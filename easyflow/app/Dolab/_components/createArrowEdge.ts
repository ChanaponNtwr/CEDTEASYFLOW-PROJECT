import { Edge, MarkerType } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";

export const createArrowEdge = (
  source: string,
  target: string,
  label?: string,
  sourceHandle?: string,
  color: string = "black",
  targetHandle?: string,
  offset: number = 200,
  step: boolean = false
): Edge => ({
  id: uuidv4(),
  source,
  target,
  type: step ? "step" : "straight",
  sourceHandle,
  targetHandle,
  style: { stroke: color, strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color }, // ✅ ใช้ MarkerType
  data: {
    label: label ?? undefined,   // ✅ ให้ label เป็น string | undefined
    ...(step ? { offset } : {}), // ✅ เพิ่ม offset เฉพาะตอน step
  },
});
