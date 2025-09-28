import express from "express";
import { Flowchart, Executor, Context, Node, Edge } from "../service/flowchart/index.js";
import prisma from "../lib/prisma.js";
const router = express.Router();

/* ---------------- In-memory store ----------------
   savedFlowcharts: Map<flowchartId, { nodes:[], edges:[], limits?:{} }>
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
export function hydrateFlowchart(payload = {}) {
  const fc = new Flowchart();

  if (Number.isFinite(payload.maxSteps)) fc.maxSteps = payload.maxSteps;
  if (Number.isFinite(payload.maxTimeMs)) fc.maxTimeMs = payload.maxTimeMs;
  if (Number.isFinite(payload.maxLoopIterationsPerNode)) fc.maxLoopIterationsPerNode = payload.maxLoopIterationsPerNode;

  const nodesInput = normalizeList(payload.nodes);
  const edgesInput = normalizeList(payload.edges);

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

  for (const e of edgesInput) {
    if (!e || !e.source || !e.target) continue;
    if (e.id && typeof fc._addEdgeInternal === "function") {
      try {
        fc._addEdgeInternal(new Edge(e.id, e.source, e.target, e.condition ?? "auto"));
        continue;
      } catch (err) {}
    }
    fc.addEdge(e.source, e.target, e.condition ?? "auto");
  }

  try {
    const startNode = fc.getNode("n_start");
    if (startNode) {
      const others = (startNode.outgoingEdgeIds || []).filter(id => id !== "n_start-n_end");
      if (others.length > 0 && fc.getEdge("n_start-n_end")) {
        fc.removeEdge("n_start-n_end");
      }
    }
  } catch (e) {}

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
    throw new Error("Graph invalid: no path from n_start to n_end.");
  }

  return fc;
}

/* ---------------- serializeFlowchart ---------------- */
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

/* ---------------- diff helper ---------------- */
function computeDiffs(before = { nodes: [], edges: [] }, after = { nodes: [], edges: [] }) {
  const mapById = (arr) => {
    const m = new Map();
    for (const o of arr || []) m.set(o.id, o);
    return m;
  };

  const beforeNodes = mapById(before.nodes || []);
  const afterNodes = mapById(after.nodes || []);
  const beforeEdges = mapById(before.edges || []);
  const afterEdges = mapById(after.edges || []);

  const addedNodes = [];
  const removedNodeIds = [];
  const updatedNodes = [];

  for (const [id, node] of afterNodes.entries()) {
    if (!beforeNodes.has(id)) addedNodes.push(node);
    else {
      const bn = beforeNodes.get(id);
      if (JSON.stringify(bn) !== JSON.stringify(node)) updatedNodes.push(node);
    }
  }
  for (const id of beforeNodes.keys()) if (!afterNodes.has(id)) removedNodeIds.push(id);

  const addedEdges = [];
  const removedEdgeIdsRaw = [];
  const updatedEdges = [];

  for (const [id, edge] of afterEdges.entries()) {
    if (!beforeEdges.has(id)) addedEdges.push(edge);
    else {
      const be = beforeEdges.get(id);
      if (JSON.stringify(be) !== JSON.stringify(edge)) updatedEdges.push(edge);
    }
  }
  for (const id of beforeEdges.keys()) if (!afterEdges.has(id)) removedEdgeIdsRaw.push(id);

  const removedNodeSet = new Set(removedNodeIds);
  const removedEdgeIds = removedEdgeIdsRaw.filter(eid => {
    const be = beforeEdges.get(eid);
    if (!be) return false;
    if (removedNodeSet.has(be.source) || removedNodeSet.has(be.target)) return false;
    return true;
  });

  return {
    nodes: { added: addedNodes, removed: removedNodeIds, updated: updatedNodes },
    edges: { added: addedEdges, removed: removedEdgeIds, updated: updatedEdges }
  };
}

/* ---------------- routes ---------------- */

// NOTE: only insert-node and delete-node responses were modified to return *only* the diffs
// (i.e. the nodes/edges that changed) so the frontend receives a minimal payload.
// Response shape for these endpoints:
// { ok: true, flowchartId, diffs: { nodes: { added:[], removed:[], updated:[] }, edges: { added:[], removed:[], updated:[] } }, message }

router.post("/create", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const body = raw || {};

    const userId = body.userId;
    if (!userId) return res.status(400).json({ ok: false, error: "Missing userId" });

    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) return res.status(404).json({ ok: false, error: `User '${userId}' not found` });

    const labId = body.labId ?? "lab_mock_1";
    const overwrite = Boolean(body.overwrite);

    // ตรวจสอบ flowchart เดิม
    const existingFC = await prisma.flowchart.findFirst({ where: { userId, labId } });

    // สร้าง Start/End node + edge
    const fcPayload = {
      nodes: [
        {
          id: "n_start",
          type: "ST",
          label: "Start",
          data: { label: "Start" },
          position: { x: 0, y: 0 },
          incomingEdgeIds: [],
          outgoingEdgeIds: ["n_start-n_end"]
        },
        {
          id: "n_end",
          type: "EN",
          label: "End",
          data: { label: "End" },
          position: { x: 0, y: 0 },
          incomingEdgeIds: ["n_start-n_end"],
          outgoingEdgeIds: []
        }
      ],
      edges: [
        { id: "n_start-n_end", source: "n_start", target: "n_end", condition: "auto" }
      ],
      limits: {
        maxSteps: 100000,
        maxTimeMs: 5000,
        maxLoopIterationsPerNode: 20000
      }
    };

    let newFC;
    if (existingFC && overwrite) {
      newFC = await prisma.flowchart.update({
        where: { flowchartId: existingFC.flowchartId },
        data: { content: fcPayload }
      });
    } else if (!existingFC) {
      newFC = await prisma.flowchart.create({
        data: { userId, labId, content: fcPayload }
      });
    } else {
      // มี flowchart อยู่แล้ว และไม่ได้ overwrite
      const fcHydrated = hydrateFlowchart(existingFC.content);
      const serialized = serializeFlowchart(fcHydrated);
      savedFlowcharts.set(existingFC.flowchartId, existingFC.content);

      return res.json({
        ok: true,
        message: "Flowchart already exists",
        flowchartId: existingFC.flowchartId,
        member: { userId, labId },
        flowchart: serialized
      });
    }

    // save in-memory
    savedFlowcharts.set(newFC.flowchartId, fcPayload);

    // hydrate + serialize
    const fcHydrated = hydrateFlowchart(fcPayload);
    const serialized = serializeFlowchart(fcHydrated);

    return res.json({
      ok: true,
      flowchartId: newFC.flowchartId,
      member: { userId, labId },
      flowchart: serialized
    });

  } catch (err) {
    console.error("create error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});


router.post("/insert-node", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const body = raw || {};

    const flowchartId = body.flowchartId;
    const edgeId = body.edgeId;
    const nodeSpec = body.node;

    if (!flowchartId) return res.status(400).json({ ok: false, error: "Missing 'flowchartId'." });
    if (!edgeId) return res.status(400).json({ ok: false, error: "Missing 'edgeId'." });
    if (!nodeSpec || typeof nodeSpec !== "object") return res.status(400).json({ ok: false, error: "Missing 'node' object." });

    // โหลดจาก memory หรือ DB
    let saved = savedFlowcharts.get(flowchartId);
    if (!saved) {
      const fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: Number(flowchartId) } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
      saved = fcFromDB.content;
      savedFlowcharts.set(flowchartId, saved);
    }

    const fc = hydrateFlowchart(saved);

    if (!fc.getEdge(edgeId)) return res.status(400).json({ ok: false, error: `Edge '${edgeId}' not found in flowchart.` });

    const beforeSerialized = serializeFlowchart(fc);

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

    try { fc.insertNodeAtEdge(edgeId, newNode); }
    catch (err) { return res.status(500).json({ ok: false, error: String(err.message ?? err) }); }

    const afterSerialized = serializeFlowchart(fc);
    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    // save memory
    savedFlowcharts.set(flowchartId, afterSerialized);

    // update DB
    await prisma.flowchart.update({
      where: { flowchartId: Number(flowchartId) },
      data: { content: afterSerialized }
    });

    return res.json({ ok: true, message: `Inserted node ${newNode.id} at edge ${edgeId}`, flowchartId, diffs });

  } catch (err) {
    console.error("insert-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.delete("/:flowchartId/node/:nodeId", (req, res) => {
  try {
    const { flowchartId, nodeId } = req.params;
    const saved = savedFlowcharts.get(flowchartId);
    if (!saved) return res.status(404).json({ ok: false, error: "Flowchart not found" });

    if (!nodeId) return res.status(400).json({ ok: false, error: "Missing nodeId" });
    if (nodeId === "n_start" || nodeId === "n_end") {
      return res.status(400).json({ ok: false, error: "Cannot delete start or end node" });
    }

    // hydrate, perform removal using Flowchart logic (preserves wiring)
    const fc = hydrateFlowchart(saved);
    const targetNode = fc.getNode(nodeId);
    if (!targetNode) return res.status(404).json({ ok: false, error: `Node ${nodeId} not found` });

    // snapshot before
    const beforeSerialized = serializeFlowchart(fc);

    try {
      if (typeof fc.removeNode === "function") {
        fc.removeNode(nodeId);
      } else {
        // fallback: remove node and its edges
        for (const eid of Object.keys(fc.edges)) {
          const e = fc.getEdge(eid);
          if (e && (e.source === nodeId || e.target === nodeId)) fc.removeEdge(eid);
        }
        delete fc.nodes[nodeId];
      }
    } catch (err) {
      console.error("removeNode error:", err);
      return res.status(500).json({ ok: false, error: String(err.message ?? err) });
    }

    // snapshot after and compute diffs
    const afterSerialized = serializeFlowchart(fc);
    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    // save updated serialized graph
    savedFlowcharts.set(flowchartId, afterSerialized);

    // Return only diffs (no full flowchart payload)
    return res.json({ ok: true, message: `Node ${nodeId} deleted`, flowchartId, diffs });
  } catch (err) {
    console.error("delete node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    // ใช้ memory serialized เลย
    let serialized = savedFlowcharts.get(id);
    if (serialized) {
      return res.json({ ok: true, flowchartId: id, flowchart: serialized });
    }

    // ถ้าไม่มีใน memory โหลดจาก DB
    const fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: id } });
    if (!fcFromDB) return res.status(404).json({ ok: false, error: "Flowchart not found" });

    // save serialized ลง memory แบบตรง ๆ
    serialized = fcFromDB.content;
    savedFlowcharts.set(id, serialized);

    return res.json({ ok: true, flowchartId: id, flowchart: serialized });
  } catch (err) {
    console.error("get flowchart error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/:id/edges", async (req, res) => {
  try {
    const id = Number(req.params.id);

    let serialized = savedFlowcharts.get(id);
    if (!serialized) {
      const fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: id } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: "Flowchart not found" });
      serialized = fcFromDB.content;
      savedFlowcharts.set(id, serialized);
    }

    return res.json({ ok: true, flowchartId: id, edges: serialized.edges });
  } catch (err) {
    console.error("get edges error:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// Update node data
router.put("/:flowchartId/node/:nodeId", (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { /* keep raw */ }
    }
    const body = raw || {};

    const { flowchartId, nodeId } = req.params;
    if (!flowchartId) return res.status(400).json({ ok: false, error: "Missing flowchartId in path." });
    if (!nodeId) return res.status(400).json({ ok: false, error: "Missing nodeId in path." });

    const saved = savedFlowcharts.get(flowchartId);
    if (!saved) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });

    // hydrate current saved flowchart
    const fc = hydrateFlowchart(saved);

    const node = fc.getNode(nodeId);
    if (!node) return res.status(404).json({ ok: false, error: `Node '${nodeId}' not found in flowchart.` });

    // type must be provided in body (for validation)
    const rawType = body.type ?? body.typeShort ?? body.typeFull;
    if (!rawType) {
      return res.status(400).json({ ok: false, error: "Missing 'type' in request body. Provide node type for validation." });
    }
    const providedType = normalizeType(rawType);

    // ensure provided type matches existing node.type
    if (providedType !== node.type) {
      return res.status(400).json({
        ok: false,
        error: `Type mismatch: provided type '${providedType}' does not match existing node type '${node.type}'.`
      });
    }

    // data must be an object
    const newData = body.data;
    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ ok: false, error: "Missing or invalid 'data' object in request body." });
    }

    // validate required keys per Node.getDefaultData
    const defaultData = Node.getDefaultData(node.type) || {};
    const requiredKeys = Object.keys(defaultData);
    const missingKeys = requiredKeys.filter(k => !(k in newData));
    if (missingKeys.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Data missing required keys for type '${node.type}': ${missingKeys.join(", ")}`
      });
    }

    // perform update (merges)
    try {
      node.updateData(newData);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to update node data: ${String(err.message ?? err)}` });
    }

    // serialize and save updated flowchart (keep same pattern as other endpoints)
    const afterSerialized = serializeFlowchart(fc);
    savedFlowcharts.set(flowchartId, afterSerialized);

    // return updated node info
    const updatedNode = {
      id: node.id,
      type: node.type,
      label: node.label,
      data: node.data,
      position: node.position,
      incomingEdgeIds: node.incomingEdgeIds || [],
      outgoingEdgeIds: node.outgoingEdgeIds || [],
      loopEdge: node.loopEdge ?? null,
      loopExitEdge: node.loopExitEdge ?? null
    };

    return res.json({
      ok: true,
      message: `Node ${nodeId} updated`,
      flowchartId,
      node: updatedNode
    });
  } catch (err) {
    console.error("update-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

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
