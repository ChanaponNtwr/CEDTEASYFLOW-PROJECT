// backend/test/test_runner.js
// Direct Flowchart + Testcase runner (Node.js ESM style)
import Flowchart from "../src/service/flowchart/classflowchart.js";
import Node from "../src/service/flowchart/classnode.js";
import Executor from "../src/service/flowchart/classexecutor.js";

/**
 * Helper: build a simple flowchart that:
 *   Start -> IN(x) -> IN(y) -> AS(sum = x + y) -> OU(output sum) -> End
 * Returns the Flowchart instance.
 **/
Flowchart.prototype._inputProvider = () => "";
function buildSumFlowchart() {
    
  const fc = new Flowchart();
  // create nodes (use explicit Node so we can control id/data)
  const n1 = new Node(fc.genId(), "IN", "input x", { variable: "x", prompt: "x", varType: "number" });
  fc.insertAfterNode("n_start", n1);

  const n2 = new Node(fc.genId(), "IN", "input y", { variable: "y", prompt: "y", varType: "number" });
  fc.insertAfterNode(n1.id, n2);

  // assign sum = x + y  (handler expected to eval expression using context variables)
  const n3 = new Node(fc.genId(), "AS", "sum = x + y", { variable: "sum", value: "x + y" });
  fc.insertAfterNode(n2.id, n3);

  // output sum (message may be evaluated by handler)
  const n4 = new Node(fc.genId(), "OU", "output sum", { message: "sum" });
  fc.insertAfterNode(n3.id, n4);

  return fc;
}

/**
 * Create a simple inputProvider that returns values from an array (in order).
 * provider signature matches usage in handlers: (prompt, varName) => value
 */
function makeArrayInputProvider(arr) {
  let idx = 0;
  return (prompt, varName) => {
    // for debugging: log what flowchart asked for
    console.log(`  [inputProvider] prompt='${prompt}', var='${varName}' -> providing index ${idx}`);
    if (idx >= arr.length) {
      // throw an error so Executor.step() catches it and reports as handler error
      throw new Error(`inputProvider: no more inputs (requested var='${varName}' prompt='${prompt}'), provided ${arr.length}`);
    }
    const v = arr[idx++];
    return v;
  };
}

/**
 * Execute a flowchart and capture errors / final context.
 * We step through manually to capture a returned error from any step.
 */
function executeFlowchartWithInputs(flowchart, inputs, opts = {}) {
  const executor = new Executor(flowchart, opts);
  const provider = makeArrayInputProvider(inputs);
  // attach provider to executor/flowchart
  executor.setInputProvider(provider);

  let lastRes = null;
  try {
    // manual stepping to capture error object returned by step()
    while (!executor.finished) {
      lastRes = executor.step({ inputProvider: provider, forceAdvanceBP: true });
      if (lastRes && lastRes.error) {
        return { error: lastRes.error, context: executor.context, executor };
      }
      // safety: prevent infinite loop - Executor has internal maxSteps/time limits
    }
    return { context: executor.context, executor };
  } catch (err) {
    // thrown errors (e.g., from inputProvider) will be caught here
    return { error: err, context: executor.context, executor };
  }
}

/**
 * Compare expected outputs array with actual executor.context.output
 * Normalize both to strings for comparison.
 */
function compareOutputs(actualOutputArr = [], expectedArr = []) {
  const asStr = (v) => {
    try {
      if (v === undefined || v === null) return String(v);
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    } catch (e) {
      return String(v);
    }
  };
  const a = (actualOutputArr || []).map(asStr);
  const e = (expectedArr || []).map(asStr);
  // exact sequence equality
  if (a.length !== e.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== e[i]) return false;
  return true;
}

/**
 * Testcases: id, inputs (array fed in order), expectedOutputs (array)
 */
const testcases = [
  { id: "TC-01-pass", inputs: [2, 3], expectedOutputs: ["5"] },    // 2 + 3 = 5 -> PASS
  { id: "TC-02-fail", inputs: [2, 2], expectedOutputs: ["5"] },    // 2 + 2 = 4 -> FAIL
  { id: "TC-03-missing-input", inputs: [7], expectedOutputs: ["?"] }, // missing second input -> ERROR
  { id: "TC-04-pass-strings", inputs: ["10", "15"], expectedOutputs: ["25"] }, // string numbers -> PASS
];

// build a single flowchart prototype (we will clone by hydrating fresh for each run)
const flowchartPrototype = buildSumFlowchart();

console.log("=== Direct Backend Test Runner (Flowchart + Testcase) ===\n");

for (const tc of testcases) {
  console.log(`Running ${tc.id}`);
  // create fresh flowchart instance by serializing+rehydrating (simple shallow clone):
  // Use classflowchart API: easiest is to create a new one from prototype nodes/edges:
  // (we'll just reuse buildSumFlowchart() to get a fresh instance)
  const fc = buildSumFlowchart();

  const result = executeFlowchartWithInputs(fc, tc.inputs);

  if (result.error) {
    console.log(`  -> ERROR during execution: ${result.error.message}`);
    console.log(`     Provided inputs: ${JSON.stringify(tc.inputs)}`);
    console.log(`     Partial output: ${JSON.stringify((result.context && result.context.output) || [])}`);
    console.log(`  => TEST ${tc.id} => FAIL (error)\n`);
    continue;
  }

  const actualOutput = result.context && result.context.output ? result.context.output : [];
  // Note: some handlers may push numbers, others strings; normalize when comparing
  const passed = compareOutputs(actualOutput, tc.expectedOutputs);

  console.log(`  Provided inputs: ${JSON.stringify(tc.inputs)}`);
  console.log(`  Actual output:   ${JSON.stringify(actualOutput)}`);
  console.log(`  Expected output: ${JSON.stringify(tc.expectedOutputs)}`);
  console.log(`  => TEST ${tc.id} => ${passed ? "PASS ✅" : "FAIL ❌"}`);
  console.log("");
}

console.log("=== Done ===");
