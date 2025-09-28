// src/service/flowchart/serializer.js
import Flowchart from "./classflowchart.js";
import Node from "./classnode.js";
import Edge from "./classedge.js";

/**
 * hydrateFlowchart(payload)
 * - payload.nodes: array หรือ object-map
 * - payload.edges: array หรือ object-map
 *
 * Returns Flowchart instance (with start/end already present from constructor).
 */
export function hydrateFlowchart(payload = {}) {
  const fc = new Flowchart();

  // apply execution limits ถ้ามี
  if (Number.isFinite(payload.maxSteps)) fc.maxSteps = payload.maxSteps;
  if (Number.isFinite(payload.maxTimeMs)) fc.maxTimeMs = payload.maxTimeMs;
  if (Number.isFinite(payload.maxLoopIterationsPerNode)) {
    fc.maxLoopIterationsPerNode = payload.maxLoopIterationsPerNode;
  }

  // normalize inputs -> arrays
  const nodesInput = Array.isArray(payload.nodes) ? payload.nodes : (payload.nodes ? Object.values(payload.nodes) : []);
  const edgesInput = Array.isArray(payload.edges) ? payload.edges : (payload.edges ? Object.values(payload.edges) : []);

  // 1) Add nodes (skip start/end which already exist)
  for (const n of nodesInput) {
    if (!n || !n.id) continue;
    if (n.id === "n_start" || n.id === "n_end") continue;
    const node = new Node(
      n.id,
      n.type ?? n.typeShort ?? "PH",
      n.label ?? "",
      n.data ?? {},
      n.position ?? { x: 0, y: 0 },
      n.incomingEdgeIds ?? [],
      n.outgoingEdgeIds ?? []
    );
    fc.addNode(node);
  }

  // 2) Add edges — preserve provided id if possible
  for (const e of edgesInput) {
    if (!e || !e.source || !e.target) continue;
    // if client provided id and internal method exists, use it to preserve id
    if (e.id && typeof fc._addEdgeInternal === "function") {
      try {
        const edgeInstance = new Edge(e.id, e.source, e.target, e.condition ?? "auto");
        fc._addEdgeInternal(edgeInstance);
        continue;
      } catch (err) {
        // fallback to addEdge
      }
    }
    fc.addEdge(e.source, e.target, e.condition ?? "auto");
  }

  // If client sent any edge from n_start (other than default), remove default start->end
  try {
    const hasStartOutgoingOtherThanDefault = Object.values(fc.edges).some(e => e.source === "n_start" && e.target !== "n_end");
    if (hasStartOutgoingOtherThanDefault && fc.getEdge("n_start-n_end")) {
      fc.removeEdge("n_start-n_end");
    }
  } catch (e) {
    // ignore
  }

  // If there are nodes but no edges connecting them (i.e., only default start->end),
  // we won't auto-insert in this mode because frontend promised complete graph.
  // But to be safe, if there are nodes and no meaningful edges, insert nodes sequentially:
  const meaningfulEdges = Object.keys(fc.edges).filter(id => id !== "n_start-n_end");
  if (nodesInput.length > 0 && meaningfulEdges.length === 0) {
    // insert sequentially into start->end (best-effort)
    let currentEdgeId = fc.chooseOutgoingEdgeId("n_start", ["auto", "next", "true", "false", "done"]);
    for (const n of nodesInput) {
      if (!n || !n.id) continue;
      if (n.id === "n_start" || n.id === "n_end") continue;
      const newNode = new Node(n.id, n.type ?? "PH", n.label ?? "", n.data ?? {}, n.position ?? { x: 0, y: 0 });
      try {
        fc.insertNodeAtEdge(currentEdgeId, newNode);
      } catch (err) {
        // fallback simple connect
        fc.addNode(newNode);
        fc.addEdge("n_start", newNode.id, "auto");
        fc.addEdge(newNode.id, "n_end", "auto");
      }
      // set next edge pointer
      const outEdgeId = (newNode.outgoingEdgeIds || []).find(id => fc.getEdge(id));
      if (!outEdgeId) break;
      currentEdgeId = outEdgeId;
    }
  }

  return fc;
}
