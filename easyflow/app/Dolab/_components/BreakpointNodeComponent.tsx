"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

const BreakpointNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => (
  <div
    style={{
      width: 30,
      height: 30,
      border: "2px solid #333",
      borderRadius: "50%",
      backgroundColor: "#f0f0f0",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      fontSize: 12,
      position: "relative",
    }}
  >
    <Handle type="target" position={Position.Left} id="false" style={{ top: "50%" }} />
    <Handle type="target" position={Position.Right} id="true" style={{ top: "50%" }} />
    <Handle type="source" position={Position.Bottom} />
    <div>{data.label}</div>
  </div>
);

export default BreakpointNodeComponent;
