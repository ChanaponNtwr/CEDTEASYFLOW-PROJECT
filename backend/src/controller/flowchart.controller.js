// flowchart.controller.js
import express from "express";
import { Flowchart, Executor, Context, Node, Edge } from "../service/flowchart/index.js";
import prisma from "../lib/prisma.js";
import SubmissionService from "../service/submission/index.js";
const router = express.Router();

const savedFlowcharts = new Map();

/**
 * Permission helper: ตรวจสอบว่า req (client) เป็นผู้สร้าง flowchart หรือไม่
 * - รับ userId จาก req.body.userId หรือ req.query.userId
 * - ถ้าไม่มี userId จะ throw error status 400
 * - ถ้า userId != flowchart.userId จะ throw error status 403
 *
 * หมายเหตุ: ถ้าคุณใช้ระบบ auth แบบ JWT ให้เปลี่ยนให้ assertFlowchartOwner อ่านจาก req.user.id แทนการให้ client ส่ง userId
 */
function assertFlowchartOwner(req, flowchart) {
  const userId = req.body?.userId ?? req.query?.userId;

  if (!userId) {
    const err = new Error("Missing userId for permission check.");
    err.status = 400;
    throw err;
  }

  if (Number(userId) !== Number(flowchart.userId)) {
    const err = new Error("สามารถแก้ไข Flowchart ได้เฉพาะผู้สร้าง Flowchart เท่านั้น");
    err.status = 403;
    throw err;
  }
}

/**
 * ตรวจสอบว่า userId ใน request ตรงกับเจ้าของ flowchart หรือไม่
 * คืนค่า true = เป็นเจ้าของ, false = ไม่ใช่เจ้าของ
 * ถ้าไม่มี userId ใน request คืนค่า false
 */
function isFlowchartOwner(req, flowchart) {
  const userId = req.body?.userId ?? req.query?.userId;
  if (!userId) return false;
  return Number(userId) === Number(flowchart.userId);
}

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

/**
 * Helper: compute shape limits for a lab.
 */
function computeShapeLimitFromLab(lab) {
  const mapping = {
    PH: null,
    DC: "declareSymVal",
    AS: "assignSymVal",
    IF: "ifSymVal",
    FOR: "forSymVal",
    WH: "whileSymVal",
    IN: "inSymVal",
    OU: "outSymVal",
    ST: null,
    EN: null
  };

  let ps = null;
  if (lab && lab.problemSolving) {
    try {
      ps = typeof lab.problemSolving === 'string' ? JSON.parse(lab.problemSolving) : lab.problemSolving;
    } catch (e) {
      ps = null;
    }
  }

  const shapeLimit = {};
  for (const key of Object.keys(mapping)) {
    let val = undefined;

    if (ps && ps.shapeConfig && Object.prototype.hasOwnProperty.call(ps.shapeConfig, key)) {
      val = ps.shapeConfig[key];
    }

    if (typeof val === "undefined" || val === null) {
      const col = mapping[key];
      if (col && lab && typeof lab[col] !== "undefined" && lab[col] !== null) {
        val = lab[col];
      }
    }

    if (typeof val === "string") {
      if (String(val).trim().toLowerCase() === "unlimited") {
        shapeLimit[key] = Infinity;
        continue;
      }
      const asNum = Number(val);
      if (!Number.isNaN(asNum)) {
        val = asNum;
      }
    }

    if (typeof val === "number") {
      if (val === -1) {
        shapeLimit[key] = Infinity;
      } else {
        shapeLimit[key] = val;
      }
      continue;
    }

    if (key === "PH" || key === "ST" || key === "EN") shapeLimit[key] = Infinity;
    else shapeLimit[key] = 0;
  }

  return shapeLimit;
}

/* -------------------------
   ROUTES
   ------------------------- */

// ─────────────────────────────────────────────
// POST /create  →  เจ้าของเท่านั้น
// ─────────────────────────────────────────────
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

    // 🔒 check submission lock (CONFIRMED only)
    const confirmedSubmission = await prisma.submission.findFirst({
      where: { userId, labId, status: "CONFIRMED" }
    });
    const submissionLocked = Boolean(confirmedSubmission);

    const existingFC = await prisma.flowchart.findFirst({
      where: { userId, labId }
    });

    if (existingFC && !overwrite) {
      const hydrated = hydrateFlowchart(existingFC.content);
      const serialized = serializeFlowchart(hydrated);
      savedFlowcharts.set(existingFC.flowchartId, existingFC.content);

      return res.json({
        ok: true,
        message: `Flowchart already exists for userId='${userId}' labId='${labId}'`,
        flowchartId: existingFC.flowchartId,
        member: { userId, labId },
        submissionLocked,
        flowchart: serialized
      });
    }

    // ถ้า overwrite ต้องเป็นเจ้าของเท่านั้น
    if (existingFC && overwrite) {
      if (Number(existingFC.userId) !== Number(userId)) {
        return res.status(403).json({
          ok: false,
          error: "สามารถแก้ไข Flowchart ได้เฉพาะผู้สร้าง Flowchart เท่านั้น"
        });
      }
    }

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
    } else {
      newFC = await prisma.flowchart.create({
        data: { userId, labId, content: fcPayload }
      });
    }

    savedFlowcharts.set(newFC.flowchartId, fcPayload);

    const hydrated = hydrateFlowchart(fcPayload);
    const serialized = serializeFlowchart(hydrated);

    return res.json({
      ok: true,
      message: `Flowchart created for userId='${userId}' labId='${labId}'`,
      flowchartId: newFC.flowchartId,
      member: { userId, labId },
      submissionLocked,
      flowchart: serialized
    });

  } catch (err) {
    console.error("create error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// POST /insert-node  →  เจ้าของเท่านั้น
// ─────────────────────────────────────────────
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

    let saved = savedFlowcharts.get(flowchartId);
    let fcFromDB = null;

    if (!saved) {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: Number(flowchartId) } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
      saved = fcFromDB.content;
      savedFlowcharts.set(flowchartId, saved);
    } else {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: Number(flowchartId) } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
    }

    // 🔐 เจ้าของเท่านั้นที่ insert node ได้
    try {
      assertFlowchartOwner(req, fcFromDB);
    } catch (err) {
      return res.status(err.status || 403).json({ ok: false, error: err.message });
    }

    // 🔒 submission lock
    const confirmedSubmission = await prisma.submission.findFirst({
      where: { userId: fcFromDB.userId, labId: fcFromDB.labId, status: "CONFIRMED" }
    });
    if (confirmedSubmission) {
      return res.status(403).json({ ok: false, error: "This lab has already been confirmed by instructor. Flowchart is read-only." });
    }

    const fc = hydrateFlowchart(saved);

    if (!fc.getEdge(edgeId)) return res.status(400).json({ ok: false, error: `Edge '${edgeId}' not found in flowchart.` });

    const typ = normalizeType(nodeSpec.type ?? nodeSpec.typeShort ?? nodeSpec.typeFull ?? "PH");

    const lab = await prisma.lab.findUnique({ where: { labId: fcFromDB.labId } });
    if (!lab) return res.status(404).json({ ok: false, error: "Lab config not found." });

    const shapeLimit = computeShapeLimitFromLab(lab);

    const fcNodesBefore = Object.values(fc.nodes || {});
    const usedCountBefore = {};
    for (const key of Object.keys(shapeLimit)) usedCountBefore[key] = 0;
    for (const n of fcNodesBefore) {
      const nodeType = normalizeType(n.type ?? n.typeShort ?? n.typeFull ?? "PH");
      if (usedCountBefore[nodeType] !== undefined) usedCountBefore[nodeType]++;
    }

    if (shapeLimit[typ] !== Infinity && usedCountBefore[typ] >= shapeLimit[typ]) {
      return res.status(409).json({
        ok: false,
        error: `Cannot insert node '${typ}': shape limit reached.`,
        limit: shapeLimit[typ],
        used: usedCountBefore[typ]
      });
    }

    if (typ === "DC") {
      const declaredNames = [];
      const d = nodeSpec.data || {};
      if (typeof d.name === "string" && d.name.trim()) declaredNames.push(d.name.trim().toLowerCase());
      if (typeof d.varName === "string" && d.varName.trim()) declaredNames.push(d.varName.trim().toLowerCase());
      if (Array.isArray(d.names)) {
        for (const nm of d.names) {
          if (typeof nm === "string" && nm.trim()) declaredNames.push(nm.trim().toLowerCase());
        }
      }
      const uniqueNames = [...new Set(declaredNames)];

      if (uniqueNames.length > 0 && !force) {
        const conflicts = [];
        const nodesArr = Object.values(fc.nodes || {});
        for (const n of nodesArr) {
          const nodeType = normalizeType(n.type ?? n.typeShort ?? n.typeFull ?? "");
          if (nodeType !== "DC") continue;
          const nd = n.data || {};
          const existingNames = [];
          if (typeof nd.name === "string" && nd.name.trim()) existingNames.push(nd.name.trim().toLowerCase());
          if (typeof nd.varName === "string" && nd.varName.trim()) existingNames.push(nd.varName.trim().toLowerCase());
          if (Array.isArray(nd.names)) {
            for (const nm of nd.names) {
              if (typeof nm === "string" && nm.trim()) existingNames.push(nm.trim().toLowerCase());
            }
          }
          for (const newName of uniqueNames) {
            if (existingNames.includes(newName)) {
              conflicts.push({ varName: newName, nodeId: n.id, foundIn: "declare" });
            }
          }
        }
        if (conflicts.length > 0) {
          return res.status(409).json({ ok: false, error: "Variable already declared in this flowchart.", conflicts });
        }
      }
    }

    const nodeId = nodeSpec.id || (typeof fc.genId === "function" ? fc.genId() : `n_${Date.now()}`);
    const newNode = new Node(
      nodeId, typ, nodeSpec.label ?? "", nodeSpec.data ?? {},
      nodeSpec.position ?? { x: 0, y: 0 },
      nodeSpec.incomingEdgeIds ?? [], nodeSpec.outgoingEdgeIds ?? []
    );
    if (nodeSpec.loopEdge) newNode.loopEdge = nodeSpec.loopEdge;
    if (nodeSpec.loopExitEdge) newNode.loopExitEdge = nodeSpec.loopExitEdge;

    const beforeSerialized = serializeFlowchart(fc);
    try {
      fc.insertNodeAtEdge(edgeId, newNode);
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message ?? err) });
    }

    const afterSerialized = serializeFlowchart(fc);
    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    savedFlowcharts.set(flowchartId, afterSerialized);
    await prisma.flowchart.update({ where: { flowchartId: Number(flowchartId) }, data: { content: afterSerialized } });

    const fcNodesAfter = Object.values(fc.nodes || {});
    const usedCount = {};
    for (const k of Object.keys(shapeLimit)) usedCount[k] = 0;
    for (const n of fcNodesAfter) {
      const t = normalizeType(n.type ?? n.typeShort ?? n.typeFull ?? "PH");
      if (usedCount[t] !== undefined) usedCount[t]++;
    }

    const shapeRemaining = {};
    const keysMap = [
      { out: "PH", in: "PH" }, { out: "DC", in: "DC" }, { out: "AS", in: "AS" },
      { out: "IF", in: "IF" }, { out: "FOR", in: "FOR" }, { out: "WHILE", in: "WH" },
      { out: "ST", in: "ST" }, { out: "EN", in: "EN" }
    ];
    for (const mapping of keysMap) {
      const lim = shapeLimit[mapping.in];
      const used = usedCount[mapping.in] ?? 0;
      if (lim === Infinity) {
        shapeRemaining[mapping.out] = { limit: "unlimited", used, remaining: "unlimited" };
      } else {
        shapeRemaining[mapping.out] = { limit: lim, used, remaining: Math.max(lim - used, 0) };
      }
    }

    return res.json({
      ok: true,
      message: `Inserted node ${newNode.id} at edge ${edgeId}`,
      flowchartId,
      diffs,
      shapeRemaining
    });

  } catch (err) {
    console.error("insert-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// DELETE /:id/node/:nodeId  →  เจ้าของเท่านั้น
// ─────────────────────────────────────────────
router.delete("/:id/node/:nodeId", async (req, res) => {
  try {
    const rawId = req.params.id;
    const nodeId = req.params.nodeId;

    if (!rawId) return res.status(400).json({ ok: false, error: "Missing flowchart id in path." });
    if (!nodeId) return res.status(400).json({ ok: false, error: "Missing nodeId in path." });

    const numId = Number(rawId);
    const mapKey = Number.isNaN(numId) ? String(rawId) : numId;

    let saved = savedFlowcharts.get(mapKey);
    let fcFromDB = null;

    if (!saved) {
      const whereKey = Number.isNaN(numId) ? Number(rawId) : numId;
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: whereKey } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: "Flowchart not found" });
      saved = fcFromDB.content;
      const cacheKey = Number(fcFromDB.flowchartId);
      savedFlowcharts.set(Number.isNaN(cacheKey) ? String(fcFromDB.flowchartId) : cacheKey, saved);
    } else {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: Number(mapKey) } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: "Flowchart not found" });
    }

    // 🔐 เจ้าของเท่านั้นที่ลบ node ได้
    try {
      assertFlowchartOwner(req, fcFromDB);
    } catch (err) {
      return res.status(err.status || 403).json({ ok: false, error: err.message });
    }

    // 🔒 submission lock
    const confirmedSubmission = await prisma.submission.findFirst({
      where: { userId: fcFromDB.userId, labId: fcFromDB.labId, status: "CONFIRMED" }
    });
    if (confirmedSubmission) {
      return res.status(403).json({
        ok: false,
        error: "This lab has already been confirmed by instructor. Flowchart is read-only."
      });
    }

    const nodeExists = (saved.nodes || []).some(n => n.id === nodeId);
    if (!nodeExists) return res.status(404).json({ ok: false, error: "Node not found" });

    const deletedNodeRaw = (saved.nodes || []).find(n => n.id === nodeId) || null;
    const declaredNames = [];
    if (deletedNodeRaw) {
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

    const fcBefore = hydrateFlowchart(saved);
    const beforeSerialized = serializeFlowchart(fcBefore);

    try {
      fcBefore.removeNode(nodeId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to remove node: ${String(err.message ?? err)}` });
    }

    const afterSerialized = serializeFlowchart(fcBefore);
    try {
      hydrateFlowchart(afterSerialized);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Graph invalid after removal: ${String(err.message ?? err)}` });
    }

    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    await prisma.flowchart.update({ where: { flowchartId: Number(fcFromDB.flowchartId) }, data: { content: afterSerialized } });
    savedFlowcharts.set(mapKey, afterSerialized);

    if (uniqueDeclaredNames.length > 0) {
      for (const [k, v] of savedFlowcharts.entries()) {
        try {
          if (String(k).startsWith("executorState_") && v && typeof v === "object" && v.executor) {
            const es = v.executor;
            if (es.context && Array.isArray(es.context.variables)) {
              es.context.variables = es.context.variables.filter(v => !uniqueDeclaredNames.includes(String(v.name)));
            }
            if (es.lastNode && Array.isArray(es.lastNode.variables)) {
              es.lastNode.variables = es.lastNode.variables.filter(v => !uniqueDeclaredNames.includes(String(v.name)));
            }
            savedFlowcharts.set(k, v);
          }
        } catch (e) {
          console.warn("Failed to clean executor snapshot:", e);
        }
      }
    }

    // คำนวณ shapeRemaining หลังลบ (นับ nodes ที่เหลือจริง รวม cascade-delete)
    let shapeRemaining = {};
    try {
      const lab = await prisma.lab.findUnique({ where: { labId: fcFromDB.labId } });
      if (lab) {
        const shapeLimit = computeShapeLimitFromLab(lab);
        const fcAfter = hydrateFlowchart(afterSerialized);
        const fcNodesAfter = Object.values(fcAfter.nodes || {});

        const usedCount = {};
        for (const key of Object.keys(shapeLimit)) usedCount[key] = 0;
        for (const n of fcNodesAfter) {
          const t = normalizeType(n.type ?? n.typeShort ?? n.typeFull ?? "PH");
          if (usedCount[t] !== undefined) usedCount[t]++;
        }

        for (const key of Object.keys(shapeLimit)) {
          const limit = shapeLimit[key];
          const used = usedCount[key] ?? 0;
          shapeRemaining[key] = {
            limit: limit === Infinity ? "unlimited" : limit,
            used,
            remaining: limit === Infinity ? "unlimited" : Math.max(limit - used, 0),
          };
        }
      }
    } catch (e) {
      console.warn("Failed to compute shapeRemaining after delete:", e);
    }

    return res.json({
      ok: true,
      message: `Node ${nodeId} removed`,
      flowchartId: fcFromDB.flowchartId,
      diffs,
      shapeRemaining,
    });

  } catch (err) {
    console.error("delete node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// GET /:flowchartId/shapes/remaining  →  ทุกคนดูได้
// ─────────────────────────────────────────────
router.get("/:flowchartId/shapes/remaining", async (req, res) => {
  try {
    const flowchartId = Number(req.params.flowchartId);
    if (!flowchartId) return res.status(400).json({ ok: false, error: "Missing flowchartId." });

    const fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId } });
    if (!fcFromDB) return res.status(404).json({ ok: false, error: "Flowchart not found." });

    const lab = await prisma.lab.findUnique({ where: { labId: fcFromDB.labId } });
    if (!lab) return res.status(404).json({ ok: false, error: "Lab config not found." });

    const shapeLimit = computeShapeLimitFromLab(lab);
    const fc = hydrateFlowchart(fcFromDB.content);
    const fcNodes = Object.values(fc.nodes || {});
    const usedCount = {};
    for (const key of Object.keys(shapeLimit)) usedCount[key] = 0;
    for (const n of fcNodes) {
      const typ = normalizeType(n.type ?? n.typeShort ?? n.typeFull ?? "PH");
      if (usedCount[typ] !== undefined) usedCount[typ]++;
    }

    const shapeRemaining = {};
    for (const key of Object.keys(shapeLimit)) {
      const limit = shapeLimit[key];
      shapeRemaining[key] = {
        limit: limit === Infinity ? "Unlimited" : limit,
        used: usedCount[key],
        remaining: limit === Infinity ? "Unlimited" : Math.max(limit - usedCount[key], 0)
      };
    }

    return res.json({ ok: true, flowchartId, shapeRemaining });

  } catch (err) {
    console.error("get shapeRemaining error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// GET /by-user  →  ทุกคนดูได้ (lightweight list)
// ─────────────────────────────────────────────
router.get("/by-user", async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId) {
      return res.status(400).json({ ok: false, error: "Missing 'userId' query parameter." });
    }

    const flowcharts = await prisma.flowchart.findMany({
      where: { userId },
      select: {
        flowchartId: true,
        labId: true,
        lab: { select: { labname: true } },
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    const confirmed = await prisma.submission.findMany({
      where: { userId, status: "CONFIRMED" },
      select: { labId: true }
    });
    const confirmedLabIds = new Set(confirmed.map(r => Number(r.labId)));

    const result = flowcharts.map(fc => ({
      flowchartId: fc.flowchartId,
      labId: fc.labId,
      labName: fc.lab?.labname ?? null,
      submissionLocked: confirmedLabIds.has(Number(fc.labId))
    }));

    return res.json({ ok: true, flowcharts: result });

  } catch (err) {
    console.error("by-user error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// GET /:id  →  ทุกคนดูได้
// ─────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const idParam = req.params.id;
    if (!idParam) return res.status(400).json({ ok: false, error: "Missing 'id' in path." });

    const parsed = Number(idParam);
    let fcFromDB = null;

    if (!Number.isNaN(parsed)) {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: parsed } });
    }
    if (!fcFromDB) {
      try { fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId: idParam } }); } catch (e) {}
    }
    if (!fcFromDB) return res.status(404).json({ ok: false, error: `Flowchart '${idParam}' not found.` });

    const confirmedSubmission = await prisma.submission.findFirst({
      where: { userId: fcFromDB.userId, labId: fcFromDB.labId, status: "CONFIRMED" }
    });
    const submissionLocked = Boolean(confirmedSubmission);

    const saved = fcFromDB.content;
    const mapKey = Number(fcFromDB.flowchartId);
    savedFlowcharts.set(Number.isNaN(mapKey) ? String(fcFromDB.flowchartId) : mapKey, saved);

    const fc = hydrateFlowchart(saved);
    const serialized = serializeFlowchart(fc);

    // แจ้ง client ว่า userId ที่ส่งมาเป็นเจ้าของหรือไม่
    const requestUserId = req.query.userId ?? req.body?.userId;
    const isOwner = requestUserId
      ? Number(requestUserId) === Number(fcFromDB.userId)
      : false;

    return res.json({
      ok: true,
      flowchartId: fcFromDB.flowchartId,
      submissionLocked,
      isOwner,           // ← client ใช้ flag นี้แสดง/ซ่อน UI สำหรับ edit
      flowchart: serialized,
      raw: saved
    });
  } catch (err) {
    console.error("get flowchart error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// GET /:id/edges  →  ทุกคนดูได้
// ─────────────────────────────────────────────
router.get("/:id/edges", async (req, res) => {
  try {
    const { id } = req.params;
    const edges = await prisma.edge.findMany({ where: { flowchartId: parseInt(id) } });
    return res.json({ ok: true, edges });
  } catch (err) {
    console.error("GET /:id/edges error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// PUT /:flowchartId/node/:nodeId  →  เจ้าของเท่านั้น
// ─────────────────────────────────────────────
router.put("/:flowchartId/node/:nodeId", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch (e) {} }
    const body = raw || {};

    const flowchartId = Number(req.params.flowchartId);
    const nodeId = req.params.nodeId;

    if (!flowchartId) return res.status(400).json({ ok: false, error: "Missing flowchartId in path." });
    if (!nodeId) return res.status(400).json({ ok: false, error: "Missing nodeId in path." });

    let saved = savedFlowcharts.get(flowchartId);
    let fcFromDB = null;

    if (!saved) {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
      saved = fcFromDB.content;
      savedFlowcharts.set(flowchartId, saved);
    } else {
      fcFromDB = await prisma.flowchart.findUnique({ where: { flowchartId } });
      if (!fcFromDB) return res.status(404).json({ ok: false, error: `flowchartId '${flowchartId}' not found.` });
    }

    // 🔐 เจ้าของเท่านั้นที่แก้ node ได้
    try {
      assertFlowchartOwner(req, fcFromDB);
    } catch (err) {
      return res.status(err.status || 403).json({ ok: false, error: err.message });
    }

    // 🔒 submission lock
    const confirmedSubmission = await prisma.submission.findFirst({
      where: { userId: fcFromDB.userId, labId: fcFromDB.labId, status: "CONFIRMED" }
    });
    if (confirmedSubmission) {
      return res.status(403).json({
        ok: false,
        error: "This lab has already been confirmed by instructor. Flowchart is read-only."
      });
    }

    const fc = hydrateFlowchart(saved);
    const beforeSerialized = serializeFlowchart(fc);

    const node = fc.getNode(nodeId);
    if (!node) return res.status(404).json({ ok: false, error: `Node '${nodeId}' not found in flowchart.` });

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

    const force = Boolean(body.force);

    if (node.type === "DC") {
      const declaredNames = [];
      const d = newData || {};
      if (typeof d.name === "string" && d.name.trim()) declaredNames.push(d.name.trim());
      if (typeof d.varName === "string" && d.varName.trim()) declaredNames.push(d.varName.trim());
      if (Array.isArray(d.names)) {
        for (const nm of d.names) if (typeof nm === "string" && nm.trim()) declaredNames.push(nm.trim());
      }
      const uniqueNames = [...new Set(declaredNames)];

      if (uniqueNames.length > 0 && !force) {
        const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const conflicts = [];
        const nodesArr = saved.nodes || [];
        for (const varName of uniqueNames) {
          const wordRe = new RegExp(`\\b${escapeRegExp(varName)}\\b`, "i");
          for (const n of nodesArr) {
            if (!n || !n.id || n.id === nodeId) continue;
            if (n.label && typeof n.label === "string" && wordRe.test(n.label)) {
              conflicts.push({ varName, nodeId: n.id, label: n.label, foundIn: "label" });
              continue;
            }
            try {
              const dataStr = JSON.stringify(n.data || {});
              if (wordRe.test(dataStr)) {
                conflicts.push({ varName, nodeId: n.id, label: n.label ?? null, foundIn: "data" });
              }
            } catch (e) {}
          }
        }
        if (conflicts.length > 0) {
          return res.status(409).json({ ok: false, error: "Variable name(s) already in use in this flowchart.", conflicts });
        }
      }
    }

    try {
      node.updateData(newData);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to update node data: ${String(err.message ?? err)}` });
    }

    const afterSerialized = serializeFlowchart(fc);
    const diffs = computeDiffs(beforeSerialized, afterSerialized);

    savedFlowcharts.set(flowchartId, afterSerialized);
    await prisma.flowchart.update({ where: { flowchartId }, data: { content: afterSerialized } });

    return res.json({ ok: true, message: `Node ${nodeId} updated`, flowchartId, diffs });

  } catch (err) {
    console.error("update-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

// ─────────────────────────────────────────────
// POST /execute  →  ทุกคนรันได้ (ไม่ต้องเป็นเจ้าของ)
// ─────────────────────────────────────────────
router.post("/execute", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) {}
    }
    const body = raw || {};

    const flowchartIdRaw = body.flowchartId;
    if (!flowchartIdRaw && flowchartIdRaw !== 0) {
      return res.status(400).json({ ok: false, error: "Missing 'flowchartId' in request." });
    }

    const fid = Number(flowchartIdRaw);
    let saved = savedFlowcharts.get(fid);
    if (!saved) saved = savedFlowcharts.get(String(flowchartIdRaw));

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

    const fc = hydrateFlowchart(saved);
    const executor = new Executor(fc, options);

    /**
     * ✅ ใช้สำหรับ inject input จากผู้ใช้เท่านั้น (ไม่ declare ให้อัตโนมัติ)
     * - ถ้าตัวแปรยัง undeclared → ข้ามไป (handler จะ throw เองเมื่อถึงเวลา)
     */
    function applyVariablesSafelyToContext(ctx, vars) {
      if (!ctx || !vars) return;

      const applyOne = (name, value, varType) => {
        if (!name) return;
        try {
          if (typeof ctx.isDeclared === "function" && ctx.isDeclared(name)) {
            ctx.set(name, value, varType);
          }
          // ❌ ไม่ declare อัตโนมัติ — ต้องมี DC node เท่านั้น
        } catch (e) {
          console.warn(`applyVariablesSafelyToContext: failed to set '${name}':`, e?.message);
        }
      };

      if (Array.isArray(vars)) {
        for (const v of vars) {
          if (!v || !v.name) continue;
          applyOne(v.name, "value" in v ? v.value : v, v.varType);
        }
        return;
      }

      if (vars && typeof vars === "object") {
        for (const k of Object.keys(vars)) {
          const raw = vars[k];
          let value, varType;
          if (raw && typeof raw === "object" && ("value" in raw || "varType" in raw)) {
            value = raw.value; varType = raw.varType;
          } else {
            value = raw; varType = undefined;
          }
          applyOne(k, value, varType);
        }
      }
    }

    /**
     * ✅ ใช้สำหรับ restore executor state ระหว่าง step เท่านั้น
     * - restore scopeStack โดยตรง ไม่ผ่าน isDeclared check
     * - เพราะ scopeStack มาจาก DC node ที่รันไปแล้ว ถูก serialize ไว้
     */
    function restoreExecutorState(executor, es) {
      if (!es) return;

      if (es.currentNodeId) executor.currentNodeId = es.currentNodeId;
      if (typeof es.finished === "boolean") executor.finished = es.finished;
      if (typeof es.paused === "boolean") executor.paused = es.paused;
      if (typeof es.stepCount === "number") executor.stepCount = es.stepCount;

      // ✅ restore context ผ่าน scopeStack โดยตรง (ไม่ต้องผ่าน isDeclared)
      if (es.context) {
        if (Array.isArray(es.context._scopeStack) && typeof executor.context.restore === "function") {
          executor.context.restore({
            scopeStack: es.context._scopeStack,
            output: es.context.output ?? []
          });
        } else if (Array.isArray(es.context.variables)) {
          // fallback: rebuild scopeStack จาก variables array
          executor.context._scopeStack = [{}];
          for (const v of es.context.variables) {
            if (v && v.name) {
              executor.context._scopeStack[0][v.name] = {
                value: v.value,
                varType: v.varType || null
              };
            }
          }
          if (typeof executor.context._syncVariables === "function") {
            executor.context._syncVariables();
          }
          executor.context.output = Array.isArray(es.context.output)
            ? Array.from(es.context.output)
            : [];
        }
      }

      // restore node internals (loop state)
      if (es.flowchartNodeInternal && typeof es.flowchartNodeInternal === "object") {
        for (const nid of Object.keys(es.flowchartNodeInternal)) {
          const nodeState = es.flowchartNodeInternal[nid];
          const node = executor.flowchart.getNode(nid);
          if (!node || !nodeState) continue;
          if ("_initialized" in nodeState) node._initialized = !!nodeState._initialized;
          if ("_phase" in nodeState) node._phase = nodeState._phase;
          if ("_loopCount" in nodeState) node._loopCount = Number(nodeState._loopCount || 0);
          if ("_scopePushed" in nodeState) node._scopePushed = !!nodeState._scopePushed;
          if ("_initValue" in nodeState) node._initValue = nodeState._initValue;
        }
      }
    }

    // ── restore จาก body.restoreState (ถ้ามี) ──
    if (restoreState && typeof restoreState === "object" && Object.keys(restoreState).length > 0) {
      try {
        if (typeof executor.restoreState === "function") {
          executor.restoreState(restoreState);
        } else {
          restoreExecutorState(executor, {
            currentNodeId: restoreState.currentNodeId,
            finished: restoreState.finished,
            paused: restoreState.paused,
            stepCount: restoreState.stepCount,
            context: restoreState.context,
            flowchartNodeInternal: restoreState.flowchartNodeInternal
          });
        }
      } catch (e) {
        console.warn("Failed to apply restoreState:", e?.message ?? e);
      }
    }

    // ── inject input variables จากผู้ใช้ (เฉพาะที่ declare แล้ว) ──
    if (Array.isArray(variables) || (variables && typeof variables === "object")) {
      try {
        applyVariablesSafelyToContext(executor.context, variables);
      } catch (e) {
        console.warn("applyVariablesSafelyToContext failed:", e?.message ?? e);
      }
    }

    // ── action: reset ──
    if (action === "reset") {
      executor.reset();
      savedFlowcharts.delete(`executorState_${fid}`);
      return res.json({
        ok: true,
        message: "reset",
        context: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    if (action === "runAll") {
      const ignoreBreakpoints = Boolean(options.ignoreBreakpoints || body.ignoreBreakpoints);
      const nodeStates = [];
      let runError = null; // ✅ เพิ่ม

      while (!executor.finished) {
        const nodeIdBefore = executor.currentNodeId;
        const result = executor.step({ forceAdvanceBP: ignoreBreakpoints });
        nodeStates.push({
          nodeId: nodeIdBefore,
          output: [...executor.context.output],
          variables: [...executor.context.variables]
        });

        // ✅ เพิ่ม: เก็บ error แล้ว break
        if (result && result.error) {
          runError = result.error;
          break;
        }
        if (executor.paused && !ignoreBreakpoints) break;
      }

      // ✅ เพิ่ม: ถ้ามี error ส่งกลับพร้อม context ที่รันได้ถึงตรงนั้น
      if (runError) {
        return res.status(400).json({
          ok: false,
          error: String(runError.message ?? runError),
          nodeStates,
          context: { variables: executor.context.variables, output: executor.context.output },
          done: true
        });
      }

      return res.json({
        ok: true,
        message: "runAll completed",
        flowchartId: fid,
        nodeStates,
        finalContext: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    if (action === "step") {
      const lastStateKey = `executorState_${fid}`;  // ✅ ต้องอยู่บรรทัดแรก
      const lastState = savedFlowcharts.get(lastStateKey);

      if (lastState && lastState.executor) {
        restoreExecutorState(executor, lastState.executor);
      }

      if (executor.finished || !lastState) {
        executor.reset();
      }

      if (Array.isArray(variables) || (variables && typeof variables === "object")) {
        applyVariablesSafelyToContext(executor.context, variables);
      }

      // ✅ จำ output length ก่อน step
      const outputLengthBefore = executor.context.output.length;

      const result = executor.step({ forceAdvanceBP });

      // ✅ output ใหม่ที่เพิ่มมาใน step นี้เท่านั้น
      const newOutput = executor.context.output.slice(outputLengthBefore);

      if (result && result.error) {
        return res.status(400).json({
          ok: false,
          error: String(result.error.message ?? result.error),
          node: result.node ? { id: result.node.id, type: result.node.type } : null,
          context: { variables: executor.context.variables, output: executor.context.output },
          newOutput: [],
          done: true
        });
      }

      // snapshot node internals
      const flowchartNodeInternal = {};
      try {
        for (const [nid, nobj] of Object.entries(executor.flowchart.nodes || {})) {
          flowchartNodeInternal[nid] = {
            _initialized: !!nobj._initialized,
            _phase: nobj._phase || null,
            _loopCount: nobj._loopCount || 0,
            _scopePushed: !!nobj._scopePushed,
            _initValue: typeof nobj._initValue !== "undefined" ? nobj._initValue : null
          };
        }
      } catch (e) {
        console.warn("Failed to snapshot node internals:", e);
      }

      let contextSnapshot;
      try {
        contextSnapshot = typeof executor.context.serialize === "function"
          ? executor.context.serialize()
          : {
              variables: executor.context.variables,
              output: executor.context.output,
              _scopeStack: executor.context._scopeStack
                ? JSON.parse(JSON.stringify(executor.context._scopeStack))
                : undefined
            };
      } catch (e) {
        contextSnapshot = { variables: executor.context.variables, output: executor.context.output };
      }

      let nextNodeId = executor.finished ? null : executor.currentNodeId;
      let nextNodeType = null;
      if (nextNodeId && executor.flowchart && typeof executor.flowchart.getNode === "function") {
        const nextNode = executor.flowchart.getNode(nextNodeId);
        if (nextNode) nextNodeType = nextNode.type;
      }

      savedFlowcharts.set(lastStateKey, {
        executor: {
          currentNodeId: executor.currentNodeId,
          finished: executor.finished,
          paused: executor.paused,
          stepCount: executor.stepCount,
          context: contextSnapshot,
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
          ? { id: result.node.id, type: result.node.type, output: [...executor.context.output], variables: [...executor.context.variables] }
          : null,
        nextNodeId,
        nextNodeType,
        context: { variables: executor.context.variables, output: executor.context.output },
        newOutput,
        paused: result.paused ?? false,
        done: result.done ?? false,
        reenter: result.reenter ?? false
      });
    }

    // ── action: resume ──
    if (action === "resume") {
      const result = executor.resume({ forceAdvanceBP });
      return res.json({
        ok: true,
        result,
        context: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    // ── default: runAll ──
    const ignoreBreakpoints = Boolean(options.ignoreBreakpoints || body.ignoreBreakpoints);
    const finalContext = executor.runAll({ ignoreBreakpoints });
    return res.json({ ok: true, context: { variables: finalContext.variables, output: finalContext.output } });

  } catch (err) {
    console.error("execute error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

export { serializeFlowchart };
export default router;