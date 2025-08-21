import express from "express";
import {
  createFlowchart,
  getFlowchart,
  deleteFlowchart,
} from "../controllers/flowchartController";

const router = express.Router();

router.post("/flowcharts", createFlowchart);
router.get("/flowcharts/:id", getFlowchart);
router.delete("/flowcharts/:id", deleteFlowchart);

export default router;
