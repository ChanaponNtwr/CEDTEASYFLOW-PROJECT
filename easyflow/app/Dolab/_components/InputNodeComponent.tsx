"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const InputNodeComponent: React.FC<{ data: { label: string } }> = ({
  data,
}) => {
  const baseWidth = 180;
  const baseHeight = 50;
  const padding = 30; // เพิ่ม padding สำหรับความเอียง
  const skew = 20; // ค่าความเอียงของรูปทรง
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      // ความกว้างใหม่ต้องเผื่อที่สำหรับความเอียง (skew) ด้วย
      const newWidth = Math.max(baseWidth, textWidth + padding * 2 + skew);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight; // ความสูงคงที่สำหรับสี่เหลี่ยมด้านขนาน

  // สร้างพิกัดสำหรับสี่เหลี่ยมด้านขนาน
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;

  const hiddenHandleStyle = {
    width: 8,
    height: 8,
    background: "#ccc",
    border: "1px solid #555",
  };

  return (
    <div style={{ position: "relative", width, height }}>
      {/* SVG Parallelogram */}
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        <polygon
          points={points}
          fill="transparent" // เปลี่ยนจาก #FFFFFF เป็น transparent
          stroke="#000000"
          strokeWidth="1"
        />
        <text
          x={width / 2} // จัดข้อความให้อยู่กึ่งกลางตามแนวนอน
          y={height / 2} // จัดข้อความให้อยู่กึ่งกลางตามแนวตั้ง
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
        >
          {data.label}
        </text>
      </svg>

      {/* Hidden span สำหรับวัดขนาดข้อความ (เหมือนเดิม) */}
      <span
        ref={textRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: "normal",
        }}
      >
        {data.label}
      </span>

      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ left: `${(width / 2 + skew / 2) * 90 / width}%` }}
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        style={{ left: `${(width / 2 - skew / 2) * 110 / width}%` }}
      />
    </div>
  );
};

export default InputNodeComponent;