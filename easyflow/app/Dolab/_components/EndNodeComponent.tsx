"use client";
import React, { useRef, useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";

// Props ของ Component, รับ data ที่มี label เป็น string
interface EndNodeProps {
  data: { label: string };
}

const EndNodeComponent: React.FC<EndNodeProps> = ({ data }) => {
  // --- ค่าเริ่มต้นสำหรับขนาดและระยะห่าง ---
  const baseWidth = 176; // ความกว้างขั้นต่ำ
  const height = 56;     // ความสูงคงที่เพื่อให้รูปทรงสวยงาม
  const padding = 36;    // เพิ่ม padding ด้านข้างเพื่อให้ข้อความไม่ชิดขอบโค้ง

  const [width, setWidth] = useState(baseWidth);
  const textRef = useRef<HTMLSpanElement>(null);

  // --- Effect สำหรับปรับความกว้างตามความยาวของข้อความ ---
  useEffect(() => {
    if (textRef.current) {
      const textWidth = textRef.current.scrollWidth; // ใช้ scrollWidth เพื่อความแม่นยำ
      const newWidth = Math.max(baseWidth, textWidth + padding * 2);
      setWidth(newWidth);
    }
  }, [data.label]);

  // --- สไตล์สำหรับ Handle ที่มองไม่เห็น ---
  const hiddenHandleStyle: React.CSSProperties = {
    width: "8px",
    height: "8px",
    background: "transparent",
    border: "none",
  };

  return (
    <div style={{ width, height, position: 'relative' }}>
      {/* --- SVG สำหรับวาดรูปทรง Terminator --- */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
        <rect
          x="0.5" // Offset ครึ่งหนึ่งของ strokeWidth เพื่อให้เส้นคมชัด
          y="0.5"
          width={width - 1}
          height={height - 1}
          rx={height / 2} // **จุดสำคัญ: ทำให้มุมโค้งเป็นครึ่งวงกลม**
          ry={height / 2} // **จุดสำคัญ: ทำให้มุมโค้งเป็นครึ่งวงกลม**
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1"
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dy=".3em" // จัดตำแหน่งแนวตั้งให้อยู่กึ่งกลางได้ดีขึ้น
          fontSize={14}
          fontWeight={600}
          fill="#000000"
        >
          {data.label}
        </text>
      </svg>

      {/* --- Span ที่ซ่อนไว้สำหรับวัดความกว้างของข้อความ --- */}
      <span
        ref={textRef}
        style={{
          position: "absolute",
          visibility: "hidden",
          whiteSpace: "nowrap",
          fontSize: 14,
          fontWeight: 600,
          paddingLeft: `${padding}px`,
          paddingRight: `${padding}px`,
        }}
      >
        {data.label}
      </span>
      
      {/* --- Handle สำหรับการเชื่อมต่อ --- */}
      {/* Handle ด้านบนสำหรับเป็น Target (จุดสิ้นสุด) เท่านั้น */}
      <Handle
              type="target"
              id="top"
              position={Position.Top}
              style={{
                ...hiddenHandleStyle,
                top: -8, // เลื่อน Handle ขึ้นไปด้านบน 8px
                left: "50%",
                transform: "translateX(-50%)", // จัดให้อยู่กึ่งกลางแนวนอน
              }}
            />
            
            {/* Handle ด้านล่างสำหรับเป็น Source (ต้นทาง) */}
            <Handle
              type="source"
              id="bottom"
              position={Position.Bottom}
              style={{
                ...hiddenHandleStyle,
                bottom: -8, // เลื่อน Handle ลงไปด้านล่าง 8px
                left: "50%",
                transform: "translateX(-50%)", // จัดให้อยู่กึ่งกลางแนวนอน
              }}
            />
    </div>
  );
};

export default EndNodeComponent;