// File: app/flowchart/utils/flowchartUtils.ts
// ไฟล์นี้จะรวมฟังก์ชันช่วยเหลือทั่วไปที่ใช้ในการคำนวณต่างๆ

import { Node, Edge, MarkerType } from "@xyflow/react";

export const stepY = 150;

export const genId = () => crypto.randomUUID();

export const computeEndY = (allNodes: Node[]) => {
  const maxY = allNodes.filter((n) => n.id !== "end").reduce((m, n) => Math.max(m, n.position.y), 0);
  return maxY + stepY;
};

export const mapTypeForNode = (type: string, prevType?: string) => {
  if (type === "if") return "if";
  if (type === "while") return "while";
  if (type === "for") return "for";
  if (["input", "output", "declare", "assign"].includes(type)) return type;
  return prevType ?? type;
};

export const moveNodesBelow = (allNodes: Node[], y: number, offset: number) =>
  allNodes.map((n) => (n.position.y > y ? { ...n, position: { ...n.position, y: n.position.y + offset } } : n));

export const removeEdgesTouching = (allEdges: Edge[], nodeId: string) => allEdges.filter((e) => e.source !== nodeId && e.target !== nodeId);

export const createArrowEdge = (source: string, target: string, options: Partial<Edge> = {}): Edge => ({
  id: `e-${source}-${target}-${genId()}`,
  source,
  target,
  animated: true,
  markerEnd: { type: MarkerType.ArrowClosed },
  type: "smoothstep",
  ...options,
});

export const reconnectAroundDeleted = (allEdges: Edge[], nodeId: string) => {
  const incoming = allEdges.filter((e) => e.target === nodeId);
  const outgoing = allEdges.filter((e) => e.source === nodeId);
  const newEdges: Edge[] = [];
  incoming.forEach((inE) => {
    outgoing.forEach((outE) => {
      if (inE.source === outE.target) return; // skip no-op
      newEdges.push(createArrowEdge(inE.source, outE.target));
    });
  });
  return newEdges;
};

export const pruneUnreachableNodes = (allNodes: Node[], allEdges: Edge[]) => {
  const adjacency = new Map<string, string[]>();
  allEdges.forEach((e) => {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    adjacency.get(e.source)!.push(e.target);
  });
  const visited = new Set<string>();
  const stack = ["start"];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    (adjacency.get(cur) ?? []).forEach((nb) => !visited.has(nb) && stack.push(nb));
  }
  return allNodes.filter((n) => visited.has(n.id) || n.id === "end");
};