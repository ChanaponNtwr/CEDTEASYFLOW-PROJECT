"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

type Props = {
  data: {
    label: string;
    __highlight?: boolean;
  };
};

const IfNodeComponent: React.FC<Props> = ({ data }) => {
  const baseWidth = 176;
  const baseHeight = 70;
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

  const points = `${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`;

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
          <filter id="if-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Node shape */}
        <g>
          <polygon
            points={points}
            fill="#FFD8D8"
            stroke="#000000"
            strokeWidth={1}
          />

          {/* Label */}
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="14"
            fill="black"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {data.label}
          </text>

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
                style={{ filter: "url(#if-glow)"}}
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
        </g>
      </svg>

      {/* Hidden span สำหรับวัดข้อความ */}
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
        style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ ...hiddenHandleStyle, left: -8, top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ ...hiddenHandleStyle, right: -8, top: "50%", transform: "translateY(-50%)" }}
      />
    </div>
  );
};

export default IfNodeComponent;
