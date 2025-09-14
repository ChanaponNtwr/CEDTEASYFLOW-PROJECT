// src/controller/flowchart.Controller.js
import express from "express";
import { Flowchart, Executor, Context, Node, Edge } from "../service/flowchart/index.js";

const router = express.Router();

/* ---------------- In-memory store ----------------
   savedFlowcharts: Map<flowchartId, { nodes:[], edges:[], limits?:{} }>
   (เปลี่ยนเป็น DB ได้ภายหลัง — เก็บ JSON ของ flowchart)
*/
const savedFlowcharts = new Map();

/* ---------------- helpers ---------------- */

function normalizeList(maybe) {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === "object") return Object.values(maybe);
  return [];
}

const TYPE_MAP = {
  start: "ST", st: "ST",
  end: "EN", en: "EN",
  declare: "DC", dc: "DC",
  if: "IF",
  assign: "AS", as: "AS",
  for: "FR", fr: "FR",
  while: "WH", wh: "WH",
  input: "IN", in: "IN",
  output: "OU", ou: "OU",
  bp: "BP", breakpoint: "BP",
  do: "DO"
};

function normalizeType(rawType) {
  if (!rawType) return "PH";
  const t = String(rawType).trim();
  if (/^[A-Z]{2,3}$/.test(t)) return t;
  const key = t.toLowerCase();
  return TYPE_MAP[key] ?? "PH";
}

function hasPathStartToEnd(fc) {
  const adj = {};
  for (const eid of Object.keys(fc.edges || {})) {
    const e = fc.getEdge(eid);
    if (!e) continue;
    adj[e.source] = adj[e.source] || [];
    adj[e.source].push(e.target);
  }
  const q = ["n_start"];
  const seen = new Set();
  while (q.length) {
    const cur = q.shift();
    if (cur === "n_end") return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const nexts = adj[cur] || [];
    for (const nx of nexts) if (!seen.has(nx)) q.push(nx);
  }
  return false;
}

/* ---------------- hydrateFlowchart ---------------- */
/**
 * Build Flowchart instance from payload.nodes / payload.edges
 * - supports array or object-map
 * - preserves provided edge ids when possible
 */
export function hydrateFlowchart(payload = {}) {
  const fc = new Flowchart();

  if (Number.isFinite(payload.maxSteps)) fc.maxSteps = payload.maxSteps;
  if (Number.isFinite(payload.maxTimeMs)) fc.maxTimeMs = payload.maxTimeMs;
  if (Number.isFinite(payload.maxLoopIterationsPerNode)) fc.maxLoopIterationsPerNode = payload.maxLoopIterationsPerNode;

  const nodesInput = normalizeList(payload.nodes);
  const edgesInput = normalizeList(payload.edges);

  // add nodes (skip start/end — constructor created them)
  for (const n of nodesInput) {
    if (!n || !n.id) continue;
    if (n.id === "n_start" || n.id === "n_end") continue;
    const typ = normalizeType(n.type ?? n.typeShort ?? n.typeFull);
    const node = new Node(
      n.id,
      typ,
      n.label ?? "",
      n.data ?? {},
      n.position ?? { x: 0, y: 0 },
      n.incomingEdgeIds ?? [],
      n.outgoingEdgeIds ?? []
    );
    if (n.loopEdge) node.loopEdge = n.loopEdge;
    if (n.loopExitEdge) node.loopExitEdge = n.loopExitEdge;
    fc.addNode(node);
  }

  // add edges (preserve id when provided)
  for (const e of edgesInput) {
    if (!e || !e.source || !e.target) continue;
    if (e.id && typeof fc._addEdgeInternal === "function") {
      try {
        fc._addEdgeInternal(new Edge(e.id, e.source, e.target, e.condition ?? "auto"));
        continue;
      } catch (err) {
        // fallback to addEdge
      }
    }
    fc.addEdge(e.source, e.target, e.condition ?? "auto");
  }

  // best-effort: if nodes provided but only start->end exists, insert sequentially
  const meaningfulEdges = Object.keys(fc.edges || {}).filter(id => id !== "n_start-n_end");
  if (nodesInput.length > 0 && meaningfulEdges.length === 0) {
    let currentEdgeId;
    try {
      currentEdgeId = fc.chooseOutgoingEdgeId("n_start", ["auto", "next", "true", "false", "done"]);
    } catch (e) {
      currentEdgeId = "n_start-n_end";
    }
    for (const n of nodesInput) {
      if (!n || !n.id) continue;
      if (n.id === "n_start" || n.id === "n_end") continue;
      const newNode = new Node(n.id, normalizeType(n.type ?? "PH"), n.label ?? "", n.data ?? {}, n.position ?? { x: 0, y: 0 });
      try {
        fc.insertNodeAtEdge(currentEdgeId, newNode);
      } catch (err) {
        fc.addNode(newNode);
        fc.addEdge("n_start", newNode.id, "auto");
        fc.addEdge(newNode.id, "n_end", "auto");
      }
      const outEdgeId = (newNode.outgoingEdgeIds || []).find(id => fc.getEdge(id));
      if (!outEdgeId) break;
      currentEdgeId = outEdgeId;
    }
  }

  if (!hasPathStartToEnd(fc)) {
    throw new Error("Graph invalid: no path from n_start to n_end. Ensure edges connect nodes from start to end.");
  }

  return fc;
}

/* ---------------- serializeFlowchart ---------------- */
/**
 * Convert Flowchart instance -> plain JSON { nodes:[], edges:[], limits:{} }
 * This is used to persist back into savedFlowcharts map.
 */
function serializeFlowchart(fc) {
  const nodes = Object.values(fc.nodes).map(n => ({
    id: n.id,
    type: n.type,
    label: n.label,
    data: n.data,
    position: n.position,
    incomingEdgeIds: n.incomingEdgeIds || [],
    outgoingEdgeIds: n.outgoingEdgeIds || [],
    loopEdge: n.loopEdge ?? null,
    loopExitEdge: n.loopExitEdge ?? null
  }));

  const edges = Object.values(fc.edges).map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    condition: e.condition ?? "auto"
  }));

  return {
    nodes,
    edges,
    limits: {
      maxSteps: fc.maxSteps,
      maxTimeMs: fc.maxTimeMs,
      maxLoopIterationsPerNode: fc.maxLoopIterationsPerNode
    }
  };
}

/* ---------------- routes ---------------- */

/**
 * POST /flowchart/save
 * - body.flowchart OR top-level nodes/edges/l mits
 * - optional body.id (flowchartId). If not provided generate one.
 * - returns { flowchartId }
 */
router.post("/save", (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { /* keep raw */ }
    }
    const body = raw || {};
    const fcPayload = body.flowchart && Object.keys(body.flowchart).length ? body.flowchart : body;

    // minimal validation
    const nodes = normalizeList(fcPayload.nodes);
    const edges = normalizeList(fcPayload.edges);
    if (!nodes.length && !edges.length) {
      return res.status(400).json({ ok: false, error: "No nodes/edges found in flowchart payload." });
    }

    const id = body.id || `flow_${Date.now()}`;
    // store plain JSON (so we can later hydrate)
    savedFlowcharts.set(id, { nodes, edges, limits: fcPayload.limits ?? {} });

    return res.json({ ok: true, flowchartId: id });
  } catch (err) {
    console.error("save error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});


/**
 * POST /flowchart/insert-node
 * - body.flowchartId (required) OR full payload (not recommended)
 * - body.edgeId (required): the existing edge id to insert at
 * - body.node (required): spec of node to insert (type, label, data, optional id)
 *
 * After insertion the saved flowchart is updated in-memory.
 */
router.post("/insert-node", (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { /* keep as-is */ }
    }
    const body = raw || {};

    const flowchartId = body.flowchartId;
    const edgeId = body.edgeId;
    const nodeSpec = body.node;

    if (!flowchartId) {
      return res.status(400).json({ ok: false, error: "Missing 'flowchartId' - specify which saved flowchart to modify." });
    }
    if (!edgeId) {
      return res.status(400).json({ ok: false, error: "Missing 'edgeId' - specify the edge to insert at." });
    }
    if (!nodeSpec || typeof nodeSpec !== "object") {
      return res.status(400).json({ ok: false, error: "Missing 'node' object in request body." });
    }

    const saved = savedFlowcharts.get(flowchartId);
    if (!saved) {
      return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
    }

    // hydrate current saved flowchart
    const fc = hydrateFlowchart(saved);

    // check edge exists
    if (!fc.getEdge(edgeId)) {
      return res.status(400).json({ ok: false, error: `Edge '${edgeId}' not found in flowchart.` });
    }

    // build Node instance (id optionally from client or generate)
    const typ = normalizeType(nodeSpec.type ?? nodeSpec.typeShort ?? nodeSpec.typeFull ?? "PH");
    const nodeId = nodeSpec.id || fc.genId();
    const newNode = new Node(
      nodeId,
      typ,
      nodeSpec.label ?? "",
      nodeSpec.data ?? {},
      nodeSpec.position ?? { x: 0, y: 0 },
      nodeSpec.incomingEdgeIds ?? [],
      nodeSpec.outgoingEdgeIds ?? []
    );
    if (nodeSpec.loopEdge) newNode.loopEdge = nodeSpec.loopEdge;
    if (nodeSpec.loopExitEdge) newNode.loopExitEdge = nodeSpec.loopExitEdge;

    // insert
    try {
      fc.insertNodeAtEdge(edgeId, newNode);
    } catch (err) {
      console.error("insertNodeAtEdge error:", err);
      return res.status(500).json({ ok: false, error: String(err.message ?? err) });
    }

    // serialize and save back
    savedFlowcharts.set(flowchartId, serializeFlowchart(fc));

    return res.json({
      ok: true,
      message: `Inserted node ${newNode.id} at edge ${edgeId}`,
      insertedNode: { id: newNode.id, type: newNode.type, label: newNode.label, data: newNode.data },
      flowchartId,
      nodes: fc.nodes,
      edges: fc.edges
    });
  } catch (err) {
    console.error("insert-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});


/**
 * GET /flowchart/:id
 * - return saved flowchart JSON
 */
router.get("/:id", (req, res) => {
  try {
    const id = req.params.id;
    const saved = savedFlowcharts.get(id);
    if (!saved) return res.status(404).json({ ok: false, error: "Not found" });
    return res.json({ ok: true, flowchartId: id, flowchart: saved });
  } catch (err) {
    console.error("get flowchart error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});


/**
 * POST /flowchart/execute
 * - body.flowchartId (required) -> run saved flowchart
 * - body.variables, inputMap, inputDefaults etc. (same as before)
 */
router.post("/execute", (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { /* keep raw */ }
    }
    const body = raw || {};

    const flowchartId = body.flowchartId;
    if (!flowchartId) {
      return res.status(400).json({ ok: false, error: "Missing 'flowchartId' in request. Must provide the saved flowchart id to execute." });
    }
    const saved = savedFlowcharts.get(flowchartId);
    if (!saved) {
      return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
    }

    const action = body.action ?? "run";
    const variables = Array.isArray(body.variables) ? body.variables : [];
    const options = body.options || {};
    const restoreState = body.restoreState || {};
    const forceAdvanceBP = Boolean(body.forceAdvanceBP);

    // hydrate from saved JSON
    const fc = hydrateFlowchart(saved);

    console.log("HYDRATED NODES:", Object.keys(fc.nodes));
    console.log("HYDRATED EDGES:", Object.keys(fc.edges));

    const executor = new Executor(fc, options);

    // restore state if provided
    if (restoreState && restoreState.context && Array.isArray(restoreState.context.variables)) {
      executor.context = new Context(restoreState.context.variables);
    }
    if (restoreState.currentNodeId) executor.currentNodeId = restoreState.currentNodeId;
    if (typeof restoreState.finished === "boolean") executor.finished = restoreState.finished;
    if (typeof restoreState.paused === "boolean") executor.paused = restoreState.paused;
    if (typeof restoreState.stepCount === "number") executor.stepCount = restoreState.stepCount;

    // ensure context variables
    if (Array.isArray(body.variables) && body.variables.length > 0) {
      executor.context = new Context(body.variables);
    } else {
      // inputMap / defaults
      const inputMap = (body.inputMap && typeof body.inputMap === "object") ? body.inputMap : {};
      const inputDefaults = (body.inputDefaults && typeof body.inputDefaults === "object") ? body.inputDefaults : {};
      for (const k of Object.keys(inputMap)) executor.context.set(k, inputMap[k]);
      for (const k of Object.keys(inputDefaults)) {
        if (executor.context.get(k) === undefined) executor.context.set(k, inputDefaults[k]);
      }
    }

    // apply variables array entries individually (safe)
    for (const v of variables) {
      if (v && v.name) executor.context.set(v.name, v.value, v.varType);
    }

    // actions
    if (action === "reset") {
      executor.reset();
      return res.json({ ok: true, message: "reset", context: { variables: executor.context.variables, output: executor.context.output } });
    }

    if (action === "step") {
      const result = executor.step({ forceAdvanceBP });
      return res.json({ ok: true, result, context: { variables: executor.context.variables, output: executor.context.output } });
    }

    if (action === "resume") {
      const result = executor.resume();
      return res.json({ ok: true, result, context: { variables: executor.context.variables, output: executor.context.output } });
    }

    // default: runAll
    const ignoreBreakpoints = Boolean(options.ignoreBreakpoints || body.ignoreBreakpoints);
    const finalContext = executor.runAll({ ignoreBreakpoints });

    return res.json({ ok: true, context: { variables: finalContext.variables, output: finalContext.output } });

  } catch (err) {
    console.error("execute error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

export default router;
