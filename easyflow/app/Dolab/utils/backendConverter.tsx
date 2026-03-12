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

// Default Start-End if nothing
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
    type: "step",
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { strokeWidth: 2 },
  };

  return {
    nodes: [startNode, endNode],
    edges: [defaultEdge],
  };
};

export const convertBackendFlowchart = (payload: any) => {
  console.log("🔍 [Converter] Processing Payload:", payload);

  let backendNodes: any[] = [];
  let backendEdges: any[] = [];

  if (!payload) return generateDefaultFlowchart();

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

  console.log(`✅ [Converter] Converting ${backendNodes.length} nodes...`);

  // --- maps & normalize ---
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

  // outgoing/incoming/adj
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

  // --- layout constants (tweakable) ---
  const BREAKPOINT_INSERT_SHIFT = 18;
  const BREAKPOINT_DESCENDANT_SHIFT = 18;
  const WHILE_TRUE_X_OFFSET = 220;
  const WHILE_FALSE_Y_SHIFT = 18;
  const FOR_FALSE_Y_SHIFT = 48;
  const NODE_HEIGHT_ESTIMATE = 60;

  // Helpers
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

  // --- New: proposed positions + propagation queue ---
  const positionedNodes = new Map<string, Node>();
  const proposed = new Map<string, { x: number; y: number }>();
  const queue: string[] = [];

  const propose = (nodeId: string, y: number, x: number) => {
    const prev = proposed.get(nodeId);
    if (!prev || prev.x !== x || prev.y !== y) {
      proposed.set(nodeId, { x, y });
      queue.push(nodeId);
    }
  };

  // Position calculators (breakpoint gets baseX to align vertically)
  const computeIfChildPos = (childId: string, baseX: number, baseY: number, direction: 'right' | 'left' | 'center') => {
    const childNode = nodesMap.get(childId);
    if (childNode && childNode.type === 'breakpoint') {
      // Align breakpoint X with parent to keep vertical connector
      return { x: baseX, y: baseY + stepY + BREAKPOINT_INSERT_SHIFT };
    }
    const x = direction === 'right' ? baseX + 250 : direction === 'left' ? baseX - 250 : baseX;
    const y = baseY + stepY;
    return { x, y };
  };

  const computeWhileChildPos = (childId: string, baseX: number, baseY: number, dir: 'true' | 'false' | 'center') => {
    const childNode = nodesMap.get(childId);
    if (childNode && childNode.type === 'breakpoint') {
      return { x: baseX, y: baseY + stepY + BREAKPOINT_INSERT_SHIFT };
    }
    if (dir === 'true') return { x: baseX + WHILE_TRUE_X_OFFSET, y: baseY + stepY };
    if (dir === 'false') return { x: baseX, y: baseY + stepY + WHILE_FALSE_Y_SHIFT };
    return { x: baseX, y: baseY + stepY };
  };

  const computeForChildPos = (childId: string, baseX: number, baseY: number, dir: 'true' | 'false' | 'center') => {
    const childNode = nodesMap.get(childId);
    if (childNode && childNode.type === 'breakpoint') {
      return { x: baseX, y: baseY + stepY + BREAKPOINT_INSERT_SHIFT };
    }
    if (dir === 'true') return { x: baseX + WHILE_TRUE_X_OFFSET, y: baseY + stepY };
    if (dir === 'false') return { x: baseX, y: baseY + stepY };
    return { x: baseX, y: baseY + stepY };
  };

  // seed queue with start
  propose("start", 50, 300);

  // process queue: use proposed positions to set final positions and propagate to children
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const proposal = proposed.get(nodeId);
    if (!proposal) continue;

    const { x: proposedX, y: proposedY } = proposal;
    const node = nodesMap.get(nodeId);
    if (!node) continue;

    // center logic: average positions of already-positioned parents (if any)
    const incoming = incomingByTarget.get(nodeId) || [];
    let finalX = proposedX;
    if (incoming.length > 0) {
      const parentNodes = incoming
        .map(inc => positionedNodes.get(inc.sourceId))
        .filter((p): p is Node => p !== undefined && p.position !== undefined);
      if (parentNodes.length > 0) {
        const sumX = parentNodes.reduce((acc, p) => acc + p.position.x, 0);
        finalX = sumX / parentNodes.length;
      } else {
        // fallback: if parents exist but not yet positioned, derive from first parent's last-known position in nodesMap
        const firstParent = incoming[0]?.sourceId;
        const parentNode = firstParent ? nodesMap.get(firstParent) : undefined;
        if (parentNode && parentNode.position) finalX = parentNode.position.x;
      }
    }

    node.position = { x: finalX, y: proposedY };
    positionedNodes.set(nodeId, node);

    // propagate to children depending on type
    if (node.type === "if") {
      const { trueChild, falseChild, others } = getBranches(nodeId);
      if (trueChild) {
        const pos = computeIfChildPos(trueChild, finalX, proposedY, 'right');
        propose(trueChild, pos.y, pos.x);
      }
      if (falseChild) {
        const pos = computeIfChildPos(falseChild, finalX, proposedY, 'left');
        propose(falseChild, pos.y, pos.x);
      }
      others.forEach(childId => {
        const pos = computeIfChildPos(childId, finalX, proposedY, 'center');
        propose(childId, pos.y, pos.x);
      });
    } else if (node.type === "while") {
      const { trueChild, falseChild, others } = getBranches(nodeId);
      if (trueChild) {
        const pos = computeWhileChildPos(trueChild, finalX, proposedY, 'true');
        propose(trueChild, pos.y, pos.x);
      }
      if (falseChild) {
        const pos = computeWhileChildPos(falseChild, finalX, proposedY, 'false');
        propose(falseChild, pos.y, pos.x);
      }
      others.forEach(childId => {
        const pos = computeWhileChildPos(childId, finalX, proposedY, 'center');
        propose(childId, pos.y, pos.x);
      });
    } else if (node.type === "for") {
      const { trueChild, falseChild, others } = getBranches(nodeId);
      if (trueChild) {
        const pos = computeForChildPos(trueChild, finalX, proposedY, 'true');
        propose(trueChild, pos.y, pos.x);
      }
      if (falseChild) {
        const pos = computeForChildPos(falseChild, finalX, proposedY, 'false');
        propose(falseChild, pos.y, pos.x);
      }
      others.forEach(childId => {
        const pos = computeForChildPos(childId, finalX, proposedY, 'center');
        propose(childId, pos.y, pos.x);
      });
    } else {
      // linear children
      let currentY = proposedY + stepY;
      const children = adj.get(nodeId) || [];
      children.forEach((childId) => {
        const childNode = nodesMap.get(childId);
        const childY = childNode && childNode.type === 'breakpoint' ? currentY + BREAKPOINT_INSERT_SHIFT : currentY;
        propose(childId, childY, finalX); // use parent's finalX so child aligns unless it's a branch-populated offset
        currentY += stepY;
      });
    }
  }

  // After propagation: adjust breakpoint descendants and loop false branches
  const breakpointsToShift = new Set<string>();
  nodesMap.forEach((n, id) => {
    if (n.type === 'breakpoint') breakpointsToShift.add(id);
  });

  breakpointsToShift.forEach((bpId) => {
    const descendants = adj.get(bpId) || [];
    descendants.forEach((d) => shiftSubtreeDown(d, BREAKPOINT_DESCENDANT_SHIFT));
  });

  // adjust while/for false branch based on depth (recompute by scanning outgoingBySource)
  const whileLoopsToAdjust = new Map<string, { trueChild: string; falseChild: string }>();
  const forLoopsToAdjust = new Map<string, { trueChild: string; falseChild: string }>();

  nodesMap.forEach((n, id) => {
    if (n.type === 'while' || n.type === 'for') {
      const { trueChild, falseChild } = getBranches(id);
      if (trueChild && falseChild) {
        if (n.type === 'while') whileLoopsToAdjust.set(id, { trueChild: trueChild!, falseChild: falseChild! });
        if (n.type === 'for') forLoopsToAdjust.set(id, { trueChild: trueChild!, falseChild: falseChild! });
      }
    }
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

  // --- convert edges and apply handles (use step edges so elbows are straight) ---
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
          else if (outgoingEntry) setSource(outgoingEntryIndex === 0 ? 'right' : 'left', 30);
          else setSource('right', 0);
          break;
        case 'while':
          if (condition === 'true') setSource('true', 40);
          else if (condition === 'false') setSource('false', 12);
          else setSource('false', 12);
          break;
        case 'for':
          if (condition === 'true') setSource('loop_body', 40);
          else if (condition === 'false') setSource('next', 12);
          else setSource('next', 12);
          break;
        default: break;
      }
    }

    if (tgtNode) {
      // for while/for we keep some special handling
      if (tgtNode.type === 'while') {
        if (condition === 'true') setTarget('loop_in', { offset: 30 });
        else if (condition === 'false') setTarget('top');
        else setTarget('top');
      } else if (tgtNode.type === 'for') {
        const isBackEdge = srcNode && srcNode.position && tgtNode.position && (srcNode.position.y > tgtNode.position.y + 5);
        const isLoopBodyOut = (edge as any).sourceHandle === 'loop_body';
        if (isBackEdge || isLoopBodyOut) setTarget('loop_return', { offset: 30 });
        else setTarget('top');
      } else if (tgtNode.type === 'breakpoint') {
        // connect breakpoints to top center to keep vertical lines
        setTarget('top');
      } else {
        setTarget('top');
      }
    }
  };

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
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: "step", // use step (elbow) so connectors are straight elbows (not curved)
      data: { condition },
      label: (condition === "auto" ? "" : condition),
      style: { strokeWidth: 2 },
      ...(String(condition).toLowerCase() === "true" || String(condition).toLowerCase() === "false" ? { labelStyle: LARGE_COND_LABEL_STYLE } : {}),
    } as Edge;

    const srcNode = nodesMap.get(source);
    const tgtNode = nodesMap.get(target);

    applyEdgeHandles(edge, srcNode, tgtNode, conditionRaw);

    return edge;
  });

  return { nodes: Array.from(positionedNodes.values()), edges: convertedEdges };
};