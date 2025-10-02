// File: app/flowchart/FlowchartEditor.tsx
"use client";

import React from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// --- Components ---
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";
import IfNodeComponent from "./_components/IfNodeComponent";
import BreakpointNodeComponent from "./_components/BreakpointNodeComponent";
import WhileNodeComponent from "./_components/WhileNodeComponent";
import StartNodeComponent from "./_components/StartNodeComponent";
import EndNodeComponent from "./_components/EndNodeComponent";
import InputNodeComponent from "./_components/InputNodeComponent";
import OutputNodeComponent from "./_components/OutputNodeComponent";
import DeclareComponent from "./_components/DeclareComponent";
import AssignComponent from "./_components/AssignComponent";
import ForNodeComponent from "./_components/ForNodeComponent";

// --- Custom Hooks ---
import { useFlowchartState } from "./hooks/useFlowchartState";
import { useFlowchartApi } from "./hooks/useFlowchartApi";
import { useNodeMutations } from "./hooks/useNodeMutations";

// --- Services / Utils for refresh ---
import { apiGetFlowchart } from "@/app/service/FlowchartService";
import { convertBackendFlowchart } from "./utils/backendConverter";

// --- Custom Node Types ---
const nodeTypes = {
  if: IfNodeComponent,
  breakpoint: BreakpointNodeComponent,
  while: WhileNodeComponent,
  start: StartNodeComponent,
  end: EndNodeComponent,
  input: InputNodeComponent,
  output: OutputNodeComponent,
  declare: DeclareComponent,
  assign: AssignComponent,
  for: ForNodeComponent,
};

type Props = { flowchartId: string };

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  // 1. จัดการ State ทั้งหมดใน Hook เดียว
  const {
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedEdge,
    setSelectedEdge,
    modalPosition,
    setModalPosition,
    selectedNode,
    setSelectedNode,
    nodeModalPosition,
    setNodeModalPosition,
    closeModal,
    closeNodeModal,
  } = useFlowchartState();

  // 2. จัดการการดึงข้อมูลจาก API (initial load)
  const { loading, error } = useFlowchartApi({ flowchartId, setNodes, setEdges });

  // 3. จัดการ Logic การแก้ไขข้อมูลทั้งหมด
  const { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode } = useNodeMutations({
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedEdge,
    closeModal,
    closeNodeModal,
  });

  // --- Refresh function: ดึงข้อมูลจริงจาก backend และอัปเดต state ---
  const refreshFlowchart = React.useCallback(async () => {
    try {
      const payload = await apiGetFlowchart(flowchartId);
      if (!payload || !payload.flowchart) {
        console.warn("No flowchart payload returned from API");
        return;
      }
      const converted = convertBackendFlowchart(payload);
      setNodes(converted.nodes);
      setEdges(converted.edges);
    } catch (err) {
      console.error("refreshFlowchart error:", err);
    }
  }, [flowchartId, setNodes, setEdges]);

  // Handlers ที่ต้อง set state โดยตรง จะยังคงอยู่ที่นี่
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setModalPosition({ x: event.clientX, y: event.clientY });
  };
  
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    if (node.id === "start" || node.id === "end") return;
    setSelectedNode(node);
    // Position the modal near the top-center of the screen
    setNodeModalPosition({ x: window.innerWidth / 2, y: 150 }); 
  };

  // --- JSX Rendering ---
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Navbar />
      <div className="mt-20 ml-4">
        <TopBarControls />
        {loading && <div className="mt-2 text-sm text-gray-600">Loading flowchart...</div>}
        {error && <div className="mt-2 text-sm text-red-600">Error: {String(error)}</div>}
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView={false}
          defaultViewport={{ x: 600, y: 150, zoom: 1 }}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      {/* --- Edge modal --- */}
      {selectedEdge && modalPosition && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div
            style={{ top: modalPosition.y, left: modalPosition.x }}
            className="absolute"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId="flow_1759391188137"// จาก props ของ FlowchartEditor
              selectedEdgeId={selectedEdge?.id} // edge ที่ user คลิก
              edge={selectedEdge}
              onAddNode={(type, label) => addNode(type, label)}
              onDeleteNode={deleteNodeAndReconnect}
              onRefresh={refreshFlowchart}
            />
          </div>
        </div>
      )}

      {/* --- Node edit modal --- */}
      {selectedNode && nodeModalPosition && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={closeNodeModal}>
          <div
            style={{ marginTop: nodeModalPosition.y }}
            className="relative" // Use relative to not be affected by parent's absolute positioning
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId="flow_1759391188137" // ต้องใช้ flowchartId จาก props
              selectedEdgeId={undefined} // node edit ไม่เกี่ยวกับ edge
              nodeToEdit={selectedNode}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={deleteNodeAndReconnect}
              onCloseModal={closeNodeModal}
              onAddNode={(type, label) => addNode(type, label, selectedNode?.id)}
              onRefresh={refreshFlowchart}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;
