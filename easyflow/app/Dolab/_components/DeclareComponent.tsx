"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const DeclareComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  const baseWidth = 170;
  const baseHeight = 60;
  const padding = 40;
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      // ✅ ปรับการคำนวณความกว้างให้เผื่อเส้นทั้ง 2 ข้าง
      const newWidth = Math.max(baseWidth, textWidth + padding * 1.5);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight;
  const verticalLineWidth = 15; // กำหนดความกว้างของเส้นข้างให้เป็นตัวแปรเดียว

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  };

  return (
    <div style={{ position: "relative", width, height }}>
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        {/* Main rectangle body */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#FFFFD8" // เปลี่ยนสีสำหรับ Declare node
          stroke="#000000"
          strokeWidth="1"
        />

        {/* First vertical divider line (Left) */}
        <line
          x1={verticalLineWidth}
          y1="0"
          x2={verticalLineWidth}
          y2={height}
          stroke="#000000"
          strokeWidth="1"
        />

        
        {/* Horizontal divider line (ถ้าไม่ต้องการ สามารถลบบรรทัดนี้ได้) */}
        <line
         x1="0"
         y1={height / 2 - 20}
         x2={width}
         y2={height / 2 - 20}
         stroke="#000000"
         strokeWidth="1"
        />

        {/* ✅ Label text - แก้ไขตำแหน่ง x ให้อยู่ตรงกลางพอดี */}
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
          fill="#000000"
        >
          {data.label}
        </text>
      </svg>

      {/* Hidden span for measuring text */}
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

      {/* ✅ Handles - เพิ่ม style left: '50%' เพื่อความชัดเจน */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...hiddenHandleStyle, top: -8, left: "51.5%", transform: "translateX(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...hiddenHandleStyle, bottom: -8, left: "51.5%", transform: "translateX(-50%)" }}
      />
    </div>
  );
};

export default DeclareComponent;