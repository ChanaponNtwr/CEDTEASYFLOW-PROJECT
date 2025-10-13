import { Node, Edge, MarkerType } from "@xyflow/react";
import { stepY } from "./flowchartUtils";

// Simplified mapping from backend type to frontend node type
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

export const convertBackendFlowchart = (payload: any) => {
  const backendFlowchart = payload.flowchart;
  if (!backendFlowchart || !backendFlowchart.nodes || !backendFlowchart.edges) {
    console.error("Invalid flowchart structure from backend:", payload);
    return { nodes: [], edges: [] };
  }

  const backendNodes = backendFlowchart.nodes as any[];
  const backendEdges = backendFlowchart.edges as any[];

  // --- Section 1: create maps ---
  const nodesMap = new Map<string, Node>();
  const idMap = new Map<string, string>();

  const normalizeId = (origId: string, label?: string) => (label === "Start" ? "start" : label === "End" ? "end" : origId).toLowerCase();

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
      sourcePosition: "bottom",
      targetPosition: "top",
    };

    nodesMap.set(newId, frontEndNode);
  });

  // --- Build outgoing map that keeps condition info ---
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

  // --- adjacency list ---
  const adj = new Map<string, string[]>();
  nodesMap.forEach((_, id) => adj.set(id, []));
  backendEdges.forEach((e) => {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (adj.has(source)) adj.get(source)!.push(target);
  });

  // --- constants ---
  const BREAKPOINT_CHILD_SHIFT = 73;
  const BREAKPOINT_INSERT_SHIFT = 30;
  const BREAKPOINT_DESCENDANT_SHIFT = 30;
  const WHILE_TRUE_X_OFFSET = 250;
  const WHILE_FALSE_Y_SHIFT = 10; // base shift for while
  const FOR_FALSE_Y_SHIFT = 60; // base shift for for loop (ยาวกว่า while มาก)
  const NODE_HEIGHT_ESTIMATE = 60; // ความสูงโดยประมาณของแต่ละ node

  // --- helpers ---
  const shiftSubtreeDown = (startNodeId: string, deltaY: number) => {
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

  // return all descendants (deep) of a node
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

  // --- Updated getBranches ---
  const getBranches = (nodeId: string) => {
    const outs = outgoingBySource.get(nodeId) || [];

    // สำหรับ for loop: ใช้ edge ID หรือลำดับแทน condition
    const node = nodesMap.get(nodeId);
    if (node?.type === 'for') {
      // edge แรกน่าจะเป็น loop body (true), edge ที่สองน่าจะเป็น next (false)
      const loopBody = outs[0]?.targetId;
      const next = outs[1]?.targetId;
      const others = outs.slice(2).map(o => o.targetId);

      console.log(`🔍 For loop branches: loopBody=${loopBody}, next=${next}`);
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

    // fallback: if there are exactly two outs use first as true, second as false
    if (outs.length === 2) {
      return { trueChild: outs[0].targetId, falseChild: outs[1].targetId, others: [] };
    }

    // generic: no explicit true/false
    const others = outs.map(o => o.targetId);
    return { trueChild: undefined, falseChild: undefined, others };
  };

  // *** ฟังก์ชันคำนวณความสูงของ branch (ลึกสุด) ***
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

  // --- we'll collect breakpoints to shift during layout ---
  const breakpointsToShift = new Set<string>();

  // *** เก็บข้อมูล while loops และ for loops ที่ต้องปรับ false branch ***
  const whileLoopsToAdjust = new Map<string, { trueChild: string; falseChild: string }>();
  const forLoopsToAdjust = new Map<string, { trueChild: string; falseChild: string }>();

  // compute child position helpers for IF-like and WHILE-like nodes
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
    // สำหรับ false branch ให้ใช้ตำแหน่งเริ่มต้นเหมือนเดิม จะมา adjust ทีหลัง
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

    node.position = { x, y };
    positionedNodes.set(nodeId, node);

    if (node.type === "if") {
      const { trueChild, falseChild, others } = getBranches(nodeId);

      if (trueChild) {
        const pos = computeIfChildPos(trueChild, x, y, 'right');
        enqueue(queue, visited, trueChild, pos.y, pos.x);
        shiftAllBreakpointsInBranch(trueChild, 100);
      }

      if (falseChild) {
        const pos = computeIfChildPos(falseChild, x, y, 'left');
        enqueue(queue, visited, falseChild, pos.y, pos.x);
        shiftAllBreakpointsInBranch(falseChild, 100);
      }

      let curY = y + stepY;
      others.forEach(childId => {
        const pos = computeIfChildPos(childId, x, y, 'center');
        enqueue(queue, visited, childId, pos.y, pos.x);
        curY += stepY;
      });

    } else if (node.type === "while") {
      const { trueChild, falseChild, others } = getBranches(nodeId);

      if (trueChild) {
        const pos = computeWhileChildPos(trueChild, x, y, 'true');
        enqueue(queue, visited, trueChild, pos.y, pos.x);

        // *** เก็บข้อมูลไว้เพื่อปรับ false branch ทีหลัง ***
        if (falseChild) {
          whileLoopsToAdjust.set(nodeId, { trueChild, falseChild });
        }
      }

      if (falseChild) {
        const pos = computeWhileChildPos(falseChild, x, y, 'false');
        enqueue(queue, visited, falseChild, pos.y, pos.x);
      }

      others.forEach(childId => {
        const pos = computeWhileChildPos(childId, x, y, 'center');
        enqueue(queue, visited, childId, pos.y, pos.x);
      });

    } else if (node.type === "for") {
      const { trueChild, falseChild, others } = getBranches(nodeId);

      console.log(`🔍 For loop ${nodeId}: trueChild=${trueChild}, falseChild=${falseChild}, others=${others}`);

      if (trueChild) {
        const pos = computeForChildPos(trueChild, x, y, 'true');
        enqueue(queue, visited, trueChild, pos.y, pos.x);

        // *** เก็บข้อมูลไว้เพื่อปรับ false branch ของ for loop ***
        if (falseChild) {
          console.log(`✅ Adding for loop ${nodeId} to adjust list`);
          forLoopsToAdjust.set(nodeId, { trueChild, falseChild });
        }
      }

      if (falseChild) {
        const pos = computeForChildPos(falseChild, x, y, 'false');
        console.log(`📍 False branch ${falseChild} initial position: y=${pos.y}`);
        enqueue(queue, visited, falseChild, pos.y, pos.x);
      }

      others.forEach(childId => {
        const pos = computeForChildPos(childId, x, y, 'center');
        enqueue(queue, visited, childId, pos.y, pos.x);
      });

    } else {
      let currentY = y + stepY;
      const children = adj.get(nodeId) || [];
      const childBaseX = node.type === 'breakpoint' ? x - BREAKPOINT_CHILD_SHIFT : x;

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

  // --- Post shifts ---
  breakpointsToShift.forEach((bpId) => {
    const descendants = adj.get(bpId) || [];
    descendants.forEach((d) => shiftSubtreeDown(d, BREAKPOINT_DESCENDANT_SHIFT));
  });

  // *** ปรับ false branch ของ while loop ตามความลึกของ true branch ***
  whileLoopsToAdjust.forEach(({ trueChild, falseChild }) => {
    const trueBranchDepth = calculateBranchDepth(trueChild);
    const dynamicShift = trueBranchDepth * NODE_HEIGHT_ESTIMATE + WHILE_FALSE_Y_SHIFT;

    console.log(`🔄 While loop adjustment: true branch depth=${trueBranchDepth}, shift=${dynamicShift}px`);

    shiftSubtreeDown(falseChild, dynamicShift);
    shiftAllBreakpointsInBranch(falseChild, 0);
  });

  // *** ปรับ false branch ของ for loop ตามความลึกของ true branch ***
  console.log(`📊 For loops to adjust: ${forLoopsToAdjust.size}`);
  forLoopsToAdjust.forEach(({ trueChild, falseChild }, forNodeId) => {
    const trueBranchDepth = calculateBranchDepth(trueChild);
    // ใช้ FOR_FALSE_Y_SHIFT เป็น base แล้วบวกกับความลึกของ true branch
    const dynamicShift = (trueBranchDepth * NODE_HEIGHT_ESTIMATE) + FOR_FALSE_Y_SHIFT;

    console.log(`🔄 For loop ${forNodeId} adjustment: true branch depth=${trueBranchDepth}, shift=${dynamicShift}px, falseChild=${falseChild}`);

    const falseNode = nodesMap.get(falseChild);
    console.log(`   Before shift: ${falseChild} position y=${falseNode?.position?.y}`);

    shiftSubtreeDown(falseChild, dynamicShift);

    console.log(`   After shift: ${falseChild} position y=${falseNode?.position?.y}`);
    shiftAllBreakpointsInBranch(falseChild, 0);
  });

  const finalNodesArray = Array.from(nodesMap.values());
  finalNodesArray.forEach(n => { if (n && n.id) positionedNodes.set(n.id, n); });

  // --- Section 4: Convert edges ---
  // --- Updated applyEdgeHandles (FOR-only changes; WHILE logic left as original) ---
  const applyEdgeHandles = (edge: Edge, srcNode?: Node, tgtNode?: Node, conditionRaw?: string) => {
    const condition = String(conditionRaw ?? "").toLowerCase();

    const setSource = (handle: string, offset = 0) => { (edge as any).sourceHandle = handle; edge.pathOptions = { ...(edge.pathOptions || {}), offset }; };
    const setTarget = (handle: string, opt?: any) => { (edge as any).targetHandle = handle; edge.pathOptions = { ...(edge.pathOptions || {}), ...(opt || {}) }; };

    // Helper: try to find the original outgoing entry for this edge (by edge.id)
    const srcId = edge.source;
    const outsForSrc = outgoingBySource.get(srcId) || [];
    const outgoingEntry = outsForSrc.find(o => o.edgeId === edge.id);

    if (srcNode) {
      switch (srcNode.type) {
        case 'if':
          if (condition === 'true') setSource('right', 30);
          else if (condition === 'false') setSource('left', 30);
          else setSource('right', 0);
          break;

        case 'while':
          // Restored original WHILE behavior (no reliance on outgoingEntry)
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
          // FOR: prefer to use outgoing entry index / edgeId when available
          if (condition === 'true') setSource('loop_body', 40);
          else if (condition === 'false') setSource('next', 12);
          else if (outgoingEntry && outsForSrc.length > 0) {
            const idx = outsForSrc.indexOf(outgoingEntry);
            // treat index 0 as loop_body, index 1 as next
            setSource(idx === 0 ? 'loop_body' : 'next', idx === 0 ? 40 : 12);
          } else {
            if (tgtNode && tgtNode.position && srcNode.position) {
              if (tgtNode.position.y > srcNode.position.y + 5) setSource('next', 12);
              else setSource('loop_body', 20);
            } else setSource('next', 12);
          }
          break;

        default:
          break;
      }
    }

    if (tgtNode) {
      if (tgtNode.type === 'while') {
        // Restored original WHILE target logic
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

        // 1. ถ้าเป็นการวนซ้ำ (BackEdge) หรือมาจาก Body ของ Loop: ใช้ loop_return
        if (isBackEdge || isLoopBodyOut) {
          setTarget('loop_return', { offset: 30 }); // ใช้ offset 60 เพื่อให้เส้นดูห่าง
        }
        // 2. ถ้ามาจากโหนดด้านบน (ไม่ใช่ BackEdge) หรือเป็นเส้นเข้าปกติ: ใช้ top
        else {
          setTarget('top');
        }
      }

      if (tgtNode.type === 'breakpoint') {
        if (condition === 'true') (edge as any).targetHandle = 'true';
        else if (condition === 'false') (edge as any).targetHandle = 'false';
        else if (outgoingEntry && outsForSrc.length > 0) {
          const idx = outsForSrc.indexOf(outgoingEntry);
          (edge as any).targetHandle = idx === 0 ? 'true' : 'false';
        }
      }
    }
  };

  const convertedEdges: Edge[] = backendEdges.map((be) => {
    const source = idMap.get(be.source) ?? be.source;
    const target = idMap.get(be.target) ?? be.target;
    const condition = be.condition ?? "";

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
    } as Edge;

    const srcNode = nodesMap.get(source);
    const tgtNode = nodesMap.get(target);

    applyEdgeHandles(edge, srcNode, tgtNode, condition);

    return edge;
  });

  return { nodes: Array.from(positionedNodes.values()), edges: convertedEdges };
};
