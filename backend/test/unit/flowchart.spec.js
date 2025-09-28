// test/unit/flowchart.spec.js
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hydrateFlowchart } from "../src/service/flowchart/serializer.js";
import Executor from "../src/service/flowchart/classexecutor.js";

describe("flowchart execute (full graph from frontend)", () => {
  it("should run simple declare -> assign -> output and produce output [5]", () => {
    const payload = {
      nodes: [
        { id: "n1", type: "DC", data: { name: "x", value: 2, varType: "int" } },
        { id: "n2", type: "AS", data: { variable: "x", value: "x + 3" } },
        { id: "n3", type: "OU", data: { message: "x" } }
      ],
      edges: [
        { id: "e1", source: "n_start", target: "n1", condition: "auto" },
        { id: "e2", source: "n1", target: "n2", condition: "auto" },
        { id: "e3", source: "n2", target: "n3", condition: "auto" },
        { id: "e4", source: "n3", target: "n_end", condition: "auto" }
      ]
    };

    const fc = hydrateFlowchart(payload);
    const ex = new Executor(fc);
    const ctx = ex.runAll();
    assert.equal(Array.isArray(ctx.output), true);
    assert.equal(ctx.output.length, 1);
    assert.equal(ctx.output[0], 5);
  });
});
