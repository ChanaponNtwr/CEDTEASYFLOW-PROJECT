// File: app/flowchart/hooks/useNodeMutations.ts
import { useCallback } from "react";
import { Connection, Node, Edge, addEdge, MarkerType } from "@xyflow/react";

// 1. IMPORT API SERVICE
import { insertNode } from "@/app/service/FlowchartService";

import {
  stepY,
  genId,
  computeEndY,
  mapTypeForNode,
  reconnectAroundDeleted,
  removeEdgesTouching,
  pruneUnreachableNodes,
  createArrowEdge,
} from "../utils/flowchartUtils";

type UseNodeMutationsProps = {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node<any, string | undefined>[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<any>[]>>;
  selectedEdge: Edge | null;
  closeModal: () => void;
  closeNodeModal: () => void;
  flowchartId: string; // **เพิ่ม flowchartId เข้ามาใน props**
};

// 2. HELPER FUNCTION TO UPDATE UI FROM API RESPONSE
const applyDiffs = (diffs, setNodes, setEdges) => {
  if (!diffs) return;

  const mapBackendNodeToFrontend = (node) => ({
    ...node,
    position: node.position || { x: 300, y: 300 },
    data: { ...node.data, label: node.label },
  });

  const mapBackendEdgeToFrontend = (edge) => ({
    ...edge,
    id: edge.id || `e-${edge.source}-${edge.target}-${Math.random()}`,
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    type: "smoothstep",
  });

  if (diffs.nodes) {
    setNodes((currentNodes) => {
      const removedIds = new Set(diffs.nodes.removed?.map((n) => n.id) || []);
      let newNodes = currentNodes.filter((n) => !removedIds.has(n.id));

      const updatedMap = new Map(diffs.nodes.updated?.map((n) => [n.id, mapBackendNodeToFrontend(n)]) || []);
      newNodes = newNodes.map((n) => updatedMap.get(n.id) || n);

      if (diffs.nodes.added) {
        newNodes.push(...diffs.nodes.added.map(mapBackendNodeToFrontend));
      }
      return newNodes;
    });
  }

  if (diffs.edges) {
    setEdges((currentEdges) => {
      const removedIds = new Set(diffs.edges.removed?.map((e) => e.id) || []);
      let newEdges = currentEdges.filter((e) => !removedIds.has(e.id));

      const updatedMap = new Map(diffs.edges.updated?.map((e) => [e.id, mapBackendEdgeToFrontend(e)]) || []);
      newEdges = newEdges.map((e) => updatedMap.get(e.id) || e);

      if (diffs.edges.added) {
        newEdges.push(...diffs.edges.added.map(mapBackendEdgeToFrontend));
      }
      return newEdges;
    });
  }
};

export const useNodeMutations = ({
  nodes,
  setNodes,
  edges,
  setEdges,
  selectedEdge,
  closeModal,
  closeNodeModal,
  flowchartId,
}: UseNodeMutationsProps) => {
  
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
    }, [setEdges]
  );
  
  const handleUpdateNode = useCallback((id: string, type: string, label: string) => {
    console.log("📝 handleUpdateNode called with:", { id, type, label });
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label }, type: mapTypeForNode(type, n.type) } : n)));
    closeNodeModal();
  }, [setNodes, closeNodeModal]);

  const deleteNodeAndReconnect = useCallback((nodeId: string) => {
    console.log("🗑️ deleteNodeAndReconnect called for nodeId:", nodeId);
    setNodes((nds) => {
      const nodeToDelete = nds.find((n) => n.id === nodeId);
      if (!nodeToDelete) return nds;
      setEdges((eds) => {
        const newEdgesFromReconnect = reconnectAroundDeleted(eds, nodeId);
        let remaining = removeEdgesTouching(eds, nodeId);
        remaining = [...remaining, ...newEdgesFromReconnect];
        setNodes((currentNodes) => {
          const kept = pruneUnreachableNodes(currentNodes, remaining);
          const keptIds = new Set(kept.map((n) => n.id));
          setEdges((esAfterPrune) => esAfterPrune.filter((e) => keptIds.has(e.source) && keptIds.has(e.target)));
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
      return nds.filter((n) => n.id !== nodeId);
    });
    closeNodeModal();
  }, [setNodes, setEdges, closeNodeModal]);
  
  const createNode = useCallback((typeKey: string, label: string, x = 300, y = 0) => 
    ({ id: genId(), type: typeKey, data: { label }, position: { x, y }, draggable: false } as Node), []);

  const insertAfter = useCallback((anchorId: string, newNodes: Node[], newEdgesToAdd: Edge[], nodesOverride?: Node[], edgesOverride?: Edge[], extraEndOffset = 0) => {
    setNodes((nds) => {
      const allNodes = nodesOverride ?? nds;
      const startNode = allNodes.find((n) => n.id === "start");
      const endNode = allNodes.find((n) => n.id === "end");
      if (!startNode || !endNode) return allNodes;
      const anchorNode = allNodes.find((n) => n.id === anchorId) ?? startNode;
      const nodesToMove = allNodes.filter((n) => n.position.y > anchorNode.position.y);
      const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + stepY } }));
      const remaining = allNodes.filter((n) => !nodesToMove.some((m) => m.id === n.id) && n.id !== "end");
      const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), ...newNodes];
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + extraEndOffset } };
      setEdges((eds) => {
        const baseEdges = edgesOverride ?? eds;
        const filtered = baseEdges.filter((e) => !(e.source === anchorId && newEdgesToAdd.some((ne) => ne.target === e.target)));
        return [...filtered, ...newEdgesToAdd];
      });
      return [...combined, updatedEnd];
    });
  }, [setNodes, setEdges]);
  
  const addNodeOnSelectedEdge = useCallback(async (type: string, label: string) => {
    if (!selectedEdge) return;

    const mapFrontendTypeToBackend = (t: string) => {
      const map = {
        input: 'IN', output: 'OUT', assign: 'AS', declare: 'DE',
        if: 'IF', while: 'WHILE', for: 'FOR',
      };
      return map[t] || t.toUpperCase();
    };

    const nodePayload = {
      type: mapFrontendTypeToBackend(type),
      label: label,
      data: {
        variable: "newVar",
        prompt: "Enter value",
        varType: "string",
      },
    };

    const edgeId = selectedEdge.id;

    try {
      console.log("Calling insertNode API with:", { flowchartId, edgeId, node: nodePayload });
      const response = await insertNode(flowchartId, edgeId, nodePayload);

      if (response && response.ok) {
        console.log("API call successful, applying diffs:", response.diffs);
        applyDiffs(response.diffs, setNodes, setEdges);
      } else {
        console.error("API call failed:", response?.message);
        alert(`Error: ${response?.message || "Failed to insert node"}`);
      }
    } catch (error) {
      console.error("Error inserting node:", error);
      alert(`An error occurred: ${error.message}`);
    } finally {
      closeModal();
    }
  }, [selectedEdge, flowchartId, setNodes, setEdges, closeModal]);
  
  const addNode = useCallback((type: string, label: string, anchorId?: string) => {
    if (selectedEdge) {
      addNodeOnSelectedEdge(type, label);
      return;
    }

    const startNode = nodes.find((n) => n.id === "start");
    const endNode = nodes.find((n) => n.id === "end");
    if (!startNode || !endNode) return;

    if (anchorId) {
      const anchorNode = nodes.find((n) => n.id === anchorId);
      if (!anchorNode) return;

      if (type === "if") {
        const ifNode = createNode("if", label, anchorNode.position.x, anchorNode.position.y + stepY);
        const bp = createNode("breakpoint", "", anchorNode.position.x + 73, anchorNode.position.y + stepY + stepY);
        const outgoing = edges.filter((e) => e.source === anchorId);
        const newEdges: Edge[] = [createArrowEdge(anchorId, ifNode.id), createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }), createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" })];
        if (outgoing.length === 0) newEdges.push(createArrowEdge(bp.id, endNode.id));
        else outgoing.forEach((o) => newEdges.push(createArrowEdge(bp.id, o.target, { targetHandle: o.targetHandle ?? undefined })));
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
    
    const middleNodes = nodes.filter((n) => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || nodes.find((n) => n.id === "start")!;
    const baseY = (nodes.find((n) => n.id === "start")!.position.y) + stepY * (middleNodes.length + 1);

    if (type === "if") {
      const ifNode = createNode("if", label, 300, baseY);
      const bp = createNode("breakpoint", "", 360, baseY + stepY);
      const newEdges = [createArrowEdge(previousNode.id, ifNode.id), createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }), createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }), createArrowEdge(bp.id, nodes.find((n) => n.id === "end")!.id)];
      const updatedNodes = [...nodes.filter(n => n.id !== 'end'), ifNode, bp, {...endNode, position: {x: 300, y: computeEndY([...nodes, ifNode, bp])}}];
      setNodes(updatedNodes);
      setEdges((eds) => [...eds.filter((e) => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
      return;
    }
    if (type === "while" || type === "for") {
      const loopNode = createNode(type, label, 300, baseY);
      const newEdges: Edge[] = [
        createArrowEdge(previousNode.id, loopNode.id, { targetHandle: "top" }),
        createArrowEdge(loopNode.id, endNode.id, { label: "False", sourceHandle: type === "while" ? "false" : "next" }),
        { ...createArrowEdge(loopNode.id, loopNode.id, { label: "True", sourceHandle: type === "while" ? "true" : "loop_body", targetHandle: type === "while" ? "loop_in" : "loop_return" }), type: "smoothstep", animated: true, pathOptions: { offset: 60 } }
      ];
      const updatedNodes = [...nodes.filter(n => n.id !== 'end'), loopNode, {...endNode, position: {x: 300, y: computeEndY([...nodes, loopNode]) + stepY}}];
      setNodes(updatedNodes);
      setEdges(eds => [...eds.filter(e => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
      return;
    }
    const newNode = createNode(mapTypeForNode(type), label, 300, baseY);
    const newEdges = [createArrowEdge(previousNode.id, newNode.id), createArrowEdge(newNode.id, endNode.id)];
    const updatedNodes = [...nodes.filter(n => n.id !== 'end'), newNode, {...endNode, position: {x: 300, y: computeEndY([...nodes, newNode])}}];
    setNodes(updatedNodes);
    setEdges(eds => [...eds.filter(e => !(e.source === previousNode.id && e.target === endNode.id)), ...newEdges]);
    
  }, [nodes, edges, selectedEdge, addNodeOnSelectedEdge, createNode, insertAfter, setEdges, setNodes, flowchartId]);

  return { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode, addNodeOnSelectedEdge };
};