"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

type Props = {
  data: {
    label: string;
    __highlight?: boolean;
  };
};

const InputNodeComponent: React.FC<Props> = ({ data }) => {
  const baseWidth = 180;
  const baseHeight = 50;
  const padding = 30;
  const skew = 20; // ค่าความเอียง
  const [width, setWidth] = useState(baseWidth);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2 + skew);
      setWidth(newWidth);
    }
  }, [data.label]);

  const height = baseHeight;

  // พิกัดสำหรับสี่เหลี่ยมด้านขนาน
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;

  // highlight detection
  const highlighted = Boolean(data?.__highlight);

  // root container (no rectangular border — highlight drawn inside SVG)
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
        style={{ overflow: "visible", display: "block" }}
        aria-hidden
      >
        {/* defs for glow filter */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* base parallelogram */}
        <g transform={`translate(-${skew / 2}, 0)`}>
          <polygon
            points={points}
            fill="#D0E8FF"
            stroke="#000000"
            strokeWidth="1"
          />

          {/* highlight overlay: same shape, stroke-only, glow */}
          {highlighted && (
            <>
              {/* thicker stroke for solid outline */}
              <polygon
                points={points}
                fill="none"
                stroke="#ff6b00"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: "url(#glow)" }}
              />
              {/* thin crisp outer line to make edge sharp */}
              <polygon
                points={points}
                fill="none"
                stroke="#ff6b00"
                strokeWidth={1}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.95}
              />
            </>
          )}

          {/* label */}
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="14"
            fill="black"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {data.label}
          </text>
        </g>
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

      {/* Handles for connections */}
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

export default InputNodeComponent;
