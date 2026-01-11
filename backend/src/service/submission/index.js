// src/service/submission/index.js
import prisma from "../../lib/prisma.js";
import { TestRunner } from "../testcase/index.js";
import Executor from "../flowchart/classexecutor.js";
import TestcaseModel from "../testcase/testcase_model.js";
import { hydrateFlowchart } from "../../controller/flowchart.controller.js";
import TestcaseRepository from "../testcase/testcaseRepository.js";
import OutputSplitter from "../testcase/outputSplitter.js";

// executor factory (same as testcase.controller)
function executorFactory(flowchart, opts = {}) {
  return new Executor(flowchart, opts);
}

// repo + runner singletons (match testcase.controller usage)
const repo = new TestcaseRepository();
const runner = new TestRunner({ executorFactory, repo });

// ================= helper functions =================
function normalizeStatusString(s) {
  if (!s && s !== 0) return null;
  const st = String(s).trim().toUpperCase();
  if (st === "PASS" || st === "PASSED" || st === "OK" || st === "SUCCESS") return "PASS";
  if (st === "ERROR") return "ERROR";
  if (st === "FAIL" || st === "FAILED") return "FAIL";
  // special-case input missing
  if (st === "INPUT_MISSING" || st === "INPUT-MISSING") return "ERROR";
  return null;
}

function normalizeRawResult(raw) {
  // legacy support: try to extract testcase id or return null
  const tid = raw?.testcaseId ?? raw?.tcId ?? raw?.id ?? raw?.testCaseId ?? null;
  const parsedTid = tid !== null && tid !== undefined ? Number(tid) : null;

  // normalize status to PASS/FAIL/ERROR
  let status = normalizeStatusString(raw?.status ?? raw?.result ?? raw?.outcome);
  if (!status) {
    if (raw?.passed === true || raw?.ok === true || raw?.success === true) status = "PASS";
    else if (raw?.error || raw?.errorMessage) status = "ERROR";
    else if (raw?.passed === false || raw?.ok === false || raw?.success === false) status = "FAIL";
  }
  if (!status) {
    if (raw?.compare === true || raw?.matched === true || raw?.equal === true) status = "PASS";
    else if (raw?.compare === false || raw?.matched === false || raw?.equal === false) status = "FAIL";
  }
  if (!status) status = "FAIL"; // conservative default

  return {
    testcaseId: Number.isNaN(parsedTid) ? null : parsedTid,
    status,
    raw,
  };
}

// helper comparator (simple exact JSON equality fallback)
function compareExpectedActual(expectedArr = [], actualArr = [], comparatorType = "exact") {
  try {
    if (!Array.isArray(expectedArr)) expectedArr = [expectedArr];
    if (!Array.isArray(actualArr)) actualArr = [actualArr];
    if (expectedArr.length !== actualArr.length) return { ok: false, message: "length mismatch" };

    for (let i = 0; i < expectedArr.length; i++) {
      const a = expectedArr[i];
      const b = actualArr[i];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        return { ok: false, message: `mismatch at index ${i}` };
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: `compare error: ${e.message}` };
  }
}

/**
 * mapAndNormalizeResults(rawResults, testcaseRows)
 * (keeps your robust mapper for non-structured runner outputs)
 */
function mapAndNormalizeResults(rawResults = [], testcaseRows = []) {
  const normalized = [];
  const splitter = new OutputSplitter();

  // compute expectedTotal
  const expectedTotal = testcaseRows.reduce((s, r) => {
    try {
      if (typeof r.expectedCount === "function") {
        return s + r.expectedCount();
      }
      if (typeof r.parseOutputs === "function") {
        const out = r.parseOutputs();
        return s + (Array.isArray(out) ? out.length : 1);
      }
      if (typeof r.outputVal === "string") {
        const parsed = JSON.parse(r.outputVal);
        return s + (Array.isArray(parsed) ? parsed.length : 1);
      }
    } catch (e) {
      // ignore parse error -> assume 1
    }
    return s + 1;
  }, 0);

  // Case A: runner already returned per-testcase objects containing testcaseId and status
  const isPerTestcaseObjects = Array.isArray(rawResults) &&
    rawResults.every(it => it && (it.testcaseId !== undefined || it.status !== undefined));

  if (isPerTestcaseObjects && rawResults.length >= testcaseRows.length) {
    for (let i = 0; i < rawResults.length; i++) {
      const r = rawResults[i];
      const tid = r.testcaseId ?? testcaseRows[i]?.testcaseId ?? null;
      let status = normalizeStatusString(r.status ?? r.result ?? null);
      if (!status) {
        if (r.passed === true || r.ok === true) status = "PASS";
        else if (r.error || r.errorMessage) status = "ERROR";
        else status = "FAIL";
      }
      normalized.push({ testcaseId: Number(tid), status, raw: r });
    }
    return normalized;
  }

  // Case B: combined outputs (split)
  if (Array.isArray(rawResults) && rawResults.length === expectedTotal) {
    const chunks = splitter.split(rawResults, testcaseRows);
    for (const ch of chunks) {
      if (!ch.testcaseId) {
        normalized.push({ testcaseId: null, status: "ERROR", raw: ch, error: ch.error });
        continue;
      }
      const tcRow = testcaseRows.find(t => Number(t.testcaseId) === Number(ch.testcaseId));
      const comparatorType = tcRow?.comparatorType ?? "exact";
      const cmp = compareExpectedActual(ch.expected, ch.actual, comparatorType);
      const status = cmp.ok ? "PASS" : "FAIL";
      normalized.push({ testcaseId: Number(ch.testcaseId), status, raw: ch, compareMessage: cmp.message ?? null });
    }
    return normalized;
  }

  // Case C: per-index raw values length === testcaseRows.length
  if (Array.isArray(rawResults) && rawResults.length === testcaseRows.length) {
    for (let i = 0; i < rawResults.length; i++) {
      const r = rawResults[i];
      const tc = testcaseRows[i];
      const tcid = tc.testcaseId;
      const actual = Array.isArray(r) ? r : [r];
      let expected;
      try {
        if (typeof tc.parseOutputs === "function") expected = tc.parseOutputs();
        else expected = JSON.parse(tc.outputVal);
      } catch (e) {
        expected = Array.isArray(tc.outputVal) ? tc.outputVal : [tc.outputVal];
      }
      const comparatorType = tc.comparatorType ?? "exact";
      const cmp = compareExpectedActual(expected, actual, comparatorType);
      const status = cmp.ok ? "PASS" : "FAIL";
      normalized.push({ testcaseId: Number(tcid), status, raw: { actual: r }, compareMessage: cmp.message ?? null });
    }
    return normalized;
  }

  // Case D: single element array of combined outputs
  if (Array.isArray(rawResults) && rawResults.length === 1 && Array.isArray(rawResults[0]) && rawResults[0].length === expectedTotal) {
    const inner = rawResults[0];
    const chunks = splitter.split(inner, testcaseRows);
    for (const ch of chunks) {
      if (!ch.testcaseId) {
        normalized.push({ testcaseId: null, status: "ERROR", raw: ch, error: ch.error });
        continue;
      }
      const tcRow = testcaseRows.find(t => Number(t.testcaseId) === Number(ch.testcaseId));
      const comparatorType = tcRow?.comparatorType ?? "exact";
      const cmp = compareExpectedActual(ch.expected, ch.actual, comparatorType);
      const status = cmp.ok ? "PASS" : "FAIL";
      normalized.push({ testcaseId: Number(ch.testcaseId), status, raw: ch, compareMessage: cmp.message ?? null });
    }
    return normalized;
  }

  // fallback mapping by index
  for (let i = 0; i < Math.min(rawResults.length, testcaseRows.length); i++) {
    const r = rawResults[i];
    const tc = testcaseRows[i];
    const tcid = tc.testcaseId;
    const actual = r?.actual ?? r;
    let expected;
    try {
      expected = typeof tc.parseOutputs === "function" ? tc.parseOutputs() : JSON.parse(tc.outputVal);
    } catch (e) {
      expected = Array.isArray(tc.outputVal) ? tc.outputVal : [tc.outputVal];
    }
    const cmp = compareExpectedActual(expected, Array.isArray(actual) ? actual : [actual], tc.comparatorType ?? "exact");
    const status = cmp.ok ? "PASS" : "FAIL";
    normalized.push({ testcaseId: Number(tcid), status, raw: r, compareMessage: cmp.message ?? null });
  }

  // ensure every testcase has a mapped result
  const have = new Set(normalized.map(n => Number(n.testcaseId)).filter(Boolean));
  for (const tc of testcaseRows) {
    if (!have.has(Number(tc.testcaseId))) {
      normalized.push({ testcaseId: Number(tc.testcaseId), status: "ERROR", raw: null, error: "no result mapped" });
    }
  }

  return normalized;
}

// delete old submissions for a user+lab before saving new attempt
async function clearPreviousSubmissions({ userId, labId }) {
  await prisma.submission.deleteMany({
    where: { userId: Number(userId), labId: Number(labId) },
  });
}

// bulk create submissions (expects clean state)
async function bulkCreateSubmissions({ entries }) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  await prisma.submission.createMany({
    data: entries.map((e) => ({
      userId: Number(e.userId),
      labId: Number(e.labId),
      testcaseId: Number(e.testcaseId),
      status: String(e.status),
      createAt: e.createAt ?? new Date(),
    })),
    skipDuplicates: true,
  });
  return true;
}

// helper: normalize session.results when they are TestcaseResult-like
function normalizeFromSessionResults(sessionResults = [], testcaseRows = []) {
  // If results look like TestcaseResult objects (have testcaseId and status), map directly
  const looksLikeTestcaseResults = Array.isArray(sessionResults) &&
    sessionResults.every(r => r && (r.testcaseId !== undefined) && (r.status !== undefined));

  if (looksLikeTestcaseResults) {
    return sessionResults.map(r => {
      const status = normalizeStatusString(r.status) || "FAIL";
      return {
        testcaseId: Number(r.testcaseId),
        status,
        raw: r
      };
    });
  }

  // otherwise return null to indicate fallback
  return null;
}

// ================= SubmissionService =================
export default class SubmissionService {
  /**
   * submitFromFlowchart
   * - run flowchart against all testcases of its lab (isolated clones)
   * - persist normalized results to Submission table (replace previous attempt)
   * - return summary based on DB (source of truth)
   */
  static async submitFromFlowchart({ flowchartId, userId, options = {} }) {
    if (!flowchartId) throw new Error("flowchartId required");
    if (!userId) throw new Error("userId required");

    const debug = !!options.debug;

    // 1) load flowchart row
    const fcRow = await prisma.flowchart.findUnique({ where: { flowchartId: Number(flowchartId) } });
    if (!fcRow) throw new Error("flowchart not found");
    if (!fcRow.labId) throw new Error("flowchart has no labId");

    // 2) load testcases for lab
    const testcaseRows = await prisma.testcase.findMany({
      where: { labId: Number(fcRow.labId) },
      orderBy: { testcaseId: "asc" },
    });

    if (!Array.isArray(testcaseRows) || testcaseRows.length === 0) {
      throw new Error("no testcases for this lab");
    }

    // 3) hydrate flowchart stored content
    const flowchartObj = hydrateFlowchart(fcRow.content);

    // 4) build TestcaseModel instances (preserve fields). We'll clone each when executing.
    const baseTestcases = testcaseRows.map((r) => new TestcaseModel({
      testcaseId: r.testcaseId,
      labId: r.labId,
      title: r.title ?? null,
      inputVal: r.inputVal,
      outputVal: r.outputVal,
      inHiddenVal: r.inHiddenVal,
      outHiddenVal: r.outHiddenVal,
      score: Number(r.score || 0),
      comparatorType: r.comparatorType || 'exact',
      isHidden: !!r.isHidden,
      createdAt: r.createdAt ?? null
    }));

    // 5) run using singleton runner
    let session;
    if (typeof runner.runBatch === "function") {
      const clones = baseTestcases.map(tc => (typeof tc.clone === 'function' ? tc.clone() : tc));
      session = await runner.runBatch(flowchartObj, clones, userId);
    } else if (typeof runner.run === "function") {
      const clones = baseTestcases.map(tc => (typeof tc.clone === 'function' ? tc.clone() : tc));
      session = await runner.run(flowchartObj, clones, userId);
    } else {
      throw new Error("TestRunner API not found (expected runBatch or run)");
    }

    const rawResults = Array.isArray(session?.results) ? session.results : [];

    if (debug) {
      console.log("DEBUG submitFromFlowchart - session.results (from runner):", JSON.stringify(rawResults, null, 2));
    }

    // 6) map & normalize results
    // Prefer using session.results directly when they are TestcaseResult-like (status + testcaseId)
    let normalized = normalizeFromSessionResults(rawResults, baseTestcases);

    if (!normalized) {
      // fallback to robust mapper for other shapes
      normalized = mapAndNormalizeResults(rawResults, baseTestcases);
    }

    if (debug) {
      console.log("DEBUG submitFromFlowchart - normalized results (final):", JSON.stringify(normalized, null, 2));
    }

    // 7) persist normalized results
    await clearPreviousSubmissions({ userId, labId: fcRow.labId });

    const entries = normalized
      .filter(n => n && n.testcaseId)
      .map((r) => ({
        userId: Number(userId),
        labId: Number(fcRow.labId),
        testcaseId: Number(r.testcaseId),
        status: r.status,
        createAt: new Date(),
      }));

    if (entries.length === 0) {
      const emptySummary = {
        flowchartId: Number(flowchartId),
        labId: fcRow.labId,
        total: 0,
        passed: 0,
        failed: 0,
        errored: 0
      };
      return { summary: emptySummary, rawSession: session, normalizedResults: normalized };
    }

    await bulkCreateSubmissions({ entries });

    if (debug) {
      const dbAfter = await prisma.submission.findMany({
        where: { userId: Number(userId), labId: Number(fcRow.labId) },
        orderBy: { testcaseId: "asc" }
      });
      console.log("DEBUG submitFromFlowchart - DB submissions after save:", JSON.stringify(dbAfter, null, 2));
    }

    // 8) build summary from DB (source of truth)
    const submissions = await prisma.submission.findMany({
      where: { userId: Number(userId), labId: Number(fcRow.labId) },
    });

    const total = submissions.length;
    const passed = submissions.filter(s => s.status === "PASS").length;
    const failed = submissions.filter(s => s.status === "FAIL").length;
    const errored = submissions.filter(s => s.status === "ERROR").length;

    const summary = {
      flowchartId: Number(flowchartId),
      labId: fcRow.labId,
      total,
      passed,
      failed,
      errored
    };

    return { summary, rawSession: session, normalizedResults: normalized };
  }

  // -------------------------
  static async getSubmissionsByLab({ labId }) {
    if (!labId) throw new Error("labId required");
    const rows = await prisma.submission.findMany({
      where: { labId: Number(labId) },
      orderBy: { createAt: "desc" },
    });

    // group by userId
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.userId)) map.set(r.userId, []);
      map.get(r.userId).push(r);
    }

    const result = [];
    for (const [userId, submissions] of map.entries()) {
      result.push({ userId, submissions });
    }
    return result;
  }

  static async getLatestForUserLab({ userId, labId }) {
    if (!userId || !labId) throw new Error("userId & labId required");
    const rows = await prisma.submission.findMany({
      where: { userId: Number(userId), labId: Number(labId) },
      orderBy: { createAt: "desc" },
    });
    return rows;
  }

  static async confirmSubmissions({ userId, labId, reviewerId = null }) {
    if (!userId || !labId) throw new Error("userId & labId required");

    await prisma.submission.updateMany({
      where: { userId: Number(userId), labId: Number(labId) },
      data: { status: "CONFIRMED", createAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        userId: Number(userId),
        message: `Your submission for labId=${labId} has been CONFIRMED`,
        createAt: new Date(),
      },
    });

    return { ok: true };
  }

  static async rejectSubmissions({ userId, labId, reviewerId = null }) {
    if (!userId || !labId) throw new Error("userId & labId required");

    await prisma.submission.deleteMany({
      where: { userId: Number(userId), labId: Number(labId) },
    });

    await prisma.notification.create({
      data: {
        userId: Number(userId),
        message: `Your submission for labId=${labId} has been REJECTED`,
        createAt: new Date(),
      },
    });

    return { ok: true };
  }

  static async isConfirmed({ userId, labId }) {
    if (!userId || !labId) return false;
    const found = await prisma.submission.findFirst({
      where: { userId: Number(userId), labId: Number(labId), status: "CONFIRMED" },
    });
    return !!found;
  }
}
