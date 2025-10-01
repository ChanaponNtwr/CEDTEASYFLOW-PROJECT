// File: app/flowchart/utils/backendConverter.ts
// ไฟล์นี้รับผิดชอบการแปลงข้อมูลที่ได้จาก API ให้อยู่ในรูปแบบที่ React Flow ใช้งานได้

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
    // Start / End
    case "ST":
    case "START":
    case "STRT":
      return "start";
    case "EN":
    case "END":
      return "end";

    // Assign / Declare / Input / Output
    case "AS":
    case "ASSIGN":
      return "assign";
    case "IN":
    case "INPUT":
      return "input";
    case "OU":
    case "OUT":
    case "OUTPUT":
      return "output";
    case "DC":
    case "DE":
    case "DECLARE":
    case "DECL":
      return "declare";

    // Control / Loops / Breakpoint
    case "IF":
      return "if";
    case "WH":
    case "WHILE":
      return "while";
    case "FR":
    case "FOR":
      return "for";
    case "BP":
    case "BREAKPOINT":
      return "breakpoint";

    // default: if backend returns a friendly name already, try to normalize it
    default:
      return backendType.toLowerCase();
  }
};

export const convertBackendFlowchart = (payload: any): { nodes: Node[]; edges: Edge[] } => {
  const backendNodes: any[] = payload?.flowchart?.nodes ?? [];
  const backendEdges: any[] = payload?.flowchart?.edges ?? [];

  // map backend ids to UI ids (special-case start/end mapping)
  const idMap = new Map<string, string>();
  backendNodes.forEach((bn) => {
    const bid = bn.id;
    if (!bid) return;
    const upperType = bn.type ? String(bn.type).toUpperCase() : "";
    if (upperType === "ST" || bn.label === "Start" || String(bid).toLowerCase().includes("start")) {
      idMap.set(bid, "start");
    } else if (upperType === "EN" || bn.label === "End" || String(bid).toLowerCase().includes("end")) {
      idMap.set(bid, "end");
    } else {
      idMap.set(bid, bid);
    }
  });

  // build Node objects with normalized types
  const nodesMap = new Map<string, Node>();
  backendNodes.forEach((bn, idx) => {
    const mappedId = idMap.get(bn.id) ?? bn.id;
    const isStart = mappedId === "start";
    const isEnd = mappedId === "end";

    const nodeType = isStart ? "start" : isEnd ? "end" : mapBackendTypeToNodeType(bn.type, bn.label);

    // treat (0,0) as "no meaningful position" so we auto-layout instead
    const hasPos = bn.position && (bn.position.x !== 0 || bn.position.y !== 0);
    const pos = hasPos ? { x: bn.position.x, y: bn.position.y } : { x: 300, y: 120 + idx * stepY };

    const node: Node = {
      id: mappedId,
      type: nodeType,
      data: { ...bn.data, label: bn.label ?? bn.data?.label ?? mappedId, _backendId: bn.id },
      position: pos,
      draggable: false,
    } as Node;

    // keep first occurrence per mappedId
    if (!nodesMap.has(mappedId)) nodesMap.set(mappedId, node);
  });

  // ensure start exists
  if (!nodesMap.has("start")) {
    nodesMap.set("start", {
      id: "start",
      type: "start",
      data: { label: "Start" },
      position: { x: 300, y: 50 },
      draggable: false,
    } as Node);
  }

  // build middle nodes, reflow vertically (keeps order deterministic)
  const middleNodesFromMap: Node[] = Array.from(nodesMap.values()).filter((n) => n.id !== "start" && n.id !== "end");
  let nextY = 50 + stepY;
  const newMiddleNodes = middleNodesFromMap.map((n) => {
    const x = n.position?.x ?? 300;
    const positioned = { ...n, position: { x, y: nextY } };
    nextY += stepY;
    return positioned;
  });

  const endY = Math.max(250, nextY);
  const endNodeFinal = {
    id: "end",
    type: "end",
    data: { label: "End" },
    position: { x: 300, y: endY },
    draggable: false,
  } as Node;

  const startNode = nodesMap.get("start")!;
  const startNodeFinal = { ...startNode, position: startNode.position ?? { x: 300, y: 50 } };

  const finalNodesArray: Node[] = [startNodeFinal, ...newMiddleNodes, endNodeFinal];

  // edges: translate backend ids using idMap
  const convertedEdges: Edge[] = backendEdges.map((be) => {
    const src = idMap.get(be.source) ?? be.source;
    const tgt = idMap.get(be.target) ?? be.target;
    const id = be.id ?? `${src}-${tgt}`;
    return {
      id,
      source: src,
      target: tgt,
      label: be.condition && be.condition !== "auto" ? be.condition : undefined,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      type: "smoothstep",
    } as Edge;
  });

  // fallback: if backend returned no edges, create one between start and end
  if (convertedEdges.length === 0) {
    convertedEdges.push(createArrowEdge("start", "end"));
  }

  return { nodes: finalNodesArray, edges: convertedEdges };
};
