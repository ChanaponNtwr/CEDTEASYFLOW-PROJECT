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
import StepEdge from "./_components/StepEdge";
import { createArrowEdge } from "./_components/createArrowEdge";

type Props = { flowchartId: string };

// FlowchartEditor - คอมโพเนนต์หลักสำหรับแก้ไข flowchart
// ปรับปรุง:
// - ให้ node 'end' มีตัวเดียวเสมอ และปรับตำแหน่ง 'end' อัตโนมัติ
// - ปรับ: ให้เฉพาะเส้นที่มี label เป็น "True" หรือ "False" เท่านั้นเป็นเส้นเหลี่ยม (type: 'step')
const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const stepY = 100; // ระยะตั้งฉาก (vertical spacing) ระหว่างชั้นของ node

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
  // ให้ end อยู่ต่ำกว่าจุดที่ต่ำที่สุดของ node อื่น ๆ เสมอ (เพื่อไม่ให้ทับกัน)
  const computeEndY = (allNodes: Node[]) => {
    const maxY = allNodes
      .filter(n => n.id !== "end")
      .reduce((m, n) => Math.max(m, n.position.y), 0);
    return maxY + stepY; // เว้นระยะ stepY จาก node ที่ต่ำสุด
  };

  // ---------------------- Helper: บังคับให้เฉพาะ edges label True/False เป็น 'step' ----------------------
  // เปลี่ยน type เป็น 'step' เฉพาะ edge ที่มี label === 'True' || label === 'False'
  const ensureBranchEdgesAreStep = (edgesList: Edge[], _nodesList: Node[]) =>
    edgesList.map(e => {
      const label = (e as any).label; // label ถูกส่งจาก createArrowEdge ในหลายที่
      if (label === 'True' || label === 'False') {
        return { ...e, type: 'step' };
      }
      return e;
    });

  // ---------------------- Connect Edge ----------------------
  // เมื่อผู้ใช้ลากเชื่อม ให้เพิ่ม edge ปกติ (straight) — แต่หลังจาก update จะบังคับให้
  // เฉพาะ edges ที่มี label True/False กลายเป็น 'step' (ด้วย ensureBranchEdgesAreStep)
  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const connEdge: Edge = {
          ...connection,
          animated: true,
          type: 'straight',
          markerEnd: { type: MarkerType.ArrowClosed },
        } as Edge;

        const newEdges = addEdge(connEdge, eds);
        return ensureBranchEdgesAreStep(newEdges, nodes);
      }),
    [setEdges, nodes]
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
      const { source, target, sourceHandle } = selectedEdge;
      const isIfTrueBranch = sourceHandle === "right";
      const isIfFalseBranch = sourceHandle === "left";

      if (isIfTrueBranch || isIfFalseBranch) {
        const sourceNode = nodes.find((n) => n.id === source);
        const targetNode = nodes.find((n) => n.id === target);
        if (!sourceNode || !targetNode) return;

        const stepX = 200; // ระยะทางด้านซ้าย/ขวา สำหรับ branch
        const stepYForEdge = stepY;
        const offsetX = isIfTrueBranch
          ? sourceNode.position.x + stepX
          : sourceNode.position.x - stepX;
        const baseYEdge = sourceNode.position.y + stepYForEdge;

        // เลื่อนเฉพาะ node ที่อยู่ด้านล่างของ sourceNode (ไม่รวม end)
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

        const bpWidth = 140; // ค่าเดียวกับ data.width
        const offsetForBranch = Math.ceil(bpWidth / 2) + 20; // เผื่อช่องว่าง

        // สร้าง edges ใหม่ (ใส่ label True/False สำหรับ branch)
        const newEdges: Edge[] = [
          createArrowEdge(sourceNode.id, newIfNodeId, { sourceHandle: sourceHandle ?? undefined }),
          createArrowEdge(newIfNodeId, newBreakpoint.id, { label: "True", sourceHandle: "right", color: "black", targetHandle: "true", offset: offsetForBranch, step: true }),
          createArrowEdge(newIfNodeId, newBreakpoint.id, { label: "False", sourceHandle: "left",  color: "black", targetHandle: "false", offset: -offsetForBranch, step: true }),
          // connector จาก breakpoint ไปยัง target — ถาต้องการให้เป็นเส้นเหลี่ยมให้ใส่ step: true (offset ตามต้องการ)
          createArrowEdge(newBreakpoint.id, targetNode.id, { step: true, offset: 0 }),
        ];


        const updatedEdges = edges.filter((e) => e.id !== selectedEdge.id);

        // สร้างรายการ nodes ใหม่โดยผสม prev nodes (แต่แทนที่ nodesToMove ด้วย movedNodes)
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

        // บังคับให้เฉพาะ edges ที่มี label True/False เป็น 'step'
        const finalEdges = ensureBranchEdgesAreStep([...updatedEdges, ...newEdges], newCombinedNodes);

        setNodes(newCombinedNodes);
        setEdges(finalEdges);
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

      // สร้าง combined nodes แล้วคำนวนตำแหน่ง end ใหม่
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
          createArrowEdge(previousNode.id, ifNode.id, { color: "black", step: true }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", color: "black", targetHandle: "true", offset: 100, step: true }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", color: "black", targetHandle: "false", offset: -100, step: true }),
          createArrowEdge(breakpoint.id, "end"),
        ];
      } else {
        newEdges = [
          createArrowEdge(previousNode.id, ifNode.id),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", color: "black", targetHandle: "true", offset: 150, step: true }),
          createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", color: "black", targetHandle: "false", offset: -150, step: true }),
          createArrowEdge(breakpoint.id, "end"),
        ];
      }

      // บังคับให้เฉพาะเส้น True/False เป็น 'step'
      const finalEdges = ensureBranchEdgesAreStep([
        ...edges.filter(e => !(e.source === previousNode.id && e.target === "end")),
        ...newEdges,
      ], newCombinedNodes);

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

      const finalEdges = ensureBranchEdgesAreStep([
        ...edges.filter(e => !(e.source === previousNode.id && e.target === "end")),
        createArrowEdge(previousNode.id, newNode.id),
        createArrowEdge(newNode.id, "end"),
      ], newCombinedNodes);

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
          edgeTypes={{ step: StepEdge }}
          onEdgeClick={onEdgeClick}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      {/* Modal เพิ่ม node */}
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
