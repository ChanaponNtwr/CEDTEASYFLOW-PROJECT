// src/server.js
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import flowchartController from "./controller/flowchart.controller.js";

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

// start
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
