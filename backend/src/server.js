// src/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import flowchartController from "./controller/flowchart.controller.js";
import testcaseRouter from "./controller/testcase.controller.js";
import labController from "./controller/lab.controller.js";
import classController from "./controller/class.controller.js";
import submissionController from "./controller/submission.controller.js";
import trialRouter from "./controller/trial.controller.js";


dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// root simple message
app.get("/", (req, res) => {
  res.send("✅ Flowchart backend running. Use /flowchart/hydrate and /flowchart/execute");
});

// mount
app.use("/flowchart", flowchartController);
app.use(testcaseRouter);
app.use("/labs", labController);
app.use("/classes", classController);
app.use(submissionController);
app.use("/trial", trialRouter);


// start
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Server running at http://10.240.68.201:${PORT}`));
