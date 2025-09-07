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

// FlowchartEditor - คอมโพเนนต์หลักสำหรับแก้ไข flowchart
// ปรับปรุง:
// - ให้ node 'end' มีตัวเดียวเสมอ และปรับตำแหน่ง 'end' อัตโนมัติ
// - เส้นเชื่อมทั้งหมดเป็นชนิด 'smoothstep'
// - เพิ่มข้อความ "True" (ขวา) และ "False" (ซ้าย) บนเส้นที่ออกจากโหนด IF
const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const stepY = 100; // ระยะห่างแนวตั้งระหว่างชั้นของโหนด

  // ---------------------- Initial Nodes & Edges ----------------------
  const initialNodes: Node[] = [
    { id: "start", type: "input", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false },
    { id: "end", type: "output", data: { label: "End" }, position: { x: 300, y: 250 }, draggable: false },
  ];
  const initialEdges: Edge[] = [createArrowEdge("start", "end")];

  // ---------------------- State Management ----------------------
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  // ---------------------- Helper: คำนวนตำแหน่ง end ใหม่ ----------------------
  // ให้ end อยู่ต่ำกว่าโหนดที่ต่ำที่สุดเสมอเพื่อไม่ให้ทับกัน
  const computeEndY = (allNodes: Node[]) => {
    const maxY = allNodes
      .filter(n => n.id !== "end")
      .reduce((m, n) => Math.max(m, n.position.y), 0);
    return maxY + stepY; // เว้นระยะห่างจากโหนดที่ต่ำที่สุด
  };

  // ---------------------- Connect Edge ----------------------
  // เมื่อผู้ใช้ลากเส้นเชื่อม ให้สร้าง edge ชนิด 'smoothstep'
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const connEdge: Edge = {
          ...connection,
          animated: true,
          type: 'smoothstep', // กำหนดชนิดของ edge เป็น smoothstep
          markerEnd: { type: MarkerType.ArrowClosed },
        } as Edge;

        const newEdges = addEdge(connEdge, eds);
        return newEdges;
      }),
    [setEdges]
  );

  // ---------------------- Click Edge ----------------------
  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setModalPosition({ x: event.clientX + 10, y: event.clientY + 10 });
  };

  const closeModal = () => {
    setSelectedEdge(null);
    setModalPosition(null);
  };

  // ---------------------- Add Node ----------------------
  const addNode = (type: string, label: string) => {
    const startNode = nodes.find(n => n.id === "start");
    const endNode = nodes.find(n => n.id === "end");
    if (!startNode || !endNode) return;

    const middleNodes = nodes.filter(n => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || startNode;
    const baseY = startNode.position.y + stepY * (middleNodes.length + 1);

    // ---------------------- Add Node บน Edge ของ IF (branch) ----------------------
    if (selectedEdge) {
      // ✅ FIX-1: Destructure `targetHandle` from the selected edge
      const { source, target, sourceHandle, targetHandle } = selectedEdge;
      const isIfTrueBranch = sourceHandle === "right";
      const isIfFalseBranch = sourceHandle === "left";

      if (isIfTrueBranch || isIfFalseBranch) {
        const sourceNode = nodes.find((n) => n.id === source);
        const targetNode = nodes.find((n) => n.id === target);
        if (!sourceNode || !targetNode) return;

        const stepX = 200; // ระยะห่างแนวนอนสำหรับ branch
        const stepYForEdge = stepY;
        const offsetX = isIfTrueBranch
          ? sourceNode.position.x + stepX
          : sourceNode.position.x - stepX;
        const baseYEdge = sourceNode.position.y + stepYForEdge;

        // เลื่อนเฉพาะโหนดที่อยู่ใต้ sourceNode (ไม่รวม 'end')
        const nodesToMove = nodes.filter(n => n.position.y > sourceNode.position.y && n.id !== "end");
        const movedNodes = nodesToMove.map(n => ({
          ...n,
          position: { x: n.position.x, y: n.position.y + stepYForEdge * 2 },
        }));

        const newIfNodeId = crypto.randomUUID();
        const newBreakpointId = crypto.randomUUID();

        const newIfNode: Node = {
          id: newIfNodeId,
          type: "ifNode",
          data: { label },
          position: { x: offsetX, y: baseYEdge },
          draggable: false,
        };

        const newBreakpoint: Node = {
          id: newBreakpointId,
          type: "breakpointNode",
          data: { label: "" },
          position: { x: offsetX + 60, y: baseYEdge + stepYForEdge },
          draggable: false,
        };

        // สร้าง edges ใหม่ พร้อมกับใส่ label
        const newEdges: Edge[] = [
          createArrowEdge(sourceNode.id, newIfNodeId, { 
            label: isIfTrueBranch ? "True" : "False", // เพิ่ม label ที่นี่
            sourceHandle: sourceHandle ?? undefined 
          }),
          createArrowEdge(newIfNodeId, newBreakpoint.id, { label: "True", sourceHandle: "right", color: "black", targetHandle: "true" }),
          createArrowEdge(newIfNodeId, newBreakpoint.id, { label: "False", sourceHandle: "left", color: "black", targetHandle: "false" }),
          // ✅ FIX-2: Use the extracted `targetHandle` for the new connection
          createArrowEdge(newBreakpoint.id, targetNode.id, {
            targetHandle: targetHandle ?? undefined
          }),
        ];

        const updatedEdges = edges.filter((e) => e.id !== selectedEdge.id);

        // สร้างรายการโหนดใหม่โดยรวมโหนดเก่าและโหนดใหม่เข้าด้วยกัน
        const newCombinedNodes = (() => {
          const remaining = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
          const combined = [
            ...remaining,
            ...movedNodes,
            newIfNode,
            newBreakpoint,
          ];
          const updatedEnd = {
            ...endNode,
            position: { x: endNode.position.x, y: computeEndY(combined) },
          };
          return [...combined, updatedEnd];
        })();
        
        setNodes(newCombinedNodes);
        setEdges([...updatedEdges, ...newEdges]);
        closeModal();
        return;
      }
    }

    // ---------------------- Add IF Node ปกติ (เพิ่มเป็นชั้นแนวตั้ง) ----------------------
    if (type === "if") {
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y && n.id !== "end");
      const movedNodes = nodesToMove.map(n => ({
        ...n,
        position: { x: n.position.x, y: n.position.y + stepY * 2 },
      }));

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

      // สร้างโหนดที่รวมกันแล้วคำนวณตำแหน่ง end ใหม่
      const newCombinedNodes = (() => {
        const remaining = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
        const combined = [
          ...remaining,
          ifNode,
          breakpoint,
          ...movedNodes,
        ];
        const updatedEnd = {
          ...nodes.find(n => n.id === "end")!,
          position: { x: 300, y: computeEndY(combined) },
        };
        return [...combined, updatedEnd];
      })();

      let newEdges: Edge[] = [];
      if (previousNode.type === "ifNode") {
        newEdges = [
          createArrowEdge(previousNode.id, ifNode.id, { color: "black" }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", color: "black", targetHandle: "true" }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", color: "black", targetHandle: "false" }),
          createArrowEdge(breakpoint.id, "end"),
        ];
      } else {
        newEdges = [
          createArrowEdge(previousNode.id, ifNode.id),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", color: "black", targetHandle: "true" }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", color: "black", targetHandle: "false" }),
          createArrowEdge(breakpoint.id, "end"),
        ];
      }
      
      const finalEdges = [
        ...edges.filter(e => !(e.source === previousNode.id && e.target === "end")),
        ...newEdges,
      ];

      setNodes(newCombinedNodes);
      setEdges(finalEdges);
    } else {
      // ---------------------- Add Default Node ----------------------
      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "default",
        data: { label },
        position: { x: 300, y: baseY },
        draggable: false,
      };

      const newCombinedNodes = (() => {
        const remaining = nodes.filter(n => n.id !== "end");
        const combined = [
          ...remaining,
          newNode,
        ];
        const updatedEnd = {
          ...nodes.find(n => n.id === "end")!,
          position: { x: nodes.find(n => n.id === "end")!.position.x, y: computeEndY(combined) },
        };
        return [...combined, updatedEnd];
      })();

      const finalEdges = [
        ...edges.filter(e => !(e.source === previousNode.id && e.target === "end")),
        createArrowEdge(previousNode.id, newNode.id),
        createArrowEdge(newNode.id, "end"),
      ];

      setNodes(newCombinedNodes);
      setEdges(finalEdges);
    }
  };

  // ---------------------- Render ----------------------
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

      {/* Modal สำหรับเพิ่มโหนด */}
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