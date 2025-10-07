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

  // SVG overlay will draw highlight to match node shape exactly.
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
  };

  return (
    <div style={rootStyle} className={highlighted ? "my-node-highlight" : undefined}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", overflow: "visible" }}
        aria-hidden
      >
        <defs>
          {/* glow filter for highlight */}
          <filter id="declare-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base rectangle */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={6}
          ry={6}
          fill="#FFFFD8"
          stroke="#000000"
          strokeWidth={1}
        />

        {/* left vertical divider */}
        <line
          x1={verticalLineWidth}
          y1={0}
          x2={verticalLineWidth}
          y2={height}
          stroke="#000000"
          strokeWidth={1}
        />

        {/* optional horizontal divider */}
        <line
          x1={0}
          y1={height / 2 - 20}
          x2={width}
          y2={height / 2 - 20}
          stroke="#000000"
          strokeWidth={1}
        />

        {/* label text */}
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
          fill="#000000"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {data.label}
        </text>

        {/* highlight overlay: same rectangle shape, stroke-only + glow */}
        {highlighted && (
          <>
            {/* thick blurred stroke for glow */}
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

      {/* Handles */}
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
