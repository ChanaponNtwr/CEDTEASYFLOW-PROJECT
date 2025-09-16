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

// --- Components ---
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";

// --- Custom Nodes ---
import IfNodeComponent from "./_components/IfNodeComponent";
import BreakpointNodeComponent from "./_components/BreakpointNodeComponent";
import WhileNodeComponent from "./_components/WhileNodeComponent";
import StartNodeComponent from "./_components/StartNodeComponent";
import EndNodeComponent from "./_components/EndNodeComponent";
import InputNodeComponent from "./_components/InputNodeComponent";
import OutputNodeComponent from "./_components/OutputNodeComponent";
import DeclareComponent from "./_components/DeclareComponent";
import AssignComponent from "./_components/AssignComponent";

// --- Utility Functions ---
import { createArrowEdge } from "./_components/createArrowEdge";

type Props = { flowchartId: string };

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const stepY = 150;

  // --- State Management ---
  const initialNodes: Node[] = [
    { id: "start", type: "startNode", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false },
    { id: "end", type: "endNode", data: { label: "End" }, position: { x: 300, y: 250 }, draggable: false },
  ];
  const initialEdges: Edge[] = [createArrowEdge("start", "end")];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const parallelogramXOffset = 25; // สำหรับ input/output/declare/assign

  // --- Helper Functions ---
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

// --- Core Logic: Add Node Function ---
  const addNode = (type: string, label: string) => {
    const startNode = nodes.find(n => n.id === "start");
    const endNode = nodes.find(n => n.id === "end");
    if (!startNode || !endNode) return;

    // --- Node kind including assign ---
    const nodeKind = (type === "input" || type === "output" || type === "declare" || type === "assign") ? type : type;
    // ❌ ไม่จำเป็นต้องใช้ parallelogramXOffset อีกต่อไป
    // const parallelogramXOffset = 25; 

    // ===================================================================================
    // CASE 1: Add node on a selected edge
    // ===================================================================================
    if (selectedEdge) {
      const { source, target, sourceHandle, targetHandle } = selectedEdge;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return;

      // --- Special Case: Adding node inside a 'while' loop ---
      if (source === target && sourceNode.type === 'whileNode') {
        let newNodesToAdd: Node[] = [];
        let newEdgesToAdd: Edge[] = [];
        let lastNodeInLoopId = '';
        const newX = sourceNode.position.x + 250;
        const newY = sourceNode.position.y + 50;

        if (type === 'if') {
          const ifNode = { id: crypto.randomUUID(), type: 'ifNode', data: { label }, position: { x: newX, y: newY }, draggable: false };
          const breakpoint = { id: crypto.randomUUID(), type: 'breakpointNode', data: { label: '' }, position: { x: newX + 60, y: newY + stepY }, draggable: false };
          newNodesToAdd.push(ifNode, breakpoint);
          lastNodeInLoopId = breakpoint.id;
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, ifNode.id, { label: "True", sourceHandle: "true" }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" })
          );
        } else {
          const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
          // ✅ แก้ไข: ไม่ต้องลบ offset ทำให้ตำแหน่ง X ตรงกัน
          const finalNewX = newX;
          const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: finalNewX, y: newY }, draggable: false };
          newNodesToAdd.push(newNode);
          lastNodeInLoopId = newNode.id;
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, newNode.id, { label: "True", sourceHandle: "true" })
          );
        }

        newEdgesToAdd.push({
          ...createArrowEdge(lastNodeInLoopId, sourceNode.id, { targetHandle: "loop_in" }),
          type: 'smoothstep',
        });
        
        setNodes(nds => [...nds, ...newNodesToAdd]);
        setEdges(eds => [...eds.filter(e => e.id !== selectedEdge.id), ...newEdgesToAdd]);
        
        closeModal();
        return;
      }

      // --- Case for adding node to an 'if' branch ---
      const isBranchingFromIf = sourceNode.type === 'ifNode' && (sourceHandle === 'right' || sourceHandle === 'left');
      if (isBranchingFromIf) {
        const isIfTrueBranch = sourceHandle === "right";
        const stepX = 200;
        const offsetX = isIfTrueBranch ? sourceNode.position.x + stepX : sourceNode.position.x - stepX;
        const baseYEdge = sourceNode.position.y + stepY;

        if (type === "if") {
          const yOffset = stepY * 2;
          const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y);
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
          const combined = [...remainingNodes, ...movedNodes.filter(n => n.id !== 'end'), newIfNode, newBreakpoint];
          const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
          setNodes([...combined, updatedEnd]);
          setEdges([...edges.filter(e => e.id !== selectedEdge.id), ...newEdges]);
        } else {
          const yOffset = stepY;
          const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y);
          const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
          
          const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
          // ✅ แก้ไข: ไม่ต้องลบ offset ทำให้ตำแหน่ง X ตรงกัน
          const finalOffsetX = offsetX;
          const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: finalOffsetX, y: baseYEdge }, draggable: false };

          const newEdges = [
            createArrowEdge(sourceNode.id, newNode.id, { label: isIfTrueBranch ? "True" : "False", sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined }),
          ];
          
          const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
          const combined = [...remainingNodes, ...movedNodes.filter(n => n.id !== 'end'), newNode];
          const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
          setNodes([...combined, updatedEnd]);
          setEdges([...edges.filter(e => e.id !== selectedEdge.id), ...newEdges]);
        }
      } 
      // --- Case for inserting node on a normal edge ---
      else {
        const yOffset = (type === 'if' || type === 'while') ? stepY * 2 : stepY;
        const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y);
        const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
        
        let newPosX = sourceNode.position.x;
        if (sourceNode.type === 'breakpointNode') {
          const incomingEdge = edges.find(e => e.target === sourceNode.id);
          if (incomingEdge) {
            const parentIfNode = nodes.find(n => n.id === incomingEdge.source);
            if (parentIfNode) newPosX = parentIfNode.position.x;
          }
        }
        
        let newNodesToAdd: Node[] = [];
        let newEdgesToAdd: Edge[] = [];
        let combinedNodes: Node[] = [];

        if (type === 'if') {
          const ifNode = { id: crypto.randomUUID(), type: 'ifNode', data: { label }, position: { x: newPosX, y: sourceNode.position.y + stepY }, draggable: false };
          const breakpoint = { id: crypto.randomUUID(), type: 'breakpointNode', data: { label: '' }, position: { x: newPosX + 73, y: sourceNode.position.y + stepY * 2 }, draggable: false };
          newNodesToAdd.push(ifNode, breakpoint);
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, ifNode.id, { sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
            createArrowEdge(breakpoint.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
          );
        } else if (type === 'while') {
          const whileNode = { id: crypto.randomUUID(), type: 'whileNode', data: { label }, position: { x: newPosX, y: sourceNode.position.y + stepY + 60}, draggable: false };
          newNodesToAdd.push(whileNode);
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, whileNode.id, { sourceHandle: sourceHandle ?? undefined, targetHandle: "top" }),
            createArrowEdge(whileNode.id, targetNode.id, { label: "False", sourceHandle: "false", targetHandle: targetHandle ?? undefined }),
            {
              ...createArrowEdge(whileNode.id, whileNode.id, { label: "True", sourceHandle: "true", targetHandle: "loop_in" }),
              type: 'smoothstep',
              pathOptions: { offset: 60 }
            }
          );
        } else {
          const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
          // ✅ แก้ไข: ไม่ต้องลบ offset ทำให้ตำแหน่ง X ตรงกัน
          const finalNewPosX = newPosX;
          const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: finalNewPosX, y: sourceNode.position.y + stepY }, draggable: false };
          newNodesToAdd.push(newNode);
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, newNode.id, { sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
          );
        }

        const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id));
        combinedNodes = [...remainingNodes.filter(n => n.id !== 'end'), ...movedNodes.filter(n => n.id !== 'end'), ...newNodesToAdd];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combinedNodes) + (type === 'while' ? stepY : 0) } };
        
        setNodes([...combinedNodes, updatedEnd]);
        setEdges([...edges.filter(e => e.id !== selectedEdge.id), ...newEdgesToAdd]);

      }
      closeModal();
      return;
    }

    // ===================================================================================
    // CASE 2: Add node to the end of the main flow
    // ===================================================================================
    const middleNodes = nodes.filter(n => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || startNode;
    const baseY = startNode.position.y + stepY * (middleNodes.length + 1);
    
    if (type === "if") {
      const yOffset = stepY * 2;
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y);
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
      const combined = [...remainingNodes, ...movedNodes.filter(n => n.id !== 'end'), ifNode, breakpoint];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
      setNodes([...combined, updatedEnd]);
      setEdges([...edges.filter(e => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
    } else if (type === 'while') {
      const yOffset = stepY;
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y);
      const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      const whileNode = { id: crypto.randomUUID(), type: 'whileNode', data: { label }, position: { x: 300, y: baseY }, draggable: false };
      const newEdges = [
        createArrowEdge(previousNode.id, whileNode.id, { targetHandle: "top" }),
        createArrowEdge(whileNode.id, endNode.id, { label: "False", sourceHandle: "false" }),
        {
          ...createArrowEdge(whileNode.id, whileNode.id, { label: "True", sourceHandle: "true", targetHandle: "loop_in" }),
          type: 'smoothstep',
          animated: true,
          pathOptions: { offset: 60 }
        }
      ];
      const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
      const combined = [...remainingNodes, ...movedNodes.filter(n => n.id !== 'end'), whileNode];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + stepY } };
      setNodes([...combined, updatedEnd]);
      setEdges([...edges.filter(e => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
    } else {
      const yOffset = stepY;
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y);
      const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      
      const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
      // ✅ แก้ไข: ไม่ต้องลบ offset ทำให้ตำแหน่ง X ตรงกัน
      const newPosX = 300; 
      const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: newPosX, y: baseY }, draggable: false };
      
      const newEdges = [
        createArrowEdge(previousNode.id, newNode.id),
        createArrowEdge(newNode.id, endNode.id),
      ];
      
      const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
      const combined = [...remainingNodes, ...movedNodes.filter(n => n.id !== 'end'), newNode];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
      setNodes([...combined, updatedEnd]);
      setEdges([...edges.filter(e => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
    }
  };
  // --- JSX Rendering ---
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
            whileNode: WhileNodeComponent,
            startNode: StartNodeComponent,
            endNode: EndNodeComponent,
            input: InputNodeComponent,
            output: OutputNodeComponent,
            declare: DeclareComponent,
            assign: AssignComponent, // ✅ เพิ่ม Assign
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
            <SymbolSection 
              edge={selectedEdge} 
              onAddNode={(type, label) => addNode(type, label)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;
