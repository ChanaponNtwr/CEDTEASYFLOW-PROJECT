// _components/WhileNodeComponent.tsx
"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

const WhileNodeComponent: React.FC<{ data: { label: string } }> = ({
  data,
}) => {
  const borderWidth = 1; // ความหนาของกรอบ

  // สไตล์สำหรับจุดเชื่อมต่อ (Handle) ให้หนาขึ้น
  const handleStyle = {
  };

  return (
    <div
      style={{
        // กรอบนอก (สีของกรอบ)
        backgroundColor: "#000000", // สีของเส้นกรอบ
        clipPath:
          "polygon(0% 50%, 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%)",
        padding: borderWidth, // ใช้ padding เป็นความหนาของกรอบ
        width: 150, // ปรับความกว้างเพื่อให้เนื้อหาด้านในมีขนาด 150
        height: "auto", // ให้ความสูงปรับตามเนื้อหา
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          // เนื้อหาด้านใน (สีพื้นหลังด้านใน)
          padding: "10px 20px",
          background: "#FFFFFF", // สีพื้นหลังของ Node
          textAlign: "center",
          width: 150, // ความกว้างของเนื้อหาด้านใน
          clipPath:
            "polygon(0% 50%, 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%)",
          position: "relative", // สำคัญสำหรับ Handle
        }}
      >
        {/* 1. รับเส้นที่เข้ามา (จาก Node ก่อนหน้า) */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={handleStyle}
        />

        <div>{data.label}</div>

        {/* 2. ส่งเส้น "True" ออกไปด้านขวา (สำหรับ Loop) */}
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          style={handleStyle}
        />

        {/* 3. ส่งเส้น "False" ออกไปด้านล่าง (ไป Node ถัดไป) */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          style={handleStyle}
        />

        {/* 4. รับเส้น "True" ที่วนกลับมาด้านล่าง */}
        <Handle
          type="target"
          position={Position.Bottom}
          id="loop_in"
          style={{ ...handleStyle, left: "75%", background: "#555" }} // ปรับ style เพื่อให้ไม่ซ้อนกับ handle "false"
        />
      </div>
    </div>
  );
};

export default WhileNodeComponent;