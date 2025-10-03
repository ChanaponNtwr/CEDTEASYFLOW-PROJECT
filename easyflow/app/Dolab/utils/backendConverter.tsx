// File: app/flowchart/utils/backendConverter.tsx
// ไฟล์นี้รับผิดชอบการแปลงข้อมูลที่ได้จาก API ให้อยู่ในรูปแบบที่ React Flow ใช้งานได้
// (เวอร์ชันปรับปรุง Logic การจัดเรียงตำแหน่ง Node ใหม่ทั้งหมด)

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
      position: n.position || { x: 0, y: 0 }, // ใช้ position จาก backend ถ้ามี, ถ้าไม่มีให้เป็น (0,0)
      draggable: false,
      sourcePosition: "bottom",
      targetPosition: "top",
    };
    nodesMap.set(newId, frontEndNode);
  });

  // --- Section 2: สร้าง Adjacency List สำหรับ Graph Traversal ---
  const adj = new Map<string, string[]>();
  nodesMap.forEach((_, id) => adj.set(id, []));

  backendEdges.forEach((e: any) => {
    const source = idMap.get(e.source) ?? e.source;
    const target = idMap.get(e.target) ?? e.target;
    if (adj.has(source)) {
      adj.get(source)!.push(target);
    }
  });

  // --- Section 3: NEW LAYOUT LOGIC - จัดเรียงตำแหน่ง Node ด้วย BFS Traversal ---
  const positionedNodes = new Map<string, Node>();
  const queue: { nodeId: string; y: number; x: number }[] = [{ nodeId: "start", y: 50, x: 300 }];
  const visited = new Set<string>(["start"]);
  let maxY = 50;

  while (queue.length > 0) {
    const { nodeId, y, x } = queue.shift()!;
    const node = nodesMap.get(nodeId);
    if (!node) continue;
    
    // กำหนดตำแหน่งและเพิ่ม vào positionedNodes
    node.position = { x, y };
    positionedNodes.set(nodeId, node);
    maxY = Math.max(maxY, y);

    const children = adj.get(nodeId) || [];
    
    // จัดการการแตกแขนงของ If-node
    if (node.type === 'if' && children.length > 1) {
        // สมมติว่าลูกคนแรกคือ True branch (ไปทางขวา) และคนที่สองคือ False (ไปทางซ้าย)
        const trueChildId = children[0];
        const falseChildId = children[1];
        if (trueChildId && !visited.has(trueChildId)) {
            visited.add(trueChildId);
            queue.push({ nodeId: trueChildId, y: y + stepY, x: x + 250 });
        }
        if (falseChildId && !visited.has(falseChildId)) {
            visited.add(falseChildId);
            queue.push({ nodeId: falseChildId, y: y + stepY, x: x - 250 });
        }
    } else { // สำหรับ Node ประเภทอื่นๆ
        let currentY = y + stepY;
        children.forEach((childId) => {
            if (!visited.has(childId)) {
                visited.add(childId);
                // ในกรณีเส้นตรง จะใช้ x เดียวกัน แต่เพิ่ม y
                queue.push({ nodeId: childId, y: currentY, x });
                currentY += stepY;
            }
        });
    }
  }

  // จัดการ End Node ให้อยู่ล่างสุดเสมอ
  const endNode = nodesMap.get("end");
  if (endNode) {
    endNode.position = { x: 300, y: maxY };
    positionedNodes.set("end", endNode);
  }

  // --- Section 4: แปลง Edges และสร้างผลลัพธ์สุดท้าย ---
  const finalNodesArray = Array.from(positionedNodes.values());
  const convertedEdges: Edge[] = backendEdges.map((be: any) => {
    const source = idMap.get(be.source) ?? be.source;
    const target = idMap.get(be.target) ?? be.target;
    return {
      id: be.id ?? `e-${source}-${target}`,
      source,
      target,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: "smoothstep",
      data: { condition: be.condition },
      label: be.condition === "auto" ? "" : be.condition,
    };
  });

  console.log("Flowchart hydrated with new layout logic.");
  return { nodes: finalNodesArray, edges: convertedEdges };
};