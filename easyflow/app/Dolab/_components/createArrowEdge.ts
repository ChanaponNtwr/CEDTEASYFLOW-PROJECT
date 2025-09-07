import { Edge, MarkerType } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";

type CreateArrowEdgeOptions = {
  label?: string;
  sourceHandle?: string;
  color?: string;
  targetHandle?: string;
  offset?: number;
  step?: boolean;
};

export const createArrowEdge = (
  source: string,
  target: string,
  labelOrOptions?: string | CreateArrowEdgeOptions,
  sourceHandle?: string,
  color: string = "black",
  targetHandle?: string,
  offset: number = 200,
  step: boolean = false
): Edge => {
  // รองรับทั้งการเรียกแบบเดิม (positional) และแบบใหม่ (options object)
  let label: string | undefined;

  if (labelOrOptions && typeof labelOrOptions === "object") {
    const opts = labelOrOptions as CreateArrowEdgeOptions;
    label = opts.label;
    sourceHandle = opts.sourceHandle ?? sourceHandle;
    color = opts.color ?? color;
    targetHandle = opts.targetHandle ?? targetHandle;
    offset = opts.offset ?? offset;
    step = opts.step ?? step;
  } else {
    label = labelOrOptions as string | undefined;
  }

  return {
    id: uuidv4(),
    source,
    target,
    type: step ? "step" : "straight",
    sourceHandle,
    targetHandle,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color },
    data: {
      label: label ?? undefined,
      ...(step ? { offset } : {}),
    },
  };
};
