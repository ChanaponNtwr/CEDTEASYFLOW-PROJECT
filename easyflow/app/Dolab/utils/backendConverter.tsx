import { Node, Edge, MarkerType } from "@xyflow/react";
import { createArrowEdge, stepY } from "./flowchartUtils";

/**
 * แปลงรหัส type ที่ backend ส่งมา (หลายรูปแบบ เช่น ST, EN, AS, IN, OU, DC, IF, WH, FR, BP)
 * ให้เป็น node.type ที่ React Flow / UI คาดหวัง (เช่น 'start','end','assign','input','output','declare','if','while','for','breakpoint')
 */
const mapBackendTypeToNodeType = (backendType?: string, label?: string) => {
  if (!backendType) {
    if (label === "Start") return "start";
    if (label === "End") return "end";
    return "assign"; // fallback
  }

  switch ((backendType || "").toUpperCase()) {
    case "ST": case "START": case "STRT": return "start";
    case "EN": case "END": return "end";
    case "AS": case "ASSIGN": return "assign";
    case "IN": case "INPUT": return "input";
    case "OU": case "OUT": case "OUTPUT": return "output";
    case "DC": case "DECLARE": return "declare";
    case "IF": return "if";
    case "WH": case "WHILE": return "while";
    case "FR": case "FOR": return "for";
    case "BP": case "BREAKPOINT": return "breakpoint";
    default: return "assign"; // fallback for unknown types
  }
};

export const convertBackendFlowchart = (payload: any) => {
  const backendFlowchart = payload.flowchart;
  if (!backendFlowchart || !backendFlowchart.nodes || !backendFlowchart.edges) {
    console.error("Invalid flowchart structure from backend:", payload);
    return { nodes: [], edges: [] };
  }

  const backendNodes = backendFlowchart.nodes;
  const backendEdges = backendFlowchart.edges;

  // --- Section 1: สร้าง Node Map และจัดการ ID ---
  const nodesMap = new Map<string, Node>();
  const idMap = new Map<string, string>();

  backendNodes.forEach((n: any) => {
    const originalId = n.id;
    const newId = (n.label === "Start" ? "start" : n.label === "End" ? "end" : originalId).toLowerCase();
    idMap.set(originalId, newId);

    const nodeType = mapBackendTypeToNodeType(n.type, n.label);
    const frontEndNode: Node = {
      id: newId,
      type: nodeType,
      data: { label: n.label, ...n.data },
      position: n.position || { x: 0, y: 0 },
      draggable: false,
      sourcePosition: "bottom",
      targetPosition: "top",
    };
    nodesMap.set(newId, frontEndNode);
  });

  // --- Build outgoing map that keeps condition info (important for if-branches) ---
  const outgoingBySource = new Map<string, Array<{ targetId: string; condition?: string; edgeId?: string }>>();
  backendEdges.forEach((be: any) => {
    const src = idMap.get(be.source) ?? be.source;
    const tgt = idMap.get(be.target) ?? be.target;
    if (!outgoingBySource.has(src)) outgoingBySource.set(src, []);
    outgoingBySource.get(src)!.push({ targetId: tgt, condition: be.condition, edgeId: be.id });
  });

  // --- Section 2: สร้าง Adjacency List (สำหรับ traversal แบบทั่วไป) ---
  const adj = new Map<string, string[]>();
  nodesMap.forEach((_, id) => adj.set(id, []));

  backendEdges.forEach((e: any) => {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (adj.has(source)) {
      adj.get(source)!.push(target);
    }
  });

  // --- Section 3: NEW LAYOUT LOGIC - BFS แต่ใช้ condition สำหรับ if ---
  const positionedNodes = new Map<string, Node>();
  const queue: { nodeId: string; y: number; x: number }[] = [{ nodeId: "start", y: 50, x: 300 }];
  const visited = new Set<string>(["start"]);
  let maxY = 50;

  // คุณสามารถปรับค่านี้ได้ถ้าต้องการให้ shift มาก/น้อยขึ้น
  const BREAKPOINT_CHILD_SHIFT = 73; // shift left for nodes after a breakpoint

  while (queue.length > 0) {
    const { nodeId, y, x } = queue.shift()!;
    const node = nodesMap.get(nodeId);
    if (!node) continue;

    node.position = { x, y };
    positionedNodes.set(nodeId, node);
    maxY = Math.max(maxY, y);

    // For if-nodes: try to place True -> right, False -> left based on conditions
    if (node.type === "if") {
      const outs = outgoingBySource.get(nodeId) || [];
      // find by condition (case-insensitive)
      const trueChild = outs.find(o => String(o.condition ?? "").toLowerCase() === "true")?.targetId;
      const falseChild = outs.find(o => String(o.condition ?? "").toLowerCase() === "false")?.targetId;
      const others = outs.filter(o => {
        const c = String(o.condition ?? "").toLowerCase();
        return c !== "true" && c !== "false";
      }).map(o => o.targetId);

      // helper to compute x for a child; always push breakpoint slightly to the right
      const computeChildX = (childId: string, baseX: number, direction: 'right' | 'left' | 'center') => {
        const childNode = nodesMap.get(childId);
        // if child itself is a breakpoint, nudge it to the right of the if (mimic earlier UI behaviour)
        if (childNode && childNode.type === 'breakpoint') {
          return baseX + 70; // breakpoint sits to the right
        }
        if (direction === 'right') return baseX + 250;
        if (direction === 'left') return baseX - 250;
        return baseX;
      };

      if (trueChild && !visited.has(trueChild)) {
        visited.add(trueChild);
        queue.push({ nodeId: trueChild, y: y + stepY, x: computeChildX(trueChild, x, 'right') });
      }
      if (falseChild && !visited.has(falseChild)) {
        visited.add(falseChild);
        queue.push({ nodeId: falseChild, y: y + stepY, x: computeChildX(falseChild, x, 'left') });
      }
      // any other children (fallback) placed vertically below
      let currentY = y + stepY;
      others.forEach((childId) => {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push({ nodeId: childId, y: currentY, x: computeChildX(childId, x, 'center') });
          currentY += stepY;
        }
      });
    } else {
      // normal linear placement
      let currentY = y + stepY;
      const children = adj.get(nodeId) || [];

      // ถ้า parent เป็น breakpoint ให้เลื่อนลูกลงมาทางซ้ายเล็กน้อย
      const childBaseX = node.type === 'breakpoint' ? x - BREAKPOINT_CHILD_SHIFT : x;

      children.forEach((childId) => {
        if (!visited.has(childId)) {
          visited.add(childId);
          queue.push({ nodeId: childId, y: currentY, x: childBaseX });
          currentY += stepY;
        }
      });
    }
  }

  // --- Section 4: แปลง Edges — ให้ true-loop กลับเข้า loop_in/loop_return; false -> next (arrow visible) ---
  const finalNodesArray = Array.from(positionedNodes.values());
  const convertedEdges: Edge[] = backendEdges.map((be: any) => {
    const source = idMap.get(be.source) ?? be.source;
    const target = idMap.get(be.target) ?? be.target;
    const condition = be.condition ?? "";

    const edge: Edge = {
      id: be.id ?? `e-${source}-${target}`,
      source,
      target,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed }, // ยืนยันหัวลูกศร
      type: "smoothstep",
      data: { condition },
      label: (condition === "auto" ? "" : condition),
      style: { strokeWidth: 2 }, // ทำให้ arrowhead ชัด
    } as Edge;

    const srcNode = nodesMap.get(source);
    const tgtNode = nodesMap.get(target);
    const condLower = String(condition).toLowerCase();

    // IF nodes: พฤติกรรมเดิม (right/left)
    if (srcNode && srcNode.type === "if") {
      if (condLower === "true") {
        (edge as any).sourceHandle = "right";
        edge.pathOptions = { offset: 30 };
      } else if (condLower === "false") {
        (edge as any).sourceHandle = "left";
        edge.pathOptions = { offset: 30 };
      } else {
        (edge as any).sourceHandle = "right";
        edge.pathOptions = { offset: 0 };
      }
    }

    // WHILE - outgoing: true -> body (sourceHandle = "true"), false -> next (sourceHandle = "false")
    if (srcNode && srcNode.type === "while") {
      if (condLower === "true") {
        (edge as any).sourceHandle = "true";
        edge.pathOptions = { offset: 40 };
      } else if (condLower === "false") {
        (edge as any).sourceHandle = "false";
        // เลือก offset เล็ก ๆ เพื่อไม่ให้ปลายชน node
        edge.pathOptions = { offset: 12 };
      } else {
        // heuristic: ถ้า target อยู่ต่ำกว่า ให้ถือเป็น false (next) มิฉะนั้น true
        if (tgtNode && srcNode && tgtNode.position && srcNode.position) {
          if (tgtNode.position.y > srcNode.position.y + 5) {
            (edge as any).sourceHandle = "false";
            edge.pathOptions = { offset: 12 };
          } else {
            (edge as any).sourceHandle = "true";
            edge.pathOptions = { offset: 20 };
          }
        } else {
          (edge as any).sourceHandle = "false";
          edge.pathOptions = { offset: 12 };
        }
      }
    }

    // FOR - outgoing: true -> loop_body (sourceHandle = "loop_body"), false -> next (sourceHandle = "next")
    // NOTE: we intentionally keep "next" as a source handle but treat "next" as a looping/back-edge
    // when it heads back into a FOR node (so it connects to loop_return).
    if (srcNode && srcNode.type === "for") {
      if (condLower === "true") {
        (edge as any).sourceHandle = "loop_body";
        edge.pathOptions = { offset: 40 };
      } else if (condLower === "false") {
        (edge as any).sourceHandle = "next";
        edge.pathOptions = { offset: 12 };
      } else {
        // heuristic: ถ้า target อยู่ต่ำกว่า ให้ถือเป็น next มิฉะนั้น loop_body
        if (tgtNode && srcNode && tgtNode.position && srcNode.position) {
          if (tgtNode.position.y > srcNode.position.y + 5) {
            (edge as any).sourceHandle = "next";
            edge.pathOptions = { offset: 12 };
          } else {
            (edge as any).sourceHandle = "loop_body";
            edge.pathOptions = { offset: 20 };
          }
        } else {
          (edge as any).sourceHandle = "next";
          edge.pathOptions = { offset: 12 };
        }
      }
    }

    // ถ้า edge นี้เข้าไปหา while และ condition === "true" -> ให้ targetHandle = "loop_in"
    // (ตรงกับ <Handle id="loop_in" /> ใน WhileNodeComponent)
    if (tgtNode && tgtNode.type === "while") {
      if (condLower === "true") {
        (edge as any).targetHandle = "loop_in";
        edge.pathOptions = { ...(edge.pathOptions || {}), offset: 30 };
      } else if (condLower === "false") {
        (edge as any).targetHandle = "top";
      } else {
        // fallback: ถ้ามาจาก node ที่อยู่ด้านล่างของ while ให้ถือเป็น back-edge -> loop_in
        const isBackEdge = srcNode && srcNode.position && tgtNode.position && (srcNode.position.y > tgtNode.position.y + 5);
        if (isBackEdge) {
          (edge as any).targetHandle = "loop_in";
          edge.pathOptions = { ...(edge.pathOptions || {}), offset: 60 };
        } else {
          (edge as any).targetHandle = "top";
        }
      }
    }

    // ถ้า edge นี้เข้าไปหา for -> ให้ targetHandle = "loop_return" เมื่อ:
    // - condition === "true" (เดิม)
    // - หรือ sourceHandle ที่เรตั้งไว้เป็น "loop_body" หรือ "next" (ตามที่ขอ ให้ next เป็น back-edge)
    if (tgtNode && tgtNode.type === "for") {
      const srcHandle = (edge as any).sourceHandle;
      if (condLower === "true" || srcHandle === "loop_body" || srcHandle === "next") {
        (edge as any).targetHandle = "loop_return";
        edge.pathOptions = { ...(edge.pathOptions || {}), offset: 30 };
      } else if (condLower === "false") {
        (edge as any).targetHandle = "top";
      } else {
        // fallback: ถ้ามาจาก node ที่อยู่ด้านล่างของ for ให้ถือเป็น back-edge -> loop_return
        const isBackEdge = srcNode && srcNode.position && tgtNode.position && (srcNode.position.y > tgtNode.position.y + 5);
        if (isBackEdge) {
          (edge as any).targetHandle = "loop_return";
          edge.pathOptions = { ...(edge.pathOptions || {}), offset: 60 };
        } else {
          (edge as any).targetHandle = "top";
        }
      }
    }

    // breakpoint targets: map เป็น true/false handles ตามเดิม
    if (tgtNode && tgtNode.type === "breakpoint") {
      if (condLower === "true") {
        (edge as any).targetHandle = "true";
      } else if (condLower === "false") {
        (edge as any).targetHandle = "false";
      }
    }

    return edge;
  });


  console.log("Flowchart hydrated with new layout + branch-handles (breakpoints nudged right; descendants shifted left).");
  return { nodes: finalNodesArray, edges: convertedEdges };
};


