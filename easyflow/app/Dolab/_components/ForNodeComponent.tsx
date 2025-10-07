"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

interface ForNodeData {
  label: string;
  __highlight?: boolean;
  width?: number;
}

const ForNodeComponent: React.FC<{ data: ForNodeData }> = ({ data }) => {
  const baseWidth = 176;
  const baseHeight = 50;
  const padding = 20;

  const [width, setWidth] = useState(baseWidth);
  const [height, setHeight] = useState(baseHeight);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2);
      const newHeight = baseHeight + (newWidth - baseWidth) / 2;
      setWidth(newWidth);
      setHeight(newHeight);
    }
  }, [data.label]);

  const cx = width / 2;
  const cy = height / 2;

  const points = `${0} ${cy} ${width / 4} 0 ${width * 0.75} 0 ${width} ${cy} ${width * 0.75} ${height} ${width / 4} ${height}`;

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  };

  const highlighted = Boolean(data?.__highlight);

  return (
    <div style={{ position: "relative", width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="for-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Node shape */}
        <polygon points={points} fill="#B0D4FF" stroke="#000" strokeWidth={1} />

        {/* Highlight overlay */}
        {highlighted && (
          <>
            <polygon
              points={points}
              fill="none"
              stroke="#ff6b00"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "url(#for-glow)" }}
            />
            <polygon
              points={points}
              fill="none"
              stroke="#ff6b00"
              strokeWidth={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.98}
            />
          </>
        )}

        {/* Label */}
        <text
          x={cx}
          y={cy + 5}
          textAnchor="middle"
          // alignmentBaseline="middle"
          fontSize={14}
          fill="black"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {data.label}
        </text>
      </svg>

      {/* Hidden span for measuring */}
      <span
        ref={textRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: "normal",
          padding: padding,
        }}
      >
        {data.label}
      </span>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{ ...hiddenHandleStyle, top: -8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="loop_body"
        style={{ ...hiddenHandleStyle, right: -8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="next"
        style={{ ...hiddenHandleStyle, bottom: -8, left: "50%" }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="loop_return"
        style={{ ...hiddenHandleStyle, bottom: -8, left: "75%" }}
      />
    </div>
  );
};

export default ForNodeComponent;
