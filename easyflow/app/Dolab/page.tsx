// File: app/flowchart/FlowchartEditor.tsx
"use client";

import React, { useCallback, useState } from "react";
import { useParams } from "next/navigation"; // <-- เพิ่ม
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
import ForNodeComponent from "./_components/ForNodeComponent";

// --- Utility Functions ---
import { createArrowEdge } from "./_components/createArrowEdge";

import { deleteNode as apiDeleteNode } from "@/app/service/FlowchartService";

// import { apiPostInsertNode } from "../service/FlowchartService";

type Props = { flowchartId: string };

const FlowchartEditor: React.FC<Props> = ({ flowchartId }) => {
  const stepY = 150;

  // --- State Management ---
  const initialNodes: Node[] = [
    { id: "start", type: "start", data: { label: "Start" }, position: { x: 300, y: 50 }, draggable: false },
    { id: "end", type: "end", data: { label: "End" }, position: { x: 300, y: 250 }, draggable: false },
  ];
  const initialEdges: Edge[] = [createArrowEdge("start", "end")];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  // NEW: selected node for editing
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeModalPosition, setNodeModalPosition] = useState<{ x: number; y: number } | null>(null);

  // --- Helpers (centralized, using .map for transforms) ---
  const genId = () => crypto.randomUUID();

  const computeEndY = (allNodes: Node[]) => {
    const maxY = allNodes.filter((n) => n.id !== "end").reduce((m, n) => Math.max(m, n.position.y), 0);
    return maxY + stepY;
  };

  const mapTypeForNode = (type: string, prevType?: string) => {
    if (type === "if") return "if";
    if (type === "while") return "while";
    if (type === "for") return "for";
    if (["input", "output", "declare", "assign"].includes(type)) return type;
    return prevType ?? type;
  };

  const moveNodesBelow = (allNodes: Node[], y: number, offset: number) =>
    allNodes.map((n) => (n.position.y > y ? { ...n, position: { ...n.position, y: n.position.y + offset } } : n));

  const removeEdgesTouching = (allEdges: Edge[], nodeId: string) => allEdges.filter((e) => e.source !== nodeId && e.target !== nodeId);

  const reconnectAroundDeleted = (allEdges: Edge[], nodeId: string) => {
    const incoming = allEdges.filter((e) => e.target === nodeId);
    const outgoing = allEdges.filter((e) => e.source === nodeId);
    const newEdges: Edge[] = [];
    incoming.forEach((inE) => {
      outgoing.forEach((outE) => {
        if (inE.source === outE.target) return; // skip no-op
        newEdges.push(createArrowEdge(inE.source, outE.target));
      });
    });
    return newEdges;
  };

  // compute reachable nodes from 'start' given edges
  const pruneUnreachableNodes = (allNodes: Node[], allEdges: Edge[]) => {
    const adjacency = new Map<string, string[]>();
    allEdges.forEach((e) => {
      if (!adjacency.has(e.source)) adjacency.set(e.source, []);
      adjacency.get(e.source)!.push(e.target);
    });
    const visited = new Set<string>();
    const stack = ["start"];
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      (adjacency.get(cur) ?? []).forEach((nb) => !visited.has(nb) && stack.push(nb));
    }
    // keep end even if not reachable
    return allNodes.filter((n) => visited.has(n.id) || n.id === "end");
  };

  // --- Core callbacks ---
  const onConnect = useCallback(
    (connection: Connection) => {
      console.log("🔌 onConnect called with connection:", connection);
      setEdges((eds) => {
        const connEdge: Edge = {
          ...connection,
          animated: true,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
        } as Edge;
        return addEdge(connEdge, eds);
      });
    },
    [setEdges]
  );

  const onEdgeClick = (event: React.MouseEvent, edge: Edge) => {
    console.log("🔗 onEdgeClick called for edge:", edge);
    event.stopPropagation();
    setSelectedEdge(edge);
    setModalPosition({ x: event.clientX + 10, y: event.clientY + 10 });
  };

  const closeModal = () => {
    setSelectedEdge(null);
    setModalPosition(null);
  };

  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    console.log("🖱️ onNodeClick called for node:", node);
    event.stopPropagation();
    if (node.id === "start" || node.id === "end") return;
    setSelectedNode(node);
    setNodeModalPosition({ x: window.innerWidth / 2 - 220, y: window.innerHeight / 2 - 150 });
  };

  const handleUpdateNode = (id: string, type: string, label: string) => {
    console.log("📝 handleUpdateNode called with:", { id, type, label });
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label }, type: mapTypeForNode(type, n.type) } : n)));
    setSelectedNode(null);
    setNodeModalPosition(null);

    console.log(nodes);
  };

const deleteNodeAndReconnect = async (nodeId: string) => {
  console.log("🗑️ deleteNodeAndReconnect called for nodeId:", nodeId);

  if (!flowchartId) {
    console.warn("deleteNodeAndReconnect: missing flowchartId");
    return;
  }

  // เก็บ snapshot ปัจจุบัน (เพื่อให้การคำนวณไม่พึ่งพา state ที่อาจ stale หลัง await)
  const snapshotNodes = [...nodes];
  const snapshotEdges = [...edges];

  // ถ้า node ไม่มีใน snapshot ให้หยุดเลย
  const exists = snapshotNodes.some((n) => n.id === nodeId);
  if (!exists) {
    console.warn("deleteNodeAndReconnect: node not found in current nodes:", nodeId);
    return;
  }

  try {
    console.log("-> calling backend DELETE for node:", nodeId, "flowchartId:", flowchartId);
    const backendResponse = await apiDeleteNode(flowchartId, nodeId);
    console.log("✅ backend delete response:", backendResponse);

    // --- คำนวณ edges ใหม่ (ลบ edges ที่ชี้ถึง node และเชื่อมรอบๆ node ที่ถูกลบ) ---
    const remainingEdges = removeEdgesTouching(snapshotEdges, nodeId);
    const reconnectEdges = reconnectAroundDeleted(snapshotEdges, nodeId);
    // รวมกัน (หากมี duplicate อาจต้องกรอง แต่เริ่มต้นเอาแบบรวม)
    const combinedEdges = [...remainingEdges, ...reconnectEdges];

    // --- คำนวณ nodes ใหม่ หลังลบ node ---
    const nodesAfterRemoval = snapshotNodes.filter((n) => n.id !== nodeId);

    // --- prune unreachable nodes ตามตรรกะเดิม (เริ่มจาก start) ---
    const pruned = pruneUnreachableNodes(nodesAfterRemoval, combinedEdges);

    // --- อัปเดตตำแหน่ง end node (ถ้ามี) ---
    const keptWithoutEnd = pruned.filter((n) => n.id !== "end");
    const endNode = pruned.find((n) => n.id === "end");
    let finalNodes: Node[] = pruned;
    if (endNode) {
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(keptWithoutEnd) } };
      // replace end in finalNodes
      finalNodes = [...keptWithoutEnd, updatedEnd];
    }

    // --- กรอง edges ให้เหลือเฉพาะที่ source/target ยังอยู่จริงใน finalNodes ---
    const keptIds = new Set(finalNodes.map((n) => n.id));
    const finalEdges = combinedEdges.filter((e) => keptIds.has(e.source) && keptIds.has(e.target));

    // --- ทำ single state updates (ไม่ nested) ---
    setNodes(finalNodes);
    setEdges(finalEdges);

    // ปิด modal / selection ถ้ามี
    setSelectedNode(null);
    setNodeModalPosition(null);
    setSelectedEdge(null);
    setModalPosition(null);

    console.log("✅ frontend updated: node removed and states set");
  } catch (err) {
    console.error("❌ Failed to delete node:", err);
    // แสดง error ให้ user รู้
    alert("ลบ node ไม่สำเร็จ — ตรวจสอบ console/terminal ของ backend ด้วย");
  }
};


  // --- Adding nodes: unified helpers to reduce duplication ---
  const createNode = (typeKey: string, label: string, x = 300, y = 0) => ({ id: genId(), type: typeKey, data: { label }, position: { x, y }, draggable: false } as Node);

  // helper to insert node(s) after an anchor node (used by anchor-insert and end-insert)
  const insertAfter = (
    anchorId: string,
    newNodes: Node[],
    newEdgesToAdd: Edge[],
    nodesOverride?: Node[],
    edgesOverride?: Edge[],
    extraEndOffset = 0
  ) => {
    setNodes((nds) => {
      const startNode = nds.find((n) => n.id === "start");
      const endNode = nds.find((n) => n.id === "end");
      if (!startNode || !endNode) return nds;

      const anchorNode = nds.find((n) => n.id === anchorId) ?? startNode;
      const nodesToMove = nds.filter((n) => n.position.y > anchorNode.position.y);
      const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + stepY } }));
      const remaining = nds.filter((n) => !nodesToMove.some((m) => m.id === n.id) && n.id !== "end");

      const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), ...newNodes];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + extraEndOffset } };

      // apply edges update once
      setEdges((eds) => {
        const baseEdges = edgesOverride ?? eds;
        // remove edges that were outgoing from anchor to replaced targets
        const filtered = baseEdges.filter((e) => !(e.source === anchorId && newEdgesToAdd.some((ne) => ne.target === e.target)));
        return [...filtered, ...newEdgesToAdd];
      });

      return [...combined, updatedEnd];
    });
  };

  // handle adding node when an edge is selected
  const addNodeOnSelectedEdge = (type: string, label: string) => {
    console.log("➕ addNodeOnSelectedEdge called with:", { type, label }, "on edge:", selectedEdge);
    if (!selectedEdge) return;
    const { source, target, sourceHandle, targetHandle } = selectedEdge;
    const sourceNode = nodes.find((n) => n.id === source);
    const targetNode = nodes.find((n) => n.id === target);
    if (!sourceNode || !targetNode) return;

    // loop-insertion case (source === target)
    if (source === target && (sourceNode.type === "while" || sourceNode.type === "for")) {
      const isWhile = sourceNode.type === "while";
      const bodyHandle = isWhile ? "true" : "loop_body";
      const returnHandle = isWhile ? "loop_in" : "loop_return";
      const loopLabel = "True";
      const newX = sourceNode.position.x + 250;
      const newY = sourceNode.position.y + 50;
      const nodesToAdd: Node[] = [];
      const edgesToAdd: Edge[] = [];

      if (type === "if") {
        const ifNode = createNode("if", label, newX, newY);
        const bp = createNode("breakpoint", "", newX + 60, newY + stepY);
        nodesToAdd.push(ifNode, bp);
        edgesToAdd.push(createArrowEdge(sourceNode.id, ifNode.id, { label: loopLabel, sourceHandle: bodyHandle }));
        edgesToAdd.push(createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }));
        edgesToAdd.push(createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }));
        edgesToAdd.push({ ...createArrowEdge(bp.id, sourceNode.id, { targetHandle: returnHandle }), type: "smoothstep" });
      } else {
        const createdType = mapTypeForNode(type) as string;
        const newNode = createNode(createdType, label, newX, newY);
        nodesToAdd.push(newNode);
        edgesToAdd.push(createArrowEdge(sourceNode.id, newNode.id, { label: loopLabel, sourceHandle: bodyHandle }));
        edgesToAdd.push({ ...createArrowEdge(newNode.id, sourceNode.id, { targetHandle: returnHandle }), type: "smoothstep" });
      }

      setNodes((nds) => [...nds, ...nodesToAdd]);
      setEdges((eds) => [...eds.filter((e) => e.id !== selectedEdge.id), ...edgesToAdd]);
      closeModal();
      return;
    }

    // branching from if (right/left handles)
    const isBranchingFromIf = sourceNode.type === "if" && (sourceHandle === "right" || sourceHandle === "left");
    if (isBranchingFromIf) {
      const isTrue = sourceHandle === "right";
      const stepX = 200;
      const offsetX = isTrue ? sourceNode.position.x + stepX : sourceNode.position.x - stepX;
      const baseYEdge = sourceNode.position.y + stepY;

      if (type === "if") {
        const yOffset = stepY * 2;
        const nodesToMove = nodes.filter((n) => n.position.y > sourceNode.position.y);
        const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
        const newIf = createNode("if", label, offsetX, baseYEdge);
        const newBp = createNode("breakpoint", "", offsetX + 60, baseYEdge + stepY);
        const newEdges = [
          createArrowEdge(sourceNode.id, newIf.id, { label: isTrue ? "True" : "False", sourceHandle: sourceHandle ?? undefined }),
          createArrowEdge(newIf.id, newBp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
          createArrowEdge(newIf.id, newBp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
          createArrowEdge(newBp.id, targetNode.id, { targetHandle: targetHandle ?? undefined }),
        ];

        const remaining = nodes.filter((p) => !nodesToMove.some((n) => n.id === p.id) && p.id !== "end");
        const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), newIf, newBp];
        const updatedEnd = { ...(nodes.find((n) => n.id === "end")!), position: { x: 300, y: computeEndY(combined) } };
        setNodes([...combined, updatedEnd]);
        setEdges((eds) => [...eds.filter((e) => e.id !== selectedEdge.id), ...newEdges]);
      } else {
        const yOffset = stepY;
        const nodesToMove = nodes.filter((n) => n.position.y > sourceNode.position.y);
        const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
        const createdType = mapTypeForNode(type) as string;
        const newNode = createNode(createdType, label, offsetX, baseYEdge);
        const newEdges = [
          createArrowEdge(sourceNode.id, newNode.id, { label: isTrue ? "True" : "False", sourceHandle: sourceHandle ?? undefined }),
          createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined }),
        ];
        const remaining = nodes.filter((p) => !nodesToMove.some((n) => n.id === p.id) && p.id !== "end");
        const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), newNode];
        const updatedEnd = { ...(nodes.find((n) => n.id === "end")!), position: { x: 300, y: computeEndY(combined) } };
        setNodes([...combined, updatedEnd]);
        setEdges((eds) => [...eds.filter((e) => e.id !== selectedEdge.id), ...newEdges]);
      }

      closeModal();
      return;
    }

    // default: insert on normal edge
    const yOffset = ["if", "while", "for"].includes(type) ? stepY * 2 : stepY;
    const nodesToMove = nodes.filter((n) => n.position.y > sourceNode.position.y);
    const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));

    let newPosX = sourceNode.position.x;
    if (sourceNode.type === "breakpoint") {
      const incomingEdge = edges.find((e) => e.target === sourceNode.id);
      if (incomingEdge) {
        const parentIf = nodes.find((n) => n.id === incomingEdge.source);
        if (parentIf) newPosX = parentIf.position.x;
      }
    }

    const newNodesToAdd: Node[] = [];
    const newEdgesToAdd: Edge[] = [];

    if (type === "if") {
      const ifNode = createNode("if", label, newPosX, sourceNode.position.y + stepY);
      const bp = createNode("breakpoint", "", newPosX + 73, sourceNode.position.y + stepY * 2);
      newNodesToAdd.push(ifNode, bp);
      newEdgesToAdd.push(
        createArrowEdge(sourceNode.id, ifNode.id, { sourceHandle: sourceHandle ?? undefined }),
        createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
        createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
        createArrowEdge(bp.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
      );
    } else if (type === "while") {
      const whileNode = createNode("while", label, newPosX, sourceNode.position.y + stepY + 60);
      newNodesToAdd.push(whileNode);
      newEdgesToAdd.push(
        createArrowEdge(sourceNode.id, whileNode.id, { sourceHandle: sourceHandle ?? undefined, targetHandle: "top" }),
        createArrowEdge(whileNode.id, targetNode.id, { label: "False", sourceHandle: "false", targetHandle: targetHandle ?? undefined }),
        { ...createArrowEdge(whileNode.id, whileNode.id, { label: "True", sourceHandle: "true", targetHandle: "loop_in" }), type: "smoothstep", pathOptions: { offset: 60 } }
      );
    } else if (type === "for") {
      const forNode = createNode("for", label, newPosX, sourceNode.position.y + stepY + 60);
      newNodesToAdd.push(forNode);
      newEdgesToAdd.push(
        createArrowEdge(sourceNode.id, forNode.id, { sourceHandle: sourceHandle ?? undefined, targetHandle: "top" }),
        createArrowEdge(forNode.id, targetNode.id, { label: "False", sourceHandle: "next", targetHandle: targetHandle ?? undefined }),
        { ...createArrowEdge(forNode.id, forNode.id, { label: "True", sourceHandle: "loop_body", targetHandle: "loop_return" }), type: "smoothstep", pathOptions: { offset: 60 } }
      );
    } else {
      const createdType = mapTypeForNode(type) as string;
      const newNode = createNode(createdType, label, newPosX, sourceNode.position.y + stepY);
      newNodesToAdd.push(newNode);
      newEdgesToAdd.push(createArrowEdge(sourceNode.id, newNode.id, { sourceHandle: sourceHandle ?? undefined }));
      newEdgesToAdd.push(createArrowEdge(newNodesToAdd[0].id, targetNode.id, { targetHandle: targetHandle ?? undefined }));
    }

    const remaining = nodes.filter((p) => !nodesToMove.some((n) => n.id === p.id));
    const combined = [...remaining.filter((n) => n.id !== "end"), ...moved.filter((n) => n.id !== "end"), ...newNodesToAdd];
    const updatedEnd = { ...(nodes.find((n) => n.id === "end")!), position: { x: 300, y: computeEndY(combined) + (["while", "for"].includes(type) ? stepY : 0) } };

    setNodes([...combined, updatedEnd]);
    setEdges((eds) => [...eds.filter((e) => e.id !== selectedEdge.id), ...newEdgesToAdd]);
    console.log(nodes);
    closeModal();
  };

  // add node in general (anchor provided -> insert after anchor, else add to selected edge or at end)
  const addNode = (type: string, label: string, anchorId?: string) => {
    console.log("➕ addNode called with:", { type, label, anchorId });
    const startNode = nodes.find((n) => n.id === "start");
    const endNode = nodes.find((n) => n.id === "end");
    if (!startNode || !endNode) return;

    // anchor-insert
    if (anchorId) {
      const anchorNode = nodes.find((n) => n.id === anchorId);
      if (!anchorNode) return;

      // branch cases: if/while/for have special node sets & edges
      if (type === "if") {
        const ifNode = createNode("if", label, anchorNode.position.x, anchorNode.position.y + stepY);
        const bp = createNode("breakpoint", "", anchorNode.position.x + 73, anchorNode.position.y + stepY + stepY);

        const outgoing = edges.filter((e) => e.source === anchorId);
        const newEdges: Edge[] = [createArrowEdge(anchorId, ifNode.id), createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }), createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" })];
        if (outgoing.length === 0) newEdges.push(createArrowEdge(bp.id, endNode.id));
        else outgoing.forEach((o) => newEdges.push(createArrowEdge(bp.id, o.target, { targetHandle: o.targetHandle ?? undefined })));

        // remove outgoing edges from anchor
        setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some((o) => o.target === e.target))), ...newEdges]);
        insertAfter(anchorId, [ifNode, bp], newEdges);
        return;
      }

      if (type === "while" || type === "for") {
        const kind = type;
        const loopNode = createNode(kind, label, anchorNode.position.x, anchorNode.position.y + stepY + 60);
        const outgoing = edges.filter((e) => e.source === anchorId);
        const newEdges: Edge[] = [];
        newEdges.push(createArrowEdge(anchorId, loopNode.id, { targetHandle: "top" }));
        if (outgoing.length === 0) newEdges.push(createArrowEdge(loopNode.id, endNode.id, { label: "False", sourceHandle: type === "while" ? "false" : "next" }));
        else outgoing.forEach((o) => newEdges.push(createArrowEdge(loopNode.id, o.target, { label: "False", sourceHandle: type === "while" ? "false" : "next", targetHandle: o.targetHandle ?? undefined })));
        newEdges.push({ ...createArrowEdge(loopNode.id, loopNode.id, { label: "True", sourceHandle: type === "while" ? "true" : "loop_body", targetHandle: type === "while" ? "loop_in" : "loop_return" }), type: "smoothstep", animated: true, pathOptions: { offset: 60 } });

        setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some((o) => o.target === e.target))), ...newEdges]);
        insertAfter(anchorId, [loopNode], newEdges, undefined, undefined, stepY);
        return;
      }

      // default insert
      const createdType = mapTypeForNode(type) as string;
      const newNode = createNode(createdType, label, anchorNode.position.x, anchorNode.position.y + stepY);
      const outgoing = edges.filter((e) => e.source === anchorId);
      const newEdgesForInsert: Edge[] = [createArrowEdge(anchorId, newNode.id)];
      if (outgoing.length === 0) newEdgesForInsert.push(createArrowEdge(newNode.id, endNode.id));
      else outgoing.forEach((o) => newEdgesForInsert.push(createArrowEdge(newNode.id, o.target, { targetHandle: o.targetHandle ?? undefined })));

      setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some((o) => o.target === e.target))), ...newEdgesForInsert]);
      insertAfter(anchorId, [newNode], newEdgesForInsert);
      return;
    }

    // if there's a selected edge -> insert on edge
    if (selectedEdge) {
      addNodeOnSelectedEdge(type, label);
      return;
    }

    // otherwise add to end
    const middleNodes = nodes.filter((n) => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || nodes.find((n) => n.id === "start")!;
    const baseY = (nodes.find((n) => n.id === "start")!.position.y) + stepY * (middleNodes.length + 1);

    if (type === "if") {
      const yOffset = stepY * 2;
      const nodesToMove = nodes.filter((n) => n.position.y > previousNode.position.y);
      const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      const ifNode = createNode("if", label, 300, baseY);
      const bp = createNode("breakpoint", "", 360, baseY + stepY);
      const newEdges = [createArrowEdge(previousNode.id, ifNode.id), createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }), createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }), createArrowEdge(bp.id, nodes.find((n) => n.id === "end")!.id)];
      const remaining = nodes.filter((p) => !nodesToMove.some((n) => n.id === p.id) && p.id !== "end");
      const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), ifNode, bp];
      const updatedEnd = { ...(nodes.find((n) => n.id === "end")!), position: { x: 300, y: computeEndY(combined) } };
      setNodes([...combined, updatedEnd]);
      setEdges((eds) => [...eds.filter((e) => !(e.source === previousNode.id && e.target === nodes.find((n) => n.id === "end")!.id)), ...newEdges]);
      return;
    }

    if (type === "while" || type === "for") {
      const kind = type;
      const yOffset = stepY;
      const nodesToMove = nodes.filter((n) => n.position.y > previousNode.position.y);
      const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      const loopNode = createNode(kind, label, 300, baseY);
      const newEdges: Edge[] = [createArrowEdge(previousNode.id, loopNode.id, { targetHandle: "top" }), createArrowEdge(loopNode.id, nodes.find((n) => n.id === "end")!.id, { label: "False", sourceHandle: type === "while" ? "false" : "next" }), { ...createArrowEdge(loopNode.id, loopNode.id, { label: "True", sourceHandle: type === "while" ? "true" : "loop_body", targetHandle: type === "while" ? "loop_in" : "loop_return" }), type: "smoothstep", animated: true, pathOptions: { offset: 60 } }];
      const remaining = nodes.filter((p) => !nodesToMove.some((n) => n.id === p.id) && p.id !== "end");
      const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), loopNode];
      const updatedEnd = { ...(nodes.find((n) => n.id === "end")!), position: { x: 300, y: computeEndY(combined) + stepY } };
      setNodes([...combined, updatedEnd]);
      setEdges((eds) => [...eds.filter((e) => !(e.source === previousNode.id && e.target === nodes.find((n) => n.id === "end")!.id)), ...newEdges]);
      return;
    }

    // default append
    const yOffset = stepY;
    const nodesToMove = nodes.filter((n) => n.position.y > previousNode.position.y);
    const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
    const createdType = mapTypeForNode(type) as string;
    const newNode = createNode(createdType, label, 300, baseY);
    const newEdges = [createArrowEdge(previousNode.id, newNode.id), createArrowEdge(newNode.id, nodes.find((n) => n.id === "end")!.id)];
    const remaining = nodes.filter((p) => !nodesToMove.some((n) => n.id === p.id) && p.id !== "end");
    const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), newNode];
    const updatedEnd = { ...(nodes.find((n) => n.id === "end")!), position: { x: nodes.find((n) => n.id === "end")!.position.x, y: computeEndY(combined) } };
    setNodes([...combined, updatedEnd]);
    setEdges((eds) => [...eds.filter((e) => !(e.source === previousNode.id && e.target === nodes.find((n) => n.id === "end")!.id)), ...newEdges]);
    console.log(nodes);
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
          onNodesChange={(changes) => {
            console.log("⚙️ Node Changes:", changes); // 3. Log การเปลี่ยนแปลงภายใน
            onNodesChange(changes);
          }}
          onEdgesChange={(changes) => {
            console.log("⚙️ Edge Changes:", changes); // 3. Log การเปลี่ยนแปลงภายใน
            onEdgesChange(changes);
          }}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView={false}
          defaultViewport={{ x: 600, y: 150, zoom: 1 }}
          nodeTypes={{
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
          }}
          onEdgeClick={onEdgeClick}
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>

      {/* Edge modal (existing) */}
      {selectedEdge && modalPosition && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div
            style={{ top: modalPosition.y, left: modalPosition.x }}
            className="absolute"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection edge={selectedEdge} onAddNode={(type, label) => addNode(type, label)} onDeleteNode={deleteNodeAndReconnect} />
          </div>
        </div>
      )}

      {/* Node edit modal (NEW) */}
      {selectedNode && nodeModalPosition && (
        <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={() => { setSelectedNode(null); setNodeModalPosition(null); }}>
          <div
            style={{ marginTop: nodeModalPosition.y }}
            className="absolute"
            onClick={(e) => e.stopPropagation()}
          >
            <SymbolSection
              nodeToEdit={selectedNode}
              onUpdateNode={(id, type, label) => handleUpdateNode(id, type, label)}
              onDeleteNode={(id) => deleteNodeAndReconnect(id)}
              onCloseModal={() => { setSelectedNode(null); setNodeModalPosition(null); }}
              onAddNode={(type, label) => addNode(type, label, selectedNode.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartEditor;