"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

type Props = {
  data: {
    label: string;
    __highlight?: boolean;
  };
};

const AssignComponent: React.FC<Props> = ({ data }) => {
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
  const highlighted = Boolean(data?.__highlight);

  const rootStyle: React.CSSProperties = {
    position: "relative",
    width,
    height,
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
          <filter id="assign-glow" x="-50%" y="-50%" width="200%" height="200%">
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

        {/* label */}
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

        {/* highlight overlay (stroke + glow) */}
        {highlighted && (
          <>
            {/* blurred thick stroke (glow) */}
            <rect
              x={-3}
              y={-3}
              width={width + 6}
              height={height + 6}
              rx={9}
              ry={9}
              fill="none"
              stroke="#ff6b00"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "url(#assign-glow)"}}
            />
            {/* crisp outer stroke */}
            <rect
              x={-1.5}
              y={-1.5}
              width={width + 3}
              height={height + 3}
              rx={8}
              ry={8}
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
