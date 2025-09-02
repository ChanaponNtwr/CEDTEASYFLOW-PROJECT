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
  BaseEdge,
  EdgeLabelRenderer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import SymbolSection from "./_components/SymbolSection";
import { v4 as uuidv4 } from "uuid";

// ---- Custom IF Node ----
const IfNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  return (
    <div
      style={{
        padding: 10,
        border: "1px solid #333",
        borderRadius: 5,
        backgroundColor: "#fff",
        textAlign: "center",
        width: 150,
        minHeight: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "#555" }} />
      <Handle type="source" position={Position.Left} id="left"  />
      <Handle type="source" position={Position.Right} id="right"  />
      <div>{data.label}</div>
    </div>
  );
};

// ---- Custom While Node ----
const WhileNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  return (
    <div
      style={{
        padding: 10,
        border: "1px solid",
        borderRadius: 5,
        backgroundColor: "white",
        textAlign: "center",
        width: 150,
        minHeight: 30,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Right} id="true" />
      <Handle type="source" position={Position.Bottom} id="false" />
      <div>{data.label}</div>
    </div>
  );
};

// ---- Custom Breakpoint Node ----
const BreakpointNodeComponent: React.FC<{ data: { label: string } }> = ({ data }) => {
  return (
    <div
      style={{
        width: 30,
        height: 30,
        border: "2px solid #333",
        borderRadius: "50%",
        backgroundColor: "#f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontSize: 12,
        position: "relative",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="false"
        style={{ top: "50%", }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="true"
        style={{ top: "50%", }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        
      />
      <div>{data.label}</div>
    </div>
  );
};

// ---- Custom Step Edge ----
const StepEdge = ({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: any) => {
  const offset = data?.offset ?? 200;
  let path = "";

  if (sourceX === targetX && sourceY === targetY) {
    // self-loop
    path = `
      M ${sourceX} ${sourceY}
      C ${sourceX + offset} ${sourceY - 50},
        ${targetX + offset} ${targetY + 50},
        ${targetX} ${targetY}
    `;
  } else {
    // normal step
    const midX = sourceX + offset;
    path = `
      M ${sourceX} ${sourceY}
      L ${midX} ${sourceY}
      L ${midX} ${targetY}
      L ${targetX} ${targetY}
    `;
  }

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: "#000", strokeWidth: 2 }} />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              top: `${sourceY - 12}px`,
              left: `${sourceX + offset / 2}px`,
              transform: 'translate(-50%, -50%)',
              background: "white",
              padding: "2px 4px",
              fontSize: 12,
            }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

type Props = { flowchartId: string };

const createArrowEdge = (
  source: string,
  target: string,
  label?: string,
  sourceHandle?: string,
  color = "black",
  targetHandle?: string,
  offset = 200,
  step = false
): Edge => ({
  id: uuidv4(),
  source,
  target,
  type: step ? "step" : "straight",
  sourceHandle,
  targetHandle,
  style: { stroke: color, strokeWidth: 2 },
  markerEnd: { type: "arrowclosed", color },
  data: step ? { offset, label } : { label },
});

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
        addEdge({ ...connection, animated: true, type: "straight", markerEnd: { type: "arrowclosed" } }, eds)
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
    const startNode = nodes.find(n => n.id === "start");
    const endNode = nodes.find(n => n.id === "end");
    if (!startNode || !endNode) return;

    const stepY = 100;
    const middleNodes = nodes.filter(n => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || startNode;
    const baseY = startNode.position.y + stepY * (middleNodes.length + 1);

    if (type === "if") {
      const ifNode: Node = { id: uuidv4(), type: "ifNode", data: { label }, position: { x: 300, y: baseY }, draggable: false };
      const breakpoint: Node = { id: uuidv4(), type: "breakpointNode", data: { label: "" }, position: { x: 360, y: baseY + stepY }, draggable: false };

      setNodes(prev => [
        ...prev.filter(n => n.id !== "end"),
        ifNode,
        breakpoint,
        { ...endNode, position: { x: 300, y: baseY + stepY * 2 } }
      ]);

      setEdges(prev => [
        ...prev.filter(e => !(e.source === previousNode.id && e.target === endNode.id)),
        createArrowEdge(previousNode.id, ifNode.id),
        createArrowEdge(ifNode.id, breakpoint.id, "True", "right", "black", "true", 100, true),
        createArrowEdge(ifNode.id, breakpoint.id, "False", "left", "black", "false", -100, true),
        createArrowEdge(breakpoint.id, endNode.id),
      ]);
    } else if (type === "while") {
      const whileNode: Node = { id: uuidv4(), type: "whileNode", data: { label }, position: { x: 300, y: baseY }, draggable: false };

      setNodes(prev => [
        ...prev.filter(n => n.id !== "end"),
        whileNode,
        { ...endNode, position: { x: 300, y: baseY + stepY * 2 } }
      ]);

      setEdges(prev => [
        ...prev.filter(e => !(e.source === previousNode.id && e.target === endNode.id)),
        createArrowEdge(previousNode.id, whileNode.id),
        createArrowEdge(whileNode.id, whileNode.id, "True", "true", "black", undefined, 150, true), // วนกลับ
        createArrowEdge(whileNode.id, endNode.id, "False", "false", "black"), // ไป End
      ]);
    } else {
      const newNode: Node = { id: uuidv4(), type: "default", data: { label }, position: { x: 300, y: baseY }, draggable: false };

      setNodes(prev => [
        ...prev.filter(n => n.id !== "end"),
        newNode,
        { ...endNode, position: { x: 300, y: startNode.position.y + stepY * (middleNodes.length + 2) } }
      ]);

      setEdges(prev => {
        const previousNode = middleNodes[middleNodes.length - 1] || startNode;
        return [
          ...prev.filter(e => !(e.source === previousNode.id && e.target === endNode.id)),
          createArrowEdge(previousNode.id, newNode.id),
          createArrowEdge(newNode.id, endNode.id),
        ];
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
          nodeTypes={{ ifNode: IfNodeComponent, whileNode: WhileNodeComponent, breakpointNode: BreakpointNodeComponent }}
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
          <div style={{ top: modalPosition.y, left: modalPosition.x }} className="absolute" onClick={e => e.stopPropagation()}>
            <SymbolSection edge={selectedEdge} onAddNode={(type, label) => { addNode(type, label); closeModal(); }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;
