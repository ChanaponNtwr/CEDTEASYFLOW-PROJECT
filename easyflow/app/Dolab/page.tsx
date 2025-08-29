"use client";
import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
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
const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true, label: "Edge" }, eds)),
    [setEdges]
  );

const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
  event.stopPropagation();
  setSelectedEdge(edge);
  setModalPosition({ x: event.clientX + 10, y: event.clientY + 10 }); // +10 offset ให้ไม่ทับ pointer
};

const closeModal = () => {
  setSelectedEdge(null);
  setModalPosition(null);
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
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView={false} // ปิด fitView ถ้าไม่ต้องการให้ zoom อัตโนมัติ
          defaultViewport={{ x: 600, y: 150, zoom: 1 }} // ตั้ง zoom เริ่มต้น
          onEdgeClick={onEdgeClick}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      {/* Modal ของ SymbolSection */}
      {selectedEdge && modalPosition && (
        <div
          className="fixed inset-0 z-50" // เพิ่ม overlay สีโปร่งใส
          onClick={closeModal} // คลิกที่ overlay จะปิด modal
        >
          <div
            className="absolute"
            style={{ top: modalPosition.y, left: modalPosition.x }}
            onClick={(e) => e.stopPropagation()} // คลิกภายใน modal จะไม่ปิด
          >
            <SymbolSection edge={selectedEdge} />
          </div>
        </div>
      )}


    </div>
  );
};

export default FlowchartEditor;
