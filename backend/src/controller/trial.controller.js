// src/controller/trial.controller.js
import express from "express";
import prisma from "../lib/prisma.js";
import { hydrateFlowchart, serializeFlowchart } from "./flowchart.controller.js";
import { v4 as uuidv4 } from "uuid";
import { Executor, Node } from "../service/flowchart/index.js";

const router = express.Router();

const trialFlowcharts = new Map();
const TRIAL_TTL_MS = 20 * 60 * 1000;

/* ----------------------
   Helpers
   ---------------------- */

function cleanupExpiredTrials() {
  const now = Date.now();
  for (const [trialId, trial] of trialFlowcharts.entries()) {
    const lastActivity = trial.lastUsed ?? trial.createdAt;
    if (now - lastActivity > TRIAL_TTL_MS) {
      trialFlowcharts.delete(trialId);
      console.log(`Trial expired and removed: ${trialId}`);
    }
  }
}
setInterval(cleanupExpiredTrials, 20 * 60 * 1000);

function normalizeType(t) {
  if (!t) return "";
  return String(t).trim().toUpperCase();
}

const FIELD_TYPE_MAP = {
  inSymVal: "IN",
  outSymVal: "OU",
  declareSymVal: "DC",
  assignSymVal: "AS",
  ifSymVal: "IF",
  forSymVal: "FOR",
  whileSymVal: "WH"
};

function buildShapeConfigFromLab(labRow) {
  const cfg = {};
  if (!labRow) return cfg;
  for (const [field, typeKey] of Object.entries(FIELD_TYPE_MAP)) {
    const raw = labRow[field];
    if (raw === undefined || raw === null) continue;
    const num = Number(raw);
    if (num === -1) cfg[typeKey] = "unlimited";
    else if (!Number.isNaN(num)) cfg[typeKey] = num;
  }
  return cfg;
}

function computeUsageAndRemaining(serializedFlowchart, labRow) {
  const nodes = serializedFlowchart?.nodes || [];
  const shapeConfig = buildShapeConfigFromLab(labRow);
  const usage = {};
  for (const n of nodes) {
    if (!n?.id) continue;
    const t = normalizeType(n.type || "PH");
    usage[t] = (usage[t] || 0) + 1;
  }
  const ALL_TYPES = ["PH", "DC", "AS", "IF", "FOR", "WH", "IN", "OU", "ST", "EN"];
  const shapeRemaining = {};
  for (const t of ALL_TYPES) {
    const used = usage[t] || 0;
    const limit = shapeConfig[t] ?? "unlimited";
    shapeRemaining[t] = {
      limit,
      used,
      remaining: limit === "unlimited" ? "unlimited" : Math.max(0, limit - used)
    };
  }
  return shapeRemaining;
}

/**
 * ✅ restore context จาก snapshot โดยตรงผ่าน _scopeStack หรือ scopeStack
 * รองรับทั้ง Context.serialize() ที่ return { scopeStack } (ไม่มี _)
 * และ snapshot ที่ถูก save ด้วย { _scopeStack } (มี _)
 */
function restoreContextFromSnapshot(ctx, snapshot) {
  if (!snapshot) return;

  // รองรับทั้ง scopeStack และ _scopeStack
  const scopeStack = snapshot.scopeStack ?? snapshot._scopeStack;

  if (Array.isArray(scopeStack) && scopeStack.length > 0) {
    if (typeof ctx.restore === "function") {
      // ✅ ใช้ Context.restore() โดยตรง (ดีที่สุด)
      ctx.restore({
        scopeStack: JSON.parse(JSON.stringify(scopeStack)),
        output: snapshot.output ?? []
      });
      return;
    }
    // fallback: set _scopeStack manual
    ctx._scopeStack = JSON.parse(JSON.stringify(scopeStack));
    if (typeof ctx._syncVariables === "function") ctx._syncVariables();
    ctx.output = Array.isArray(snapshot.output) ? Array.from(snapshot.output) : [];
    return;
  }

  // fallback สุดท้าย: rebuild จาก variables array
  if (Array.isArray(snapshot.variables) && snapshot.variables.length > 0) {
    ctx._scopeStack = [{}];
    for (const v of snapshot.variables) {
      if (v && v.name) {
        ctx._scopeStack[0][v.name] = { value: v.value, varType: v.varType || null };
      }
    }
    if (typeof ctx._syncVariables === "function") ctx._syncVariables();
    ctx.output = Array.isArray(snapshot.output) ? Array.from(snapshot.output) : [];
  }
}

/**
 * ✅ inject input จากผู้ใช้ — เฉพาะตัวแปรที่ declare แล้วเท่านั้น
 * ไม่ declare อัตโนมัติ
 */
function applyUserVariables(ctx, vars) {
  if (!ctx || !vars || !Array.isArray(vars)) return;
  for (const v of vars) {
    if (!v || !v.name) continue;
    try {
      if (typeof ctx.isDeclared === "function" && ctx.isDeclared(v.name)) {
        ctx.set(v.name, v.value, v.varType);
      }
    } catch (e) {
      console.warn(`applyUserVariables: failed to set '${v.name}':`, e?.message);
    }
  }
}

/* ----------------------
   Trial endpoints
   ---------------------- */

router.post("/start", async (req, res) => {
  try {
    const { labId } = req.body;
    if (!labId) return res.status(400).json({ ok: false, error: "Missing labId" });

    const labRow = await prisma.lab.findUnique({
      where: { labId: Number(labId) },
      include: { testcases: true }
    });
    if (!labRow) return res.status(404).json({ ok: false, error: "Lab not found" });

    const initialPayload = {
      nodes: [
        { id: "n_start", type: "ST", label: "Start", data: { label: "Start" }, position: { x: 0, y: 0 }, incomingEdgeIds: [], outgoingEdgeIds: ["n_start-n_end"] },
        { id: "n_end", type: "EN", label: "End", data: { label: "End" }, position: { x: 0, y: 0 }, incomingEdgeIds: ["n_start-n_end"], outgoingEdgeIds: [] }
      ],
      edges: [{ id: "n_start-n_end", source: "n_start", target: "n_end", condition: "auto" }],
      limits: { maxSteps: 100000, maxTimeMs: 5000, maxLoopIterationsPerNode: 20000 }
    };

    const trialId = uuidv4();
    trialFlowcharts.set(trialId, {
      labId: Number(labId),
      labRow,
      flowchart: initialPayload,
      executor: null,
      createdAt: Date.now(),
      lastUsed: Date.now()
    });

    return res.json({
      ok: true,
      trialId,
      flowchart: initialPayload,
      lab: {
        labId: labRow.labId,
        labname: labRow.labname,
        inSymVal: labRow.inSymVal,
        outSymVal: labRow.outSymVal
      },
      shapeRemaining: computeUsageAndRemaining(initialPayload, labRow)
    });
  } catch (err) {
    console.error("trial start error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.get("/:trialId/flowchart", async (req, res) => {
  try {
    const state = trialFlowcharts.get(req.params.trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();
    return res.json({
      ok: true,
      trialId: req.params.trialId,
      flowchart: state.flowchart,
      shapeRemaining: computeUsageAndRemaining(state.flowchart, state.labRow),
      lab: { labId: state.labRow.labId, labname: state.labRow.labname }
    });
  } catch (err) {
    console.error("trial get flowchart error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.post("/:trialId/flowchart/node", async (req, res) => {
  try {
    const state = trialFlowcharts.get(req.params.trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();

    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const { edgeId, node: nodeSpec } = raw || {};

    if (!edgeId) return res.status(400).json({ ok: false, error: "Missing edgeId" });
    if (!nodeSpec || typeof nodeSpec !== "object") return res.status(400).json({ ok: false, error: "Missing node" });

    const fc = hydrateFlowchart(state.flowchart);
    if (!fc.getEdge(edgeId)) return res.status(400).json({ ok: false, error: `Edge '${edgeId}' not found` });

    const shapeRemainingBefore = computeUsageAndRemaining(state.flowchart, state.labRow);
    const incomingType = normalizeType(nodeSpec.type ?? nodeSpec.typeShort ?? nodeSpec.typeFull ?? "PH");
    const info = shapeRemainingBefore[incomingType] || { limit: "unlimited", remaining: "unlimited" };
    if (info.limit !== "unlimited" && Number(info.remaining) <= 0) {
      return res.status(409).json({ ok: false, error: `Node limit reached for type ${incomingType}`, shapeRemaining: shapeRemainingBefore });
    }

    const nodeId = nodeSpec.id || fc.genId();
    const newNode = new Node(
      nodeId,
      normalizeType(nodeSpec.type ?? nodeSpec.typeShort ?? nodeSpec.typeFull ?? "PH"),
      nodeSpec.label ?? "",
      nodeSpec.data ?? {},
      nodeSpec.position ?? { x: 0, y: 0 },
      nodeSpec.incomingEdgeIds ?? [],
      nodeSpec.outgoingEdgeIds ?? []
    );
    if (nodeSpec.loopEdge) newNode.loopEdge = nodeSpec.loopEdge;
    if (nodeSpec.loopExitEdge) newNode.loopExitEdge = nodeSpec.loopExitEdge;

    try {
      fc.insertNodeAtEdge(edgeId, newNode);
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err.message ?? err) });
    }

    const afterSerialized = serializeFlowchart(fc);
    state.flowchart = afterSerialized;
    // ✅ reset executor state เมื่อ flowchart เปลี่ยน
    state.executor = null;
    trialFlowcharts.set(req.params.trialId, state);

    const createdEdgeIds = (afterSerialized.edges || [])
      .filter(e => e.source === newNode.id || e.target === newNode.id)
      .map(e => e.id);

    return res.json({
      ok: true,
      message: `Inserted node ${newNode.id} at edge ${edgeId}`,
      nodeId: newNode.id,
      createdEdgeIds,
      flowchart: afterSerialized,
      shapeRemaining: computeUsageAndRemaining(afterSerialized, state.labRow)
    });
  } catch (err) {
    console.error("trial insert-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.put("/:trialId/flowchart/node/:nodeId", async (req, res) => {
  try {
    const { trialId, nodeId } = req.params;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();

    const { label, data, position, type } = req.body || {};
    const fc = hydrateFlowchart(state.flowchart);
    const node = fc.getNode(nodeId);
    if (!node) return res.status(404).json({ ok: false, error: `Node '${nodeId}' not found` });

    if (type) {
      const before = computeUsageAndRemaining(state.flowchart, state.labRow);
      const newType = normalizeType(type);
      const oldType = normalizeType(node.type);
      if (newType !== oldType) {
        const info = before[newType] || { limit: "unlimited", remaining: "unlimited" };
        if (info.limit !== "unlimited" && Number(info.remaining) <= 0) {
          return res.status(409).json({ ok: false, error: `Node limit reached for type ${newType}`, shapeRemaining: before });
        }
        node.type = newType;
      }
    }

    if (label !== undefined) node.label = label;
    if (data !== undefined) node.data = data;
    if (position !== undefined) node.position = position;

    const afterSerialized = serializeFlowchart(fc);
    state.flowchart = afterSerialized;
    // ✅ reset executor state เมื่อ node เปลี่ยน
    state.executor = null;
    trialFlowcharts.set(trialId, state);

    return res.json({
      ok: true,
      message: `Node ${nodeId} updated`,
      nodeId,
      node: { id: node.id, type: node.type, label: node.label, data: node.data, position: node.position },
      flowchart: afterSerialized,
      shapeRemaining: computeUsageAndRemaining(afterSerialized, state.labRow)
    });
  } catch (err) {
    console.error("trial edit-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.delete("/:trialId/flowchart/node/:nodeId", async (req, res) => {
  try {
    const { trialId, nodeId } = req.params;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();

    const fc = hydrateFlowchart(state.flowchart);
    fc.removeNode(nodeId);

    state.flowchart = serializeFlowchart(fc);
    // ✅ reset executor state เมื่อ node ถูกลบ
    state.executor = null;
    trialFlowcharts.set(trialId, state);

    return res.json({
      ok: true,
      message: `Node ${nodeId} removed`,
      flowchart: state.flowchart,
      shapeRemaining: computeUsageAndRemaining(state.flowchart, state.labRow)
    });
  } catch (err) {
    console.error("delete node error:", err);
    return res.status(400).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.get("/:trialId/testcases", async (req, res) => {
  try {
    const state = trialFlowcharts.get(req.params.trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();
    const labRow = state.labRow || (await prisma.lab.findUnique({ where: { labId: state.labId }, include: { testcases: true } }));
    return res.json({ ok: true, testcases: labRow.testcases || [] });
  } catch (err) {
    console.error("trial get testcases error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.post("/:trialId/execute", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const trial = trialFlowcharts.get(trialId);
    if (!trial) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    trial.lastUsed = Date.now();

    let raw = req.body;
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch {} }
    const body = raw || {};

    const action = body.action ?? "runAll";
    const variables = body.variables;
    const options = body.options || {};
    const forceAdvanceBP = Boolean(body.forceAdvanceBP);

    const fc = hydrateFlowchart(trial.flowchart);
    const executor = new Executor(fc, options);

    // ── restore previous executor state ──
    if (trial.executor) {
      const es = trial.executor;
      executor.currentNodeId = es.currentNodeId;
      executor.finished = es.finished;
      executor.paused = es.paused;
      executor.stepCount = es.stepCount;

      // ✅ restore context ผ่าน scopeStack (รองรับทั้ง scopeStack และ _scopeStack)
      restoreContextFromSnapshot(executor.context, es.context);

      // restore node internals (for / while loop state)
      if (es.flowchartNodeInternal) {
        for (const nid of Object.keys(es.flowchartNodeInternal)) {
          const node = executor.flowchart.getNode(nid);
          if (!node) continue;
          Object.assign(node, es.flowchartNodeInternal[nid]);
        }
      }
    }

    // ── inject input จากผู้ใช้ (เฉพาะที่ declare แล้ว) ──
    applyUserVariables(executor.context, variables);

    /* ACTION: RESET */
    if (action === "reset") {
      for (const node of Object.values(executor.flowchart.nodes)) {
        node._initialized = false;
        node._phase = null;
        node._loopCount = 0;
        node._scopePushed = false;
        node._initValue = null;
      }
      executor.reset();
      trial.executor = null;
      return res.json({
        ok: true,
        message: "reset",
        context: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    /* ACTION: RUN ALL */
    if (action === "runAll") {
      const nodeStates = [];
      let runError = null;

      while (!executor.finished) {
        const nodeIdBefore = executor.currentNodeId;
        const r = executor.step({ forceAdvanceBP });
        nodeStates.push({
          nodeId: nodeIdBefore,
          output: [...executor.context.output],
          variables: [...executor.context.variables]
        });
        if (r?.error) { runError = r.error; break; }
        if (executor.paused && !forceAdvanceBP) break;
      }

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
        nodeStates,
        finalContext: { variables: executor.context.variables, output: executor.context.output }
      });
    }

    if (action === "step") {
      // ✅ ถ้า finished แล้ว → ส่ง done: true พร้อม output ว่าง
      if (executor.finished) {
        return res.json({
          ok: true,
          node: null,
          nextNodeId: null,
          context: { variables: [], output: [] },
          newOutput: [],
          paused: false,
          done: true
        });
      }
      // ✅ จำ output length ก่อน step
      const outputLengthBefore = executor.context.output.length;

      const result = executor.step({ forceAdvanceBP });

      // ✅ คำนวณเฉพาะ output ใหม่ที่เพิ่มมาใน step นี้
      const newOutput = executor.context.output.slice(outputLengthBefore);

      // ✅ ดัก error จาก handler
      if (result?.error) {
        trial.executor = null;
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
      for (const [nid, node] of Object.entries(executor.flowchart.nodes)) {
        flowchartNodeInternal[nid] = {
          _initialized: node._initialized,
          _phase: node._phase,
          _loopCount: node._loopCount,
          _scopePushed: node._scopePushed,
          _initValue: node._initValue
        };
      }

      // snapshot context
      let contextSnapshot;
      try {
        contextSnapshot = typeof executor.context.serialize === "function"
          ? executor.context.serialize()
          : {
              variables: executor.context.variables,
              output: executor.context.output,
              scopeStack: executor.context._scopeStack
                ? JSON.parse(JSON.stringify(executor.context._scopeStack))
                : [{}]
            };
      } catch (e) {
        contextSnapshot = { variables: executor.context.variables, output: executor.context.output };
      }

      trial.executor = {
        currentNodeId: executor.currentNodeId,
        finished: executor.finished,
        paused: executor.paused,
        stepCount: executor.stepCount,
        context: contextSnapshot,
        flowchartNodeInternal
      };

      return res.json({
        ok: true,
        node: result.node ? { id: result.node.id, type: result.node.type } : null,
        nextNodeId: executor.currentNodeId,
        context: { variables: executor.context.variables, output: executor.context.output },
        newOutput,  // ✅ หน้าบ้านใช้ตัวนี้ append console แทน context.output
        paused: executor.paused,
        done: executor.finished
      });
    }

    return res.status(400).json({ ok: false, error: "Unsupported action" });

  } catch (err) {
    console.error("trial execute error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.post("/:trialId/testcases/run", async (req, res) => {
  try {
    const state = trialFlowcharts.get(req.params.trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();

    const labRow = state.labRow || (await prisma.lab.findUnique({ where: { labId: state.labId }, include: { testcases: true } }));
    const testcases = labRow?.testcases ?? [];
    if (!testcases.length) return res.status(400).json({ ok: false, error: "No testcases available for this lab" });

    const body = req.body || {};
    const ignoreBreakpoints = Boolean(body.ignoreBreakpoints);
    const serialized = state.flowchart;
    const results = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const tc of testcases) {
      const tcId = tc.testcaseId ?? null;
      const score = Number(tc.score || 0);
      maxScore += score;

      function safeParse(val) {
        if (val === undefined || val === null) return null;
        if (typeof val === "string") { try { return JSON.parse(val); } catch { return val; } }
        return val;
      }
      const inputVal = safeParse(tc.inputVal);
      const expectedVal = safeParse(tc.outputVal);

      try {
        const fc = hydrateFlowchart(serialized);
        const executor = new Executor(fc, {});

        // inject testcase input ผ่าน inputProvider แทน context.set โดยตรง
        // เพราะตัวแปรต้อง declare ก่อนผ่าน DC node
        let inputQueue = [];
        if (Array.isArray(inputVal)) inputQueue = inputVal.map(String);
        else if (inputVal !== null) inputQueue = [String(inputVal)];

        executor.setInputProvider(() => inputQueue.shift() ?? "");

        const finalContext = executor.runAll({ ignoreBreakpoints });
        const actualOutput = finalContext.output ?? [];
        const passed = JSON.stringify(actualOutput) === JSON.stringify(expectedVal);
        const awarded = passed ? score : 0;
        totalScore += awarded;

        results.push({ testcaseId: tcId, inputVal, expectedVal, actualVal: actualOutput, passed, score, scoreAwarded: awarded });
      } catch (err) {
        results.push({ testcaseId: tcId, inputVal, expectedVal, actualVal: null, passed: false, score, scoreAwarded: 0, error: String(err.message ?? err) });
      }
    }

    return res.json({ ok: true, trialId: req.params.trialId, results, totalScore, maxScore });
  } catch (err) {
    console.error("trial run testcases error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

router.get("/:trialId/shapes/remaining", async (req, res) => {
  try {
    const state = trialFlowcharts.get(req.params.trialId);
    if (!state) return res.status(404).json({ ok: false, error: "Trial session not found or expired. Please start a new trial." });
    state.lastUsed = Date.now();
    return res.json({ ok: true, trialId: req.params.trialId, shapeRemaining: computeUsageAndRemaining(state.flowchart, state.labRow) });
  } catch (err) {
    console.error("get shape remaining error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

export default router;