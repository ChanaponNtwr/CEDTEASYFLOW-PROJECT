"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const IfNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  const baseWidth = 150;
  const baseHeight = 70;
  const padding = 20; // ระยะห่างตัวอักษรจากขอบ
  const [width, setWidth] = useState(baseWidth);
  const [height, setHeight] = useState(baseHeight);

  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.offsetWidth;
      const newWidth = Math.max(baseWidth, textWidth + padding * 2);
      const newHeight = baseHeight + (newWidth - baseWidth) / 2; // ปรับความสูงสมดุล
      setWidth(newWidth);
      setHeight(newHeight);
    }
  }, [data.label]);

  const cx = width / 2;
  const cy = height / 2;

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  };

  return (
    <div style={{ position: "relative", width, height }}>
      {/* SVG diamond */}
      <svg width="100%" height="100%">
        <polygon
          points={`${cx},0 ${width},${cy} ${cx},${height} 0,${cy}`}
          fill="#FFFFFF"
          stroke="#000000"
          strokeWidth="1"
        />
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          alignmentBaseline="middle"
          fontSize="14"
        >
          {data.label}
        </text>
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

      {/* Hidden Handles */}
      <Handle type="target" position={Position.Top} style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }} />
      <Handle type="source" position={Position.Left} id="left" style={{ ...hiddenHandleStyle, left: -8, top: "50%", transform: "translateY(-50%)" }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...hiddenHandleStyle, right: -8, top: "50%", transform: "translateY(-50%)" }} />
    </div>
  );
};

export default IfNodeComponent;

