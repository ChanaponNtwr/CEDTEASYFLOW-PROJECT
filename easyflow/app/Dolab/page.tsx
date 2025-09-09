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
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";

import IfNodeComponent from "./_components/IfNodeComponent";
import BreakpointNodeComponent from "./_components/BreakpointNodeComponent";
import { createArrowEdge } from "./_components/createArrowEdge";

type Props = { flowchartId: string };

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const stepY = 100;

  const initialNodes: Node[] = [
    { id: "start", type: "input", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false },
    { id: "end", type: "output", data: { label: "End" }, position: { x: 300, y: 250 }, draggable: false },
  ];
  const initialEdges: Edge[] = [createArrowEdge("start", "end")];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const computeEndY = (allNodes: Node[]) => {
    const maxY = allNodes
      .filter(n => n.id !== "end")
      .reduce((m, n) => Math.max(m, n.position.y), 0);
    return maxY + stepY;
  };

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const connEdge: Edge = {
          ...connection,
          animated: true,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        } as Edge;
        return addEdge(connEdge, eds);
      }),
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
    const startNode = nodes.find(n => n.id === "start");
    const endNode = nodes.find(n => n.id === "end");
    if (!startNode || !endNode) return;

    // --- CASE 1: Add node on a selected edge ---
    if (selectedEdge) {
      const { source, target, sourceHandle, targetHandle } = selectedEdge;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return;
      
      const isBranchingFromIf = sourceNode.type === 'ifNode' && (sourceHandle === 'right' || sourceHandle === 'left');

      // SUB-CASE 1.1: Branching out from an IF Node (creates horizontal branch)
      if (isBranchingFromIf) {
        const isIfTrueBranch = sourceHandle === "right";
        const stepX = 200;
        const offsetX = isIfTrueBranch ? sourceNode.position.x + stepX : sourceNode.position.x - stepX;
        const baseYEdge = sourceNode.position.y + stepY;

        if (type === "if") {
          const yOffset = stepY * 2;
          const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y && n.id !== "end");
          const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));

          const newIfNode = { id: crypto.randomUUID(), type: "ifNode", data: { label }, position: { x: offsetX, y: baseYEdge }, draggable: false };
          const newBreakpoint = { id: crypto.randomUUID(), type: "breakpointNode", data: { label: "" }, position: { x: offsetX + 60, y: baseYEdge + stepY }, draggable: false };
          
          const newEdges = [
            createArrowEdge(sourceNode.id, newIfNode.id, { label: isIfTrueBranch ? "True" : "False", sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newIfNode.id, newBreakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
            createArrowEdge(newIfNode.id, newBreakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
            createArrowEdge(newBreakpoint.id, targetNode.id, { targetHandle: targetHandle ?? undefined }),
          ];

          const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
          const combined = [...remainingNodes, ...movedNodes, newIfNode, newBreakpoint];
          const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
          setNodes([...combined, updatedEnd]);
          setEdges([...edges.filter(e => e.id !== selectedEdge.id), ...newEdges]);

        } else { // Default node on a new branch
          const yOffset = stepY;
          const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y && n.id !== "end");
          const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
          
          const newNode = { id: crypto.randomUUID(), type: "default", data: { label }, position: { x: offsetX, y: baseYEdge }, draggable: false };

          const newEdges = [
            createArrowEdge(sourceNode.id, newNode.id, { label: isIfTrueBranch ? "True" : "False", sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined }),
          ];

          const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
          const combined = [...remainingNodes, ...movedNodes, newNode];
          const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
          setNodes([...combined, updatedEnd]);
          setEdges([...edges.filter(e => e.id !== selectedEdge.id), ...newEdges]);
        }
      } 
      // SUB-CASE 1.2: Generic insertion into an existing edge (vertical stacking)
      else {
        const yOffset = type === 'if' ? stepY * 2 : stepY;
        const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y && n.id !== "end");
        const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));

        let newNodesToAdd: Node[] = [];
        let newEdgesToAdd: Edge[] = [];
        
        if (type === 'if') {
          const ifNode = { id: crypto.randomUUID(), type: 'ifNode', data: { label }, position: { x: sourceNode.position.x, y: sourceNode.position.y + stepY }, draggable: false };
          const breakpoint = { id: crypto.randomUUID(), type: 'breakpointNode', data: { label: '' }, position: { x: sourceNode.position.x + 60, y: sourceNode.position.y + stepY * 2 }, draggable: false };
          newNodesToAdd.push(ifNode, breakpoint);
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, ifNode.id, { sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
            createArrowEdge(breakpoint.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
          );
        } else { // Default node
          // Check if the source is a breakpoint to align the new node correctly
          const newX = sourceNode.type === 'breakpointNode' ? targetNode.position.x : sourceNode.position.x;
          
          const newNode = { id: crypto.randomUUID(), type: 'default', data: { label }, position: { x: newX, y: sourceNode.position.y + stepY }, draggable: false };
          newNodesToAdd.push(newNode);
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, newNode.id, { sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
          );
        }
        
        const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
        const combined = [...remainingNodes, ...movedNodes, ...newNodesToAdd];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
        setNodes([...combined, updatedEnd]);
        setEdges([...edges.filter(e => e.id !== selectedEdge.id), ...newEdgesToAdd]);
      }
      closeModal();
      return;
    }

    // --- CASE 2: Add node to the end of the main flow ---
    const middleNodes = nodes.filter(n => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || startNode;
    const baseY = startNode.position.y + stepY * (middleNodes.length + 1);
    
    if (type === "if") {
      const yOffset = stepY * 2;
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y && n.id !== "end");
      const movedNodes = nodesToMove.map(n => ({...n, position: { ...n.position, y: n.position.y + yOffset }}));
      
      const ifNode = { id: crypto.randomUUID(), type: "ifNode", data: { label }, position: { x: 300, y: baseY }, draggable: false };
      const breakpoint = { id: crypto.randomUUID(), type: "breakpointNode", data: { label: "" }, position: { x: 360, y: baseY + stepY }, draggable: false };
      
      const newEdges = [
          createArrowEdge(previousNode.id, ifNode.id),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
          createArrowEdge(breakpoint.id, endNode.id),
      ];
      
      const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
      const combined = [...remainingNodes, ...movedNodes, ifNode, breakpoint];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
      setNodes([...combined, updatedEnd]);
      setEdges([...edges.filter(e => e.source === previousNode.id && e.target === endNode.id), ...newEdges]);
    } else { // Default node
      const yOffset = stepY;
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y && n.id !== "end");
      const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      
      const newNode = { id: crypto.randomUUID(), type: "default", data: { label }, position: { x: 300, y: baseY }, draggable: false };

      const newEdges = [
        createArrowEdge(previousNode.id, newNode.id),
        createArrowEdge(newNode.id, endNode.id),
      ];

      const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
      const combined = [...remainingNodes, ...movedNodes, newNode];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
      setNodes([...combined, updatedEnd]);
      setEdges([...edges.filter(e => e.source === previousNode.id && e.target === endNode.id), ...newEdges]);
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
            breakpointNode: BreakpointNodeComponent,
          }}
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