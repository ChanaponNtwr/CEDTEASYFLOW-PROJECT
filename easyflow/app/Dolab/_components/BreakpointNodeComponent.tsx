"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

const hiddenHandleStyle = {
  width: 0,
  height: 0,
  background: "transparent",
};

const BreakpointNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => (
  // 🛠️ เพิ่ม Wrapper คลุมด้านนอก กำหนดความกว้าง 176px ให้เท่ากับ baseWidth ของ If Node
  // และใช้ flex เพื่อจัดวงกลม Breakpoint ให้อยู่กึ่งกลางเสมอ
  <div
    style={{
      width: 176,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <div
      style={{
        width: 30,
        height: 30,
        border: "2px solid #333",
        borderRadius: "50%",
        backgroundColor: "#FFD8D8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontSize: 12,
        position: "relative",
      }}
    >
      {/* Handles จะยังเกาะติดอยู่กับขอบของวงกลมเหมือนเดิม เพราะวงกลมมี position: "relative" */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="false" 
        style={{ ...hiddenHandleStyle, left: -8, top: "50%", transform: "translateY(-50%)" }} 
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="true" 
        style={{ ...hiddenHandleStyle, right: -8, top: "50%", transform: "translateY(-50%)" }}
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }}
      />
      
      {/* แสดง Label ถ้ามี */}
      {data?.label && <div>{data.label}</div>}
    </div>
  </div>
);

export default BreakpointNodeComponent;