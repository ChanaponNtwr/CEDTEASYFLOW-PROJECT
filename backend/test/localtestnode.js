// backend/test/localtest_allnodes.js
import Flowchart from "../src/service/flowchart/classflowchart.js";
import Node from "../src/service/flowchart/classnode.js";
import Executor from "../src/service/flowchart/classexecutor.js";

function buildAllNodeFlowchart() {
  const fc = new Flowchart();

  // --- Nodes ---
  const n1 = new Node("n1", "DC", "Declare x", { name: "x", value: 1, varType: "int" }); // Declare
  const n2 = new Node("n2", "AS", "Assign", { variable: "x", value: "x + 1" });           // Assign
  const n3 = new Node("n3", "IF", "If x > 1", { condition: "x > 1" });                   // If
  const n4 = new Node("n4", "OU", "Output OK", { message: "`x is ${x}`" });              // Output (template literal)
  const n5 = new Node("n5", "OU", "Output Small", { message: "x is too small" });        // Output (text)
  const n6 = new Node("n6", "WH", "While x < 5", { condition: "x < 5", varName: "x", increment: "x = x + 1" });
  const n7 = new Node("n7", "OU", "Loop Print", { message: "`loop x=${x}`" });
  const n8 = new Node("n8", "BP", "Breakpoint", { note: "Pause check" });
  const n9 = new Node("n9", "FR", "For loop", { init: "i = 0", condition: "i < 3", increment: "i = i + 1", varName: "i" });
  const n10 = new Node("n10", "OU", "Print i", { message: "`i=${i}`" });
  const n11 = new Node("n11", "IN", "Input name", { variable: "name", prompt: "Enter your name", varType: "string" });
  const n12 = new Node("n12", "OU", "Say Hello", { message: "`Hello ${name}`" });
  const n13 = new Node("n13", "DO", "Do something", { acction: "console.log('Do Action executed')" });
  const n14 = new Node("n14", "OU", "Finish", { message: "Done!" });

  // --- Add nodes ---
  [n1,n2,n3,n4,n5,n6,n7,n8,n9,n10,n11,n12,n13,n14].forEach(n => fc.addNode(n));

  // --- Edges ---
  fc.addEdge("n_start", "n1", "auto");
  fc.addEdge("n1", "n2", "auto");
  fc.addEdge("n2", "n3", "auto");
  fc.addEdge("n3", "n4", "true");     // If true
  fc.addEdge("n3", "n5", "false");    // If false
  fc.addEdge("n4", "n6", "auto");     // If true → While
  fc.addEdge("n5", "n6", "auto");     // If false → While
  fc.addEdge("n6", "n7", "true");
  fc.addEdge("n6", "n9", "false");
  fc.addEdge("n7", "n8", "auto");
  fc.addEdge("n8", "n6", "auto");     // loop back
  fc.addEdge("n9", "n10", "true");
  fc.addEdge("n9", "n11", "false");
  fc.addEdge("n10", "n9", "auto");
  fc.addEdge("n11", "n12", "auto");
  fc.addEdge("n12", "n13", "auto");
  fc.addEdge("n13", "n14", "auto");
  fc.addEdge("n14", "n_end", "auto");

  return fc;
}

async function runLocalTest() {
  const fc = buildAllNodeFlowchart();
  const executor = new Executor(fc, { maxLoopIterationsPerNode: 50 });

  console.log("=== START EXECUTION ===");
  const ctx = executor.runAll({
    ignoreBreakpoints: true,
    inputProvider: (prompt, varName) => {
      console.log(`📝 Simulated input for ${varName} (${prompt})`);
      return "Alice"; // ใส่ค่า default input
    }
  });
  console.log("=== FINAL RESULT ===");
  console.log("Variables:", ctx.variables);
  console.log("Output:", ctx.output);
}

runLocalTest().catch(err => console.error("Test error:", err));
