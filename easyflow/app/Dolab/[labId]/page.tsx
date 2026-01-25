"use client";

import React, { useMemo, useEffect, useState } from "react";
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

// --- Node Components ---
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

// --- Hooks & Services ---
import { useFlowchartState } from "../hooks/useFlowchartState";
import { useFlowchartApi } from "../hooks/useFlowchartApi";
import { useNodeMutations } from "../hooks/useNodeMutations";
import { apiGetFlowchart } from "@/app/service/FlowchartService";
import { convertBackendFlowchart } from "../utils/backendConverter";

// ✅ Import useParams และ useSearchParams
import { useParams, useSearchParams } from "next/navigation";

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

type Props = { 
  flowchartId?: string | number; // รองรับทั้ง string และ number
  labId?: number; // รับ labId เข้ามาโดยตรงได้ (Optional)
};

const FlowchartEditor: React.FC<Props> = ({ flowchartId: propId, labId: propLabId }) => {
  // 1. ดึง Params ผ่าน Hook (Fallback กรณีไม่ได้ส่ง Prop มา)
  const paramsHook = useParams();
  const searchParams = useSearchParams(); 

  // ✅ State สำหรับเก็บ labId
  const [labId, setLabId] = useState<number | null>(propLabId ? Number(propLabId) : null);

  // 2. คำนวณ ID ของ Flowchart (Priority: Prop > URL Param > Hook)
  const resolvedFlowchartId = useMemo(() => {
    // ถ้ามี Prop ส่งมาจาก Server Component ให้ใช้ก่อน (Best Practice Next.js 15)
    if (propId) return String(propId);

    // ถ้าไม่มี Prop ให้พยายามหาจาก Hook useParams (Client Side)
    if (paramsHook) {
      if (paramsHook.flowchartId) return String(paramsHook.flowchartId);
      if (paramsHook.labId) return String(paramsHook.labId); // กรณี URL เป็น /Dolab/[labId]
    }
    
    return "";
  }, [propId, paramsHook]);

  // ✅ Effect: พยายามหา Lab ID 
  useEffect(() => {
    // ถ้ามีค่าจาก Prop แล้ว ไม่ต้องทำอะไร
    if (propLabId) {
      setLabId(Number(propLabId));
      return;
    }

    // 1. ลองดูจาก Query Params (?labId=...)
    const paramLabId = searchParams?.get("labId");
    if (paramLabId) {
      setLabId(Number(paramLabId));
      return;
    }

    // 2. ถ้ายังไม่มี ให้ลองดึงข้อมูล Flowchart มาดู
    if (resolvedFlowchartId) {
      apiGetFlowchart(String(resolvedFlowchartId))
        .then((resp) => {
          const foundLabId = 
            resp?.labId ?? 
            resp?.lab_id ?? 
            resp?.assignmentId ?? 
            resp?.assignment_id ??
            resp?.flowchart?.labId ??
            resp?.data?.labId;

          if (foundLabId) {
            console.log("✅ [FlowchartEditor] Found Lab ID from API:", foundLabId);
            setLabId(Number(foundLabId));
          }
        })
        .catch((err) => console.warn("Could not fetch metadata for labId:", err));
    }
  }, [resolvedFlowchartId, searchParams, propLabId]);

  // Debug Flowchart ID
  useEffect(() => {
    console.log(`✅ [FlowchartEditor] Resolved ID: "${resolvedFlowchartId}"`);
  }, [resolvedFlowchartId]);

  // --- Logic เดิม ---
  const {
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedEdge, setSelectedEdge,
    modalPosition, setModalPosition,
    selectedNode, setSelectedNode,
    nodeModalPosition, setNodeModalPosition,
    closeModal, closeNodeModal,
  } = useFlowchartState();

  const { loading, error } = useFlowchartApi({ 
    flowchartId: String(resolvedFlowchartId), 
    setNodes, 
    setEdges 
  });

  const { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode } = useNodeMutations({
    nodes, setNodes, edges, setEdges, selectedEdge, closeModal, closeNodeModal,
  });

  const refreshFlowchart = React.useCallback(async () => {
    if (!resolvedFlowchartId) return;
    try {
      const payload = await apiGetFlowchart(String(resolvedFlowchartId));
      
      const foundLabId = payload?.labId ?? payload?.lab_id ?? payload?.flowchart?.labId;
      if (foundLabId) setLabId(Number(foundLabId));

      const converted = convertBackendFlowchart(payload);
      setNodes(converted.nodes);
      setEdges(converted.edges);
      
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
  }, [setNodes, setEdges, resolvedFlowchartId]);

  // Highlight Logic
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

  const highlightNode = React.useCallback((nodeId: string | number | null) => {
      if (!nodeId) { clearHighlights(); return; }
      const strId = String(nodeId);
      if (String(highlightedIdRef.current) === strId) return;
      clearHighlights();
      highlightedIdRef.current = strId;
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => {
            if (String(n.id) === strId) {
              const data = { ...(n.data ?? {}), __highlight: true };
              const cls = n.className ? `${n.className} my-node-highlight` : "my-node-highlight";
              return { ...n, data, className: cls, selected: true };
            }
            return n;
          })
        );
      }, 0);
    }, [clearHighlights, setNodes]);

  // Events
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      <Navbar />
      
      <div className="mt-20 ml-4 z-10 relative">
        <TopBarControls 
          flowchartId={Number(resolvedFlowchartId)} 
          labId={labId}
          onHighlightNode={highlightNode} 
        />
        {loading && <div className="mt-2 text-sm text-blue-600">Loading flowchart ID: {resolvedFlowchartId}...</div>}
        {error && <div className="mt-2 text-sm text-red-600">Error: {String(error)}</div>}
      </div>

      <div className="flex-1 w-full h-full relative">
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
          <Background color="#aaa" gap={16} />
          <MiniMap style={{ height: 120 }} zoomable pannable />
          <Controls />
        </ReactFlow>
      </div>

      {/* Edge Modal */}
      {selectedEdge && modalPosition && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div
            style={{ top: modalPosition.y, left: modalPosition.x }}
            className="absolute"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId={Number(resolvedFlowchartId)}
              selectedEdgeId={selectedEdge?.id}
              edge={selectedEdge}
              onAddNode={(type, label) => addNode(type, label)}
              onDeleteNode={deleteNodeAndReconnect}
              onRefresh={refreshFlowchart}
            />
          </div>
        </div>
      )}

      {/* Node Edit Modal */}
      {selectedNode && nodeModalPosition && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={closeNodeModal}>
          <div
            style={{ marginTop: nodeModalPosition.y }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId={Number(resolvedFlowchartId)}
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
    </div>
  );
};

export default FlowchartEditor;