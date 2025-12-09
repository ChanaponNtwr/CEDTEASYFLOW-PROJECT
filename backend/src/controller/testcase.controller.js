// src/controller/testcase.controller.js
import express from "express";
import { PrismaClient } from "@prisma/client";
import { TestRunner } from "../service/testcase/index.js";
import Executor from "../service/flowchart/classexecutor.js";
import TestcaseRepository from "../service/testcase/testcaseRepository.js";
import Testcase from "../service/testcase/testcase_model.js";
import { hydrateFlowchart } from "../controller/flowchart.controller.js";



const prisma = new PrismaClient();

// executorFactory for TestRunner
function executorFactory(flowchart, opts = {}) {
  return new Executor(flowchart, opts);
}

// create repo + runner singletons
const repo = new TestcaseRepository(); // ✅ use real repo
const runner = new TestRunner({ executorFactory, repo }); // ✅ pass repo

// -----------------------
// Helper utilities
// -----------------------
function normalizeToJSONString(v) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

async function saveSubmissionSafe({ userId, labId, testcaseId, status }) {
  const data = {
    userId: Number(userId),
    labId: Number(labId),
    testcaseId: Number(testcaseId),
    status: String(status),
    createAt: new Date(),
  };

  try {
    return await prisma.submission.upsert({
      where: {
        userId_labId_testcaseId: {
          userId: Number(userId),
          labId: Number(labId),
          testcaseId: Number(testcaseId),
        },
      },
      update: { status: data.status, createAt: data.createAt },
      create: data,
    });
  } catch (e) {
    try {
      return await prisma.submission.create({ data });
    } catch (e2) {
      try {
        return await prisma.submission.update({
          where: {
            userId_labId_testcaseId: {
              userId: Number(userId),
              labId: Number(labId),
              testcaseId: Number(testcaseId),
            },
          },
          data: { status: data.status, createAt: data.createAt },
        });
      } catch (e3) {
        console.warn("saveSubmissionSafe: upsert/create/update all failed:", e, e2, e3);
        return null;
      }
    }
  }
}

// -----------------------
// Handlers (exported)
// -----------------------

// GET /api/flowchart/:flowchartId
export async function getFlowchartHandler(req, res) {
  try {
    const { flowchartId } = req.params;
    if (!flowchartId) return res.status(400).json({ ok: false, message: "flowchartId required" });

    const row = await prisma.flowchart.findUnique({ where: { flowchartId: Number(flowchartId) } });
    if (!row) return res.status(404).json({ ok: false, message: "flowchart not found" });

    return res.json({ ok: true, flowchart: row });
  } catch (err) {
    console.error("getFlowchartHandler error:", err);
    return res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}

// GET /api/testcase/lab/:labId
export async function getTestcasesByLabHandler(req, res) {
  try {
    const { labId } = req.params;
    if (!labId) return res.status(400).json({ ok: false, message: "labId required" });

    const rows = await prisma.testcase.findMany({ where: { labId: Number(labId) }, orderBy: { testcaseId: "asc" } });
    return res.json({ ok: true, testcases: rows });
  } catch (err) {
    console.error("getTestcasesByLabHandler error:", err);
    return res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}

// POST /api/testcase/lab/:labId
export async function createTestcaseHandler(req, res) {
  try {
    const { labId } = req.params;
    const body = req.body || {};
    if (!labId) return res.status(400).json({ ok: false, message: "labId required" });
    if (body.inputVal === undefined || body.outputVal === undefined) {
      return res.status(400).json({ ok: false, message: "inputVal and outputVal required" });
    }

    const rec = await prisma.testcase.create({
      data: {
        labId: Number(labId),
        inputVal: normalizeToJSONString(body.inputVal),
        outputVal: normalizeToJSONString(body.outputVal),
        inHiddenVal: body.inHiddenVal ?? null,
        outHiddenVal: body.outHiddenVal ?? null,
        score: Number(body.score || 0),
      },
    });

    return res.json({ ok: true, testcase: rec });
  } catch (err) {
    console.error("createTestcaseHandler error:", err);
    return res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}

// PUT /api/testcase/:testcaseId
export async function updateTestcaseHandler(req, res) {
  try {
    const { testcaseId } = req.params;
    const body = req.body || {};
    if (!testcaseId) return res.status(400).json({ ok: false, message: "testcaseId required" });

    const updated = await prisma.testcase.update({
      where: { testcaseId: Number(testcaseId) },
      data: {
        inputVal: body.inputVal !== undefined ? normalizeToJSONString(body.inputVal) : undefined,
        outputVal: body.outputVal !== undefined ? normalizeToJSONString(body.outputVal) : undefined,
        inHiddenVal: body.inHiddenVal !== undefined ? body.inHiddenVal : undefined,
        outHiddenVal: body.outHiddenVal !== undefined ? body.outHiddenVal : undefined,
        score: body.score !== undefined ? Number(body.score) : undefined,
      },
    });

    return res.json({ ok: true, testcase: updated });
  } catch (err) {
    console.error("updateTestcaseHandler error:", err);
    return res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}

// DELETE /api/testcase/:testcaseId
export async function deleteTestcaseHandler(req, res) {
  try {
    const { testcaseId } = req.params;
    if (!testcaseId) return res.status(400).json({ ok: false, message: "testcaseId required" });

    await prisma.testcase.delete({ where: { testcaseId: Number(testcaseId) } });
    return res.json({ ok: true, message: "deleted" });
  } catch (err) {
    console.error("deleteTestcaseHandler error:", err);
    return res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}

// POST /api/testcase/runBatch
export async function runBatchHandler(req, res) {
  try {
    const { flowchart, testcases = [], userId = null } = req.body || {};
    if (!flowchart) return res.status(400).json({ ok: false, message: "flowchart object required" });
    if (!Array.isArray(testcases) || testcases.length === 0) return res.status(400).json({ ok: false, message: "testcases array required" });

    const tcList = testcases.map((t, idx) => ({
      testcaseId: t.testcaseId ?? null,
      labId: t.labId ?? null,
      inputVal: typeof t.inputVal === "string" ? t.inputVal : normalizeToJSONString(t.inputVal),
      outputVal: typeof t.outputVal === "string" ? t.outputVal : normalizeToJSONString(t.outputVal),
      score: Number(t.score || 0),
      comparatorType: t.comparatorType || "exact",
    }));

    const session = await runner.runBatch(flowchart, tcList, userId);
    return res.json({ ok: true, session: session.toSummary ? session.toSummary(true) : session });
  } catch (err) {
    console.error("runBatchHandler error:", err);
    return res.status(500).json({ ok: false, message: err.message || String(err) });
  }
}

// POST /api/testcase/runFromFlowchart/:flowchartId
export async function runFromFlowchartHandler(req, res) {
  try {
    const { flowchartId } = req.params;
    const { testcases = null, userId = null } = req.body || {};

    if (!flowchartId) {
      return res.status(400).json({ ok: false, message: "flowchartId required" });
    }

    const fcRow = await prisma.flowchart.findUnique({
      where: { flowchartId: Number(flowchartId) },
    });

    if (!fcRow) {
      return res.status(404).json({ ok: false, message: "flowchart not found" });
    }

    // flowchart JSON stored in Prisma
    const flowchartObj = hydrateFlowchart(fcRow.content);
    let tcInstances = [];

    // ----------------------------------------------------
    // CASE A: Testcases are provided in req.body
    // ----------------------------------------------------
    if (Array.isArray(testcases) && testcases.length > 0) {
      for (const t of testcases) {
        if (t.inputVal === undefined || t.outputVal === undefined) continue;

        // Save testcase to DB first
        const rec = await prisma.testcase.create({
          data: {
            labId: fcRow.labId ?? null,
            inputVal: normalizeToJSONString(t.inputVal),
            outputVal: normalizeToJSONString(t.outputVal),
            inHiddenVal: t.inHiddenVal ?? null,
            outHiddenVal: t.outHiddenVal ?? null,
            score: Number(t.score || 0),
          },
        });

        // Convert to Testcase CLASS instance
        tcInstances.push(
          new Testcase({
            testcaseId: rec.testcaseId,
            labId: rec.labId,
            inputVal: rec.inputVal,
            outputVal: rec.outputVal,
            score: rec.score,
            comparatorType: t.comparatorType || "exact",
          })
        );
      }
    }

    // ----------------------------------------------------
    // CASE B: Load testcases from DB by labId
    // ----------------------------------------------------
    else {
      if (!fcRow.labId) {
        return res.status(400).json({
          ok: false,
          message: "flowchart has no labId and no testcases provided",
        });
      }

      const rows = await prisma.testcase.findMany({
        where: { labId: Number(fcRow.labId) },
      });

      if (!rows || rows.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "no testcases found for this lab",
        });
      }

      // Convert each row into Testcase class instance
      tcInstances = rows.map((r) => {
        return new Testcase({
          testcaseId: r.testcaseId,
          labId: r.labId,
          inputVal: r.inputVal,
          outputVal: r.outputVal,
          score: r.score,
          comparatorType: r.comparatorType ?? "exact",
        });
      });
    }

    // ----------------------------------------------------
    // RUN TestRunner with real testcase CLASS instances
    // ----------------------------------------------------
    const session = await runner.runBatch(flowchartObj, tcInstances, userId);

    // ----------------------------------------------------
    // SAVE submission results
    // ----------------------------------------------------
    if (userId) {
      const results = session.results || [];

      for (const r of results) {
        try {
          await saveSubmissionSafe({
            userId,
            labId: Number(fcRow.labId),
            testcaseId: Number(r.testcaseId),
            status: r.status,
          });
        } catch (e) {
          console.warn("Failed to save submission for testcase", r.testcaseId, e);
        }
      }
    }

    // ----------------------------------------------------
    // RETURN SESSION SUMMARY
    // ----------------------------------------------------
    return res.json({
      ok: true,
      flowchartId: fcRow.flowchartId,
      labId: fcRow.labId,
      session: session.toSummary ? session.toSummary(true) : session,
    });

  } catch (err) {
    console.error("runFromFlowchartHandler error:", err);
    const code = err && err.code ? err.code : null;
    return res.status(500).json({
      ok: false,
      message: err.message || String(err),
      code,
    });
  }
}


// -----------------------
// Router: bind paths to handlers
// -----------------------
// src/router/testcase.router.js
import { Router } from "express";

const router = Router();


router.get(
  "/api/testcase/lab/:labId/list",
  getTestcasesByLabHandler
);

router.post(
  "/api/testcase/lab/:labId/create",
  createTestcaseHandler
);

router.put(
  "/api/testcase/:testcaseId/update",
  updateTestcaseHandler
);

router.delete(
  "/api/testcase/:testcaseId/delete",
  deleteTestcaseHandler
);

router.post(
  "/api/testcase/run/batch",
  runBatchHandler
);

router.post(
  "/api/testcase/run/from-flowchart/:flowchartId",
  runFromFlowchartHandler 
);

export default router;
