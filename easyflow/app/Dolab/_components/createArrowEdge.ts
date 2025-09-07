import { Edge, MarkerType } from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";

type CreateLabeledEdgeOptions = {
  label?: string | boolean;
  sourceHandle?: string;
  targetHandle?: string;
  color?: string;
  offset?: number;
  step?: boolean;
};

export const createArrowEdge = (
  source: string,
  target: string,
  options: CreateLabeledEdgeOptions = {}
): Edge => {
  const {
    label: rawLabel,
    sourceHandle,
    targetHandle,
    offset = 200,
    step = false,
  } = options;

  const label = rawLabel !== undefined ? String(rawLabel) : undefined;
  let color = options.color || "black";



  return {
    id: uuidv4(),
    source,
    target,
    type: step ? "step" : "smoothstep",
    sourceHandle,
    targetHandle,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color },

    // ▼▼▼ ส่วนที่แก้ไขเพื่อให้ Label สวยงามบนเส้น ▼▼▼

    label,

    // 1. ปิดการใช้งานพื้นหลังสี่เหลี่ยม (label background)
    labelShowBg: false,

    // 2. กำหนดสไตล์ให้ตัวอักษรเอง ให้มีขอบสีขาว
    labelStyle: {
      fontSize: 12,
      fontWeight: 'bold',
      fill: '#333',
      // --- CSS Tricks ---
      paintOrder: 'stroke', // บอกให้วาดเส้นขอบก่อน แล้วค่อยถมสี
      stroke: '#ffffff',      // กำหนดให้เส้นขอบเป็นสีขาว
      strokeWidth: 4,         // กำหนดความหนาของเส้นขอบ
      strokeLinecap: 'round', // ทำให้ขอบมนสวยงาม
    },

    // 3. ส่วนของ Background Style ไม่จำเป็นต้องใช้อีกต่อไป (แต่ใส่ค่า default ไว้ได้)
    labelBgStyle: {
      fill: '#fff',
    },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
    // ▲▲▲ สิ้นสุดส่วนที่แก้ไข ▲▲▲

    data: {
      ...(step ? { offset } : {}),
    },
  };
};