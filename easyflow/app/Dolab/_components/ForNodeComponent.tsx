"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

// Define the type for the data prop for better type-checking
interface ForNodeData {
  label: string;
  width?: number; // Make width an optional property
}

const ForNodeComponent: React.FC<{ data: ForNodeData }> = ({ data }) => {
  const { label, width = 176 } = data; // Set a default width
  const borderWidth = 1;

  // This style makes the handles invisible but still functional
  const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
    border: "none",
  };

  return (
    <div
      style={{
        // This outer div creates the border effect
        backgroundColor: "#000000", // Border color
        clipPath:
          "polygon(0% 50%, 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%)",
        padding: borderWidth,
        width: width, // Use the dynamic width
        height: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          // This inner div contains the content
          padding: "10px 20px",
          background: "#B0D4FF", // A slightly different color for distinction
          textAlign: "center",
          width: width, // Use the dynamic width
          clipPath:
            "polygon(0% 50%, 25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%)",
          position: "relative", // Important for Handle positioning
        }}
      >
        {/* Input handle from the previous node */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          style={{ ...hiddenHandleStyle, top: -8 }}
        />

        <div>{label}</div>

        {/* Output for the loop body (each iteration) */}
        <Handle
          type="source"
          position={Position.Right}
          id="loop_body"
          style={{ ...hiddenHandleStyle, right: -8 }}
        />

        {/* Output for when the loop finishes */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="next"
          style={{ ...hiddenHandleStyle, bottom: -8, left: "50%" }}
        />

        {/* Input handle for the returning loop connection */}
        <Handle
          type="target"
          position={Position.Bottom}
          id="loop_return"
          style={{ ...hiddenHandleStyle, bottom: -8, left: "75%" }}
        />
      </div>
    </div>
  );
};

export default ForNodeComponent;