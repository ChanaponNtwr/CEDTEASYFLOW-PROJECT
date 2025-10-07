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

  const FIXED_FLOWCHART_ID = Number(flowchartId ?? 8);

  const refreshFlowchart = React.useCallback(async () => {
    try {
      const payload = await apiGetFlowchart(FIXED_FLOWCHART_ID);
      if (!payload || !payload.flowchart) {
        console.warn("No flowchart payload returned from API");
        return;
      }
      const converted = convertBackendFlowchart(payload);
      setNodes(converted.nodes);
      setEdges(converted.edges);
      // ล้าง highlight หลัง refresh
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
  }, [setNodes, setEdges, FIXED_FLOWCHART_ID]);

  // ---------------------------
  // Highlight logic (robust)
  // ---------------------------
  const highlightedIdRef = React.useRef<string | null>(null);

  // Clear highlight on all nodes
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

  // Set highlight to specific nodeId (string or number)
  const highlightNode = React.useCallback(
    (nodeId: string | null) => {
      // nodeId null => clear
      if (!nodeId) {
        clearHighlights();
        return;
      }

      // if same -> nothing
      if (String(highlightedIdRef.current) === String(nodeId)) return;

      // clear then apply
      clearHighlights();
      highlightedIdRef.current = String(nodeId);

      // apply; wrap in setTimeout to avoid race with ReactFlow internal updates
      setTimeout(() => {
        setNodes((prev) =>
          prev.map((n) => {
            if (String(n.id) === String(nodeId)) {
              const data = { ...(n.data ?? {}), __highlight: true };
              const cls = n.className ? `${n.className} my-node-highlight` : "my-node-highlight";
              return { ...n, data, className: cls, selected: true };
            }
            return n;
          })
        );
        // debug
        console.log("[FlowchartEditor] applied highlight ->", nodeId);
      }, 0);
    },
    [clearHighlights, setNodes]
  );

  // expose highlightNode to TopBarControls via prop
  // ---------------------------

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

  // debug helper (optional — can remove later)
  React.useEffect(() => {
    console.log("[FlowchartEditor] nodes ids:", nodes.map((n) => String(n.id)));
  }, [nodes]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Navbar />
      <div className="mt-20 ml-4">
        <TopBarControls flowchartId={FIXED_FLOWCHART_ID} onHighlightNode={highlightNode} />
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

      {/* Edge modal */}
      {selectedEdge && modalPosition && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div
            style={{ top: modalPosition.y, left: modalPosition.x }}
            className="absolute"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId={FIXED_FLOWCHART_ID}
              selectedEdgeId={selectedEdge?.id}
              edge={selectedEdge}
              onAddNode={(type, label) => addNode(type, label)}
              onDeleteNode={deleteNodeAndReconnect}
              onRefresh={refreshFlowchart}
            />
          </div>
        </div>
      )}

      {/* Node edit modal */}
      {selectedNode && nodeModalPosition && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={closeNodeModal}>
          <div
            style={{ marginTop: nodeModalPosition.y }}
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              flowchartId={FIXED_FLOWCHART_ID}
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
