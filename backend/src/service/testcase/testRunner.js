// src/service/testcase/testRunner.js
import InputCombiner from './inputCombiner.js';
import OutputSplitter from './outputSplitter.js';
import Comparator from './comparator.js';
import ArrayInputProvider, { InputMissingError } from './inputProvider.js';
import TestcaseResult from './testcaseResult.js';
import TestSession from './testSession.js';

export default class TestRunner {
  constructor({ executorFactory, repo }) {
    if (!executorFactory) throw new Error('executorFactory is required');
    if (!repo) throw new Error('repo is required');
    this.executorFactory = executorFactory;
    this.inputCombiner = new InputCombiner();
    this.outputSplitter = new OutputSplitter();
    this.comparator = Comparator;
    this.repo = repo;
  }

  validateBeforeRun(flowchartMeta, testcases = []) {
    const combined = this.inputCombiner.combine(testcases);
    return this.inputCombiner.validateCombinedInputs(flowchartMeta, combined);
  }

  /**
   * runBatch:
   * - flowchart: object that will be passed to executorFactory to create Executor
   * - testcases: array of Testcase instances
   * - userId: number (for session)
   */
  async runBatch(flowchart, testcases = [], userId = null) {
    const session = new TestSession({ userId, labId: (testcases[0] && testcases[0].labId) || null, flowchartId: flowchart?.flowchartId || null, mode: 'batch' });
    session.start();

    // create session record (persist)
    try {
      const created = await this.repo.createSession({ userId: session.userId, labId: session.labId, flowchartId: session.flowchartId, mode: session.mode, createdAt: session.createdAt });
      session.runId = created.runId || created.runId || session.runId;
    } catch (e) {
      // fallback: continue without persistent id
      session.runId = session.runId || null;
    }

    // combine inputs
    const combinedInputs = this.inputCombiner.combine(testcases);

    // validate
    const v = this.inputCombiner.validateCombinedInputs(flowchart, combinedInputs);
    if (!v.ok) {
      // create a failing result for each testcase (or mark overall input missing)
      for (const tc of testcases) {
        const res = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'INPUT_MISSING',
          expected: tc.parseOutputs(),
          actual: [],
          scoreAwarded: 0,
          errorMessage: v.message
        });
        session.recordResult(res);
        await this.repo.saveResult(res).catch(() => {});
      }
      session.finish();
      await this.repo.saveSession(session).catch(() => {});
      return session;
    }

    // build input provider
    const provider = new ArrayInputProvider(combinedInputs);

    // create executor
    const executor = this.executorFactory(flowchart, { maxTimeMs: flowchart?.maxTimeMs || undefined });

    // set provider onto executor (so handlers can call flowchart._inputProvider or executor.options)
    if (typeof executor.setInputProvider === 'function') {
      executor.setInputProvider((prompt, varName) => provider.next(prompt, varName));
    } else if (executor.flowchart) {
      executor.flowchart._inputProvider = (prompt, varName) => provider.next(prompt, varName);
    }

    // run using step loop to capture step results/errors
    let lastStepRes = null;
    try {
      while (true) {
        // call step and capture return object
        const res = executor.step({ forceAdvanceBP: true });
        lastStepRes = res;
        // if handler returned an error object
        if (res && res.error) {
          // treat as run error
          const errMsg = (res.error && res.error.message) || String(res.error);
          // create a result marking INPUT_MISSING if the underlying error is InputMissingError
          const isInputMissing = errMsg && errMsg.toUpperCase().includes('INPUT') && errMsg.toUpperCase().includes('MISSING');
          // Mark all remaining testcases as failed with error
          for (const tc of testcases) {
            const r = new TestcaseResult({
              runId: session.runId,
              testcaseId: tc.testcaseId,
              status: isInputMissing ? 'INPUT_MISSING' : 'ERROR',
              expected: (() => { try { return tc.parseOutputs(); } catch(e){ return []; } })(),
              actual: (() => { try { return executor.context && executor.context.output ? executor.context.output.slice() : []; } catch(e){ return []; } })(),
              scoreAwarded: 0,
              errorMessage: errMsg
            });
            session.recordResult(r);
            await this.repo.saveResult(r).catch(()=>{});
          }
          break;
        }

        // if paused because breakpoint (should not happen with forceAdvanceBP true) -> break
        if (res && res.paused) {
          break;
        }

        // if done -> stop
        if (res && res.done) {
          break;
        }

        // continue loop (executor.step will progress)
      }
    } catch (err) {
      // unexpected thrown error
      const errMsg = err && err.message ? err.message : String(err);
      for (const tc of testcases) {
        const r = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          expected: (() => { try { return tc.parseOutputs(); } catch(e){ return []; } })(),
          actual: executor && executor.context && executor.context.output ? executor.context.output.slice() : [],
          scoreAwarded: 0,
          errorMessage: errMsg
        });
        session.recordResult(r);
        await this.repo.saveResult(r).catch(()=>{});
      }
      session.finish();
      await this.repo.saveSession(session).catch(()=>{});
      return session;
    }

    // At this point execution finished (or stopped). Collect outputs
    const combinedOutputs = (executor && executor.context && Array.isArray(executor.context.output)) ? executor.context.output.slice() : [];

    // split by expected counts
    const chunks = this.outputSplitter.split(combinedOutputs, testcases);

    // produce results per testcase
    for (let i = 0; i < testcases.length; i++) {
      const tc = testcases[i];
      const chunk = chunks.find(c => c.testcaseId === tc.testcaseId);
      if (!chunk) {
        // no output provided for this testcase
        const r = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          expected: tc.parseOutputs(),
          actual: [],
          scoreAwarded: 0,
          errorMessage: 'No output chunk for testcase'
        });
        session.recordResult(r);
        await this.repo.saveResult(r).catch(()=>{});
        continue;
      }

      if (chunk.error) {
        const r = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          expected: chunk.expected,
          actual: chunk.actual,
          scoreAwarded: 0,
          errorMessage: chunk.error
        });
        session.recordResult(r);
        await this.repo.saveResult(r).catch(()=>{});
        continue;
      }

      const pass = this.comparator.compare(chunk.actual, chunk.expected, tc.comparatorType || 'exact');
      const score = pass ? tc.score : 0;
      const r = new TestcaseResult({
        runId: session.runId,
        testcaseId: tc.testcaseId,
        status: pass ? 'PASS' : 'FAIL',
        expected: chunk.expected,
        actual: chunk.actual,
        scoreAwarded: score,
        errorMessage: pass ? null : 'Mismatch'
      });
      session.recordResult(r);
      await this.repo.saveResult(r).catch(()=>{});
    }

    session.finish();
    await this.repo.saveSession(session).catch(()=>{});

    return session;
  }
}
