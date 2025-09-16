// test/flowchartController.test.js
import express from "express";
import request from "supertest";
import bodyParser from "body-parser";
import flowchartRouter from "../src/service/flowchart.Controller.js"; // path ตามโปรเจคของคุณ

// สร้าง express app เล็กๆ สำหรับทดสอบ
function createApp() {
  const app = express();
  app.use(bodyParser.json({ limit: "1mb" }));
  app.use("/flowchart", flowchartRouter);
  return app;
}

describe("Flowchart Controller (save -> insert -> execute)", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test("save a basic flowchart, insert node, and execute", async () => {
    // 1) save base flowchart with start -> end only but a single node n1 attached
    const saveRes = await request(app)
      .post("/flowchart/save")
      .send({
        nodes: [
          { id: "n1", type: "DC", data: { name: "x", value: 1, varType: "int" } }
        ],
        edges: [
          { id: "e1", source: "n_start", target: "n1", condition: "auto" },
          { id: "e2", source: "n1", target: "n_end", condition: "auto" }
        ]
      })
      .expect(200);

    expect(saveRes.body.ok).toBe(true);
    const flowchartId = saveRes.body.flowchartId;
    expect(flowchartId).toBeDefined();

    // 2) insert an assign node on edge e1
    const insertRes = await request(app)
      .post("/flowchart/insert-node")
      .send({
        flowchartId,
        edgeId: "e1",
        node: { id: "n2", type: "AS", label: "Assign", data: { variable: "x", value: 5 } }
      })
      .expect(200);

    expect(insertRes.body.ok).toBe(true);
    expect(insertRes.body.insertedNode).toBeDefined();
    expect(insertRes.body.insertedNode.id).toBeDefined();

    // 3) execute flowchart
    const execRes = await request(app)
      .post("/flowchart/execute")
      .send({
        flowchartId,
        options: { ignoreBreakpoints: true }
      })
      .expect(200);

    expect(execRes.body.ok).toBe(true);
    expect(execRes.body.context).toBeDefined();
    // expect variable x to be present and updated to 5
    const vars = execRes.body.context.variables;
    const xVar = (vars || []).find(v => v.name === "x");
    expect(xVar).toBeDefined();
    expect(xVar.value === 5 || xVar.value === "5" || xVar.value === 5).toBeTruthy();
  });
});
