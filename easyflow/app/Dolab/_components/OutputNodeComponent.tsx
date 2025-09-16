"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

// คงชื่อ Component ไว้เป็น OutputNodeComponent เหมือนเดิม
const OutputNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  // 1. นำค่าคงที่จาก InputNodeComponent มาใช้
  const baseWidth = 180;
  const baseHeight = 50;
  const padding = 30;
  const skew = 20; // เพิ่มค่าความเอียง
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  // 2. ใช้ useEffect แบบเดียวกับ InputNodeComponent เพื่อคำนวณความกว้าง
  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2 + skew);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight; // ความสูงคงที่

  // 3. สร้างพิกัดสำหรับรูปทรงสี่เหลี่ยมด้านขนาน (Parallelogram)
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;

  return (
    // ไม่ต้องเปลี่ยน div ด้านนอก
    <div style={{ position: "relative", width, height }}>
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        {/* 4. เปลี่ยนจากการวาด <rect> เป็น <polygon> */}
        <polygon
          points={points}
          fill="#ffffff"
          stroke="#000"
          strokeWidth="1"
        />
        <text
          x={width / 2}
          y={height / 2} // ปรับการจัดกลางเล็กน้อย
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize={14}
        >
          {data.label}
        </text>
      </svg>

      {/* Hidden span สำหรับวัดขนาดข้อความ */}
      <span
        ref={textRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: "normal", // ปรับ font weight ให้ตรงกัน
        }}
      >
        {data.label}
      </span>

      {/* 5. ปรับตำแหน่ง Handle ให้ตรงกับรูปทรงที่เอียง */}
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        style={{ left: `${(width / 2 + skew / 2) * 90 / width}%` }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ left: `${(width / 2 - skew / 2) * 110 / width}%` }}
      />
    </div>
  );
};

export default OutputNodeComponent;