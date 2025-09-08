// src/controller/flowchartController.js
import express from "express";
import { Flowchart, Executor, Context, Node, Edge } from "../service/flowchart/index.js";

const router = express.Router();

/* ---------------- helpers ---------------- */

function normalizeList(maybe) {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe;
  if (typeof maybe === "object") return Object.values(maybe);
  return [];
}

/**
 * map common full names -> short codes used by Node class
 */
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
  // if already in uppercase short code (e.g. "DC", "WH")
  if (/^[A-Z]{2,3}$/.test(t)) return t;
  const key = t.toLowerCase();
  return TYPE_MAP[key] ?? "PH";
}

/**
 * quick check: is there a path from n_start -> n_end ?
 * BFS over fc.edges
 */
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

/* ---------------- hydrate ---------------- */

/**
 * hydrateFlowchart(payload)
 * - build Flowchart instance from payload.nodes & payload.edges
 * - supports nodes/edges as array or object-map
 * - preserves edge.id when possible (uses fc._addEdgeInternal)
 * - normalizes node.type (accepts "declare", "DC", "Declare", etc.)
 * - validates that there is a path from n_start -> n_end (throws Error if not)
 */
export function hydrateFlowchart(payload = {}) {
  const fc = new Flowchart();

  // apply limits if provided
  if (Number.isFinite(payload.maxSteps)) fc.maxSteps = payload.maxSteps;
  if (Number.isFinite(payload.maxTimeMs)) fc.maxTimeMs = payload.maxTimeMs;
  if (Number.isFinite(payload.maxLoopIterationsPerNode)) fc.maxLoopIterationsPerNode = payload.maxLoopIterationsPerNode;

  const nodesInput = normalizeList(payload.nodes);
  const edgesInput = normalizeList(payload.edges);

  // 1) Add nodes (skip start/end which are already created in constructor)
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

  // 2) Add edges (prefer preserving provided id)
  for (const e of edgesInput) {
    if (!e || !e.source || !e.target) continue;
    if (e.id && typeof fc._addEdgeInternal === "function") {
      try {
        fc._addEdgeInternal(new Edge(e.id, e.source, e.target, e.condition ?? "auto"));
        continue;
      } catch (err) {
        // fallback to addEdge on failure
      }
    }
    fc.addEdge(e.source, e.target, e.condition ?? "auto");
  }

  // 3) If nodes were provided but there are no meaningful edges (only default start->end),
  //    try a best-effort sequential insertion between start->end.
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
      // update pointer for next insertion
      const outEdgeId = (newNode.outgoingEdgeIds || []).find(id => fc.getEdge(id));
      if (!outEdgeId) break;
      currentEdgeId = outEdgeId;
    }
  }

  // 4) Validate path start -> end exists
  if (!hasPathStartToEnd(fc)) {
    throw new Error("Graph invalid: no path from n_start to n_end. Ensure edges connect nodes from start to end.");
  }

  return fc;
}

/* ---------------- routes ---------------- */

router.post("/hydrate", (req, res) => {
  try {
    const payload = req.body || {};
    const fc = hydrateFlowchart(payload);

    return res.json({
      ok: true,
      nodes: fc.nodes,
      edges: fc.edges,
      limits: {
        maxSteps: fc.maxSteps,
        maxTimeMs: fc.maxTimeMs,
        maxLoopIterationsPerNode: fc.maxLoopIterationsPerNode
      }
    });
  } catch (err) {
    console.error("hydrate error:", err);
    return res.status(400).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.post("/execute", (req, res) => {
  try {
    const body = req.body || {};
    const action = body.action ?? "run";
    const fcPayload = body.flowchart && Object.keys(body.flowchart).length ? body.flowchart : body;
    const variables = Array.isArray(body.variables) ? body.variables : [];
    const options = body.options || {};
    const restoreState = body.restoreState || {};
    const forceAdvanceBP = Boolean(body.forceAdvanceBP);

    // hydrate -> may throw if invalid
    const fc = hydrateFlowchart(fcPayload);

    // debug: show what was hydrated
    console.log("HYDRATED NODES:", Object.keys(fc.nodes));
    console.log("HYDRATED EDGES:", Object.keys(fc.edges));

    // create executor
    const executor = new Executor(fc, options);

    // restore minimal state if provided
    if (restoreState && restoreState.context && Array.isArray(restoreState.context.variables)) {
      executor.context = new Context(restoreState.context.variables);
    }
    if (restoreState.currentNodeId) executor.currentNodeId = restoreState.currentNodeId;
    if (typeof restoreState.finished === "boolean") executor.finished = restoreState.finished;
    if (typeof restoreState.paused === "boolean") executor.paused = restoreState.paused;
    if (typeof restoreState.stepCount === "number") executor.stepCount = restoreState.stepCount;

    // set initial variables (before running)
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
      console.log("STEP result:", result);
      return res.json({
        ok: true,
        result,
        context: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    if (action === "resume") {
      const result = executor.resume();
      console.log("RESUME result:", result);
      return res.json({
        ok: true,
        result,
        context: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    // default: runAll
    const finalContext = executor.runAll();
    console.log("RUN finished; variables:", finalContext.variables, "output:", finalContext.output);
    return res.json({
      ok: true,
      context: { variables: finalContext.variables, output: finalContext.output }
    });

  } catch (err) {
    console.error("execute error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

export default router;
