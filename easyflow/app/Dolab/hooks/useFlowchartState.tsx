// File: app/flowchart/hooks/useFlowchartState.ts

// Hook นี้จะจัดการ State ทั้งหมดของ Flowchart เช่น nodes, edges, selectedNode เป็นต้น

import { useState } from "react";
import { useNodesState, useEdgesState, Node, Edge } from "@xyflow/react";

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export const useFlowchartState = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeModalPosition, setNodeModalPosition] = useState<{ x: number; y: number } | null>(null);

  const closeModal = () => {
    setSelectedEdge(null);
    setModalPosition(null);
  };
  
  const closeNodeModal = () => {
    setSelectedNode(null);
    setNodeModalPosition(null);
  }

  return {
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
  };
};