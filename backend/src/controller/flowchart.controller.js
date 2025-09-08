// src/controller/flowchart.Controller.js
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
 * - best-effort sequential insert if nodes provided but no meaningful edges
 */
export function hydrateFlowchart(payload = {}) {
  const fc = new Flowchart();

  if (Number.isFinite(payload.maxSteps)) fc.maxSteps = payload.maxSteps;
  if (Number.isFinite(payload.maxTimeMs)) fc.maxTimeMs = payload.maxTimeMs;
  if (Number.isFinite(payload.maxLoopIterationsPerNode)) fc.maxLoopIterationsPerNode = payload.maxLoopIterationsPerNode;

  const nodesInput = normalizeList(payload.nodes);
  const edgesInput = normalizeList(payload.edges);

  // add nodes
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
        // fallback
      }
    }
    fc.addEdge(e.source, e.target, e.condition ?? "auto");
  }

  // best-effort: if nodes exist but only start->end edge, insert sequentially
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

/**
 * Ensure executor.context contains variables for any IN nodes:
 * - body.variables (array) wins (we initialize Context with it)
 * - otherwise we create (or set) variables from inputMap / inputDefaults
 */
function ensureContextVariablesFromBody(body, executor) {
  // priority: variables array
  if (Array.isArray(body.variables) && body.variables.length > 0) {
    executor.context = new Context(body.variables);
    return;
  }

  // otherwise, keep existing context (fresh) and set from inputMap / inputDefaults
  const inputMap = (body.inputMap && typeof body.inputMap === "object") ? body.inputMap : {};
  const inputDefaults = (body.inputDefaults && typeof body.inputDefaults === "object") ? body.inputDefaults : {};

  // set provided keys
  for (const k of Object.keys(inputMap)) {
    executor.context.set(k, inputMap[k]);
  }
  // set defaults only if not present
  for (const k of Object.keys(inputDefaults)) {
    if (executor.context.get(k) === undefined) executor.context.set(k, inputDefaults[k]);
  }
}

/**
 * POST /flowchart/execute
 *
 * Body options:
 * - flowchart?: { nodes, edges, limits } OR top-level nodes/edges
 * - variables?: [{name,value,varType}]  // initial variables (preferred)
 * - inputMap?: { name: value }          // alternative for IN nodes
 * - inputDefaults?: { name: value }     // fallback defaults
 * - action?: "run"|"step"|"resume"|"reset"
 * - options?: { maxSteps, maxTimeMs, maxLoopIterationsPerNode, ignoreBreakpoints }
 */
router.post("/execute", (req, res) => {
  try {
    // parse possibly-string body
    let raw = req.body;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        // keep raw as string (will be invalid)
      }
    }
    const body = raw || {};

    // quick diagnostics
    const hasNodes = body.nodes && (Array.isArray(body.nodes) ? body.nodes.length > 0 : Object.keys(body.nodes || {}).length > 0);
    const hasFlowchartNodes = body.flowchart && body.flowchart.nodes && (Array.isArray(body.flowchart.nodes) ? body.flowchart.nodes.length > 0 : Object.keys(body.flowchart.nodes || {}).length > 0);

    if (!hasNodes && !hasFlowchartNodes) {
      return res.status(400).json({
        ok: false,
        error: "No nodes found in payload. POST JSON with top-level 'nodes'/'edges' or 'flowchart' containing them.",
        example: {
          nodes: [{ id: "n1", type: "DC", data: { name: "x", value: 2 } }],
          edges: [{ source: "n_start", target: "n1" }]
        }
      });
    }

    const action = body.action ?? "run";
    const fcPayload = body.flowchart && Object.keys(body.flowchart).length ? body.flowchart : body;
    const variables = Array.isArray(body.variables) ? body.variables : [];
    const options = body.options || {};
    const restoreState = body.restoreState || {};
    const forceAdvanceBP = Boolean(body.forceAdvanceBP);

    // hydrate flowchart (can throw)
    const fc = hydrateFlowchart(fcPayload);

    console.log("HYDRATED NODES:", Object.keys(fc.nodes));
    console.log("HYDRATED EDGES:", Object.keys(fc.edges));

    // create executor
    const executor = new Executor(fc, options);

    // restore state if provided
    if (restoreState && restoreState.context && Array.isArray(restoreState.context.variables)) {
      executor.context = new Context(restoreState.context.variables);
    }
    if (restoreState.currentNodeId) executor.currentNodeId = restoreState.currentNodeId;
    if (typeof restoreState.finished === "boolean") executor.finished = restoreState.finished;
    if (typeof restoreState.paused === "boolean") executor.paused = restoreState.paused;
    if (typeof restoreState.stepCount === "number") executor.stepCount = restoreState.stepCount;

    // ensure context variables from body.variables / inputMap / inputDefaults
    ensureContextVariablesFromBody(body, executor);

    // also apply variables array entries individually (if provided) to be safe
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
    const ignoreBreakpoints = Boolean(options.ignoreBreakpoints || body.ignoreBreakpoints);
    const finalContext = executor.runAll({ ignoreBreakpoints });
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
