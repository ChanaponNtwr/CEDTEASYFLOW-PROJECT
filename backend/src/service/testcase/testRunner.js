// src/service/testcase/testRunner.js
import InputCombiner from './inputCombiner.js';
import OutputSplitter from './outputSplitter.js';
import Comparator from './comparator.js';
import ArrayInputProvider from './inputProvider.js';
import TestcaseResult from './testcaseResult.js';
import TestSession from './testSession.js';
import Testcase from './testcase_model.js';
import { hydrateFlowchart } from '../flowchart/index.js';

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

  parseInputType(val) {
    if (typeof val === 'string' && val.trim() !== '') {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    return val;
  }

  /* ================= FLOWCHART CLONE ================= */

  cloneFlowchart(flowchart) {
    if (!flowchart) return null;
    const plain = JSON.parse(JSON.stringify(flowchart));

    if (flowchart.startNodeId) plain.startNodeId = flowchart.startNodeId;
    if (flowchart.start) plain.start = flowchart.start;

    if (plain.nodes) {
      const nodes = Array.isArray(plain.nodes)
        ? plain.nodes
        : Object.values(plain.nodes);

      nodes.forEach(n => {
        if (n.data) {
          delete n.data.visited;
          delete n.data.loopCount;
          delete n.data.visitCount;
        }
      });
    }

    const hydrated = hydrateFlowchart(plain);
    if (hydrated && !hydrated.startNodeId && plain.startNodeId) {
      hydrated.startNodeId = plain.startNodeId;
    }
    return hydrated;
  }

  /* ================= RUN ================= */

  async runBatch(flowchart, testcases = [], userId = null) {
    const session = new TestSession({
      userId,
      labId: testcases[0]?.labId ?? null,
      flowchartId: flowchart?.flowchartId ?? null,
      mode: 'batch'
    });
    session.start();

    try {
      const created = await this.repo.createSession({
        userId: session.userId,
        labId: session.labId,
        flowchartId: session.flowchartId,
        mode: session.mode,
        createdAt: session.createdAt
      });
      session.runId = created.runId ?? null;
    } catch {}

    const tcInstances = testcases.map(t =>
      t instanceof Testcase ? t : new Testcase(t)
    );

    for (const tc of tcInstances) {
      let expected;
      try {
        expected = tc.parseOutputs();
      } catch (e) {
        session.recordResult(new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          errorMessage: e.message
        }));
        continue;
      }

      let inputs;
      try {
        inputs = tc.parseInputs();
        if (Array.isArray(inputs[0])) inputs = inputs[0];
        inputs = inputs.map(v => this.parseInputType(v));
      } catch (e) {
        session.recordResult(new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          errorMessage: e.message
        }));
        continue;
      }

      let executor;
      let result;

      try {
        const provider = new ArrayInputProvider(inputs);
        const clean = this.cloneFlowchart(flowchart);
        executor = this.executorFactory(clean, {});

        // 🔥 สำคัญที่สุด: RESET STATE ให้เหมือน controller
        executor.context.output = [];
        executor.context._scopeStack = [ {} ];
        executor.context._syncVariables?.();

        // 🔥 force start node
        if (clean?.startNodeId) {
          executor.currentNodeId = clean.startNodeId;
        }

        executor.setInputProvider?.((p, v) => provider.next(p, v));

        let steps = 0;
        const maxSteps = clean?.limits?.maxSteps ?? 100000;

        while (!executor.finished && steps < maxSteps) {
          const r = executor.step({ forceAdvanceBP: true });
          if (r?.error) throw new Error(r.error);
          steps++;
        }

        const actual = executor.context.output.slice();
        const chunk = this.outputSplitter.split(actual, [tc])[0];

        const pass = this.comparator.compare(chunk.actual, chunk.expected, tc.comparatorType);
        result = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: pass ? 'PASS' : 'FAIL',
          expected: chunk.expected,
          actual: chunk.actual,
          scoreAwarded: pass ? tc.score : 0,
          errorMessage: pass ? null : 'Mismatch'
        });

      } catch (e) {
        result = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          expected,
          actual: executor?.context?.output ?? [],
          errorMessage: e.message
        });
      }

      session.recordResult(result);
      await this.repo.saveResult(result).catch(() => {});
    }

    session.finish();
    await this.repo.saveSession(session).catch(() => {});
    return session;
  }
}
