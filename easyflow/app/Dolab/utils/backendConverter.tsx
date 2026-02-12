// File: app/flowchart/utils/backendConverter.tsx

import { Node, Edge, MarkerType } from "@xyflow/react";
import { stepY } from "./flowchartUtils";

// --- Constants & Maps ---
const TYPE_MAP: Record<string, string> = {
  ST: "start", START: "start", STRT: "start",
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
    return "assign"; // fallback
  }
  return TYPE_MAP[backendType.toUpperCase()] ?? "assign";
};

// ✅ ฟังก์ชันสร้าง Default Flowchart (Start -> End)
// ใช้กรณีข้อมูลว่าง หรือหา Nodes ไม่เจอ
const generateDefaultFlowchart = () => {
  console.log("🛠️ [Converter] Generating DEFAULT Start-End nodes.");
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
    style: { strokeWidth: 2 },
  };

  return {
    nodes: [startNode, endNode],
    edges: [defaultEdge],
  };
};

export const convertBackendFlowchart = (payload: any) => {
  // 🔍 DEBUG: ดู Payload ที่ได้รับ
  console.log("🔍 [Converter] Processing Payload:", payload);

  // --- 1. Robust Payload Parsing (ส่วนสำคัญที่เพิ่มใหม่) ---
  let backendNodes: any[] = [];
  let backendEdges: any[] = [];

  if (!payload) {
    console.warn("⚠️ Payload is null/undefined.");
    return generateDefaultFlowchart();
  }

  // พยายามเจาะหา nodes จากโครงสร้างต่างๆ
  if (payload.flowchart && Array.isArray(payload.flowchart.nodes)) {
    // Case 1: มาตรฐาน หรือ Create Response { flowchart: { nodes: ... } }
    console.log("🎯 [Converter] Found nodes in payload.flowchart.nodes");
    backendNodes = payload.flowchart.nodes;
    backendEdges = payload.flowchart.edges || [];
  } else if (Array.isArray(payload.nodes)) {
    // Case 2: โครงสร้างย่อ { nodes: ... }
    console.log("🎯 [Converter] Found nodes in payload.nodes");
    backendNodes = payload.nodes;
    backendEdges = payload.edges || [];
  } else if (payload.data && payload.data.flowchart && Array.isArray(payload.data.flowchart.nodes)) {
    // Case 3: Axios wrapper ซ้อน { data: { flowchart: ... } }
    console.log("🎯 [Converter] Found nodes in payload.data.flowchart.nodes");
    backendNodes = payload.data.flowchart.nodes;
    backendEdges = payload.data.flowchart.edges || [];
  } else if (Array.isArray(payload)) {
    // Case 4: ส่งมาเป็น Array ตรงๆ
    console.log("🎯 [Converter] Payload is an array of nodes");
    backendNodes = payload;
  }

  // --- 2. Empty Check ---
  if (!backendNodes || backendNodes.length === 0) {
    console.warn("⚠️ [Converter] No nodes found after parsing. Returning Default.");
    return generateDefaultFlowchart();
  }

  console.log(`✅ [Converter] Converting ${backendNodes.length} nodes...`);

  // --- Section 1: Create Maps ---
  const nodesMap = new Map<string, Node>();
  const idMap = new Map<string, string>();

  // normalize IDs consistently
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

  // --- Build outgoing/incoming maps ---
  const outgoingBySource = new Map<string, Array<{ targetId: string; condition?: string; edgeId?: string }>>();
  const addOutgoing = (s: string, t: string, condition?: string, edgeId?: string) => {
    if (!outgoingBySource.has(s)) outgoingBySource.set(s, []);
    outgoingBySource.get(s)!.push({ targetId: t, condition, edgeId });
  };

  backendEdges.forEach((be) => {
    const src = idMap.get(be.source) ?? be.source;
    const tgt = idMap.get(be.target) ?? be.target;
    addOutgoing(src, tgt, be.condition, be.id);
  });

  const incomingByTarget = new Map<string, Array<{ sourceId: string; condition?: string; edgeId?: string }>>();
  backendEdges.forEach((be) => {
    const src = idMap.get(be.source) ?? be.source;
    const tgt = idMap.get(be.target) ?? be.target;
    if (!incomingByTarget.has(tgt)) incomingByTarget.set(tgt, []);
    incomingByTarget.get(tgt)!.push({ sourceId: src, condition: be.condition, edgeId: be.id });
  });

  const adj = new Map<string, string[]>();
  nodesMap.forEach((_, id) => adj.set(id, []));
  backendEdges.forEach((e) => {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (adj.has(source)) adj.get(source)!.push(target);
  });

  // --- Constants for Layout ---
  const BREAKPOINT_INSERT_SHIFT = 30;
  const BREAKPOINT_DESCENDANT_SHIFT = 30;
  const WHILE_TRUE_X_OFFSET = 250;
  const WHILE_FALSE_Y_SHIFT = 10;
  const FOR_FALSE_Y_SHIFT = 60;
  const NODE_HEIGHT_ESTIMATE = 60;

  // --- Layout Helpers ---
  const shiftSubtreeDown = (startNodeId: string, deltaY: number) => {
    if (!deltaY || deltaY === 0) return;
    const q = [startNodeId];
    const visitedShift = new Set<string>([startNodeId]);
    while (q.length) {
      const nid = q.shift()!;
      const n = nodesMap.get(nid);
      if (n && n.position) n.position = { x: n.position.x, y: n.position.y + deltaY };
      const children = adj.get(nid) || [];
      children.forEach((c) => {
        if (!visitedShift.has(c)) {
          visitedShift.add(c);
          q.push(c);
        }
      });
    }
  };

  const getAllDescendants = (startId: string) => {
    const res: string[] = [];
    const q = [startId];
    const vis = new Set<string>([startId]);
    while (q.length) {
      const id = q.shift()!;
      const children = adj.get(id) || [];
      children.forEach((c) => {
        if (!vis.has(c)) {
          vis.add(c);
          res.push(c);
          q.push(c);
        }
      });
    }
    return res;
  };

  const shiftAllBreakpointsInBranch = (branchRootId: string, deltaY: number) => {
    const descendants = getAllDescendants(branchRootId);
    descendants.forEach((d) => {
      const dn = nodesMap.get(d);
      if (dn?.type === 'breakpoint') shiftSubtreeDown(d, deltaY);
    });
  };

  const enqueue = (queue: Array<any>, visited: Set<string>, nodeId: string, y: number, x: number) => {
    if (!visited.has(nodeId)) {
      visited.add(nodeId);
      queue.push({ nodeId, y, x });
    }
  };

  const getBranches = (nodeId: string) => {
    const outs = outgoingBySource.get(nodeId) || [];
    const node = nodesMap.get(nodeId);

    if (node?.type === 'for') {
      const loopBody = outs[0]?.targetId;
      const next = outs[1]?.targetId;
      const others = outs.slice(2).map(o => o.targetId);
      return { trueChild: loopBody, falseChild: next, others };
    }

    const trueEntry = outs.find(o => String(o.condition ?? "").toLowerCase() === "true");
    const falseEntry = outs.find(o => String(o.condition ?? "").toLowerCase() === "false");

    if (trueEntry || falseEntry) {
      const trueChild = trueEntry?.targetId;
      const falseChild = falseEntry?.targetId;
      const others = outs.filter(o => {
        const c = String(o.condition ?? "").toLowerCase();
        return c !== "true" && c !== "false";
      }).map(o => o.targetId);
      return { trueChild, falseChild, others };
    }

    if (outs.length === 2) {
      return { trueChild: outs[0].targetId, falseChild: outs[1].targetId, others: [] };
    }
    const others = outs.map(o => o.targetId);
    return { trueChild: undefined, falseChild: undefined, others };
  };

  const calculateBranchDepth = (startId: string): number => {
    let maxDepth = 0;
    const q: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    const vis = new Set<string>([startId]);
    while (q.length) {
      const { id, depth } = q.shift()!;
      maxDepth = Math.max(maxDepth, depth);
      const children = adj.get(id) || [];
      children.forEach((c) => {
        if (!vis.has(c)) {
          vis.add(c);
          q.push({ id: c, depth: depth + 1 });
        }
      });
    }
    return maxDepth;
  };

  // --- Layout Collections ---
  const breakpointsToShift = new Set<string>();
  const whileLoopsToAdjust = new Map<string, { trueChild: string; falseChild: string }>();
  const forLoopsToAdjust = new Map<string, { trueChild: string; falseChild: string }>();

  // --- Position Calculators ---
  const computeIfChildPos = (childId: string, baseX: number, baseY: number, direction: 'right' | 'left' | 'center') => {
    const childNode = nodesMap.get(childId);
    if (childNode && childNode.type === 'breakpoint') {
      breakpointsToShift.add(childId);
      const bpXOffset = direction === 'right' ? 70 : direction === 'left' ? -70 : 70;
      return { x: baseX + bpXOffset, y: baseY + stepY + 100 };
    }
    const x = direction === 'right' ? baseX + 250 : direction === 'left' ? baseX - 250 : baseX;
    const y = baseY + stepY;
    return { x, y };
  };

  const computeWhileChildPos = (childId: string, baseX: number, baseY: number, dir: 'true' | 'false' | 'center') => {
    const childNode = nodesMap.get(childId);
    if (childNode && childNode.type === 'breakpoint') {
      breakpointsToShift.add(childId);
      const bpXOffset = dir === 'true' ? 70 : dir === 'false' ? -70 : 70;
      return { x: baseX + bpXOffset, y: baseY + stepY + 30 };
    }
    if (dir === 'true') return { x: baseX + WHILE_TRUE_X_OFFSET, y: baseY + stepY };
    if (dir === 'false') return { x: baseX, y: baseY + stepY + WHILE_FALSE_Y_SHIFT };
    return { x: baseX, y: baseY + stepY };
  };

  const computeForChildPos = (childId: string, baseX: number, baseY: number, dir: 'true' | 'false' | 'center') => {
    const childNode = nodesMap.get(childId);
    if (childNode && childNode.type === 'breakpoint') {
      breakpointsToShift.add(childId);
      const bpXOffset = dir === 'true' ? 70 : dir === 'false' ? -70 : 70;
      return { x: baseX + bpXOffset, y: baseY + stepY + 30 };
    }
    if (dir === 'true') return { x: baseX + WHILE_TRUE_X_OFFSET, y: baseY + stepY };
    if (dir === 'false') return { x: baseX, y: baseY + stepY };
    return { x: baseX, y: baseY + stepY };
  };

  // --- Section 3: Layout (BFS-like) ---
  const positionedNodes = new Map<string, Node>();
  const queue: { nodeId: string; y: number; x: number }[] = [{ nodeId: "start", y: 50, x: 300 }];
  const visited = new Set<string>(["start"]);

  while (queue.length > 0) {
    const { nodeId, y, x } = queue.shift()!;
    const node = nodesMap.get(nodeId);
    if (!node) continue;

    // Merge node centering logic
    let finalX = x;
    const incoming = incomingByTarget.get(nodeId) || [];
    if (incoming.length > 1) {
      const parentNodes = incoming
        .map(inc => positionedNodes.get(inc.sourceId))
        .filter((p): p is Node => p !== undefined && p.position !== undefined);
      if (parentNodes.length > 0) {
        const sumX = parentNodes.reduce((acc, p) => acc + p.position.x, 0);
        finalX = sumX / parentNodes.length;
      }
    }

    node.position = { x: finalX, y };
    positionedNodes.set(nodeId, node);

    if (node.type === "if") {
      const { trueChild, falseChild, others } = getBranches(nodeId);
      if (trueChild) {
        const pos = computeIfChildPos(trueChild, finalX, y, 'right');
        enqueue(queue, visited, trueChild, pos.y, pos.x);
      }
      if (falseChild) {
        const pos = computeIfChildPos(falseChild, finalX, y, 'left');
        enqueue(queue, visited, falseChild, pos.y, pos.x);
      }
      let curY = y + stepY;
      others.forEach(childId => {
        const pos = computeIfChildPos(childId, finalX, y, 'center');
        enqueue(queue, visited, childId, pos.y, pos.x);
        curY += stepY;
      });
    } else if (node.type === "while") {
      const { trueChild, falseChild, others } = getBranches(nodeId);
      if (trueChild) {
        const pos = computeWhileChildPos(trueChild, finalX, y, 'true');
        enqueue(queue, visited, trueChild, pos.y, pos.x);
        if (falseChild) whileLoopsToAdjust.set(nodeId, { trueChild, falseChild });
      }
      if (falseChild) {
        const pos = computeWhileChildPos(falseChild, finalX, y, 'false');
        enqueue(queue, visited, falseChild, pos.y, pos.x);
      }
      others.forEach(childId => {
        const pos = computeWhileChildPos(childId, finalX, y, 'center');
        enqueue(queue, visited, childId, pos.y, pos.x);
      });
    } else if (node.type === "for") {
      const { trueChild, falseChild, others } = getBranches(nodeId);
      if (trueChild) {
        const pos = computeForChildPos(trueChild, finalX, y, 'true');
        enqueue(queue, visited, trueChild, pos.y, pos.x);
        if (falseChild) forLoopsToAdjust.set(nodeId, { trueChild, falseChild });
      }
      if (falseChild) {
        const pos = computeForChildPos(falseChild, finalX, y, 'false');
        enqueue(queue, visited, falseChild, pos.y, pos.x);
      }
      others.forEach(childId => {
        const pos = computeForChildPos(childId, finalX, y, 'center');
        enqueue(queue, visited, childId, pos.y, pos.x);
      });
    } else {
      let currentY = y + stepY;
      const children = adj.get(nodeId) || [];
      const childBaseX = finalX;
      children.forEach((childId) => {
        if (!visited.has(childId)) {
          const childNode = nodesMap.get(childId);
          const childY = childNode && childNode.type === 'breakpoint' ? currentY + BREAKPOINT_INSERT_SHIFT : currentY;
          if (childNode && childNode.type === 'breakpoint') breakpointsToShift.add(childId);
          enqueue(queue, visited, childId, childY, childBaseX);
          currentY += stepY;
        }
      });
    }
  }

  // --- Post layout shifts ---
  breakpointsToShift.forEach((bpId) => {
    const descendants = adj.get(bpId) || [];
    descendants.forEach((d) => shiftSubtreeDown(d, BREAKPOINT_DESCENDANT_SHIFT));
  });

  whileLoopsToAdjust.forEach(({ trueChild, falseChild }) => {
    const trueBranchDepth = calculateBranchDepth(trueChild);
    const dynamicShift = trueBranchDepth * NODE_HEIGHT_ESTIMATE + WHILE_FALSE_Y_SHIFT;
    shiftSubtreeDown(falseChild, dynamicShift);
    shiftAllBreakpointsInBranch(falseChild, 0);
  });

  forLoopsToAdjust.forEach(({ trueChild, falseChild }) => {
    const trueBranchDepth = calculateBranchDepth(trueChild);
    const dynamicShift = (trueBranchDepth * NODE_HEIGHT_ESTIMATE) + FOR_FALSE_Y_SHIFT;
    shiftSubtreeDown(falseChild, dynamicShift);
    shiftAllBreakpointsInBranch(falseChild, 0);
  });

  // --- Section 4: Convert edges and apply handles ---
  const applyEdgeHandles = (edge: Edge, srcNode?: Node, tgtNode?: Node, conditionRaw?: string) => {
    const condition = String(conditionRaw ?? "").toLowerCase();

    const setSource = (handle: string, offset = 0) => {
      (edge as any).sourceHandle = handle;
      (edge as any).pathOptions = { ...((edge as any).pathOptions || {}), offset };
    };
    const setTarget = (handle: string, opt?: any) => {
      (edge as any).targetHandle = handle;
      (edge as any).pathOptions = { ...((edge as any).pathOptions || {}), ...(opt || {}) };
    };

    const srcId = edge.source;
    const outsForSrc = outgoingBySource.get(srcId) || [];
    const outgoingEntryIndex = outsForSrc.findIndex(o => o.edgeId === edge.id);
    const outgoingEntry = outgoingEntryIndex >= 0 ? outsForSrc[outgoingEntryIndex] : undefined;

    if (srcNode) {
      switch (srcNode.type) {
        case 'if':
          if (condition === 'true') setSource('right', 30);
          else if (condition === 'false') setSource('left', 30);
          else if (outgoingEntry) {
            setSource(outgoingEntryIndex === 0 ? 'right' : 'left', outgoingEntryIndex === 0 ? 30 : 30);
          } else setSource('right', 0);
          break;
        case 'while':
          if (condition === 'true') setSource('true', 40);
          else if (condition === 'false') setSource('false', 12);
          else {
            if (tgtNode && tgtNode.position && srcNode.position) {
              if (tgtNode.position.y > srcNode.position.y + 5) setSource('false', 12);
              else setSource('true', 20);
            } else setSource('false', 12);
          }
          break;
        case 'for':
          if (condition === 'true') setSource('loop_body', 40);
          else if (condition === 'false') setSource('next', 12);
          else if (outgoingEntry) {
            setSource(outgoingEntryIndex === 0 ? 'loop_body' : 'next', outgoingEntryIndex === 0 ? 40 : 12);
          } else {
            if (tgtNode && tgtNode.position && srcNode.position) {
              if (tgtNode.position.y > srcNode.position.y + 5) setSource('next', 12);
              else setSource('loop_body', 20);
            } else setSource('next', 12);
          }
          break;
        default: break;
      }
    }

    if (tgtNode) {
      if (tgtNode.type === 'while') {
        if (condition === 'true') setTarget('loop_in', { offset: 30 });
        else if (condition === 'false') setTarget('top');
        else {
          const isBackEdge = srcNode && srcNode.position && tgtNode.position && (srcNode.position.y > tgtNode.position.y + 5);
          if (isBackEdge) setTarget('loop_in', { offset: 10 });
          else setTarget('top');
        }
      }
      if (tgtNode.type === 'for') {
        const isBackEdge = srcNode && srcNode.position && tgtNode.position && (srcNode.position.y > tgtNode.position.y + 5);
        const isLoopBodyOut = (edge as any).sourceHandle === 'loop_body';
        if (isBackEdge || isLoopBodyOut) setTarget('loop_return', { offset: 30 });
        else setTarget('top');
      }
      if (tgtNode.type === 'breakpoint') {
        if (condition === 'true') (edge as any).targetHandle = 'true';
        else if (condition === 'false') (edge as any).targetHandle = 'false';
        else {
          const incomingToSource = incomingByTarget.get(srcId) || [];
          const parentCondEntry = incomingToSource.find(ent => {
            const c = String(ent.condition ?? "").toLowerCase();
            return c === "true" || c === "false";
          });
          if (parentCondEntry && parentCondEntry.condition) {
            (edge as any).targetHandle = String(parentCondEntry.condition).toLowerCase() === 'true' ? 'true' : 'false';
          } else if (outgoingEntry && outsForSrc.length > 0) {
            (edge as any).targetHandle = outgoingEntryIndex === 0 ? 'true' : 'false';
          } else {
            (edge as any).targetHandle = 'true';
          }
        }
      }
    }
  };

  // เพิ่มสไตล์ป้ายเฉพาะเมื่อเป็น 'true' หรือ 'false' (ไม่แตะ logic อื่น ๆ)
  const LARGE_COND_LABEL_STYLE = { fontSize: 16, fontWeight: 700 };

  const convertedEdges: Edge[] = backendEdges.map((be) => {
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
      label: (condition === "auto" ? "" : condition),
      style: { strokeWidth: 2 },
      // เพิ่ม labelStyle เฉพาะกรณี condition เป็น true/false (case-insensitive)
      ...(String(condition).toLowerCase() === "true" || String(condition).toLowerCase() === "false" ? { labelStyle: LARGE_COND_LABEL_STYLE } : {}),
    } as Edge;

    const srcNode = nodesMap.get(source);
    const tgtNode = nodesMap.get(target);

    applyEdgeHandles(edge, srcNode, tgtNode, conditionRaw);

    return edge;
  });

  return { nodes: Array.from(positionedNodes.values()), edges: convertedEdges };
};
