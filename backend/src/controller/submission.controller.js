// src/controller/submission.controller.js
import express from "express";
import prisma from "../lib/prisma.js";
import SubmissionService from "../service/submission/index.js";

const router = express.Router();

/**
 * POST /api/submission/submit
 * body: { flowchartId, userId, debug? }
 */
router.post("/api/submission/submit", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const { flowchartId, userId, debug = false } = raw || {};

    if (!flowchartId || !userId) {
      return res.status(400).json({
        ok: false,
        message: "flowchartId & userId required",
      });
    }

    // load flowchart to check existence/labId
    const fc = await prisma.flowchart.findUnique({
      where: { flowchartId: Number(flowchartId) },
    });
    if (!fc) return res.status(404).json({ ok: false, message: "flowchart not found" });
    if (!fc.labId) return res.status(400).json({ ok: false, message: "flowchart has no labId" });

    // check confirmed
    const alreadyConfirmed = await SubmissionService.isConfirmed({
      userId: Number(userId),
      labId: Number(fc.labId),
    });
    if (alreadyConfirmed) {
      return res.status(403).json({
        ok: false,
        message:
          "This lab has already been CONFIRMED for this student. Editing or re-submitting is not allowed.",
      });
    }

    // perform submit (run + persist) - pass debug option through
    const result = await SubmissionService.submitFromFlowchart({
      flowchartId: Number(flowchartId),
      userId: Number(userId),
      options: { debug: Boolean(debug) },
    });

    // result.summary is computed from DB (source of truth)
    return res.json({ ok: true, summary: result.summary, normalizedResults: result.normalizedResults ?? null });
  } catch (err) {
    console.error("submission/submit error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * GET /api/submission/lab/:labId
 * - list submissions grouped by user for a lab
 */
router.get("/api/submission/lab/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    if (!labId) return res.status(400).json({ ok: false, message: "labId required" });

    // 1) ดึง submissions ทั้งหมดของ lab
    const submissions = await prisma.submission.findMany({
      where: { labId: Number(labId) },
      orderBy: { createAt: "desc" },
    });

    // 2) ดึง testcases ของ lab
    const testcases = await prisma.testcase.findMany({
      where: { labId: Number(labId) },
    });
    const testcaseMap = new Map(testcases.map(tc => [tc.testcaseId, tc]));

    // 3) group submissions by user
    const map = new Map();
    for (const s of submissions) {
      if (!map.has(s.userId)) map.set(s.userId, []);
      map.get(s.userId).push(s);
    }

    // 4) build data with scoreSummary
    const data = [];
    for (const [userId, userSubs] of map.entries()) {
      let totalScore = 0;
      let totalMaxScore = 0;

      const subsWithScore = userSubs.map(s => {
        const tc = testcaseMap.get(s.testcaseId);
        const maxScore = tc?.score ?? 1;
        const awarded = s.status === "PASS" ? maxScore : 0;
        totalScore += awarded;
        totalMaxScore += maxScore;

        return { ...s, scoreAwarded: awarded, maxScore };
      });

      data.push({
        userId,
        submissions: subsWithScore,
        scoreSummary: `${totalScore}/${totalMaxScore}`
      });
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error("submission getByLab error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * GET /api/submission/user/:userId/lab/:labId/latest
 */
router.get("/api/submission/user/:userId/lab/:labId/latest", async (req, res) => {
  try {
    const { userId, labId } = req.params;
    if (!userId || !labId) return res.status(400).json({ ok: false, message: "userId & labId required" });
    const rows = await SubmissionService.getLatestForUserLab({ userId: Number(userId), labId: Number(labId) });
    return res.json({ ok: true, submissions: rows });
  } catch (err) {
    console.error("get latest submission error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * POST /api/submission/lab/:labId/user/:userId/confirm
 * body: { reviewerId? }
 */
router.post("/api/submission/lab/:labId/user/:userId/confirm", async (req, res) => {
  try {
    const { labId, userId } = req.params;
    if (!labId || !userId) return res.status(400).json({ ok: false, message: "labId & userId required" });

    await SubmissionService.confirmSubmissions({ userId: Number(userId), labId: Number(labId) });
    return res.json({ ok: true, message: "Confirmed" });
  } catch (err) {
    console.error("confirm error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * POST /api/submission/lab/:labId/user/:userId/cancel
 * - นักเรียนยกเลิกการส่งงานของ lab นี้ทั้งหมด
 */
router.post("/api/submission/lab/:labId/user/:userId/cancel", async (req, res) => {
  try {
    const { labId, userId } = req.params;
    if (!labId || !userId) {
      return res.status(400).json({ ok: false, message: "labId & userId required" });
    }

    // 1) เช็คว่าเคย confirm แล้วหรือยัง
    const alreadyConfirmed = await SubmissionService.isConfirmed({
      userId: Number(userId),
      labId: Number(labId),
    });

    if (alreadyConfirmed) {
      return res.status(403).json({
        ok: false,
        message: "This lab has already been CONFIRMED. Cancel is not allowed.",
      });
    }

    // 2) ลบ submissions ทั้งหมดของ user + lab นี้
    const deleted = await prisma.submission.deleteMany({
      where: {
        userId: Number(userId),
        labId: Number(labId),
      },
    });

    return res.json({
      ok: true,
      message: "Submission cancelled",
      deletedCount: deleted.count,
    });
  } catch (err) {
    console.error("cancel submission error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});


/**
 * POST /api/submission/lab/:labId/user/:userId/reject
 * body: { reviewerId? }
 */
router.post("/api/submission/lab/:labId/user/:userId/reject", async (req, res) => {
  try {
    const { labId, userId } = req.params;
    if (!labId || !userId) return res.status(400).json({ ok: false, message: "labId & userId required" });

    await SubmissionService.rejectSubmissions({ userId: Number(userId), labId: Number(labId) });
    return res.json({ ok: true, message: "Rejected and submissions removed" });
  } catch (err) {
    console.error("reject error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

export default router;
