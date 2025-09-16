"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const OutputNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  const baseWidth = 180;
  const baseHeight = 50;
  const padding = 30;
  const skew = 20;
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  // สร้างข้อความที่จะแสดงผลขึ้นมาใหม่
  const displayText = `Output ${data.label}`;

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2 + skew);
      setWidth(newWidth);
    }
  }, [displayText]); // เปลี่ยน dependency เป็น displayText

  const height = baseHeight;

  // สร้างพิกัดสำหรับรูปทรงสี่เหลี่ยมด้านขนาน (Parallelogram)
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;

  return (
    <div style={{ position: "relative", width, height }}>
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        <polygon
          points={points}
          fill="#ffffff"
          stroke="#000"
          strokeWidth="1"
        />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize={14}
        >
          {/* แสดงผลข้อความใหม่ */}
          {displayText}
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
          fontWeight: "normal",
        }}
      >
        {/* ใช้ข้อความใหม่ในการคำนวณความกว้าง */}
        {displayText}
      </span>

      {/* ปรับตำแหน่ง Handle ให้ตรงกับรูปทรงที่เอียง */}
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