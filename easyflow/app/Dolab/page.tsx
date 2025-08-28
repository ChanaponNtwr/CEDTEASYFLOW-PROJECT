"use client";
import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  addEdge,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";
import { v4 as uuidv4 } from "uuid";

type Props = {
  flowchartId: string;
};

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  // Mockup nodes & edges
  const initialNodes: Node[] = [
    { id: "start", type: "input", data: { label: "Start" }, position: { x: 300, y: 50 } },
    { id: "end", type: "output", data: { label: "End" }, position: { x: 300, y: 150 } },
  ];

  const initialEdges: Edge[] = [
    { id: "e1", source: "start", target: "end", animated: true, label: "Next" },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>(initialEdges);

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgePosition, setEdgePosition] = useState<{ x: number; y: number } | null>(null);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true, label: "Edge" }, eds)),
    [setEdges]
  );

  // เมื่อคลิก edge
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setEdgePosition({ x: event.clientX, y: event.clientY });
  };

  const closeModal = () => {
    setSelectedEdge(null);
    setEdgePosition(null);
  };

  const addNode = () => {
    const newNode: Node = {
      id: uuidv4(),
      data: { label: "New Node" },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      type: "default",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Navbar />
      <div className="mt-20 ml-4">
        <TopBarControls />
      </div>

      {/* ReactFlow */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          onEdgeClick={onEdgeClick}
        >
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      {/* Modal */}
        {selectedEdge && edgePosition && (
          <div
            className="fixed inset-0 z-50 pointer-events-auto bg-transparent"
            onClick={closeModal} // คลิกด้านนอกปิด modal
          >
            <div
              className="absolute bg-white p-6 rounded-lg shadow-lg max-h-[400px] overflow-y-auto"
              style={{
                top: Math.min(edgePosition.y, window.innerHeight - 500),
                left: Math.min(edgePosition.x + 20, window.innerWidth - 500),
                minWidth: 300,
                maxWidth: 500,
              }}
              onClick={(e) => e.stopPropagation()} // ป้องกันคลิกใน modal ไม่ให้ปิด
            >
              {/* SymbolSection */}
              <SymbolSection />
            </div>
          </div>
        )}
    </div>
  );
};

export default FlowchartEditor;
