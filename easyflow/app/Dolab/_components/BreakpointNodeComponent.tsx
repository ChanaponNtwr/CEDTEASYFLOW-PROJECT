"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
  };
  
const BreakpointNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => (
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
    {/* ใช้ handle true/false ซ้อนกันที่ด้านบน เพื่อให้เส้นจาก branch มาชน breakpoint แบบตรงลงกลาง */}
    <Handle
      type="target"
      position={Position.Top}
      id="false"
      style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }}
    />
    <Handle
      type="target"
      position={Position.Top}
      id="true"
      style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }}
    />
    <Handle type="source" position={Position.Bottom} style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }}/>
    <div>{data.label}</div>
  </div>
);

export default BreakpointNodeComponent;
