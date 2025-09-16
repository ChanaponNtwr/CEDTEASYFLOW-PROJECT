// _components/WhileNodeComponent.tsx
"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";

// Define the type for the data prop for better type-checking
interface WhileNodeData {
  label: string;
  width?: number; // Make width an optional property
}

const WhileNodeComponent: React.FC<{ data: WhileNodeData }> = ({ data }) => {
  const { label, width = 176 } = data; // Set a default width of 150
  const borderWidth = 1;

  const handleStyle = {
    // You can add common styles for handles here if needed
  };


    const hiddenHandleStyle = {
    width: 0,
    height: 0,
    background: "transparent",
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
          background: "#FFE0B0", // Node background color
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
          style={{ ...hiddenHandleStyle, top: -8, left: "50%", transform: "translateX(-50%)" }}
        />

        <div>{label}</div>

        {/* "True" condition output for the loop body */}
        <Handle
          type="source"
          position={Position.Right}
          id="true"
          style={{ ...hiddenHandleStyle, right: -8, top: "50%", transform: "translateY(-50%)" }}
        />

        {/* "False" condition output to the next node */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          style={{ ...hiddenHandleStyle, bottom: -8, left: "50%", transform: "translateX(-50%)" }} 
        />

        {/* Input handle for the returning loop connection */}
        <Handle
          type="target"
          position={Position.Bottom}
          id="loop_in"
          style={{ ...handleStyle, bottom: -8, left: "75%", transform: "translateX(-50%)" }}
        />
      </div>
    </div>
  );
};

export default WhileNodeComponent;