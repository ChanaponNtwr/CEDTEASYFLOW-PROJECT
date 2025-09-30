// File: app/flowchart/utils/backendConverter.ts
// ไฟล์นี้รับผิดชอบการแปลงข้อมูลที่ได้จาก API ให้อยู่ในรูปแบบที่ React Flow ใช้งานได้

import { Node, Edge, MarkerType } from "@xyflow/react";
import { createArrowEdge, stepY } from "./flowchartUtils";

const mapBackendTypeToNodeType = (backendType?: string, label?: string) => {
  if (!backendType) {
    if (label === "Start") return "start";
    if (label === "End") return "end";
    return "assign"; // fallback
  }
  switch ((backendType || "").toUpperCase()) {
    case "ST": return "start";
    case "EN": return "end";
    case "AS": return "assign";
    case "IN": return "input";
    case "OUT": return "output";
    case "DE": case "DECLARE": return "declare";
    case "IF": return "if";
    case "WHILE": return "while";
    case "FOR": return "for";
    case "BP": return "breakpoint";
    default: return backendType.toLowerCase();
  }
};

export const convertBackendFlowchart = (payload: any): { nodes: Node[]; edges: Edge[] } => {
  const backendNodes: any[] = payload?.flowchart?.nodes ?? [];
  const backendEdges: any[] = payload?.flowchart?.edges ?? [];

  const idMap = new Map<string, string>();
  backendNodes.forEach((bn) => {
    const bid = bn.id;
    if (!bid) return;
    if ((bn.type && bn.type.toUpperCase() === "ST") || bn.label === "Start" || String(bid).toLowerCase().includes("start")) {
      idMap.set(bid, "start");
    } else if ((bn.type && bn.type.toUpperCase() === "EN") || bn.label === "End" || String(bid).toLowerCase().includes("end")) {
      idMap.set(bid, "end");
    } else {
      idMap.set(bid, bid);
    }
  });

  const nodesMap = new Map<string, Node>();
  backendNodes.forEach((bn, idx) => {
    const mappedId = idMap.get(bn.id) ?? bn.id;
    const isStart = mappedId === "start";
    const isEnd = mappedId === "end";
    const nodeType = isStart ? "start" : isEnd ? "end" : mapBackendTypeToNodeType(bn.type, bn.label);
    const hasPos = bn.position && (bn.position.x !== 0 || bn.position.y !== 0);
    const pos = hasPos ? { x: bn.position.x, y: bn.position.y } : { x: 300, y: 120 + idx * stepY };
    const node: Node = {
      id: mappedId,
      type: nodeType,
      data: { ...bn.data, label: bn.label ?? bn.data?.label ?? mappedId, _backendId: bn.id },
      position: pos,
      draggable: false,
    } as Node;
    if (!nodesMap.has(mappedId)) nodesMap.set(mappedId, node);
  });

  if (!nodesMap.has("start")) {
    nodesMap.set("start", { id: "start", type: "start", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false });
  }

  const middleNodesFromMap: Node[] = Array.from(nodesMap.values()).filter((n) => n.id !== "start" && n.id !== "end");
  let nextY = 50 + stepY;
  const newMiddleNodes = middleNodesFromMap.map((n) => {
    const x = n.position?.x ?? 300;
    const positioned = { ...n, position: { x, y: nextY } };
    nextY += stepY;
    return positioned;
  });

  const endY = Math.max(250, nextY);
  const endNodeFinal = { id: "end", type: "end", data: { label: "End" }, position: { x: 300, y: endY }, draggable: false } as Node;
  const startNode = nodesMap.get("start")!;
  const startNodeFinal = { ...startNode, position: startNode.position ?? { x: 300, y: 50 } };
  const finalNodesArray: Node[] = [startNodeFinal, ...newMiddleNodes, endNodeFinal];

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

  if (convertedEdges.length === 0) {
    convertedEdges.push(createArrowEdge("start", "end"));
  }

  return { nodes: finalNodesArray, edges: convertedEdges };
};