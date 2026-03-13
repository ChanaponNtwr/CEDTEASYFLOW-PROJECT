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

  // root container
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
          <filter id="input-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <g>
          {/* Base shape */}
          <polygon
            points={points}
            fill="#B6F3E6"
            stroke="#000"
            strokeWidth={1}
            strokeLinejoin="round"
          />

          {highlighted && (
            <>
              {/* Glow effect */}
              <polygon
                points={points}
                fill="none"
                stroke="#ff6b00"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ filter: "url(#input-glow)" }}
              />
              {/* Crisp outer line */}
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

      {/* Handles for connections (แก้ไข left เป็น 50%) */}
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

export default InputNodeComponent;