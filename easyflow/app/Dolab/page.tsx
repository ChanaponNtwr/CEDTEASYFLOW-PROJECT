"use client";
import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  MarkerType, // ✅ import MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";

import IfNodeComponent from "./_components/IfNodeComponent";
import WhileNodeComponent from "./_components/WhileNodeComponent";
import BreakpointNodeComponent from "./_components/BreakpointNodeComponent";
import StepEdge from "./_components/StepEdge";
import { createArrowEdge } from "./_components/createArrowEdge";

type Props = { flowchartId: string };

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const initialNodes: Node[] = [
    { id: "start", type: "input", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false },
    { id: "end", type: "output", data: { label: "End" }, position: { x: 300, y: 250 }, draggable: false },
  ];

  const initialEdges: Edge[] = [createArrowEdge("start", "end")];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            type: "straight",
            markerEnd: { type: MarkerType.ArrowClosed }, // ✅ ใช้ MarkerType.ArrowClosed
          },
          eds
        )
      ),
    [setEdges]
  );

  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setModalPosition({ x: event.clientX + 10, y: event.clientY + 10 });
  };

  const closeModal = () => {
    setSelectedEdge(null);
    setModalPosition(null);
  };

  const addNode = (type: string, label: string) => {
    if (!selectedEdge) return;

    const { source, target, sourceHandle } = selectedEdge;
    const isIfTrueBranch = sourceHandle === "right";
    const isIfFalseBranch = sourceHandle === "left";

    if (isIfTrueBranch || isIfFalseBranch) {
      const newNodeId = crypto.randomUUID ? crypto.randomUUID() : `${Math.random()}`;

      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);

      const offsetX = isIfTrueBranch ? 475 : 125;
      const baseY =
        sourceNode && targetNode
          ? (sourceNode.position.y + targetNode.position.y) / 2
          : (sourceNode?.position.y ?? 0) + 60;

      const newNode: Node = {
        id: newNodeId,
        type: type === "default" ? "default" : `${type}Node`,
        data: { label },
        position: { x: offsetX, y: baseY },
        draggable: false,
      };

      const edgeLabel =
        typeof selectedEdge.data?.label === "string"
          ? selectedEdge.data.label
          : undefined;

      const newEdges: Edge[] = [
        createArrowEdge(
          source ?? "",
          newNodeId,
          edgeLabel,
          sourceHandle ?? undefined,
          "black",
          undefined,
          isIfTrueBranch ? 100 : -100,
          true
        ),
        createArrowEdge(
          newNodeId,
          target ?? "",
          undefined,
          undefined,
          "black",
          selectedEdge.targetHandle ?? undefined,
          0,
          true
        ),
      ];


      const updatedEdges = edges.filter((e) => e.id !== selectedEdge.id);
      setNodes((prev) => [...prev, newNode]);
      setEdges([...updatedEdges, ...newEdges]);
      closeModal();
      return;
    }

    // ... ส่วนอื่นไม่เปลี่ยน
    const startNode = nodes.find((n) => n.id === "start");
    const endNode = nodes.find((n) => n.id === "end");
    if (!startNode || !endNode) return;

    const stepY = 100;
    const middleNodes = nodes.filter((n) => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || startNode;
    const baseY = startNode.position.y + stepY * (middleNodes.length + 1);

    if (type === "if") {
      const ifNode: Node = {
        id: crypto.randomUUID(),
        type: "ifNode",
        data: { label },
        position: { x: 300, y: baseY },
        draggable: false,
      };
      const breakpoint: Node = {
        id: crypto.randomUUID(),
        type: "breakpointNode",
        data: { label: "" },
        position: { x: 360, y: baseY + stepY },
        draggable: false,
      };

      setNodes((prev) => [
        ...prev.filter((n) => n.id !== "end"),
        ifNode,
        breakpoint,
        { ...endNode, position: { x: 300, y: baseY + stepY * 2 } },
      ]);

      setEdges((prev) => [
        ...prev.filter((e) => !(e.source === previousNode.id && e.target === endNode.id)),
        createArrowEdge(previousNode.id, ifNode.id),
        createArrowEdge(ifNode.id, breakpoint.id, "True", "right", "black", "true", 100, true),
        createArrowEdge(ifNode.id, breakpoint.id, "False", "left", "black", "false", -100, true),
        createArrowEdge(breakpoint.id, endNode.id),
      ]);
    } else if (type === "while") {
      const whileNode: Node = {
        id: crypto.randomUUID(),
        type: "whileNode",
        data: { label },
        position: { x: 300, y: baseY },
        draggable: false,
      };

      setNodes((prev) => [
        ...prev.filter((n) => n.id !== "end"),
        whileNode,
        { ...endNode, position: { x: 300, y: baseY + stepY * 2 } },
      ]);

      setEdges((prev) => [
        ...prev.filter((e) => !(e.source === previousNode.id && e.target === endNode.id)),
        createArrowEdge(previousNode.id, whileNode.id),
        createArrowEdge(whileNode.id, whileNode.id, "True", "true", "black", undefined, 150, true),
        createArrowEdge(whileNode.id, endNode.id, "False", "false", "black"),
      ]);
    } else {
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "default",
        data: { label },
        position: { x: 300, y: baseY },
        draggable: false,
      };

      setNodes((prev) => [
        ...prev.filter((n) => n.id !== "end"),
        newNode,
        { ...endNode, position: { x: 300, y: startNode.position.y + stepY * (middleNodes.length + 2) } },
      ]);

      setEdges((prev) => {
        const previousNode = middleNodes[middleNodes.length - 1] || startNode;
        return [
          ...prev.filter((e) => !(e.source === previousNode.id && e.target === endNode.id)),
          createArrowEdge(previousNode.id, newNode.id),
          createArrowEdge(newNode.id, endNode.id),
        ];
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Navbar />
      <div className="mt-20 ml-4">
        <TopBarControls />
      </div>
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView={false}
          defaultViewport={{ x: 600, y: 150, zoom: 1 }}
          nodeTypes={{
            ifNode: IfNodeComponent,
            whileNode: WhileNodeComponent,
            breakpointNode: BreakpointNodeComponent,
          }}
          edgeTypes={{ step: StepEdge }}
          onEdgeClick={onEdgeClick}
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
            <SymbolSection edge={selectedEdge} onAddNode={(type, label) => addNode(type, label)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;
