"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const ProcessComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  const baseWidth = 150;
  const baseHeight = 60;
  const padding = 30;
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // ปรับความกว้างตามความยาวของข้อความ
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight;

  return (
    <div style={{ position: "relative", width, height, fontFamily: 'sans-serif' }}>
      {/* SVG Rectangle for Process Symbol */}
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#ffffff" // สีฟ้าอ่อน
          stroke="#333"
          strokeWidth="1"
          rx="4" // ทำให้มุมโค้งมนเล็กน้อย
          ry="4"
        />
        <text
          x={width / 2} // จัดข้อความให้อยู่กึ่งกลางแนวนอน
          y={height / 2} // จัดข้อความให้อยู่กึ่งกลางแนวตั้ง
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
          fill="#00000"
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
        }}
      >
        {data.label}
      </span>

      {/* Handles for connections (on all 4 sides) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
      />
    </div>
  );
};

export default ProcessComponent;