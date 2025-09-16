"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const InternalStorageComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  const baseWidth = 150;
  const baseHeight = 60;
  const padding = 40;
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight;
  const headerWidth1 = 15;
  const headerWidth2 = 15;

  return (
    <div style={{ position: "relative", width, height }}>
      {/* SVG for the Internal Storage shape */}
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        {/* Main rectangle body */}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1"
        />

        {/* First vertical divider line */}
        <line
          x1={headerWidth1}
          y1="0"
          x2={headerWidth1}
          y2={height}
          stroke="#000000"
          strokeWidth="1"
        />

        {/* Horizontal divider line (middle) */}
        <line
        x1="0"
        y1={height / 2 - 20}
        x2={width}
        y2={height / 2 - 20}
        stroke="#000000"
        strokeWidth="1.2"
        />

        {/* Label text */}
        <text
          x={(width + headerWidth1 + headerWidth2) / 2}
          y={height / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
          fill="#000000"
          style={{ userSelect: "none" }}
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
          fontWeight: "normal",
        }}
      >
        {data.label}
      </span>

      {/* Handles for connecting nodes (Top and Bottom only) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#000000" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#000000" }}
      />
    </div>
  );
};

export default InternalStorageComponent;
