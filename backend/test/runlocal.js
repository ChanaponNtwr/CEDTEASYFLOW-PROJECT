// test/run_local_executor_test.js
import Flowchart from "../src/service/flowchart/classflowchart.js";
import Node from "../src/service/flowchart/classnode.js";
import Edge from "../src/service/flowchart/classedge.js";
import Executor from "../src/service/flowchart/classexecutor.js";

/**
 * สร้าง flowchart programmatically:
 * start -> declare x=2 -> assign x = x+3 -> output x -> end
 */
function buildFlowchart() {
  const fc = new Flowchart();

  // สร้าง node แบบตรง ๆ (ใช้ createNode เพื่อ id อัตโนมัติ หรือใช้ id เอง)
  const n1 = new Node("n1", "DC", "Declare x", { name: "x", value: 2, varType: "int" });
  const n2 = new Node("n2", "AS", "Assign x", { variable: "x", value: "x + 3" });
  const n3 = new Node("n3", "OU", "Output x", { message: "x" });

  fc.addNode(n1);
  fc.addNode(n2);
  fc.addNode(n3);

  // เชื่อม
  fc.addEdge("n_start", "n1", "auto");
  fc.addEdge("n1", "n2", "auto");
  fc.addEdge("n2", "n3", "auto");
  fc.addEdge("n3", "n_end", "auto");

  return fc;
}

(async () => {
  try {
    const fc = buildFlowchart();
    console.log("Nodes:", Object.keys(fc.nodes));
    console.log("Edges:", Object.keys(fc.edges));

    const ex = new Executor(fc);
    const ctx = ex.runAll();

    console.log("FINAL CONTEXT variables:", ctx.variables);
    console.log("FINAL CONTEXT output:", ctx.output);
  } catch (err) {
    console.error("Test error:", err);
  }
})();
