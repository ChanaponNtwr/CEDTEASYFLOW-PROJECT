"use client";

import React, { useMemo, useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// --- Next.js Navigation ---
import { useParams, useSearchParams } from "next/navigation";

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

// Define nodeTypes outside component to prevent re-creation on render
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
  flowchartId?: string;
};

const FlowchartEditor: React.FC<Props> = ({ flowchartId: propId }) => {
  // 1. Next.js Hooks
  const paramsHook = useParams();
  const searchParams = useSearchParams();

  // 2. Local State
  const [labId, setLabId] = useState<number | null>(null);

  // 3. Resolve Flowchart ID
  const resolvedFlowchartId = useMemo(() => {
    // Priority 1: Passed via props
    if (propId) return propId;
    
    // Priority 2: From URL Params (useParams)
    if (!paramsHook) return "";

    // Helper to extract ID safely
    // Prioritize specific keys: 'flowchartId', 'id', then fallback to first key
    const extractId = (obj: any) => {
      if (obj.flowchartId) return obj.flowchartId;
      if (obj.id) return obj.id;
      // Fallback: grab the first available value if it's a generic route like [slug]
      const keys = Object.keys(obj);
      if (keys.length > 0) return obj[keys[0]];
      return null;
    };

    const fromHook = extractId(paramsHook);
    return Array.isArray(fromHook) ? fromHook[0] : fromHook || "";
  }, [propId, paramsHook]);

  // 4. Fetch Lab ID Logic (Optimized)
  useEffect(() => {
    let isMounted = true;

    // Case A: Found in Query Params (?labId=...)
    const paramLabId = searchParams?.get("labId");
    if (paramLabId) {
      setLabId(Number(paramLabId));
      return;
    }

    // Case B: Fetch from API using Flowchart ID
    if (resolvedFlowchartId) {
      apiGetFlowchart(String(resolvedFlowchartId))
        .then((resp) => {
          if (!isMounted) return;

          // Attempt to find Lab ID in various response structures
          const foundLabId =
            resp?.labId ??
            resp?.lab_id ??
            resp?.assignmentId ??
            resp?.assignment_id ??
            resp?.flowchart?.labId ??
            resp?.flowchart?.lab_id ??
            resp?.data?.labId;

          if (foundLabId) {
            console.log("✅ [FlowchartEditor] Found Lab ID from API:", foundLabId);
            setLabId(Number(foundLabId));
          }
        })
        .catch((err) => {
          if (isMounted) console.warn("Could not fetch metadata for labId:", err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [resolvedFlowchartId, searchParams]);

  // Debug Flowchart ID
  useEffect(() => {
    if (resolvedFlowchartId) {
      console.log(`✅ [FlowchartEditor] Using Flowchart ID: "${resolvedFlowchartId}"`);
    }
  }, [resolvedFlowchartId]);

  // --- React Flow Logic ---
  const {
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedEdge, setSelectedEdge,
    modalPosition, setModalPosition,
    selectedNode, setSelectedNode,
    nodeModalPosition, setNodeModalPosition,
    closeModal, closeNodeModal,
  } = useFlowchartState();

  // Initial Load Hook
  const { loading, error } = useFlowchartApi({
    flowchartId: String(resolvedFlowchartId),
    setNodes,
    setEdges,
  });

  // Mutation Hooks (Connect, Update, Delete)
  const { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode } = useNodeMutations({
    nodes, setNodes, edges, setEdges, selectedEdge, closeModal, closeNodeModal,
  });

  // Refresh Logic (Manual Reload)
  const refreshFlowchart = useCallback(async () => {
    if (!resolvedFlowchartId) return;
    try {
      const payload = await apiGetFlowchart(String(resolvedFlowchartId));

      // Update Lab ID if found during refresh
      const foundLabId = payload?.labId ?? payload?.lab_id ?? payload?.flowchart?.labId;
      if (foundLabId) setLabId(Number(foundLabId));

      const converted = convertBackendFlowchart(payload);
      setNodes(converted.nodes);
      setEdges(converted.edges);

      // Reset Highlights logic after refresh
      setNodes((nds) =>
        nds.map((n) => {
          const data = { ...(n.data ?? {}) };
          if (data && data.__highlight) delete data.__highlight;
          const cls = n.className
            ? n.className.split(" ").filter((c) => c !== "my-node-highlight").join(" ")
            : undefined;
          return { ...n, data, className: cls, selected: false };
        })
      );
    } catch (err) {
      console.error("refreshFlowchart error:", err);
    }
  }, [setNodes, setEdges, resolvedFlowchartId]);

  // --- Highlight Logic ---
  const highlightedIdRef = useRef<string | null>(null);
  
  const clearHighlights = useCallback(() => {
    highlightedIdRef.current = null;
    setNodes((prev) =>
      prev.map((n) => {
        const data = { ...(n.data ?? {}) };
        if (data && data.__highlight) delete data.__highlight;
        const cls = n.className
          ? n.className.split(" ").filter((c) => c !== "my-node-highlight").join(" ")
          : undefined;
        return { ...n, data, className: cls, selected: false };
      })
    );
  }, [setNodes]);

  const highlightNode = useCallback((nodeId: string | number | null) => {
    if (!nodeId) {
      clearHighlights();
      return;
    }
    const strId = String(nodeId);
    if (String(highlightedIdRef.current) === strId) return;

    clearHighlights();
    highlightedIdRef.current = strId;

    // Use slight timeout to ensure state is clean before applying highlight
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

  // --- Events Handlers ---
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

  // --- Render ---
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      <Navbar />

      <div className="mt-20 ml-4 z-10 relative">
        <TopBarControls
          flowchartId={Number(resolvedFlowchartId)}
          labId={labId}
          onHighlightNode={highlightNode}
        />
        {loading && (
          <div className="mt-2 text-sm text-blue-600">
            Loading flowchart ID: {resolvedFlowchartId}...
          </div>
        )}
        {error && (
          <div className="mt-2 text-sm text-red-600">
            Error: {String(error)}
          </div>
        )}
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

      {/* Edge Action Modal */}
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
        <div
          className="fixed inset-0 z-50 flex items-start justify-center"
          onClick={closeNodeModal}
        >
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
              onAddNode={(type, label) =>
                addNode(type, label, selectedNode?.id)
              }
              onRefresh={refreshFlowchart}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;