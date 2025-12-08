// src/controller/testcase.controller.js
// Minimal Express-style handlers — import and attach to your router
import { Testcase, TestcaseRepository, TestRunner } from '../service/testcase/index.js';

// executorFactory must create your existing Executor
// We assume your Executor class is exported from src/service/flowchart/classexecutor.js
import Executor from '../service/flowchart/classexecutor.js';

function executorFactory(flowchart, opts = {}) {
  // create instance of your Executor (flowchart object is expected)
  return new Executor(flowchart, opts);
}

// create repository + runner singletons (or create per-request as you prefer)
const repo = new TestcaseRepository();
const runner = new TestRunner({ executorFactory, repo });

/**
 * POST /api/testcase/runBatch
 * body: { flowchart: <object>, testcases: [ {inputVal: stringJSON, outputVal: stringJSON, score, comparatorType, testcaseId? } ], userId?, labId? }
 */
export async function runBatchHandler(req, res) {
  try {
    const { flowchart, testcases = [], userId = null, labId = null } = req.body || {};

    if (!flowchart) return res.status(400).json({ ok: false, message: 'flowchart object is required in body' });
    if (!Array.isArray(testcases) || testcases.length === 0) return res.status(400).json({ ok: false, message: 'testcases array required' });

    // convert plain objects to Testcase instances
    const tcInstances = testcases.map((t, idx) => new Testcase({
      testcaseId: t.testcaseId || null,
      labId: labId || t.labId || null,
      title: t.title || `tc_${idx+1}`,
      inputVal: typeof t.inputVal === 'string' ? t.inputVal : JSON.stringify(t.inputVal || []),
      outputVal: typeof t.outputVal === 'string' ? t.outputVal : JSON.stringify(t.outputVal || []),
      score: t.score || 0,
      comparatorType: t.comparatorType || 'exact',
      isHidden: !!t.isHidden
    }));

    const session = await runner.runBatch(flowchart, tcInstances, userId);

    return res.json({ ok: true, session: session.toSummary(true) });
  } catch (e) {
    console.error('runBatchHandler error:', e);
    return res.status(500).json({ ok: false, message: e.message || String(e) });
  }
}

/**
 * GET /api/testcase/lab/:labId
 * get testcases (from repo)
 */
export async function getTestcasesHandler(req, res) {
  try {
    const { labId } = req.params;
    if (!labId) return res.status(400).json({ ok: false, message: 'labId required' });
    const rows = await repo.findByLab(Number(labId));
    // return public view
    return res.json({ ok: true, testcases: rows.map(r => r.toPublicView ? r.toPublicView() : r) });
  } catch (e) {
    console.error('getTestcasesHandler error:', e);
    return res.status(500).json({ ok: false, message: e.message || String(e) });
  }
}

/**
 * POST /api/testcase/lab/:labId
 * create testcase (dev helper)
 * body: { inputVal, outputVal, score, comparatorType, title, isHidden }
 */
export async function createTestcaseHandler(req, res) {
  try {
    const { labId } = req.params;
    if (!labId) return res.status(400).json({ ok: false, message: 'labId required' });
    const payload = req.body || {};
    // minimal validation
    if (!payload.inputVal || !payload.outputVal) {
      return res.status(400).json({ ok: false, message: 'inputVal and outputVal required' });
    }
    const tc = await repo.saveTestcase(Number(labId), {
      title: payload.title || 'auto',
      inputVal: typeof payload.inputVal === 'string' ? payload.inputVal : JSON.stringify(payload.inputVal),
      outputVal: typeof payload.outputVal === 'string' ? payload.outputVal : JSON.stringify(payload.outputVal),
      score: payload.score || 0,
      comparatorType: payload.comparatorType || 'exact',
      isHidden: !!payload.isHidden
    });
    return res.json({ ok: true, testcase: tc.toPublicView ? tc.toPublicView() : tc });
  } catch (e) {
    console.error('createTestcaseHandler error:', e);
    return res.status(500).json({ ok: false, message: e.message || String(e) });
  }
}
