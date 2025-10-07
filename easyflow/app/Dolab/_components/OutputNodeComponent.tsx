"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

type Props = {
  data: {
    label: string;
    __highlight?: boolean;
  };
};

const OutputNodeComponent: React.FC<Props> = ({ data }) => {
  const baseWidth = 180;
  const baseHeight = 50;
  const padding = 30;
  const skew = 20;
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
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;
  const xOffset = skew / 2;

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
          <filter id="output-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(-${xOffset}, 0)`}>
          {/* Base polygon */}
          <polygon
            points={points}
            fill="#D8FFD8"
            stroke="#000000"
            strokeWidth={1}
          />

          {/* Label */}
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize={14}
            fill="black"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {data.label}
          </text>

          {/* Highlight overlay */}
          {highlighted && (
            <>
              {/* Glow */}
              <polygon
                points={points}
                fill="none"
                stroke="#ff6b00"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "url(#output-glow)"}}
              />
              {/* Crisp stroke */}
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
