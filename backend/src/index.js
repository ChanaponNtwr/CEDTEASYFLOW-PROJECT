// src/index.js
import express from "express";
import flowchartRouter from "./controller/flowchart.controller.js";

const app = express();
app.use(express.json({ limit: "1mb" }));

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// mount flowchart API
app.use("/api/flowchart", flowchartRouter);

// error handler (simple)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: String(err) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
