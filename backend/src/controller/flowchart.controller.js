import express from "express";
import { Flowchart, Executor, Context, Node, Edge } from "../service/flowchart/index.js";
import prisma from "../lib/prisma.js";
const router = express.Router();

const savedFlowcharts = new Map();

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

router.post("/create", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const body = raw || {};

    const userId = body.userId;
    const labId = body.labId;
    const overwrite = Boolean(body.overwrite);

    if (!userId) return res.status(400).json({ ok: false, error: "Missing 'userId'." });
    if (!labId) return res.status(400).json({ ok: false, error: "Missing 'labId'." });

    // check DB
    const existingFC = await prisma.flowchart.findFirst({ where: { userId, labId } });

    // ถ้ามีอยู่แล้ว + ไม่ overwrite → return existing (pattern insert-node)
    if (existingFC && !overwrite) {
      const fcHydrated = hydrateFlowchart(existingFC.content);
      const serialized = serializeFlowchart(fcHydrated);
      savedFlowcharts.set(existingFC.flowchartId, existingFC.content);

      return res.json({
        ok: true,
        message: `Flowchart already exists for userId='${userId}' labId='${labId}'`,
        flowchartId: existingFC.flowchartId,
        member: { userId, labId },
        flowchart: serialized
      });
    }

    // สร้าง payload start/end
    const fcPayload = {
      nodes: [
        { id: "n_start", type: "ST", label: "Start", data: { label: "Start" }, position: { x: 0, y: 0 }, incomingEdgeIds: [], outgoingEdgeIds: ["n_start-n_end"] },
        { id: "n_end", type: "EN", label: "End", data: { label: "End" }, position: { x: 0, y: 0 }, incomingEdgeIds: ["n_start-n_end"], outgoingEdgeIds: [] }
      ],
      edges: [{ id: "n_start-n_end", source: "n_start", target: "n_end", condition: "auto" }],
      limits: { maxSteps: 100000, maxTimeMs: 5000, maxLoopIterationsPerNode: 20000 }
    };

    // save DB
    let newFC;
    if (existingFC && overwrite) {
      newFC = await prisma.flowchart.update({
        where: { flowchartId: existingFC.flowchartId },
        data: { content: fcPayload }
      });
    } else {
      newFC = await prisma.flowchart.create({
        data: { userId, labId, content: fcPayload }
      });
    }

    // save memory
    savedFlowcharts.set(newFC.flowchartId, fcPayload);

    // hydrate + serialize
    const fcHydrated = hydrateFlowchart(fcPayload);
    const serialized = serializeFlowchart(fcHydrated);

    return res.json({
      ok: true,
      message: `Flowchart created for userId='${userId}' labId='${labId}'`,
      flowchartId: newFC.flowchartId,
      member: { userId, labId },
      flowchart: serialized
    });

  } catch (err) {
    console.error("create error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
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
    const force = Boolean(body.force);

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

    // ถ้าเป็น Declare node -> ตรวจสอบว่าตัวแปรที่ประกาศมีการใช้แล้วหรือไม่
    const incomingType = normalizeType(nodeSpec.type ?? nodeSpec.typeShort ?? nodeSpec.typeFull ?? "PH");
    if (incomingType === "DC" || incomingType === "declare" || incomingType === "dc") {
      // helper: ดึงชื่อที่ประกาศออกมา (รองรับหลายรูปแบบของ data)
      const declaredNames = [];
      const d = nodeSpec.data || {};
      if (typeof d.name === "string" && d.name.trim()) declaredNames.push(d.name.trim());
      if (typeof d.varName === "string" && d.varName.trim()) declaredNames.push(d.varName.trim());
      if (Array.isArray(d.names)) {
        for (const nm of d.names) if (typeof nm === "string" && nm.trim()) declaredNames.push(nm.trim());
      }
      // unique
      const uniqueNames = [...new Set(declaredNames)];

      if (uniqueNames.length > 0 && !force) {
        // function: escape regex
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        const conflicts = [];
        const nodesArr = saved.nodes || [];
        for (const varName of uniqueNames) {
          const wordRe = new RegExp(`\\b${escapeRegExp(varName)}\\b`, "i");
          for (const n of nodesArr) {
            if (!n || !n.id) continue;
            // skip if the node is the incoming declare itself (unlikely in insert case)
            // check label
            if (n.label && typeof n.label === "string" && wordRe.test(n.label)) {
              conflicts.push({ varName, nodeId: n.id, label: n.label, foundIn: "label" });
              continue;
            }
            // check data (stringify defensive)
            try {
              const dataStr = JSON.stringify(n.data || {});
              if (wordRe.test(dataStr)) {
                conflicts.push({ varName, nodeId: n.id, label: n.label ?? null, foundIn: "data" });
              }
            } catch (e) {
              // ignore stringify errors
            }
          }
        }

        if (conflicts.length > 0) {
          return res.status(409).json({
            ok: false,
            error: "Variable name(s) already in use in this flowchart.",
            conflicts
          });
        }
      }
    }

    // proceed with hydrate + insertion (เดิมของคุณ)
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


router.delete("/:id/node/:nodeId", async (req, res) => {
  try {
    const rawId = req.params.id;
    const nodeId = req.params.nodeId;
    if (!rawId) return res.status(400).json({ ok: false, error: "Missing flowchart id in path." });
    if (!nodeId) return res.status(400).json({ ok: false, error: "Missing nodeId in path." });

    // normalize id: support numeric or string keys in cache/DB
    const numId = Number(rawId);
    const mapKey = Number.isNaN(numId) ? String(rawId) : numId;

    // load saved JSON (memory cache first)
    let saved = savedFlowcharts.get(mapKey);
    if (!saved) {
      const whereKey = Number.isNaN(numId) ? Number(rawId) : numId;
      const fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: whereKey } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: "Flowchart not found" });
      saved = fcFromDB.content;
      // normalize cache key to number when possible
      const cacheKey = Number(fcFromDB.flowchartId);
      savedFlowcharts.set(Number.isNaN(cacheKey) ? String(fcFromDB.flowchartId) : cacheKey, saved);
    }

    // quick check node exists in raw saved JSON (fast-fail)
    const nodeExists = (saved.nodes || []).some(n => n.id === nodeId);
    if (!nodeExists) return res.status(404).json({ ok: false, error: "Node not found" });

    // --- EXTRACT declared variable names from the node being deleted ---
    // (so we can remove them from any cached executor state or other registries)
    const deletedNodeRaw = (saved.nodes || []).find(n => n.id === nodeId) || null;
    const declaredNames = [];
    if (deletedNodeRaw) {
      // normalize type check (node may store type as "DC" or "declare")
      const nodeType = normalizeType(deletedNodeRaw.type ?? deletedNodeRaw.typeShort ?? deletedNodeRaw.typeFull ?? "");
      if (nodeType === "DC") {
        const d = deletedNodeRaw.data || {};
        if (typeof d.name === "string" && d.name.trim()) declaredNames.push(d.name.trim());
        if (typeof d.varName === "string" && d.varName.trim()) declaredNames.push(d.varName.trim());
        if (Array.isArray(d.names)) {
          for (const nm of d.names) if (typeof nm === "string" && nm.trim()) declaredNames.push(nm.trim());
        }
      }
    }
    const uniqueDeclaredNames = [...new Set(declaredNames)];

    // hydrate to Flowchart instance and keep before snapshot for diffs
    const fcBefore = hydrateFlowchart(saved);
    const beforeSerialized = serializeFlowchart(fcBefore);

    // use backend logic to remove node (this mutates fcBefore)
    try {
      fcBefore.removeNode(nodeId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to remove node: ${String(err.message ?? err)}` });
    }

    // serialize after-change
    const afterSerialized = serializeFlowchart(fcBefore);

    // optional: verify path start->end still exists (hydrateFlowchart earlier checked on create; here we can be defensive)
    try {
      // hasPathStartToEnd expects a Flowchart instance; reuse helper if available or re-hydrate
      // (we can check by hydrating from afterSerialized to be safe)
      const fcCheck = hydrateFlowchart(afterSerialized);
      // if hydrateFlowchart throws, it will be caught below
    } catch (err) {
      // If the removal broke graph (no path) — still persist? better to return error and not save.
      return res.status(400).json({ ok: false, error: `Graph invalid after removal: ${String(err.message ?? err)}` });
    }

    // compute diffs (same helper used by other endpoints)
    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    // --- Persist changes to DB ---
    // persist to DB (use number key if possible)
    const dbKey = Number.isNaN(Number(mapKey)) ? mapKey : Number(mapKey);
    await prisma.flowchart.update({
      where: { flowchartId: dbKey },
      data: { content: afterSerialized }
    });

    // update in-memory cache (flowchart content)
    savedFlowcharts.set(mapKey, afterSerialized);

    // --- Remove declared vars from any stored executor states (cache) ---
    // Update any keys starting with 'executorState_' to remove variables that were declared by deleted node.
    if (uniqueDeclaredNames.length > 0) {
      for (const [k, v] of Array.from(savedFlowcharts.entries())) {
        try {
          // We care only about executor snapshots saved under keys like executorState_<id>
          if (String(k).startsWith("executorState_") && v && typeof v === "object" && v.executor) {
            const es = v.executor;

            // remove from es.context.variables (array of { name, value, varType } or similar)
            if (es.context && Array.isArray(es.context.variables)) {
              es.context.variables = es.context.variables.filter(varObj => {
                if (!varObj || !varObj.name) return true;
                return !uniqueDeclaredNames.includes(String(varObj.name));
              });
            }

            // remove from es.context.output? (unlikely, but preserve)
            // remove from es.lastNode.variables if present
            if (es.lastNode && Array.isArray(es.lastNode.variables)) {
              es.lastNode.variables = es.lastNode.variables.filter(varObj => {
                if (!varObj || !varObj.name) return true;
                return !uniqueDeclaredNames.includes(String(varObj.name));
              });
            }

            // If flowchartNodeInternal or other internal snapshots hold variable-like keys, we leave them.
            // Save back modified snapshot
            savedFlowcharts.set(k, v);
          }
        } catch (e) {
          // don't fail delete because of cache cleanup; just warn (but keep going)
          console.warn("Failed to clean executor snapshot for deleted variables:", e);
        }
      }

      // Additionally: if the saved flowchart content included any top-level registry of variables (custom),
      // remove those entries too (defensive)
      try {
        const flowSaved = savedFlowcharts.get(mapKey);
        if (flowSaved && typeof flowSaved === "object") {
          // common possible places: flowSaved.variables (array of { name,... }) or flowSaved.declaredVariables
          if (Array.isArray(flowSaved.variables)) {
            flowSaved.variables = flowSaved.variables.filter(v => {
              if (!v || !v.name) return true;
              return !uniqueDeclaredNames.includes(String(v.name));
            });
          }
          if (Array.isArray(flowSaved.declaredVariables)) {
            flowSaved.declaredVariables = flowSaved.declaredVariables.filter(nm => !uniqueDeclaredNames.includes(String(nm)));
          }
          // save back
          savedFlowcharts.set(mapKey, flowSaved);
        }
      } catch (e) {
        console.warn("Failed to clean top-level declared variables in saved content:", e);
      }
    }

    // optional: remove any stored executorState for this flowchart (to avoid inconsistency)
    const execKey = `executorState_${mapKey}`;
    if (savedFlowcharts.has(execKey)) {
      // If you prefer to delete executor snapshot entirely instead of cleaning names, you can:
      // savedFlowcharts.delete(execKey);
      // For now we already attempted cleaning above; but keep this delete as a safety fallback:
      // If snapshot still contains no variables and you want to remove it, uncomment next lines:
      // const maybe = savedFlowcharts.get(execKey);
      // if (maybe && maybe.executor && Array.isArray(maybe.executor.context?.variables) && maybe.executor.context.variables.length === 0) savedFlowcharts.delete(execKey);
    }

    return res.json({
      ok: true,
      message: `Node ${nodeId} removed`,
      flowchartId: dbKey,
      diffs,
    });
  } catch (err) {
    console.error("delete node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const idParam = req.params.id;
    if (!idParam) return res.status(400).json({ ok: false, error: "Missing 'id' in path." });

    // try numeric lookup first, then fallback to string lookup
    const parsed = Number(idParam);
    let fcFromDB = null;

    if (!Number.isNaN(parsed)) {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: parsed } });
    }
    if (!fcFromDB) {
      // fallback: try string key (in case flowchartId is stored as string)
      try {
        fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: idParam } });
      } catch (e) {
        // some prisma schemas won't accept string for a numeric field; ignore error
      }
    }

    if (!fcFromDB) {
      return res.status(404).json({ ok: false, error: `Flowchart '${idParam}' not found.` });
    }

    // get payload from DB
    const saved = fcFromDB.content;

    // normalize memory key: prefer Number if possible
    const mapKey = Number(fcFromDB.flowchartId);
    savedFlowcharts.set(Number.isNaN(mapKey) ? String(fcFromDB.flowchartId) : mapKey, saved);

    // hydrate + serialize for consumer-friendly representation
    const fc = hydrateFlowchart(saved);
    const serialized = serializeFlowchart(fc);

    return res.json({
      ok: true,
      flowchartId: fcFromDB.flowchartId,
      // include both serialized (hydrated) representation and raw content from DB
      flowchart: serialized,
      raw: saved
    });
  } catch (err) {
    console.error("get flowchart error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.get("/:id/edges", async (req, res) => {
  try {
    const { id } = req.params;

    const edges = await prisma.edge.findMany({
      where: { flowchartId: parseInt(id) },
    });

    return res.json({ ok: true, edges });
  } catch (err) {
    console.error("GET /:id/edges error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// Update node data
// Update node data (with variable-name conflict check for Declare nodes)
router.put("/:flowchartId/node/:nodeId", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { /* keep raw */ }
    }
    const body = raw || {};

    const flowchartId = Number(req.params.flowchartId);
    const nodeId = req.params.nodeId;

    if (!flowchartId) return res.status(400).json({ ok: false, error: "Missing flowchartId in path." });
    if (!nodeId) return res.status(400).json({ ok: false, error: "Missing nodeId in path." });

    // โหลดจาก memory หรือ DB
    let saved = savedFlowcharts.get(flowchartId);
    if (!saved) {
      const fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
      saved = fcFromDB.content;
      savedFlowcharts.set(flowchartId, saved);
    }

    // hydrate
    const fc = hydrateFlowchart(saved);
    const beforeSerialized = serializeFlowchart(fc);

    const node = fc.getNode(nodeId);
    if (!node) return res.status(404).json({ ok: false, error: `Node '${nodeId}' not found in flowchart.` });

    // type check (existing behavior)
    const rawType = body.type ?? body.typeShort ?? body.typeFull;
    if (!rawType) {
      return res.status(400).json({ ok: false, error: "Missing 'type' in request body. Provide node type for validation." });
    }
    const providedType = normalizeType(rawType);
    if (providedType !== node.type) {
      return res.status(400).json({
        ok: false,
        error: `Type mismatch: provided type '${providedType}' does not match existing node type '${node.type}'.`
      });
    }

    // data validate (existing behavior)
    const newData = body.data;
    if (!newData || typeof newData !== "object") {
      return res.status(400).json({ ok: false, error: "Missing or invalid 'data' object in request body." });
    }

    const defaultData = Node.getDefaultData(node.type) || {};
    const requiredKeys = Object.keys(defaultData);
    const missingKeys = requiredKeys.filter(k => !(k in newData));
    if (missingKeys.length > 0) {
      return res.status(400).json({
        ok: false,
        error: `Data missing required keys for type '${node.type}': ${missingKeys.join(", ")}`
      });
    }

    // -------------------------
    // Conflict detection: ถ้าเป็น Declare node ให้ตรวจสอบชื่อที่ประกาศว่า "มีการใช้แล้ว" หรือไม่
    // รองรับการส่งตัวเลือก force: true เพื่อบังคับข้ามการตรวจสอบ
    // -------------------------
    const force = Boolean(body.force);

    if (node.type === "DC") {
      // helper: ดึงชื่อที่ประกาศออกมาจาก newData (รองรับ name, varName, names[])
      const declaredNames = [];
      const d = newData || {};
      if (typeof d.name === "string" && d.name.trim()) declaredNames.push(d.name.trim());
      if (typeof d.varName === "string" && d.varName.trim()) declaredNames.push(d.varName.trim());
      if (Array.isArray(d.names)) {
        for (const nm of d.names) if (typeof nm === "string" && nm.trim()) declaredNames.push(nm.trim());
      }
      const uniqueNames = [...new Set(declaredNames)];

      if (uniqueNames.length > 0 && !force) {
        // escape regex special chars
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const conflicts = [];
        const nodesArr = saved.nodes || [];

        for (const varName of uniqueNames) {
          const wordRe = new RegExp(`\\b${escapeRegExp(varName)}\\b`, "i");
          for (const n of nodesArr) {
            if (!n || !n.id) continue;
            if (n.id === nodeId) continue; // อย่าตรวจสอบกับ node ที่กำลังแก้เอง
            // check label
            if (n.label && typeof n.label === "string" && wordRe.test(n.label)) {
              conflicts.push({ varName, nodeId: n.id, label: n.label, foundIn: "label" });
              continue;
            }
            // check data (stringify defensive)
            try {
              const dataStr = JSON.stringify(n.data || {});
              if (wordRe.test(dataStr)) {
                conflicts.push({ varName, nodeId: n.id, label: n.label ?? null, foundIn: "data" });
              }
            } catch (e) {
              // ignore stringify errors
            }
          }
        }

        if (conflicts.length > 0) {
          return res.status(409).json({
            ok: false,
            error: "Variable name(s) already in use in this flowchart.",
            conflicts
          });
        }
      }
    }

    // update - ใช้ method เดิมของ Node
    try {
      node.updateData(newData);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to update node data: ${String(err.message ?? err)}` });
    }

    const afterSerialized = serializeFlowchart(fc);
    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    // save memory + db
    savedFlowcharts.set(flowchartId, afterSerialized);
    await prisma.flowchart.update({
      where: { flowchartId },
      data: { content: afterSerialized }
    });

    return res.json({
      ok: true,
      message: `Node ${nodeId} updated`,
      flowchartId,
      diffs
    });
  } catch (err) {
    console.error("update-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});


// (วางทับฟังก์ชัน router.post("/execute", ...) ใน controller ของคุณ)
router.post("/execute", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { /* keep raw */ }
    }
    const body = raw || {};

    const flowchartIdRaw = body.flowchartId;
    if (!flowchartIdRaw && flowchartIdRaw !== 0) {
      return res.status(400).json({ ok: false, error: "Missing 'flowchartId' in request. Must provide the saved flowchart id to execute." });
    }

    const fid = Number(flowchartIdRaw);
    let saved = savedFlowcharts.get(fid);
    if (!saved) saved = savedFlowcharts.get(String(flowchartIdRaw));

    // fallback: load from DB
    if (!saved) {
      const fcFromDB = await prisma.flowchart.findUnique({
        where: { flowchartId: isNaN(fid) ? Number(flowchartIdRaw) : fid }
      });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartIdRaw}' not found.` });
      saved = fcFromDB.content;
      const mapKey = Number(fcFromDB.flowchartId);
      savedFlowcharts.set(isNaN(mapKey) ? String(fcFromDB.flowchartId) : mapKey, saved);
    }

    const action = body.action ?? "run";
    const variables = body.variables;
    const options = body.options || {};
    const restoreState = body.restoreState || {};
    const forceAdvanceBP = Boolean(body.forceAdvanceBP);

    // hydrate flowchart
    const fc = hydrateFlowchart(saved);
    const executor = new Executor(fc, options);

    // restore executor state if provided in request.restoreState
    if (restoreState && restoreState.context && Array.isArray(restoreState.context.variables)) {
      for (const v of restoreState.context.variables) {
        if (v && v.name) executor.context.set(v.name, v.value, v.varType);
      }
    }
    if (restoreState.currentNodeId) executor.currentNodeId = restoreState.currentNodeId;
    if (typeof restoreState.finished === "boolean") executor.finished = restoreState.finished;
    if (typeof restoreState.paused === "boolean") executor.paused = restoreState.paused;
    if (typeof restoreState.stepCount === "number") executor.stepCount = restoreState.stepCount;

    // If restoreState includes node internals, apply them onto hydrated flowchart nodes
    if (restoreState.flowchartNodeInternal && typeof restoreState.flowchartNodeInternal === "object") {
      try {
        for (const nid of Object.keys(restoreState.flowchartNodeInternal)) {
          const nodeState = restoreState.flowchartNodeInternal[nid];
          const node = executor.flowchart.getNode(nid);
          if (!node) continue;
          // copy only safe properties
          if ('_initialized' in nodeState) node._initialized = !!nodeState._initialized;
          if ('_phase' in nodeState) node._phase = nodeState._phase;
          if ('_loopCount' in nodeState) node._loopCount = Number(nodeState._loopCount) || 0;
          if ('_scopePushed' in nodeState) node._scopePushed = !!nodeState._scopePushed;
          if ('_initValue' in nodeState) node._initValue = nodeState._initValue;
        }
      } catch (e) {
        console.warn("Failed to apply restoreState.flowchartNodeInternal:", e);
      }
    }

    // apply variables from request BEFORE action handling
    if (Array.isArray(variables)) {
      for (const v of variables) {
        if (v && v.name) executor.context.set(v.name, v.value, v.varType);
      }
    } else if (variables && typeof variables === "object") {
      for (const k of Object.keys(variables)) {
        const val = variables[k];
        if (val && typeof val === "object" && ("value" in val || "varType" in val)) {
          executor.context.set(k, val.value, val.varType);
        } else {
          executor.context.set(k, val);
        }
      }
    }

    // --- handle actions ---
    if (action === "reset") {
      executor.reset();
      const lastStateKey = `executorState_${fid}`;
      savedFlowcharts.delete(lastStateKey);

      return res.json({
        ok: true,
        message: "reset",
        context: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    if (action === "runAll") {
      const ignoreBreakpoints = Boolean(options.ignoreBreakpoints || body.ignoreBreakpoints);
      const nodeStates = [];

      while (!executor.finished) {
        const nodeIdBefore = executor.currentNodeId;
        const result = executor.step({ forceAdvanceBP: ignoreBreakpoints });
        nodeStates.push({
          nodeId: nodeIdBefore,
          output: [...executor.context.output],
          variables: [...executor.context.variables]
        });
        if (result && result.error) break;
        if (executor.paused && !ignoreBreakpoints) break;
      }

      return res.json({
        ok: true,
        message: "runAll completed",
        flowchartId: fid,
        nodeStates,
        finalContext: {
          variables: executor.context.variables,
          output: executor.context.output
        }
      });
    }

    if (action === "step") {
      const lastStateKey = `executorState_${fid}`;
      const lastState = savedFlowcharts.get(lastStateKey);

      // restore previous executor state ถ้า state เดิมมีอยู่
      if (lastState && lastState.executor) {
        const es = lastState.executor;
        if (es.currentNodeId) executor.currentNodeId = es.currentNodeId;
        if (typeof es.finished === "boolean") executor.finished = es.finished;
        if (typeof es.paused === "boolean") executor.paused = es.paused;
        if (typeof es.stepCount === "number") executor.stepCount = es.stepCount;
        if (es.context && Array.isArray(es.context.variables)) {
          for (const v of es.context.variables) {
            if (v && v.name) executor.context.set(v.name, v.value, v.varType);
          }
        }
        // restore flowchart node internals if present
        if (es.flowchartNodeInternal && typeof es.flowchartNodeInternal === "object") {
          for (const nid of Object.keys(es.flowchartNodeInternal)) {
            const nodeState = es.flowchartNodeInternal[nid];
            const node = executor.flowchart.getNode(nid);
            if (!node) continue;
            if ('_initialized' in nodeState) node._initialized = !!nodeState._initialized;
            if ('_phase' in nodeState) node._phase = nodeState._phase;
            if ('_loopCount' in nodeState) node._loopCount = Number(nodeState._loopCount) || 0;
            if ('_scopePushed' in nodeState) node._scopePushed = !!nodeState._scopePushed;
            if ('_initValue' in nodeState) node._initValue = nodeState._initValue;
          }
        }
      }

      // ถ้า finished หรือเพิ่ง reset ให้เริ่มจาก start node
      if (executor.finished || !lastState) {
        executor.reset();
      }

      // apply variables ใหม่ถ้ามีส่งมาพร้อม step
      if (Array.isArray(variables)) {
        for (const v of variables) {
          if (v && v.name) executor.context.set(v.name, v.value, v.varType);
        }
      } else if (variables && typeof variables === "object") {
        for (const k of Object.keys(variables)) {
          const val = variables[k];
          if (val && typeof val === "object" && ("value" in val || "varType" in val)) {
            executor.context.set(k, val.value, val.varType);
          } else {
            executor.context.set(k, val);
          }
        }
      }

      // execute single step
      const result = executor.step({ forceAdvanceBP });

      // build flowchartNodeInternal snapshot to save node-local flags
      const flowchartNodeInternal = {};
      try {
        for (const [nid, nobj] of Object.entries(executor.flowchart.nodes || {})) {
          flowchartNodeInternal[nid] = {
            _initialized: !!nobj._initialized,
            _phase: nobj._phase || null,
            _loopCount: nobj._loopCount || 0,
            _scopePushed: !!nobj._scopePushed,
            _initValue: typeof nobj._initValue !== 'undefined' ? nobj._initValue : null
          };
        }
      } catch (e) {
        console.warn("Failed to snapshot flowchart node internals:", e);
      }

      // next node info
      let nextNodeId = executor.finished ? null : executor.currentNodeId;
      let nextNodeType = null;
      if (nextNodeId && executor.flowchart && typeof executor.flowchart.getNode === "function") {
        const nextNode = executor.flowchart.getNode(nextNodeId);
        if (nextNode) nextNodeType = nextNode.type;
      }

      // save executor state per flowchart (including node internals)
      savedFlowcharts.set(lastStateKey, {
        executor: {
          currentNodeId: executor.currentNodeId,
          finished: executor.finished,
          paused: executor.paused,
          stepCount: executor.stepCount,
          context: {
            variables: executor.context.variables,
            output: executor.context.output
          },
          lastNode: {
            nodeId: result.node?.id,
            type: result.node?.type,
            output: result.node ? [...executor.context.output] : [],
            variables: result.node ? [...executor.context.variables] : []
          },
          flowchartNodeInternal
        }
      });

      return res.json({
        ok: true,
        node: result.node
          ? {
              id: result.node.id,
              type: result.node.type,
              output: [...executor.context.output],
              variables: [...executor.context.variables]
            }
          : null,
        nextNodeId,
        nextNodeType,
        context: { variables: executor.context.variables, output: executor.context.output },
        paused: result.paused ?? false,
        done: result.done ?? false,
        reenter: result.reenter ?? false
      });
    }

    if (action === "resume") {
      const result = executor.resume({ forceAdvanceBP });
      return res.json({
        ok: true,
        result,
        context: { variables: executor.context.variables, output: executor.context.output }
      });
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
