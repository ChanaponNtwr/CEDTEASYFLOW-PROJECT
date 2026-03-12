// File: backendConverter.tsx
// Replace your existing converter with this file (only this file changed).
import { Node, Edge, MarkerType } from "@xyflow/react";
import { stepY } from "./flowchartUtils";

/**
 * Converter ปรับตำแหน่ง layout โดยโฟกัสที่การจัดตำแหน่ง breakpoint ให้ตรงแกนหลัก
 *
 * ไม่แก้ UI/logic อื่นใด — แก้เฉพาะการคำนวณตำแหน่งและ edge handle เท่านั้น
 */

// Map backend type => frontend type (ปรับตามของคุณได้)
const TYPE_MAP: Record<string, string> = {
  ST: "start", START: "start",
  EN: "end", END: "end",
  AS: "assign", ASSIGN: "assign",
  IN: "input", INPUT: "input",
  OU: "output", OUT: "output", OUTPUT: "output",
  DC: "declare", DECLARE: "declare",
  IF: "if",
  WH: "while", WHILE: "while",
  FR: "for", FOR: "for",
  BP: "breakpoint", BREAKPOINT: "breakpoint",
};

const mapBackendTypeToNodeType = (backendType?: string, label?: string) => {
  if (!backendType) {
    if (label === "Start") return "start";
    if (label === "End") return "end";
    return "assign";
  }
  return TYPE_MAP[backendType.toUpperCase()] ?? "assign";
};

const generateDefaultFlowchart = () => {
  const startNode: Node = {
    id: "start",
    type: "start",
    position: { x: 300, y: 50 },
    data: { label: "Start" },
    sourcePosition: "bottom" as any,
    targetPosition: "top" as any,
  };

  const endNode: Node = {
    id: "end",
    type: "end",
    position: { x: 300, y: 300 },
    data: { label: "End" },
    sourcePosition: "bottom" as any,
    targetPosition: "top" as any,
  };

  const defaultEdge: Edge = {
    id: "e-start-end",
    source: "start",
    target: "end",
    type: "smoothstep",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "#222", strokeWidth: 2 },
  };

  return {
    nodes: [startNode, endNode],
    edges: [defaultEdge],
  };
};

export const convertBackendFlowchart = (payload: any) => {
  console.log("[Converter] payload:", payload);

  if (!payload) return generateDefaultFlowchart();

  let backendNodes: any[] = [];
  let backendEdges: any[] = [];

  if (payload.flowchart && Array.isArray(payload.flowchart.nodes)) {
    backendNodes = payload.flowchart.nodes;
    backendEdges = payload.flowchart.edges || [];
  } else if (Array.isArray(payload.nodes)) {
    backendNodes = payload.nodes;
    backendEdges = payload.edges || [];
  } else if (payload.data && payload.data.flowchart && Array.isArray(payload.data.flowchart.nodes)) {
    backendNodes = payload.data.flowchart.nodes;
    backendEdges = payload.data.flowchart.edges || [];
  } else if (Array.isArray(payload)) {
    backendNodes = payload;
  }

  if (!backendNodes || backendNodes.length === 0) return generateDefaultFlowchart();

  // --- Prepare maps ---
  const nodesMap = new Map<string, Node>();
  const idMap = new Map<string, string>();

  const normalizeId = (origId: string, label?: string) =>
    (label === "Start" ? "start" : label === "End" ? "end" : origId).toLowerCase();

  backendNodes.forEach((n) => {
    const originalId = n.id;
    const newId = normalizeId(originalId, n.label);
    idMap.set(originalId, newId);

    const nodeType = mapBackendTypeToNodeType(n.type, n.label);
    const frontEndNode: Node = {
      id: newId,
      type: nodeType,
      data: { label: n.label, ...(n.data || {}) },
      position: n.position || { x: 0, y: 0 },
      draggable: false,
      sourcePosition: "bottom" as any,
      targetPosition: "top" as any,
    };

    nodesMap.set(newId, frontEndNode);
  });

  // Build adjacency & incoming/outgoing
  const outgoingBySource = new Map<string, Array<{ targetId: string; condition?: string; edgeId?: string }>>();
  const incomingByTarget = new Map<string, Array<{ sourceId: string; condition?: string; edgeId?: string }>>();
  const adj = new Map<string, string[]>();

  backendEdges.forEach((be) => {
    const src = idMap.get(be.source) ?? be.source;
    const tgt = idMap.get(be.target) ?? be.target;

    if (!outgoingBySource.has(src)) outgoingBySource.set(src, []);
    outgoingBySource.get(src)!.push({ targetId: tgt, condition: be.condition, edgeId: be.id });

    if (!incomingByTarget.has(tgt)) incomingByTarget.set(tgt, []);
    incomingByTarget.get(tgt)!.push({ sourceId: src, condition: be.condition, edgeId: be.id });

    if (!adj.has(src)) adj.set(src, []);
    adj.get(src)!.push(tgt);

    if (!adj.has(tgt)) adj.set(tgt, []); // ensure exists
  });

  // Layout constants
  const MAIN_X = 300;
  const START_Y = 50;
  const STEP_Y = stepY ?? 90;
  const NODE_HEIGHT_EST = 60;

  // Utility: BFS traversal to position nodes
  const positionedNodes = new Map<string, Node>();
  const visited = new Set<string>();

  // Start from start node if exists
  const startId = nodesMap.has("start") ? "start" : Array.from(nodesMap.keys())[0];
  const queue: { id: string; x: number; y: number; parentId?: string }[] = [{ id: startId, x: MAIN_X, y: START_Y }];

  // Helper: find a non-breakpoint parent (for aligning breakpoint)
  const findAlignmentXFromParents = (incoming: Array<{ sourceId: string }>) => {
    if (!incoming || incoming.length === 0) return MAIN_X;
    for (const inc of incoming) {
      const pn = positionedNodes.get(inc.sourceId);
      if (pn && pn.type !== "breakpoint" && pn.position) return pn.position.x;
    }
    // fallback: if some parent exists in nodesMap with position, use it
    for (const inc of incoming) {
      const pn = nodesMap.get(inc.sourceId);
      if (pn && pn.position) return pn.position.x;
    }
    return MAIN_X;
  };

  // BFS-style layout but deterministic: when encountering breakpoint we align to parent X
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur.id)) continue;
    visited.add(cur.id);

    const node = nodesMap.get(cur.id);
    if (!node) continue;

    // If node has incoming edges and one of them is a breakpoint, prefer breakpoint.x for alignment
    const incoming = incomingByTarget.get(cur.id) || [];

    // If node is 'breakpoint' -> align its X to the most relevant parent's X (decision/start)
    if (node.type === "breakpoint") {
      const alignX = findAlignmentXFromParents(incoming) ?? cur.x;
      node.position = { x: alignX, y: cur.y };
    } else {
      // If has incoming and any incoming parent already positioned, use that parent's X (prefer non-breakpoint)
      if (incoming.length > 0) {
        const parentXs: number[] = [];
        for (const inc of incoming) {
          const pn = positionedNodes.get(inc.sourceId);
          if (pn && pn.position) parentXs.push(pn.position.x);
        }
        if (parentXs.length > 0) {
          // prefer the first non-breakpoint parent's x; otherwise use average
          const nonBp = incoming
            .map(i => positionedNodes.get(i.sourceId))
            .find(p => p && p.type !== "breakpoint");
          node.position = { x: nonBp?.position?.x ?? (parentXs.reduce((a, b) => a + b, 0) / parentXs.length), y: cur.y };
        } else {
          node.position = { x: cur.x, y: cur.y };
        }
      } else {
        // no incoming -> use provided x
        node.position = { x: cur.x, y: cur.y };
      }
    }

    positionedNodes.set(cur.id, node);

    // enqueue children with appropriate x offsets depending on node type
    const children = adj.get(cur.id) || [];
    if (node.type === "if") {
      // determine true/false children by condition
      const outs = outgoingBySource.get(cur.id) || [];
      const trueChild = outs.find(o => String(o.condition ?? "").toLowerCase() === "true")?.targetId;
      const falseChild = outs.find(o => String(o.condition ?? "").toLowerCase() === "false")?.targetId;
      if (trueChild) {
        queue.push({ id: trueChild, x: (node.position!.x + 250), y: node.position!.y + STEP_Y, parentId: cur.id });
      }
      if (falseChild) {
        queue.push({ id: falseChild, x: (node.position!.x - 250), y: node.position!.y + STEP_Y, parentId: cur.id });
      }
      // other outs center under parent
      outs.filter(o => {
        const c = String(o.condition ?? "").toLowerCase();
        return c !== "true" && c !== "false";
      }).forEach((o, idx) => {
        queue.push({ id: o.targetId, x: node.position!.x, y: node.position!.y + STEP_Y + (idx * STEP_Y), parentId: cur.id });
      });
    } else if (node.type === "while" || node.type === "for") {
      const outs = outgoingBySource.get(cur.id) || [];
      const trueChild = outs.find(o => String(o.condition ?? "").toLowerCase() === "true")?.targetId;
      const falseChild = outs.find(o => String(o.condition ?? "").toLowerCase() === "false")?.targetId;
      if (trueChild) queue.push({ id: trueChild, x: node.position!.x + 250, y: node.position!.y + STEP_Y, parentId: cur.id });
      if (falseChild) queue.push({ id: falseChild, x: node.position!.x, y: node.position!.y + STEP_Y, parentId: cur.id });
      outs.filter(o => {
        const c = String(o.condition ?? "").toLowerCase();
        return c !== "true" && c !== "false";
      }).forEach((o, idx) => {
        queue.push({ id: o.targetId, x: node.position!.x, y: node.position!.y + STEP_Y + (idx * STEP_Y), parentId: cur.id });
      });
    } else {
      // normal sequential children -> place directly under parent (same X) with STEP_Y spacing
      let curY = node.position!.y + STEP_Y;
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          const childNode = nodesMap.get(childId);
          // if child is breakpoint -> align it to parent's X
          if (childNode && childNode.type === "breakpoint") {
            queue.push({ id: childId, x: node.position!.x, y: curY, parentId: cur.id });
          } else {
            queue.push({ id: childId, x: node.position!.x, y: curY, parentId: cur.id });
          }
          curY += STEP_Y;
        }
      });
    }
  } // end BFS

  // After positioning, ensure some merges (like End) align to breakpoint X if breakpoint exists
  positionedNodes.forEach((node, nid) => {
    if (!node.position) return;
    // If node has incoming and one incoming is a breakpoint, align this node's X to breakpoint
    const incoming = incomingByTarget.get(nid) || [];
    const bpInc = incoming.find(inc => {
      const pn = nodesMap.get(inc.sourceId) ?? positionedNodes.get(inc.sourceId);
      return pn && pn.type === "breakpoint";
    });
    if (bpInc) {
      const bpNode = positionedNodes.get(bpInc.sourceId) ?? nodesMap.get(bpInc.sourceId);
      if (bpNode && bpNode.position) node.position.x = bpNode.position.x;
    }
  });

  // --- Convert edges and set handles based on relative X positions ---
  const edges: Edge[] = backendEdges.map((be) => {
    const source = idMap.get(be.source) ?? be.source;
    const target = idMap.get(be.target) ?? be.target;
    const conditionRaw = be.condition ?? "";
    const condition = String(conditionRaw ?? "");

    const edge: Edge = {
      id: be.id ?? `e-${source}-${target}`,
      source,
      target,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: "smoothstep",
      data: { condition },
      label: condition && condition !== "auto" ? condition : undefined,
      style: { stroke: "#222", strokeWidth: 2 },
    } as Edge;

    const srcNode = positionedNodes.get(source) ?? nodesMap.get(source);
    const tgtNode = positionedNodes.get(target) ?? nodesMap.get(target);

    // handle source handle for decision nodes
    if (srcNode) {
      if (srcNode.type === "if") {
        const c = String(conditionRaw ?? "").toLowerCase();
        if (c === "true") (edge as any).sourceHandle = "right";
        else if (c === "false") (edge as any).sourceHandle = "left";
        else (edge as any).sourceHandle = "right";
      } else if (srcNode.type === "while" || srcNode.type === "for") {
        const c = String(conditionRaw ?? "").toLowerCase();
        if (c === "true") (edge as any).sourceHandle = "right";
        else if (c === "false") (edge as any).sourceHandle = "top";
        else (edge as any).sourceHandle = "right";
      }
    }

    // handle target handle especially for breakpoint merging
    if (tgtNode && tgtNode.position && srcNode && srcNode.position) {
      const srcX = srcNode.position.x;
      const tgtX = tgtNode.position.x;
      const diff = srcX - tgtX;
      const TH = 40;
      if (tgtNode.type === "breakpoint") {
        if (Math.abs(diff) <= TH) {
          (edge as any).targetHandle = "top";
        } else if (diff < 0) {
          // source is left of breakpoint -> target handle left so path goes right then down
          (edge as any).targetHandle = "left";
        } else {
          (edge as any).targetHandle = "right";
        }
        // also adjust source handle so edge looks horizontal then vertical
        if (!((edge as any).sourceHandle)) {
          (edge as any).sourceHandle = srcX < tgtX ? "right" : srcX > tgtX ? "left" : "bottom";
        }
      } else {
        // normal: top target
        (edge as any).targetHandle = "top";
      }
    } else {
      // fallback
      (edge as any).targetHandle = "top";
    }

    return edge;
  });

  // Return nodes (as array) and edges
  const nodes = Array.from(positionedNodes.values());
  // Ensure fallback: if no start/end in positionedNodes, include from nodesMap
  if (!nodes.some(n => n.id === "start") && nodesMap.has("start")) nodes.push(nodesMap.get("start")!);
  if (!nodes.some(n => n.id === "end") && nodesMap.has("end")) nodes.push(nodesMap.get("end")!);

  return { nodes, edges };
};