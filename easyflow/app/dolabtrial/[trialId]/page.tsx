"use client";

import React, { use } from "react"; // 1. Import 'use'
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
import TopBarControls from "../_components/TopBarControls";
import SymbolSection from "../_components/SymbolSection";
import IfNodeComponent from "../_components/IfNodeComponent";
import BreakpointNodeComponent from "../_components/BreakpointNodeComponent";
import WhileNodeComponent from "../_components/WhileNodeComponent";
import StartNodeComponent from "../_components/StartNodeComponent";
import EndNodeComponent from "../_components/EndNodeComponent";
import InputNodeComponent from "../_components/InputNodeComponent";
import OutputNodeComponent from "../_components/OutputNodeComponent";
import DeclareComponent from "../_components/DeclareComponent";
import AssignComponent from "../_components/AssignComponent";
import ForNodeComponent from "../_components/ForNodeComponent";

// --- Custom Hooks ---
import { useFlowchartState } from "../hooks/useFlowchartState";
import { useFlowchartApi } from "../hooks/useFlowchartApi";
import { useNodeMutations } from "../hooks/useNodeMutations";

// --- Services / Utils for refresh ---
// 1. เปลี่ยนชื่อ import ตรงนี้
import { apiGetTrialFlowchart } from "@/app/service/FlowchartService"; 
import { convertBackendFlowchart } from "../utils/backendConverter";

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

// 2. กำหนด Interface สำหรับรับค่า params เป็น Promise (Next.js 15)
interface PageProps {
  params: Promise<{
    trialId: string;
  }>;
}

export default function DoLabTrialPage({ params }: PageProps) {
  // 3. ใช้ use() เพื่อดึงค่า trialId ออกจาก Promise params
  const { trialId } = use(params);
  const flowchartId = trialId;

  console.log("🟢 DoLabTrialPage Loaded. Trial ID:", flowchartId);

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

  // ส่ง flowchartId เข้าไปโหลดข้อมูล
  const { loading, error } = useFlowchartApi({ flowchartId, setNodes, setEdges });

  const { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode } = useNodeMutations({
    nodes,
    setNodes,
    edges,
    setEdges,
    selectedEdge,
    closeModal,
    closeNodeModal,
  });

  const currentTrialId = flowchartId; 
  
  const [showTutorial, setShowTutorial] = React.useState(true);
  const [step, setStep] = React.useState(0);

  const tutorialSteps = [
    { title: "Step 1", description: "สามารถเปิดโจทย์ได้ โดยกดที่ Problem solving" },
    { title: "Step 2", description: "สามารถเพิ่ม Node ที่เป็น Shape ต่างๆได้ โดยคลิกที่เส้น Edge เพื่อเพิ่ม Node ระหว่างกลาง" },
    { title: "Step 3", description: "สามารถทดสอบ Flowchart ได้ที่ปุ่ม RunAll และ Step เพื่อดูผลลัพธ์ของ Flowchart" },
    { title: "Step 4", description: "ระบบจะแสดงผลลัพธ์ที่นี้ สามารถตอบโต้กับระบบได้ตรงนี้" },
  ];
  const tutorialPositionMap: Record<number, string> = {
  0: "left-80 top-24",
  1: "left-[1100px] top-[280px]",
  2: "left-80 top-24",
  3: "bottom-25 right-105 ",
  };

  const tutorialPosition =
    tutorialPositionMap[step] || "left-80 top-24";

  const refreshFlowchart = React.useCallback(async () => {
    if (!currentTrialId) return;
    try {
      const payload = await apiGetTrialFlowchart(currentTrialId);
      
      // logic นี้รองรับทั้งมีข้อมูลและไม่มีข้อมูล (สร้าง Start/End ให้)
      const converted = convertBackendFlowchart(payload || {});
      setNodes(converted.nodes);
      setEdges(converted.edges);
      
      // Clear Highlights
      setNodes((nds) =>
        nds.map((n) => {
          const data = { ...(n.data ?? {}) };
          if (data && data.__highlight) delete data.__highlight;
          const cls = n.className ? n.className.split(" ").filter((c) => c !== "my-node-highlight").join(" ") : undefined;
          return { ...n, data, className: cls, selected: false };
        })
      );
    } catch (err) {
      console.error("refreshFlowchart error:", err);
    }
  }, [setNodes, setEdges, currentTrialId]);

  // --- Highlight Logic ---
  const highlightedIdRef = React.useRef<string | null>(null);

  const clearHighlights = React.useCallback(() => {
    highlightedIdRef.current = null;
    setNodes((prev) =>
      prev.map((n) => {
        const data = { ...(n.data ?? {}) };
        if (data && data.__highlight) delete data.__highlight;
        const cls = n.className ? n.className.split(" ").filter((c) => c !== "my-node-highlight").join(" ") : undefined;
        return { ...n, data, className: cls, selected: false };
      })
    );
  }, [setNodes]);

  const highlightNode = React.useCallback(
    (nodeId: string | number | null) => {
      if (!nodeId) {
        clearHighlights();
        return;
      }
      const idStr = String(nodeId);
      if (String(highlightedIdRef.current) === idStr) return;
      clearHighlights();
      highlightedIdRef.current = idStr;
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => {
            if (String(n.id) === idStr) {
              const data = { ...(n.data ?? {}), __highlight: true };
              const cls = n.className ? `${n.className} my-node-highlight` : "my-node-highlight";
              return { ...n, data, className: cls, selected: true };
            }
            return n;
          })
        );
      }, 0);
    },
    [clearHighlights, setNodes]
  );

  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setModalPosition({ x: event.clientX, y: event.clientY });
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    if (node.id === "start" || node.id === "end") return;
    setSelectedNode(node);
    setNodeModalPosition({ x: window.innerWidth / 2, y: 150 });
  };

  React.useEffect(() => {
    console.log("[Page] Nodes updated, count:", nodes.length);
  }, [nodes]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Navbar />
      <div className="mt-20 ml-4">
        {/* ส่ง flowchartId เข้าไปที่ Controls */}
        <TopBarControls flowchartId={currentTrialId} onHighlightNode={highlightNode} />
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

      {selectedEdge && modalPosition && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div
            style={{ top: modalPosition.y, left: modalPosition.x }}
            className="absolute"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId={currentTrialId}
              selectedEdgeId={selectedEdge?.id}
              edge={selectedEdge}
              onAddNode={(type, label) => addNode(type, label)}
              onDeleteNode={deleteNodeAndReconnect}
              onCloseModal={closeModal} // ✅ เพิ่มบรรทัดนี้ลงไปเพื่อสั่งปิด Modal หลังเพิ่ม Node เสร็จ
              onRefresh={refreshFlowchart}
            />
          </div>
        </div>
      )}

      {selectedNode && nodeModalPosition && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={closeNodeModal}>
          <div
            style={{ marginTop: nodeModalPosition.y }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId={currentTrialId}
              selectedEdgeId={undefined}
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

      {showTutorial && (
      <div className="fixed inset-0 z-[999] bg-black/20">
        <div
          className={`absolute bg-white rounded-xl p-6 w-[420px] shadow-2xl border border-gray-200 ${tutorialPosition}`}
        >
          <h2 className="text-xl font-bold mb-3">
            {tutorialSteps[step].title}
          </h2>

          <div className="h-[1px] bg-gray-300 mb-4" />

          <p className="text-base text-gray-700 leading-relaxed">
            {tutorialSteps[step].description}
          </p>

          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setShowTutorial(false)}
              className="text-gray-500 hover:text-black text-sm"
            >
              Skip
            </button>

            <div className="space-x-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="px-3 py-1 bg-gray-200 rounded-md text-sm"
                >
                  Back
                </button>
              )}

              {step < tutorialSteps.length - 1 ? (
                <button
                  onClick={() => setStep((s) => s + 1)}
                  className="px-3 py-1 bg-black text-white rounded-md text-sm"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => setShowTutorial(false)}
                  className="px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                >
                  Start
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};