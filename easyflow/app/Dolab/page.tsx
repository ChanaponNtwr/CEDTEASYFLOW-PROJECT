"use client";
import React, { useCallback, useState } from "react";
import {
  ReactFlow,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  Position,
  Handle,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";
import { v4 as uuidv4 } from "uuid";

// ---- Custom IfNodeComponent ----
const IfNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  return (
    <div
      style={{
        padding: 10,
        border: "2px solid #333",
        borderRadius: 5,
        backgroundColor: "#fff",
        textAlign: "center",
        width: 120,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#555" }} />
      <Handle type="source" position={Position.Left} id="left" style={{ background: "red" }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: "blue" }} />
      <div>{data.label}</div>
    </div>
  );
};

type Props = { flowchartId: string };

// ฟังก์ชันสร้าง edge แบบมีหัวลูกศร
const createArrowEdge = (
  source: string,
  target: string,
  label?: string,
  sourceHandle?: string,
  color = "black"
): Edge => ({
  id: uuidv4(),
  source,
  target,
  type: "straight",
  label,
  sourceHandle,
  style: { stroke: color },
  markerEnd: { type: "arrowclosed", color },
});

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const initialNodes: Node[] = [
    { id: "start", type: "input", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false },
    { id: "end", type: "output", data: { label: "End" }, position: { x: 300, y: 250 }, draggable: false },
  ];

  const initialEdges: Edge[] = [
    createArrowEdge("start", "end", undefined, undefined, "black")
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: true, type: "straight", markerEnd: { type: "arrowclosed" } }, eds)),
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
    const startNode = nodes.find((n) => n.id === "start");
    const endNode = nodes.find((n) => n.id === "end");
    if (!startNode || !endNode) return;

    const stepY = 100;
    const branchOffsetX = 150;
    const middleNodes = nodes.filter(n => n.id !== "start" && n.id !== "end");
    const baseY = startNode.position.y + stepY * (middleNodes.length + 1);

    if (type === "if") {
      const ifNode: Node = { id: uuidv4(), type: "ifNode", data: { label }, position: { x: 300, y: baseY }, draggable: false };
      const trueNode: Node = { id: uuidv4(), type: "default", data: { label: "True Branch" }, position: { x: 300 + branchOffsetX, y: baseY + stepY }, targetPosition: Position.Top, sourcePosition: Position.Bottom, draggable: false };
      const falseNode: Node = { id: uuidv4(), type: "default", data: { label: "False Branch" }, position: { x: 300 - branchOffsetX, y: baseY + stepY }, targetPosition: Position.Top, sourcePosition: Position.Bottom, draggable: false };
      const breakpoint: Node = { id: uuidv4(), type: "default", data: { label: "Breakpoint" }, position: { x: 300, y: baseY + stepY * 2 }, targetPosition: Position.Top, sourcePosition: Position.Bottom, draggable: false };

      setNodes([
        { ...startNode },
        ...middleNodes.map((node, i) => ({ ...node, position: { x: 300, y: startNode.position.y + stepY * (i + 1) } })),
        ifNode, trueNode, falseNode, breakpoint,
        { ...endNode, position: { x: 300, y: baseY + stepY * 3 } }
      ]);

      setEdges([
        createArrowEdge(startNode.id, ifNode.id),
        createArrowEdge(ifNode.id, trueNode.id, "True", "right", "blue"),
        createArrowEdge(ifNode.id, falseNode.id, "False", "left", "red"),
        createArrowEdge(trueNode.id, breakpoint.id),
        createArrowEdge(falseNode.id, breakpoint.id),
        createArrowEdge(breakpoint.id, endNode.id),
      ]);
    } else {
      const newNode: Node = { id: uuidv4(), type: "default", data: { label }, position: { x: 300, y: 0 }, draggable: false };

      setNodes(prev => {
        const middleNodes = prev.filter(n => n.id !== "start" && n.id !== "end");
        const updated = [...middleNodes, newNode];
        return [
          { ...startNode },
          ...updated.map((node, i) => ({ ...node, position: { x: 300, y: startNode.position.y + stepY * (i + 1) } })),
          { ...endNode, position: { x: 300, y: startNode.position.y + stepY * (updated.length + 1) } }
        ];
      });

      setEdges(() => {
        const middleNodes = nodes.filter(n => n.id !== "start" && n.id !== "end");
        const sequence = [startNode, ...middleNodes, newNode, endNode];
        return sequence.slice(0, -1).map((node, i) => createArrowEdge(node.id, sequence[i + 1].id));
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      <Navbar />
      <div className="mt-20 ml-4"><TopBarControls /></div>
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView={false}
          defaultViewport={{ x: 600, y: 150, zoom: 1 }}
          nodeTypes={{ ifNode: IfNodeComponent }}
          onEdgeClick={onEdgeClick}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      {selectedEdge && modalPosition && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div style={{ top: modalPosition.y, left: modalPosition.x }} className="absolute" onClick={(e) => e.stopPropagation()}>
            <SymbolSection edge={selectedEdge} onAddNode={(type, label) => { addNode(type, label); closeModal(); }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;
