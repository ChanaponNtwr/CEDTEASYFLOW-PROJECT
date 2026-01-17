"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

// Props ของ Component, รับ data ที่มี label เป็น string และ optional highlight flag
interface TerminatorNodeProps {
  data: {
    label: string;
    __highlight?: boolean;
  };
}

const TerminatorNodeComponent: React.FC<TerminatorNodeProps> = ({ data }) => {
  // --- ค่าเริ่มต้นสำหรับขนาดและระยะห่าง ---
  const baseWidth = 160; // ความกว้างขั้นต่ำ
  const height = 56; // ความสูงคงที่เพื่อให้รูปทรงสวยงาม
  const padding = 36; // เพิ่ม padding ด้านข้างเพื่อให้ข้อความไม่ชิดขอบโค้ง

  const [width, setWidth] = useState(baseWidth);
  const textRef = useRef<HTMLSpanElement>(null);

  // --- Effect สำหรับปรับความกว้างตามความยาวของข้อความ ---
  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.scrollWidth; // ใช้ scrollWidth เพื่อความแม่นยำ
      const newWidth = Math.max(baseWidth, textWidth + padding * 2);
      setWidth(newWidth);
    }
  }, [data.label]);

  // highlight detection
  const highlighted = Boolean(data?.__highlight);

  // inline root style (inline เพื่อไม่พึ่ง global css)
  const rootStyle: React.CSSProperties = {
    width,
    height,
    position: "relative",
    display: "inline-block",
    borderRadius: height / 2,
    // add visible highlight styles when needed
    ...(highlighted
      ? {
          border: "3px solid #ff6b00",
          boxShadow: "0 0 0 8px rgba(255,107,0,0.12)",
          transition: "box-shadow 160ms, border 160ms",
        }
      : {}),
  };

  // --- สไตล์สำหรับ Handle ที่มองไม่เห็น ---
  const hiddenHandleStyle: React.CSSProperties = {
    width: "8px",
    height: "8px",
    background: "transparent",
    border: "none",
  };

  return (
    <div style={rootStyle} className={highlighted ? "my-node-highlight" : undefined}>
      {/* --- SVG สำหรับวาดรูปทรง Terminator --- */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden>
        <rect
          x="0.5" // Offset ครึ่งหนึ่งของ strokeWidth เพื่อให้เส้นคมชัด
          y="0.5"
          width={width - 1}
          height={height - 1}
          rx={height / 2} // ทำให้มุมโค้งเป็นครึ่งวงกลม
          ry={height / 2}
          fill="#E9B3FB"
          stroke="#000000"
          strokeWidth="1"
        />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          dy=".3em"
          fontSize={14}
          fontWeight={600 as any}
          fill="#000000"
        >
          {data.label}
        </text>
      </svg>

      {/* --- Span ที่ซ่อนไว้สำหรับวัดความกว้างของข้อความ --- */}
      <span
        ref={textRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: `${padding}px`,
          paddingRight: `${padding}px`,
        }}
      >
        {data.label}
      </span>

      {/* --- Handles สำหรับการเชื่อมต่อ --- */}
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        style={{
          ...hiddenHandleStyle,
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        style={{
          ...hiddenHandleStyle,
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
};

export default TerminatorNodeComponent;
