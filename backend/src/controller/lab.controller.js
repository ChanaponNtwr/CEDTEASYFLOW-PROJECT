// src/controller/lab.controller.js
import express from "express";
import { labService } from "../service/lab/index.js";

const router = express.Router();

/**
 * POST /labs
 * create lab (optionally with testcases)
 */
router.post("/", async (req, res) => {
  try {
    const lab = await labService.createLab(req.body);
    res.status(201).json({ ok: true, lab });
  } catch (err) {
    console.error("LAB CREATE ERROR:", err);
    res.status(400).json({
      ok: false,
      message: err.message,
      details: err.details || null
    });
  }
});

/**
 * GET /labs/:labId
 */
router.get("/:labId", async (req, res) => {
  try {
    const lab = await labService.getLab(req.params.labId);
    res.json({ ok: true, lab });
  } catch (err) {
    res.status(404).json({ ok: false, message: err.message });
  }
});

/**
 * GET /labs/owner/:userId
 */
router.get("/owner/:userId", async (req, res) => {
  try {
    const labs = await labService.listLabsByOwner(req.params.userId);
    res.json({ ok: true, labs });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * PUT /labs/:labId
 * payload may include "testcases": [ ... ] which will replace existing testcases atomically
 * optional body.currentUserId to assert owner
 */
router.put("/:labId", async (req, res) => {
  try {
    const currentUserId = req.body?.currentUserId ?? null;
    const lab = await labService.updateLab(req.params.labId, req.body, currentUserId);
    res.json({ ok: true, lab });
  } catch (err) {
    console.error("LAB UPDATE ERROR:", err);
    const status = err.code === "FORBIDDEN" ? 403 : 400;
    res.status(status).json({ ok: false, message: err.message, details: err.details || null });
  }
});

/**
 * DELETE /labs/:labId
 */
router.delete("/:labId", async (req, res) => {
  try {
    const actorUserId = req.headers["x-user-id"];
    if (!actorUserId) {
      return res.status(403).json({ ok: false, message: "x-user-id required" });
    }

    await labService.deleteLab(req.params.labId, actorUserId);

    return res.json({ ok: true });
  } catch (err) {
    console.error("LAB DELETE ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;

    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * POST /labs/:labId/testcases
 */
router.post("/:labId/testcases", async (req, res) => {
  try {
    const tc = await labService.addTestcase(req.params.labId, req.body);
    res.status(201).json({ ok: true, testcase: tc });
  } catch (err) {
    console.error("ADD TESTCASE ERROR:", err);
    res.status(400).json({ ok: false, message: err.message });
  }
});

/**
 * POST /labs/:labId/testcases/bulk
 */
router.post("/:labId/testcases/bulk", async (req, res) => {
  try {
    const result = await labService.addTestcasesBulk(req.params.labId, req.body.testcases);
    res.status(201).json({ ok: true, result });
  } catch (err) {
    console.error("ADD TESTCASES BULK ERROR:", err);
    res.status(400).json({ ok: false, message: err.message });
  }
});

export default router;
