import { Edge } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";

export const createArrowEdge = (
  source: string,
  target: string,
  label?: string,
  sourceHandle?: string,
  color = "black",
  targetHandle?: string,
  offset = 200,
  step = false
): Edge => ({
  id: uuidv4(),
  source,
  target,
  type: step ? "step" : "straight",
  sourceHandle,
  targetHandle,
  style: { stroke: color, strokeWidth: 2 },
  markerEnd: { type: "arrowclosed", color },
  data: step ? { offset, label } : { label },
});
