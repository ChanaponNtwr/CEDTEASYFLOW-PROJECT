"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const AssignComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  const baseWidth = 176;
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

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  }

  return (
    <div style={{ position: "relative", width, height }}>
      {/* SVG Rectangle for Process Symbol */}
      <svg width="100%" height="100%">
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#FFFFD8" // ✅ เปลี่ยนเป็นสีส้มพีช
          stroke="#000000"
          strokeWidth="2"
          rx="4" // ทำให้มุมโค้งมนเล็กน้อย
          ry="4"
        />
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

      {/* ✅ Handles for connections - ทำให้ครบ 4 ด้านและกำหนดตำแหน่งชัดเจน */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }} 
      />
    </div>
  );
};

export default AssignComponent;