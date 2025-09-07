"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

const WhileNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => (
  <div
    style={{
      padding: 10,
      border: "1px solid",
      borderRadius: 5,
      backgroundColor: "white",
      textAlign: "center",
      width: 150,
      minHeight: 30,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}
  >
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Right} id="true" />
    <Handle type="target" position={Position.Bottom} id="false" style={{ left: "60%" }} />
    <Handle type="source" position={Position.Bottom} id="false_end" style={{ left: "50%" }} />
    <div>{data.label}</div>
  </div>
);

export default WhileNodeComponent;
