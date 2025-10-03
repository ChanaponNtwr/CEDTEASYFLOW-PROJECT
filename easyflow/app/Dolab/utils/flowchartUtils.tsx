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
  const reachable = new Set<string>();
  const queue = ["start"];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (reachable.has(curr)) continue;
    reachable.add(curr);
    const neighbors = adjacency.get(curr) || [];
    neighbors.forEach((n) => queue.push(n));
  }
  return allNodes.filter((n) => reachable.has(n.id));
};

/**
 * Finds all node IDs reachable from a given start node by traversing the graph.
 * @param startNodeId The ID of the node to start the traversal from.
 * @param allEdges The list of all edges in the graph.
 * @returns A Set of reachable node IDs, including the start node.
 */
export const findReachableNodeIds = (startNodeId: string, allEdges: Edge[]): Set<string> => {
  const reachable = new Set<string>();
  if (!startNodeId) return reachable;

  const queue: string[] = [startNodeId];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    reachable.add(currentNodeId);

    const outgoingEdges = allEdges.filter((edge) => edge.source === currentNodeId);
    for (const edge of outgoingEdges) {
      if (edge.target && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  return reachable;
};