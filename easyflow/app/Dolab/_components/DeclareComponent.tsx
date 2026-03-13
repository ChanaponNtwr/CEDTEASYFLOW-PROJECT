"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

type Props = {
  data: {
    label: string;
    __highlight?: boolean;
  };
};

const DeclareComponent: React.FC<Props> = ({ data }) => {
  const baseWidth = 170;
  const baseHeight = 60;
  const padding = 40;
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 1.5);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight;
  const verticalLineWidth = 15; // distance for left divider

  const highlighted = Boolean(data?.__highlight);

  const rootStyle: React.CSSProperties = {
    position: "relative",
    width,
    height,
    borderRadius: 6,
    display: "inline-block",
  };

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
    border: "none",
  };

  return (
    <div style={rootStyle} className={highlighted ? "highlighted-node" : ""}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      >
        <defs>
          <filter id="declare-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Base shape */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#FFF"
          stroke="#000"
          strokeWidth={1}
          rx={6}
          ry={6}
        />
        {/* left divider line */}
        <line
          x1={verticalLineWidth}
          y1={0}
          x2={verticalLineWidth}
          y2={height}
          stroke="#000"
          strokeWidth={1}
        />

        {/* text */}
        <text
          x={width / 2 + verticalLineWidth / 2}
          y={height / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
          fill="black"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {data.label}
        </text>

        {/* Highlighting */}
        {highlighted && (
          <>
            {/* outer glow */}
            <rect
              x={-2}
              y={-2}
              width={width + 4}
              height={height + 4}
              rx={8}
              ry={8}
              fill="none"
              stroke="#ff6b00"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "url(#declare-glow)" }}
            />
            {/* solid, crisp outer stroke */}
            <rect
              x={-1}
              y={-1}
              width={width + 2}
              height={height + 2}
              rx={7}
              ry={7}
              fill="none"
              stroke="#ff6b00"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.98}
            />
          </>
        )}
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

      {/* Handles (แก้ไข left เป็น 50%) */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }}
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }}
      />
    </div>
  );
};

export default DeclareComponent;