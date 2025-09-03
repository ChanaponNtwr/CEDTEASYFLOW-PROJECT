"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

const IfNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => (
  <div
    style={{
      padding: 10,
      border: "1px solid #333",
      borderRadius: 5,
      backgroundColor: "#fff",
      textAlign: "center",
      width: 150,
      minHeight: 30,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Handle type="target" position={Position.Top} style={{ background: "#555" }} />
    <Handle type="source" position={Position.Left} id="left" />
    <Handle type="source" position={Position.Right} id="right" />
    <div>{data.label}</div>
  </div>
);

export default IfNodeComponent;
