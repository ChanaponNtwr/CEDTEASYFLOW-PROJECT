// src/service/testcase/testRunner.js
import InputCombiner from './inputCombiner.js';
import OutputSplitter from './outputSplitter.js';
import Comparator from './comparator.js';
import ArrayInputProvider, { InputMissingError } from './inputProvider.js';
import TestcaseResult from './testcaseResult.js';
import TestSession from './testSession.js';
import Testcase from './testcase_model.js';
import { hydrateFlowchart } from '../flowchart/index.js'; // Import hydrate logic

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

  // [FIX 1] Helper: Parse input string to number to prevent string concatenation
  // แปลง "50" -> 50 เพื่อให้บวกเลขได้ ไม่ใช่เอา string มาต่อกัน
  parseInputType(val) {
    if (typeof val === 'string' && val.trim() !== '') {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
    return val;
  }

  // [FIX 2] Helper: Clone and Sanitize flowchart carefully
  // ล้างค่าเก่าที่ค้างอยู่ (เช่น 50) แต่เก็บสูตรการคำนวณไว้
  cloneFlowchart(flowchart) {
    if (!flowchart) return null;
    try {
      // 1. Deep Copy
      const plainData = JSON.parse(JSON.stringify(flowchart));

      // 2. Sanitize: Clear runtime data only
      if (plainData.nodes) {
        const nodes = Array.isArray(plainData.nodes)
          ? plainData.nodes
          : Object.values(plainData.nodes);

        nodes.forEach(node => {
          if (node.data) {
             const type = (node.type || '').toUpperCase();
             // [IMPORTANT] ลบ 'value' เฉพาะโหนด Input เท่านั้น! 
             // ห้ามลบของ AS (Assign) หรือ DC (Declare) เพราะนั่นคือ Logic ของโหนด
             if (['IN', 'INPUT', 'READ'].includes(type)) {
                delete node.data.value;
             }
             // ลบตัวแปร runtime อื่นๆ
             delete node.data.visited;
             delete node.data.loopCount;
             delete node.data.visitCount;
          }
        });
      }

      // 3. Re-hydrate
      return hydrateFlowchart(plainData);
    } catch (e) {
      console.warn("Failed to clone/hydrate flowchart", e);
      return flowchart;
    }
  }

  // optional convenience
  validateBeforeRun(flowchartMeta, testcases = []) {
    const combined = this.inputCombiner.combine(testcases);
    return this.inputCombiner.validateCombinedInputs(flowchartMeta, combined);
  }

  /**
   * runBatch:
   * - flowchart: object (hydrated or raw) passed to executorFactory
   * - testcases: array of Testcase instances OR plain objects
   * - userId: optional (for session/submissions)
   */
  async runBatch(flowchart, testcases = [], userId = null) {
    const session = new TestSession({
      userId,
      labId: (testcases[0] && testcases[0].labId) || null,
      flowchartId: flowchart?.flowchartId || null,
      mode: 'batch'
    });
    session.start();

    // try persist session
    try {
      const created = await this.repo.createSession({
        userId: session.userId,
        labId: session.labId,
        flowchartId: session.flowchartId,
        mode: session.mode,
        createdAt: session.createdAt
      });
      session.runId = created.runId || session.runId;
    } catch (e) {
      session.runId = session.runId || null;
    }

    // Normalize incoming testcases into Testcase class instances
    const tcInstances = (testcases || []).map(t => {
      if (!t) return null;
      if (typeof t.parseInputs === 'function' && typeof t.parseOutputs === 'function') return t;
      return new Testcase({
        testcaseId: t.testcaseId ?? null,
        labId: t.labId ?? null,
        title: t.title ?? '',
        inputVal: typeof t.inputVal === 'string' ? t.inputVal : JSON.stringify(t.inputVal ?? []),
        outputVal: typeof t.outputVal === 'string' ? t.outputVal : JSON.stringify(t.outputVal ?? []),
        inHiddenVal: typeof t.inHiddenVal === 'string' ? t.inHiddenVal : (t.inHiddenVal ? JSON.stringify(t.inHiddenVal) : null),
        outHiddenVal: typeof t.outHiddenVal === 'string' ? t.outHiddenVal : (t.outHiddenVal ? JSON.stringify(t.outHiddenVal) : null),
        score: Number(t.score || 0),
        comparatorType: t.comparatorType || 'exact',
        isHidden: !!t.isHidden
      });
    }).filter(Boolean);

    // iterate testcases
    for (const tc of tcInstances) {
      // --- parse expected outputs (visible) ---
      let expectedOutputs = [];
      try {
        expectedOutputs = tc.parseOutputs();
      } catch (e) {
        const r = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          scoreAwarded: 0,
          errorMessage: `Invalid expected output JSON: ${e.message}`
        });
        session.recordResult(r);
        await this.repo.saveResult(r).catch(()=>{});
        continue;
      }

      // --- parse inputs (visible) ---
      let inputsArr = [];
      try {
        inputsArr = tc.parseInputs();
        if (Array.isArray(inputsArr) && Array.isArray(inputsArr[0])) inputsArr = inputsArr[0];
        if (!Array.isArray(inputsArr)) inputsArr = [inputsArr];

        // [FIX 1 Applied] Parse inputs to numbers
        inputsArr = inputsArr.map(v => this.parseInputType(v));

      } catch (e) {
        const r = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          scoreAwarded: 0,
          errorMessage: `Invalid input JSON: ${e.message}`
        });
        session.recordResult(r);
        await this.repo.saveResult(r).catch(()=>{});
        continue;
      }

      // --- VISIBLE RUN ---
      let visibleResult = null;
      try {
        const provider = new ArrayInputProvider(inputsArr);
        
        // [FIX 2 Applied] Clone and Sanitize Flowchart
        const cleanFlowchart = this.cloneFlowchart(flowchart);

        const executor = this.executorFactory(cleanFlowchart, { maxTimeMs: cleanFlowchart?.maxTimeMs || undefined });

        if (typeof executor.setInputProvider === 'function') {
          executor.setInputProvider((prompt, varName) => provider.next(prompt, varName));
        } else if (executor.flowchart) {
          executor.flowchart._inputProvider = (prompt, varName) => provider.next(prompt, varName);
        }

        // [Manual Step Loop] Matches Controller behavior
        try {
          const maxSteps = (cleanFlowchart && cleanFlowchart.limits && cleanFlowchart.limits.maxSteps) || cleanFlowchart.maxSteps || 100000;
          let stepCount = 0;

          while (!executor.finished && stepCount < maxSteps) {
            const result = executor.step({ forceAdvanceBP: true });
            
            if (result && result.error) {
              throw new Error(result.error);
            }
            stepCount++;
          }

          if (stepCount >= maxSteps && !executor.finished) {
            throw new Error(`Execution exceeded max steps (${maxSteps})`);
          }

        } catch (runErr) {
          const errMsg = runErr && runErr.message ? runErr.message : String(runErr);
          visibleResult = new TestcaseResult({
            runId: session.runId,
            testcaseId: tc.testcaseId,
            status: errMsg.toUpperCase().includes('INPUT') ? 'INPUT_MISSING' : 'ERROR',
            expected: expectedOutputs,
            actual: (executor && executor.context && Array.isArray(executor.context.output)) ? executor.context.output.slice() : [],
            scoreAwarded: 0,
            errorMessage: errMsg
          });
        }

        // If no error thrown above, extract outputs
        if (!visibleResult) {
          const actualOutputs = (executor && executor.context && Array.isArray(executor.context.output)) ? executor.context.output.slice() : [];
          // split outputs into chunks per testcase
          const chunks = this.outputSplitter.split(actualOutputs, [tc]);
          const chunk = chunks.find(c => c.testcaseId === tc.testcaseId) || chunks[0];
          
          if (!chunk) {
            visibleResult = new TestcaseResult({
              runId: session.runId,
              testcaseId: tc.testcaseId,
              status: 'ERROR',
              expected: expectedOutputs,
              actual: actualOutputs,
              scoreAwarded: 0,
              errorMessage: `Output not enough`
            });
          } else if (chunk.error) {
            visibleResult = new TestcaseResult({
              runId: session.runId,
              testcaseId: tc.testcaseId,
              status: 'ERROR',
              expected: chunk.expected || expectedOutputs,
              actual: chunk.actual || actualOutputs,
              scoreAwarded: 0,
              errorMessage: chunk.error
            });
          } else {
            const pass = this.comparator.compare(chunk.actual, chunk.expected, tc.comparatorType || 'exact');
            const score = pass ? tc.score : 0;
            visibleResult = new TestcaseResult({
              runId: session.runId,
              testcaseId: tc.testcaseId,
              status: pass ? 'PASS' : 'FAIL',
              expected: chunk.expected,
              actual: chunk.actual,
              scoreAwarded: score,
              errorMessage: pass ? null : 'Mismatch'
            });
          }
        }
      } catch (err) {
        // unexpected
        visibleResult = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          expected: expectedOutputs,
          actual: [],
          scoreAwarded: 0,
          errorMessage: err && err.message ? err.message : String(err)
        });
      }

      // if still null (shouldn't), mark error
      if (!visibleResult) {
        visibleResult = new TestcaseResult({
          runId: session.runId,
          testcaseId: tc.testcaseId,
          status: 'ERROR',
          expected: expectedOutputs,
          actual: [],
          scoreAwarded: 0,
          errorMessage: 'Unknown runner state'
        });
      }

      // --- HIDDEN CHECK (only if visible passed and hidden provided) ---
      let finalResult = visibleResult;
      if (visibleResult.status === 'PASS' && (tc.inHiddenVal || tc.outHiddenVal)) {
        // parse hidden input & hidden expected (if present)
        let hidInputs = null;
        let hidExpected = null;
        try {
          if (tc.inHiddenVal) {
            hidInputs = (typeof tc.inHiddenVal === 'string') ? JSON.parse(tc.inHiddenVal) : tc.inHiddenVal;
            if (Array.isArray(hidInputs) && Array.isArray(hidInputs[0])) hidInputs = hidInputs[0];
            if (!Array.isArray(hidInputs)) hidInputs = [hidInputs];
            // [FIX 1 Applied] Parse hidden inputs too
            hidInputs = hidInputs.map(v => this.parseInputType(v));
          }
          if (tc.outHiddenVal) {
            hidExpected = (typeof tc.outHiddenVal === 'string') ? JSON.parse(tc.outHiddenVal) : tc.outHiddenVal;
            if (!Array.isArray(hidExpected)) hidExpected = [hidExpected];
          }
        } catch (e) {
          finalResult = new TestcaseResult({
            runId: session.runId,
            testcaseId: tc.testcaseId,
            status: 'ERROR',
            expected: visibleResult.expected,
            actual: visibleResult.actual,
            scoreAwarded: 0,
            errorMessage: `Invalid hidden JSON: ${e.message}`
          });
        }

        // run hidden round only when both parsed ok and at least hidExpected exists
        if (finalResult && finalResult.status !== 'ERROR' && hidExpected) {
          try {
            const hidProvider = new ArrayInputProvider(hidInputs || []);
            
            // [FIX 2 Applied] Clone and Sanitize Flowchart for hidden run
            const cleanFlowchartHidden = this.cloneFlowchart(flowchart);

            const hidExec = this.executorFactory(cleanFlowchartHidden, { maxTimeMs: cleanFlowchartHidden?.maxTimeMs || undefined });

            if (typeof hidExec.setInputProvider === 'function') {
              hidExec.setInputProvider((prompt, varName) => hidProvider.next(prompt, varName));
            } else if (hidExec.flowchart) {
              hidExec.flowchart._inputProvider = (prompt, varName) => hidProvider.next(prompt, varName);
            }

            // [Manual Step Loop] for hidden run
            try {
              const maxSteps = (cleanFlowchartHidden && cleanFlowchartHidden.limits && cleanFlowchartHidden.limits.maxSteps) || cleanFlowchartHidden.maxSteps || 100000;
              let stepCount = 0;

              while (!hidExec.finished && stepCount < maxSteps) {
                 const result = hidExec.step({ forceAdvanceBP: true });
                 if (result && result.error) throw new Error(result.error);
                 stepCount++;
              }
              if (stepCount >= maxSteps && !hidExec.finished) {
                 throw new Error(`Hidden run exceeded max steps (${maxSteps})`);
              }

            } catch (hErr) {
              finalResult = new TestcaseResult({
                runId: session.runId,
                testcaseId: tc.testcaseId,
                status: 'ERROR',
                expected: visibleResult.expected,
                actual: visibleResult.actual,
                scoreAwarded: 0,
                errorMessage: `Hidden run error: ${hErr && hErr.message ? hErr.message : String(hErr)}`
              });
            }

            if (finalResult && finalResult.status !== 'ERROR') {
              const hidActualOutputs = (hidExec && hidExec.context && Array.isArray(hidExec.context.output)) ? hidExec.context.output.slice() : [];
              const hidPass = this.comparator.compare(hidActualOutputs, hidExpected, tc.comparatorType || 'exact');
              if (!hidPass) {
                finalResult = new TestcaseResult({
                  runId: session.runId,
                  testcaseId: tc.testcaseId,
                  status: 'FAIL',
                  expected: visibleResult.expected,
                  actual: visibleResult.actual,
                  scoreAwarded: 0,
                  errorMessage: 'Hidden mismatch'
                });
              } else {
                // hidden passed -> keep visibleResult as finalResult (already PASS)
                finalResult = visibleResult;
              }
            }
          } catch (e) {
            finalResult = new TestcaseResult({
              runId: session.runId,
              testcaseId: tc.testcaseId,
              status: 'ERROR',
              expected: visibleResult.expected,
              actual: visibleResult.actual,
              scoreAwarded: 0,
              errorMessage: e && e.message ? e.message : String(e)
            });
          }
        }
      } // end hidden check

      // record finalResult
      session.recordResult(finalResult);
      await this.repo.saveResult(finalResult).catch(()=>{});
    } // end foreach testcase

    // finish session persistence
    session.finish();
    try { await this.repo.saveSession(session); } catch(e){/* ignore */ }

    return session;
  }
}