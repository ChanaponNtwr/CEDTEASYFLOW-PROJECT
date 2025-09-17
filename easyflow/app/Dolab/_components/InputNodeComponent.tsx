"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

const InputNodeComponent: React.FC<{ data: { label: string } }> = ({
  data,
}) => {
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

  // พิกัดสำหรับสี่เหลี่ยมด้านขนาน (เหมือนเดิม)
  const points = `${skew},0 ${width},0 ${width - skew},${height} 0,${height}`;
  
  // ✅ คำนวณค่าที่ต้องเลื่อน (offset) เพื่อให้รูปทรงอยู่ตรงกลาง
  const xOffset = skew / 2;

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  };

  return (
    // กรอบ Container หลัก ขนาดจะพอดีกับรูปทรง
    <div style={{ position: "relative", width, height }}>
      <svg width="100%" height="100%" style={{ overflow: "visible" }}>
        {/* ✅ ใช้ transform="translate(x, y)" เพื่อเลื่อน group ของ element ทั้งหมด */}
        <g transform={`translate(-${xOffset}, 0)`}>
          <polygon
            points={points}
            fill="#D0E8FF" // ใส่สีพื้นหลังกลับเข้าไป
            stroke="#000000"
            strokeWidth="1"
          />
          <text
            x={width / 2}
            y={height / 2}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontSize="14"
            fill="black" // ใส่สีตัวอักษร
          >
            {data.label}
          </text>
        </g>
      </svg>

      {/* Hidden span สำหรับวัดขนาดข้อความ (เหมือนเดิม) */}
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

      {/* ✅ Handles for connections (ปรับตำแหน่ง left ให้เป็น 50% เพื่อให้อยู่กึ่งกลาง) */}
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