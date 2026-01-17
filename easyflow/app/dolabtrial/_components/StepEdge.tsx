"use client";
import React from "react";
import { BaseEdge, EdgeLabelRenderer } from "@xyflow/react";

const StepEdge = ({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: any) => {
  const offset = data?.offset ?? 200;
  let path = "";

  if (sourceX === targetX && sourceY === targetY) {
    path = `
      M ${sourceX} ${sourceY}
      C ${sourceX + offset} ${sourceY - 50},
        ${targetX + offset} ${targetY + 50},
        ${targetX} ${targetY}
    `;
  } else {
    const midX = sourceX + offset;
    path = `
      M ${sourceX} ${sourceY}
      L ${midX} ${sourceY}
      L ${midX} ${targetY}
      L ${targetX} ${targetY}
    `;
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: "#000", strokeWidth: 2 }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              top: `${sourceY - 12}px`,
              left: `${sourceX + offset / 2}px`,
              transform: 'translate(-50%, -50%)',
              background: "white",
              padding: "2px 4px",
              fontSize: 12,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default StepEdge;
