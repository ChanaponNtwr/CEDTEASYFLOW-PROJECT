// src/controller/trial.controller.js
import express from "express";
import prisma from "../lib/prisma.js";
import { hydrateFlowchart, serializeFlowchart } from "./flowchart.controller.js";
import { normalize as normalizeQuery } from "path"; // dummy import placeholder (not used) - remove if eslint complains
import { v4 as uuidv4 } from "uuid";
import { Executor, Node } from "../service/flowchart/index.js"; // Executor for run

const router = express.Router();

// In-memory map of trial sessions:
// trialId -> { labId, labRow, flowchart, createdAt }
const trialFlowcharts = new Map();

/* ----------------------
   Helpers
   ---------------------- */

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

// build shapeConfig from lab row numeric fields OR problemSolving.shapeConfig if present
function buildShapeConfigFromLab(labRow) {
  // try problemSolving first
  if (labRow && labRow.problemSolving) {
    try {
      const ps = typeof labRow.problemSolving === "string"
        ? JSON.parse(labRow.problemSolving)
        : labRow.problemSolving;
      if (ps && typeof ps === "object" && ps.shapeConfig && typeof ps.shapeConfig === "object") {
        // normalize values
        const out = {};
        for (const k of Object.keys(ps.shapeConfig)) {
          const v = ps.shapeConfig[k];
          if (v === "unlimited" || v === "UNLIMITED") out[k] = "unlimited";
          else if (typeof v === "number") out[k] = Number(v);
          else if (v && typeof v === "object" && v.limit !== undefined) {
            out[k] = (v.limit === "unlimited" || v.limit === "UNLIMITED") ? "unlimited" : Number(v.limit);
          } else {
            const maybeNum = Number(v);
            out[k] = Number.isNaN(maybeNum) ? "unlimited" : maybeNum;
          }
        }
        return out;
      }
    } catch (e) {
      // ignore parse errors, fallback to numeric fields
    }
  }

  // fallback: use numeric fields on labRow
  const cfg = {};
  if (!labRow) return cfg;
  for (const [field, typeKey] of Object.entries(FIELD_TYPE_MAP)) {
    if (labRow[field] !== undefined && labRow[field] !== null) {
      cfg[typeKey] = Number(labRow[field]);
    }
  }
  // ST/EN/PH are unlimited by default; not necessary to include
  return cfg;
}

// compute usage + remaining from a serialized flowchart object and a lab row
function computeUsageAndRemaining(serializedFlowchart, labRow) {
  const nodes = (serializedFlowchart && serializedFlowchart.nodes) || [];
  const shapeConfig = buildShapeConfigFromLab(labRow);

  // normalize keys to canonical two/three-letter codes
  const canonicalMap = {
    "insymval": "IN", "insym": "IN", "in": "IN",
    "outsymval": "OU", "outsym": "OU", "out": "OU",
    "declaresymval": "DC", "declaresym": "DC", "declare": "DC",
    "assignsymval": "AS", "assignsym": "AS", "assign": "AS",
    "ifsymval": "IF", "ifsym": "IF", "if": "IF",
    "forsymval": "FOR", "forsym": "FOR", "for": "FOR",
    "whilesymval": "WH", "whilesym": "WH", "while": "WH", "wh": "WH",
    "ph": "PH", "dc": "DC", "as": "AS", "if": "IF", "fr": "FOR", "for": "FOR", "wh": "WH", "in": "IN", "ou": "OU", "st": "ST", "en": "EN"
  };

  // normalize shapeConfig -> normalizedShapeConfig map with limits
  const normalizedShapeConfig = {};
  for (const [k, v] of Object.entries(shapeConfig || {})) {
    const kNorm = String(k).replace(/[^a-z0-9]/gi, "").toLowerCase();
    const canonical = canonicalMap[kNorm] || (kNorm.length <= 3 ? kNorm.toUpperCase() : null);
    const typeKey = canonical || String(k).toUpperCase();

    if (v === "unlimited" || v === "UNLIMITED") normalizedShapeConfig[typeKey] = { limit: "unlimited" };
    else normalizedShapeConfig[typeKey] = { limit: Number(v) };
  }

  // usage
  const usage = {};
  for (const n of nodes) {
    if (!n || !n.id) continue;
    const t = normalizeType(n.type ?? n.typeShort ?? n.typeFull ?? "PH");
    usage[t] = (usage[t] || 0) + 1;
  }

  const ALL_TYPES = ["PH","DC","AS","IF","FOR","WH","IN","OU","ST","EN"];
  const combined = new Set([...ALL_TYPES, ...Object.keys(normalizedShapeConfig), ...Object.keys(usage)]);

  const shapeRemaining = {};
  for (const t of combined) {
    const typ = normalizeType(t);
    const conf = normalizedShapeConfig[typ];
    // default unlimited unless explicitly limited by config
    const limit = conf && conf.limit !== undefined ? conf.limit : "unlimited";
    const used = usage[typ] || 0;
    const remaining = limit === "unlimited" ? "unlimited" : Math.max(0, Number(limit) - used);
    shapeRemaining[typ] = { limit, used, remaining };
  }

  return shapeRemaining;
}

/* ----------------------
   Trial endpoints
   ---------------------- */

/**
 * POST /trial/start
 * body: { labId }
 * -> creates a trial session, returns { trialId, flowchart, lab }
 */
router.post("/start", async (req, res) => {
  try {
    const { labId } = req.body;
    if (!labId) return res.status(400).json({ ok: false, error: "Missing labId" });

    const labRow = await prisma.lab.findUnique({
      where: { labId: Number(labId) },
      include: { testcases: true }
    });
    if (!labRow) return res.status(404).json({ ok: false, error: "Lab not found" });

    // build an empty flowchart payload (start/end)
    const initialPayload = {
      nodes: [
        { id: "n_start", type: "ST", label: "Start", data: { label: "Start" }, position: { x: 0, y: 0 }, incomingEdgeIds: [], outgoingEdgeIds: ["n_start-n_end"] },
        { id: "n_end", type: "EN", label: "End", data: { label: "End" }, position: { x: 0, y: 0 }, incomingEdgeIds: ["n_start-n_end"], outgoingEdgeIds: [] }
      ],
      edges: [{ id: "n_start-n_end", source: "n_start", target: "n_end", condition: "auto" }],
      limits: { maxSteps: 100000, maxTimeMs: 5000, maxLoopIterationsPerNode: 20000 }
    };

    const fcSerialized = initialPayload; // keep serialized form in memory
    const trialId = uuidv4();

    trialFlowcharts.set(trialId, {
      labId: Number(labId),
      labRow,
      flowchart: fcSerialized,
      createdAt: Date.now()
    });

    const shapeRemaining = computeUsageAndRemaining(fcSerialized, labRow);

    return res.json({
      ok: true,
      trialId,
      flowchart: fcSerialized,
      lab: {
        labId: labRow.labId,
        labname: labRow.labname,
        inSymVal: labRow.inSymVal,
        outSymVal: labRow.outSymVal
      },
      shapeRemaining
    });
  } catch (err) {
    console.error("trial start error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/**
 * GET /trial/:trialId/flowchart
 */
router.get("/:trialId/flowchart", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "trial not found" });

    const shapeRemaining = computeUsageAndRemaining(state.flowchart, state.labRow);

    return res.json({ ok: true, trialId, flowchart: state.flowchart, shapeRemaining, lab: { labId: state.labRow.labId, labname: state.labRow.labname } });
  } catch (err) {
    console.error("trial get flowchart error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/**
 * POST /trial/:trialId/flowchart/node
 * body: { edgeId, node: { type?, label?, data?, ... } }
 * -> insert node at edge (like normal insert-node) but not persisted to DB
 */
router.post("/:trialId/flowchart/node", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "trial not found" });

    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const { edgeId, node: nodeSpec } = raw || {};

    if (!edgeId) return res.status(400).json({ ok: false, error: "Missing edgeId" });
    if (!nodeSpec || typeof nodeSpec !== "object") return res.status(400).json({ ok: false, error: "Missing node" });

    const saved = state.flowchart;
    const fc = hydrateFlowchart(saved);
    if (!fc.getEdge(edgeId)) return res.status(400).json({ ok: false, error: `Edge '${edgeId}' not found` });

    // compute current shapeRemaining based on lab
    const shapeRemainingBefore = computeUsageAndRemaining(saved, state.labRow);

    const incomingType = normalizeType(nodeSpec.type ?? nodeSpec.typeShort ?? nodeSpec.typeFull ?? "PH");
    // enforce limit if limited
    const info = shapeRemainingBefore[incomingType] || { limit: "unlimited", used: 0, remaining: "unlimited" };
    if (info.limit !== "unlimited" && Number(info.remaining) <= 0) {
      return res.status(409).json({ ok: false, error: `Node limit reached for type ${incomingType}`, shapeRemaining: shapeRemainingBefore });
    }

    // create Node and insert
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
    // update state
    state.flowchart = afterSerialized;
    trialFlowcharts.set(trialId, state);

    // gather created edge ids touching new node
    const createdEdgeIds = (afterSerialized.edges || [])
      .filter(e => e.source === newNode.id || e.target === newNode.id)
      .map(e => e.id);

    const shapeRemainingAfter = computeUsageAndRemaining(afterSerialized, state.labRow);

    return res.json({
      ok: true,
      message: `Inserted node ${newNode.id} at edge ${edgeId}`,
      nodeId: newNode.id,
      createdEdgeIds,
      flowchart: afterSerialized,
      shapeRemaining: shapeRemainingAfter
    });
  } catch (err) {
    console.error("trial insert-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/**
 * PUT /trial/:trialId/flowchart/node/:nodeId
 * update node data (same validation as DB-backed)
 */
router.put("/:trialId/flowchart/node/:nodeId", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const nodeId = req.params.nodeId;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "trial not found" });

    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) {}
    }
    const body = raw || {};
    const rawType = body.type ?? body.typeShort ?? body.typeFull;
    if (!rawType) return res.status(400).json({ ok: false, error: "Missing 'type' in request body." });

    const providedType = normalizeType(rawType);
    const fc = hydrateFlowchart(state.flowchart);
    const node = fc.getNode(nodeId);
    if (!node) return res.status(404).json({ ok: false, error: `Node '${nodeId}' not found.` });

    if (providedType !== node.type) {
      return res.status(400).json({ ok: false, error: `Type mismatch: provided '${providedType}' != existing '${node.type}'` });
    }

    const newData = body.data;
    if (!newData || typeof newData !== "object") return res.status(400).json({ ok: false, error: "Missing or invalid 'data' object." });

    const force = Boolean(body.force);

    if (node.type === "DC") {
      const declaredNames = [];
      const d = newData || {};
      if (typeof d.name === "string" && d.name.trim()) declaredNames.push(d.name.trim());
      if (typeof d.varName === "string" && d.varName.trim()) declaredNames.push(d.varName.trim());
      if (Array.isArray(d.names)) for (const nm of d.names) if (typeof nm === "string" && nm.trim()) declaredNames.push(nm.trim());
      const uniqueNames = [...new Set(declaredNames)];

      if (uniqueNames.length > 0 && !force) {
        const nodesArr = state.flowchart.nodes || [];
        const conflicts = [];
        for (const varName of uniqueNames) {
          const wordRe = new RegExp(`\\b${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          for (const n of nodesArr) {
            if (!n || !n.id) continue;
            if (n.id === nodeId) continue;
            if (n.label && typeof n.label === "string" && wordRe.test(n.label)) {
              conflicts.push({ varName, nodeId: n.id, label: n.label, foundIn: "label" });
              continue;
            }
            try {
              if (wordRe.test(JSON.stringify(n.data || {}))) {
                conflicts.push({ varName, nodeId: n.id, label: n.label ?? null, foundIn: "data" });
              }
            } catch (e) {}
          }
        }
        if (conflicts.length > 0) return res.status(409).json({ ok: false, error: "Variable name(s) already in use in this flowchart.", conflicts });
      }
    }

    try {
      node.updateData(newData);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to update node: ${String(err.message ?? err)}` });
    }

    const afterSerialized = serializeFlowchart(fc);
    state.flowchart = afterSerialized;
    trialFlowcharts.set(trialId, state);

    const shapeRemaining = computeUsageAndRemaining(afterSerialized, state.labRow);

    return res.json({ ok: true, message: `Node ${nodeId} updated`, nodeId, flowchart: afterSerialized, shapeRemaining });
  } catch (err) {
    console.error("trial update-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/**
 * DELETE /trial/:trialId/flowchart/node/:nodeId
 */
router.delete("/:trialId/flowchart/node/:nodeId", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const nodeId = req.params.nodeId;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "trial not found" });

    const fc = hydrateFlowchart(state.flowchart);
    try {
      fc.removeNode(nodeId);
    } catch (err) {
      return res.status(400).json({ ok: false, error: `Failed to remove node: ${String(err.message ?? err)}` });
    }
    const afterSerialized = serializeFlowchart(fc);
    state.flowchart = afterSerialized;
    trialFlowcharts.set(trialId, state);

    const shapeRemaining = computeUsageAndRemaining(afterSerialized, state.labRow);

    return res.json({ ok: true, message: `Node ${nodeId} removed`, flowchart: afterSerialized, shapeRemaining });
  } catch (err) {
    console.error("trial delete-node error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/**
 * GET /trial/:trialId/testcases
 * -> return testcases for the lab (so FE can present / run)
 */
router.get("/:trialId/testcases", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "trial not found" });

    // labRow already includes testcases if we fetched early; if not, fetch
    const labRow = state.labRow || (await prisma.lab.findUnique({ where: { labId: state.labId }, include: { testcases: true } }));
    return res.json({ ok: true, testcases: labRow.testcases || [] });
  } catch (err) {
    console.error("trial get testcases error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/**
 * POST /trial/:trialId/execute
 * body:
 * {
 *   action?: "step" | "runAll" | "reset" | "resume",
 *   variables?: [],
 *   options?: {},
 *   forceAdvanceBP?: boolean
 * }
 */
router.post("/:trialId/execute", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const trial = trialFlowcharts.get(trialId);

    if (!trial) {
      return res.status(404).json({ ok: false, error: "trial not found" });
    }

    let raw = req.body;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch {}
    }
    const body = raw || {};

    const action = body.action ?? "runAll";
    const variables = body.variables;
    const options = body.options || {};
    const forceAdvanceBP = Boolean(body.forceAdvanceBP);

    // hydrate flowchart
    const fc = hydrateFlowchart(trial.flowchart);
    const executor = new Executor(fc, options);

    // restore previous executor state (สำคัญมาก)
    if (trial.executor) {
      const es = trial.executor;
      executor.currentNodeId = es.currentNodeId;
      executor.finished = es.finished;
      executor.paused = es.paused;
      executor.stepCount = es.stepCount;

      if (es.context?.variables) {
        for (const v of es.context.variables) {
          executor.context.set(v.name, v.value, v.varType);
        }
      }

      // restore node internals (for / while / if)
      if (es.flowchartNodeInternal) {
        for (const nid of Object.keys(es.flowchartNodeInternal)) {
          const node = executor.flowchart.getNode(nid);
          if (!node) continue;
          Object.assign(node, es.flowchartNodeInternal[nid]);
        }
      }
    }

    // apply variables from request
    if (Array.isArray(variables)) {
      for (const v of variables) {
        executor.context.set(v.name, v.value, v.varType);
      }
    }

    /* =========================
     * ACTION: RESET
     * ======================= */
    if (action === "reset") {
      executor.reset();
      trial.executor = null;
      return res.json({ ok: true, message: "reset" });
    }

    /* =========================
     * ACTION: RUN ALL
     * ======================= */
    if (action === "runAll") {
      const nodeStates = [];

      while (!executor.finished) {
        const nodeIdBefore = executor.currentNodeId;
        const r = executor.step({ forceAdvanceBP });

        nodeStates.push({
          nodeId: nodeIdBefore,
          output: [...executor.context.output],
          variables: [...executor.context.variables]
        });

        if (executor.paused && !forceAdvanceBP) break;
        if (r?.error) break;
      }

      return res.json({
        ok: true,
        nodeStates,
        finalContext: {
          variables: executor.context.variables,
          output: executor.context.output
        }
      });
    }

    /* =========================
     * ACTION: STEP
     * ======================= */
    if (action === "step") {
      if (executor.finished) executor.reset();

      const result = executor.step({ forceAdvanceBP });

      // snapshot node internal states
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

      // save executor state
      trial.executor = {
        currentNodeId: executor.currentNodeId,
        finished: executor.finished,
        paused: executor.paused,
        stepCount: executor.stepCount,
        context: {
          variables: executor.context.variables,
          output: executor.context.output
        },
        flowchartNodeInternal
      };

      return res.json({
        ok: true,
        node: result.node
          ? { id: result.node.id, type: result.node.type }
          : null,
        nextNodeId: executor.currentNodeId,
        context: {
          variables: executor.context.variables,
          output: executor.context.output
        },
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



/**
 * POST /trial/:trialId/testcases/run  */
router.post("/:trialId/testcases/run", async (req, res) => {
  try {
    const trialId = req.params.trialId;
    const state = trialFlowcharts.get(trialId);
    if (!state) return res.status(404).json({ ok: false, error: "trial not found" });

    // get testcases from state.labRow (fetched at start), otherwise fetch DB
    const labRow = state.labRow || (await prisma.lab.findUnique({ where: { labId: state.labId }, include: { testcases: true } }));
    const testcases = (labRow && labRow.testcases) ? labRow.testcases : [];

    if (!Array.isArray(testcases) || testcases.length === 0) {
      return res.status(400).json({ ok: false, error: "No testcases available for this lab" });
    }

    // optional options from client
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

      // parse stored inputVal/outputVal (labService stored them as JSON string for arrays/objects)
      function safeParse(val) {
        if (val === undefined || val === null) return null;
        if (typeof val === "string") {
          // try parse JSON, but if not JSON, return as string
          try {
            return JSON.parse(val);
          } catch (e) {
            return val;
          }
        }
        return val;
      }
      const inputVal = safeParse(tc.inputVal);
      const expectedVal = safeParse(tc.outputVal);

      try {
        // hydrate a fresh flowchart for each testcase to be isolated
        const fc = hydrateFlowchart(serialized);
        const executor = new Executor(fc, {}); // no special options here

        // set input variables into executor.context
        if (Array.isArray(inputVal)) {
          executor.context.set("input", inputVal);
          inputVal.forEach((v, idx) => executor.context.set(`arg${idx}`, v));
        } else if (inputVal && typeof inputVal === "object") {
          // treat as named inputs
          for (const k of Object.keys(inputVal)) executor.context.set(k, inputVal[k]);
          executor.context.set("input", inputVal);
        } else {
          // primitive
          executor.context.set("input0", inputVal);
          executor.context.set("input", inputVal);
        }

        // run all (ignore breakpoints if requested)
        const finalContext = executor.runAll({ ignoreBreakpoints });

        // actual output candidate:
        // prefer executor output list if available, otherwise variables snapshot
        const actualOutput = finalContext.output ?? finalContext.variables ?? null;

        // compare expectedVal and actualOutput
        const passed = JSON.stringify(actualOutput) === JSON.stringify(expectedVal);
        const awarded = passed ? score : 0;
        totalScore += awarded;

        results.push({
          testcaseId: tcId,
          inputVal,
          expectedVal,
          actualVal: actualOutput,
          passed,
          score: score,
          scoreAwarded: awarded
        });
      } catch (err) {
        results.push({
          testcaseId: tcId,
          inputVal,
          expectedVal,
          actualVal: null,
          passed: false,
          score: score,
          scoreAwarded: 0,
          error: String(err.message ?? err)
        });
      }
    }

    return res.json({
      ok: true,
      trialId,
      results,
      totalScore,
      maxScore
    });
  } catch (err) {
    console.error("trial run testcases error:", err);
    return res.status(500).json({ ok: false, error: String(err.message ?? err) });
  }
});

/* Expose router */
export default router;
