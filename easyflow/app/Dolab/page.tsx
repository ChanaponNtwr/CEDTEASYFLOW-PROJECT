"use client";
import React, { useEffect, useState, useCallback } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { getFlowchart, saveFlowchart } from "../api/flowchartApi";
import Navbar from "@/components/Navbar";
import TopBarControls from "./_components/TopBarControls";
import { v4 as uuidv4 } from "uuid";

type Props = {
  flowchartId: string;
};

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const [flowchartName, setFlowchartName] = useState("My Flowchart");
  const [description, setDescription] = useState("This is a sample flowchart");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) =>
        addEdge({ ...connection, animated: true, label: "Edge" }, eds)
      ),
    [setEdges]
  );

  const addNode = () => {
    const newNode: Node = {
      id: uuidv4(),
      data: { label: "New Node" },
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      type: "default",
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSave = async () => {
    const payload = {
      flowchartID: flowchartId,
      name: flowchartName,
      description: description,
      nodes: nodes.map((n) => ({
        id: n.id,
        flowchartid: flowchartId,
        type: n.type ?? "default",
        label: typeof n.data.label === "string" ? n.data.label : "Node",
        x: n.position.x,
        y: n.position.y,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        flowchartid: flowchartId,
        from: e.source,
        to: e.target,
        label: e.label ?? "",
      })),
    };

    try {
      await saveFlowchart(payload);
      alert("Saved!");
    } catch (error) {
      console.error("Save failed:", error);
      alert("Error saving flowchart");
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getFlowchart(flowchartId);
        setFlowchartName(data.name);
        setDescription(data.description);

        const loadedNodes: Node[] = data.nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          position: { x: n.x, y: n.y },
          data: { label: n.label },
        }));

        const loadedEdges: Edge[] = data.edges.map((e: any) => ({
          id: e.id,
          source: e.from,
          target: e.to,
          label: e.label,
          animated: true,
        }));

        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } catch (error) {
        console.log("No existing flowchart. Starting new.");
      }
    };

    loadData();
  }, [flowchartId]);

  return (
    
  <div className="flex flex-col h-screen w-screen overflow-hidden">
  <Navbar />

  {/* Header bar (ชื่อ flowchart + ปุ่ม) */}
  <div className="p-2 bg-gray-100 flex justify-between shrink-0 mt-21">
    <div>
      <h2 className="text-xl font-semibold">{flowchartName}</h2>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
    <div>
      <button onClick={addNode} className="px-3 py-1 bg-blue-500 text-white rounded mr-2">
        + Add Node
      </button>
      <button onClick={handleSave} className="px-3 py-1 bg-green-600 text-white rounded">
        💾 Save
      </button>
    </div>
  </div>
  {/* Controls bar */}
        <div className="mt-4 ml-4">
          <TopBarControls />
        </div>
  {/* ReactFlow เต็มพื้นที่ที่เหลือ */}
  <div className="flex-1">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  </div>
</div>
  );
};

export default FlowchartEditor;
