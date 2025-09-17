"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const OutputNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  // ค่าคงที่สำหรับรูปทรงและการคำนวณ
  const baseWidth = 180;
  const baseHeight = 50;
  const padding = 30;
  const skew = 20;
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  // useEffect สำหรับปรับความกว้างตามความยาวของข้อความ
  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2 + skew);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight;

  // คำนวณพิกัดของ Polygon (เหมือนเดิม)
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;

  // ✅ คำนวณค่า offset ที่ต้องใช้เพื่อเลื่อนรูปทรงให้มาอยู่ตรงกลาง
  const xOffset = skew / 2;

    const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  };
  
  return (
    // Container หลักของโหนด
    <div style={{ position: "relative", width, height }}>
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        {/* ✅ ใช้ <g> ครอบและใช้ transform="translate()" เพื่อเลื่อนทั้ง group */}
        <g transform={`translate(-${xOffset}, 0)`}>
          <polygon
            points={points}
            fill="#D8FFD8" // เปลี่ยนสีสำหรับ Output node
            stroke="#000000"
            strokeWidth="1"
          />
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={14}
            fill="black"
          >
            {data.label}
          </text>
        </g>
      </svg>

      {/* Span ที่ซ่อนไว้สำหรับวัดขนาดข้อความ (เหมือนเดิม) */}
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

      {/* ✅ ปรับตำแหน่ง Handle ให้อยู่ที่ 50% เพื่อให้อยู่กึ่งกลางพอดี */}
      <Handle
              type="target"
              position={Position.Top}
              style={{ ...hiddenHandleStyle, top: -8, left: "43.5%", transform: "translateX(-50%)" }}
            />
            <Handle
              type="source"
              id="bottom"
              position={Position.Bottom}
              style={{ ...hiddenHandleStyle, bottom: -8, left: "43.5%", transform: "translateX(-50%)" }}
            />
    </div>
  );
};

export default OutputNodeComponent;