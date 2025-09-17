// File: app/flowchart/FlowchartEditor.tsx
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
import ForNodeComponent from "./_components/ForNodeComponent";

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

  // NEW: selected node for editing
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeModalPosition, setNodeModalPosition] = useState<{ x: number; y: number } | null>(null);

  // --- Helper Functions ---
  const computeEndY = (allNodes: Node[]) => {
    const maxY = allNodes
      .filter((n) => n.id !== "end")
      .reduce((m, n) => Math.max(m, n.position.y), 0);
    return maxY + stepY;
  };

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => {
        const connEdge: Edge = {
          ...connection,
          animated: true,
          type: "smoothstep",
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

  // NEW: handle node click for editing
  const onNodeClick = (event: React.MouseEvent, node: Node) => {
    event.stopPropagation();
    // don't open edit for start/end if you don't want
    if (node.id === "start" || node.id === "end") return;
    setSelectedNode(node);
    // center modal approx
    setNodeModalPosition({ x: window.innerWidth / 2 - 220, y: window.innerHeight / 2 - 150 });
  };

  // NEW: update node handler
  const handleUpdateNode = (id: string, type: string, label: string) => {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label }, type: mapTypeForNode(type, n.type) } : n)));
    // close node modal
    setSelectedNode(null);
    setNodeModalPosition(null);
  };

  const mapTypeForNode = (type: string, prevType: string | undefined) => {
    // keep consistent mapping between symbol types and node.type used by ReactFlow
    if (type === "if") return "ifNode";
    if (type === "while") return "whileNode";
    if (type === "for") return "forNode";
    // input/output/declare/assign use those exact keys in your nodeTypes
    if (type === "input" || type === "output" || type === "declare" || type === "assign") return type;
    // fallback keep previous type
    return prevType ?? type;
  };

  // --- Delete node + auto-reconnect ---
  const deleteNodeAndReconnect = (nodeId: string) => {
    setNodes((nds) => {
      const nodeToDelete = nds.find((n) => n.id === nodeId);
      if (!nodeToDelete) return nds;

      setEdges((eds) => {
        // outgoing and incoming
        const incoming = eds.filter((e) => e.target === nodeId);
        const outgoing = eds.filter((e) => e.source === nodeId);

        // create new edges connecting each incoming.source -> each outgoing.target
        const newEdges: Edge[] = [];
        incoming.forEach((inE) => {
          outgoing.forEach((outE) => {
            // skip if connecting start->end duplicates existing
            if (inE.source === outE.target) return;
            newEdges.push(createArrowEdge(inE.source, outE.target));
          });
        });

        // remove edges that touch the deleted node
        let remaining = eds.filter((e) => e.source !== nodeId && e.target !== nodeId);
        // add newly created connecting edges
        remaining = [...remaining, ...newEdges];

        // After removing the node, also remove any nodes that become unreachable from start
        // We'll compute reachable nodes from start using the remaining edges
        const adjacency = new Map<string, string[]>();
        remaining.forEach((e) => {
          if (!adjacency.has(e.source)) adjacency.set(e.source, []);
          adjacency.get(e.source)!.push(e.target);
        });

        const visited = new Set<string>();
        const stack = ["start"];
        while (stack.length) {
          const cur = stack.pop()!;
          if (visited.has(cur)) continue;
          visited.add(cur);
          const neighbors = adjacency.get(cur) ?? [];
          neighbors.forEach((nb) => {
            if (!visited.has(nb)) stack.push(nb);
          });
        }

        // remove nodes not visited (but keep end even if disconnected?)
        setNodes((currentNodes) => {
          const kept = currentNodes.filter((n) => visited.has(n.id) || n.id === "end");
          // also ensure there are no edges referencing removed nodes
          const keptIds = new Set(kept.map((n) => n.id));
          setEdges((esAfterPrune) => esAfterPrune.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)));

          // update end position to reflect current nodes
          const endNode = kept.find((n) => n.id === "end");
          if (endNode) {
            const combined = kept.filter((n) => n.id !== "end");
            const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
            return [...combined, updatedEnd];
          }

          return kept;
        });

        return remaining;
      });

      // finally remove the node from node list
      return nds.filter((n) => n.id !== nodeId);
    });

    // close any open modal
    setSelectedNode(null);
    setNodeModalPosition(null);
  };

  // --- Core Logic: Add Node Function ---
  // now accepts optional anchorId: when provided, insert after that node (autoconnect)
  const addNode = (type: string, label: string, anchorId?: string) => {
    const startNode = nodes.find((n) => n.id === "start");
    const endNode = nodes.find((n) => n.id === "end");
    if (!startNode || !endNode) return;

    const nodeKind = (type === "input" || type === "output" || type === "declare" || type === "assign") ? type : type;

    // Helper to create basic node
    const createBasicNode = (createdType: string, id?: string, pos?: { x: number; y: number }) => ({ id: id ?? crypto.randomUUID(), type: createdType, data: { label }, position: pos ?? { x: 300, y: 0 }, draggable: false });

    // If anchorId provided -> insert after that node (auto-reconnect incoming/outgoing)
    if (anchorId) {
      const anchorNode = nodes.find((n) => n.id === anchorId);
      if (!anchorNode) return;

      // compute new node position below anchor
      const newPosY = anchorNode.position.y + stepY;
      const newPosX = anchorNode.position.x;

      // find outgoing edges from anchor
      const outgoing = edges.filter((e) => e.source === anchorId);

      // shift nodes below anchor downward
      const nodesToMove = nodes.filter((n) => n.position.y > anchorNode.position.y);
      const movedNodes = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + stepY } }));
      const remainingNodes = nodes.filter((n) => !nodesToMove.some((m) => m.id === n.id) && n.id !== "end");

      if (type === "if") {
        const ifNode = { id: crypto.randomUUID(), type: "ifNode", data: { label }, position: { x: newPosX, y: newPosY }, draggable: false };
        const breakpoint = { id: crypto.randomUUID(), type: "breakpointNode", data: { label: "" }, position: { x: newPosX + 73, y: newPosY + stepY }, draggable: false };

        // create edges: anchor->if, if->breakpoint(true/false), breakpoint->each old outgoing target
        const newEdges: Edge[] = [];
        newEdges.push(createArrowEdge(anchorId, ifNode.id));
        newEdges.push(createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }));
        newEdges.push(createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" }));
        if (outgoing.length === 0) {
          newEdges.push(createArrowEdge(breakpoint.id, endNode.id));
        } else {
          outgoing.forEach((o) => {
            newEdges.push(createArrowEdge(breakpoint.id, o.target, { targetHandle: o.targetHandle ?? undefined }));
          });
        }

        // remove old outgoing edges from anchor
        setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some(o => o.target === e.target))), ...newEdges]);

        const combined = [...remainingNodes.filter(n => n.id !== 'end'), ...movedNodes.filter(n => n.id !== 'end'), ifNode, breakpoint];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) } };
        setNodes([...combined, updatedEnd]);
        return;
      }

      if (type === 'while') {
        const whileNode = { id: crypto.randomUUID(), type: 'whileNode', data: { label }, position: { x: newPosX, y: newPosY + 60 }, draggable: false };
        const newEdges: Edge[] = [];
        newEdges.push(createArrowEdge(anchorId, whileNode.id, { targetHandle: 'top' }));
        // connect while false to old outgoing targets or end
        if (outgoing.length === 0) newEdges.push(createArrowEdge(whileNode.id, endNode.id, { label: 'False' }));
        else outgoing.forEach((o) => newEdges.push(createArrowEdge(whileNode.id, o.target, { label: 'False', targetHandle: o.targetHandle ?? undefined })));
        newEdges.push({ ...createArrowEdge(whileNode.id, whileNode.id, { label: 'True', sourceHandle: 'true', targetHandle: 'loop_in' }), type: 'smoothstep', animated: true, pathOptions: { offset: 60 } });

        setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some(o => o.target === e.target))), ...newEdges]);

        const combined = [...remainingNodes.filter(n => n.id !== 'end'), ...movedNodes.filter(n => n.id !== 'end'), whileNode];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + stepY } };
        setNodes([...combined, updatedEnd]);
        return;
      }

      if (type === 'for') {
        const forNode = { id: crypto.randomUUID(), type: 'forNode', data: { label }, position: { x: newPosX, y: newPosY + 60 }, draggable: false };
        const newEdges: Edge[] = [];
        newEdges.push(createArrowEdge(anchorId, forNode.id, { targetHandle: 'top' }));
        if (outgoing.length === 0) newEdges.push(createArrowEdge(forNode.id, endNode.id, { label: 'False', sourceHandle: 'next' }));
        else outgoing.forEach((o) => newEdges.push(createArrowEdge(forNode.id, o.target, { label: 'False', sourceHandle: 'next', targetHandle: o.targetHandle ?? undefined })));
        newEdges.push({ ...createArrowEdge(forNode.id, forNode.id, { label: 'True', sourceHandle: 'loop_body', targetHandle: 'loop_return' }), type: 'smoothstep', animated: true, pathOptions: { offset: 60 } });

        setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some(o => o.target === e.target))), ...newEdges]);

        const combined = [...remainingNodes.filter(n => n.id !== 'end'), ...movedNodes.filter(n => n.id !== 'end'), forNode];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + stepY } };
        setNodes([...combined, updatedEnd]);
        return;
      }

      // default insertion (input/output/declare/assign or general node)
      const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
      const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: newPosX, y: newPosY }, draggable: false };

      // create new edges: anchor->newNode, newNode->each old target (or end if none)
      const newEdgesForInsert: Edge[] = [];
      newEdgesForInsert.push(createArrowEdge(anchorId, newNode.id));
      if (outgoing.length === 0) newEdgesForInsert.push(createArrowEdge(newNode.id, endNode.id));
      else outgoing.forEach((o) => newEdgesForInsert.push(createArrowEdge(newNode.id, o.target, { targetHandle: o.targetHandle ?? undefined })));

      setEdges((eds) => [...eds.filter((e) => !(e.source === anchorId && outgoing.some(o => o.target === e.target))), ...newEdgesForInsert]);

      const combinedDefault = [...remainingNodes.filter(n => n.id !== 'end'), ...movedNodes.filter(n => n.id !== 'end'), newNode];
      const updatedEndDefault = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combinedDefault) } };
      setNodes([...combinedDefault, updatedEndDefault]);

      return;
    }

    // ===================================================================================
    // CASE 1: Add node on a selected edge
    // ===================================================================================
    if (selectedEdge) {
      const { source, target, sourceHandle, targetHandle } = selectedEdge;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return;

      // --- Special Case: Adding node inside a 'while' or 'for' loop ---
      if (source === target && (sourceNode.type === 'whileNode' || sourceNode.type === 'forNode')) {
        let newNodesToAdd: Node[] = [];
        let newEdgesToAdd: Edge[] = [];
        let lastNodeInLoopId = '';
        const newX = sourceNode.position.x + 250;
        const newY = sourceNode.position.y + 50;

        // --- MODIFIED: Determine correct handles for while/for ---
        const isWhileNode = sourceNode.type === 'whileNode';
        const loopBodyHandle = isWhileNode ? 'true' : 'loop_body';
        const loopReturnHandle = isWhileNode ? 'loop_in' : 'loop_return';
        const loopLabel = "True";

        if (type === 'if') {
          const ifNode = { id: crypto.randomUUID(), type: 'ifNode', data: { label }, position: { x: newX, y: newY }, draggable: false };
          const breakpoint = { id: crypto.randomUUID(), type: 'breakpointNode', data: { label: '' }, position: { x: newX + 60, y: newY + stepY }, draggable: false };
          newNodesToAdd.push(ifNode, breakpoint);
          lastNodeInLoopId = breakpoint.id;
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, ifNode.id, { label: loopLabel, sourceHandle: loopBodyHandle }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
            createArrowEdge(ifNode.id, breakpoint.id, { label: "False", sourceHandle: "left", targetHandle: "false" })
          );
        } else {
          const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
          const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: newX, y: newY }, draggable: false };
          newNodesToAdd.push(newNode);
          lastNodeInLoopId = newNode.id;
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, newNode.id, { label: loopLabel, sourceHandle: loopBodyHandle })
          );
        }

        newEdgesToAdd.push({
          ...createArrowEdge(lastNodeInLoopId, sourceNode.id, { targetHandle: loopReturnHandle }),
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
          const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: offsetX, y: baseYEdge }, draggable: false };
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
        // --- MODIFIED: Include 'for' in yOffset calculation ---
        const yOffset = (type === 'if' || type === 'while' || type === 'for') ? stepY * 2 : stepY;
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
        } 
        // --- ADDED LOGIC FOR 'for' LOOP ---
        else if (type === 'for') {
            const forNode = { id: crypto.randomUUID(), type: 'forNode', data: { label }, position: { x: newPosX, y: sourceNode.position.y + stepY + 60 }, draggable: false };
            newNodesToAdd.push(forNode);
            newEdgesToAdd.push(
                createArrowEdge(sourceNode.id, forNode.id, { sourceHandle: sourceHandle ?? undefined, targetHandle: "top" }),
                createArrowEdge(forNode.id, targetNode.id, { label: "False", sourceHandle: "next", targetHandle: targetHandle ?? undefined }),
                {
                    ...createArrowEdge(forNode.id, forNode.id, { label: "True", sourceHandle: "loop_body", targetHandle: "loop_return" }),
                    type: 'smoothstep',
                    pathOptions: { offset: 60 }
                }
            );
        }
        else {
          const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
          const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: newPosX, y: sourceNode.position.y + stepY }, draggable: false };
          newNodesToAdd.push(newNode);
          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, newNode.id, { sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
          );
        }

        const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id));
        combinedNodes = [...remainingNodes.filter(n => n.id !== 'end'), ...movedNodes.filter(n => n.id !== 'end'), ...newNodesToAdd];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combinedNodes) + ((type === 'while' || type === 'for') ? stepY : 0) } };
        
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
    } 
    // --- ADDED LOGIC FOR 'for' LOOP ---
    else if (type === 'for') {
        const yOffset = stepY;
        const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y);
        const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
        const forNode = { id: crypto.randomUUID(), type: 'forNode', data: { label }, position: { x: 300, y: baseY }, draggable: false };
        const newEdges = [
            createArrowEdge(previousNode.id, forNode.id, { targetHandle: "top" }),
            createArrowEdge(forNode.id, endNode.id, { label: "False", sourceHandle: "next" }),
            {
                ...createArrowEdge(forNode.id, forNode.id, { label: "True", sourceHandle: "loop_body", targetHandle: "loop_return" }),
                type: 'smoothstep',
                animated: true,
                pathOptions: { offset: 60 }
            }
        ];
        const remainingNodes = nodes.filter(p => !nodesToMove.some(n => n.id === p.id) && p.id !== "end");
        const combined = [...remainingNodes, ...movedNodes.filter(n => n.id !== 'end'), forNode];
        const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + stepY } };
        setNodes([...combined, updatedEnd]);
        setEdges([...edges.filter(e => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
    }
    else {
      const yOffset = stepY;
      const nodesToMove = nodes.filter(n => n.position.y > previousNode.position.y);
      const movedNodes = nodesToMove.map(n => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      const createdType = (nodeKind === "input" || nodeKind === "output" || nodeKind === "declare" || nodeKind === "assign") ? nodeKind : "default";
      const newNode = { id: crypto.randomUUID(), type: createdType, data: { label }, position: { x: 300, y: baseY }, draggable: false };
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
          onNodeClick={onNodeClick} // NEW: bind handler
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
            assign: AssignComponent,
            forNode: ForNodeComponent,
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


