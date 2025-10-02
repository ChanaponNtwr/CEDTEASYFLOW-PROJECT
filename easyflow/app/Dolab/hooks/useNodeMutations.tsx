// File: app/flowchart/hooks/useNodeMutations.tsx
// Hook ที่ซับซ้อนที่สุด รับผิดชอบ Logic การเปลี่ยนแปลงข้อมูลทั้งหมด เช่น การเพิ่ม, ลบ, แก้ไข Node และ Edge

import { useCallback } from "react";
import { Connection, Node, Edge, addEdge, MarkerType } from "@xyflow/react";

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
  findReachableNodeIds, // Import ฟังก์ชันใหม่
} from "../utils/flowchartUtils";

type UseNodeMutationsProps = {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node<any, string | undefined>[]>>;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge<any>[]>>;
  selectedEdge: Edge | null;
  closeModal: () => void;
  closeNodeModal: () => void;
};

export const useNodeMutations = ({ nodes, setNodes, edges, setEdges, selectedEdge, closeModal, closeNodeModal }: UseNodeMutationsProps) => {

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

  const insertAfter = useCallback((
    anchorId: string,
    splitTargetId: string | null, // Node ปลายทางของเส้นที่ถูกแทรก
    newNodes: Node[],
    newEdgesToAdd: Edge[],
    edgeToRemoveId?: string | null,
    nodesOverride?: Node[],
    edgesOverride?: Edge[],
    extraEndOffset = 0
  ) => {
    setNodes((nds) => {
      const allNodes = nodesOverride ?? nds;
      const allEdges = edgesOverride ?? edges;

      const startNode = allNodes.find((n) => n.id === "start");
      const endNode = allNodes.find((n) => n.id === "end");
      if (!startNode || !endNode) return allNodes;

      const anchorNode = allNodes.find((n) => n.id === anchorId) ?? startNode;
      
      const yOffset = newNodes.reduce((acc, node) => {
          if (node.type === 'if') return acc + stepY * 2;
          if (node.type === 'while' || node.type === 'for') return acc + stepY * 2;
          return acc + stepY;
      }, 0);

      // --- LOGIC ใหม่: ใช้ Graph Traversal เพื่อหา Node ที่ต้องขยับ ---
      const nodesToMoveIds = splitTargetId 
        ? findReachableNodeIds(splitTargetId, allEdges)
        : new Set(allNodes.filter(n => n.position.y > anchorNode.position.y).map(n => n.id));
      
      const nodesToMove = allNodes.filter((n) => nodesToMoveIds.has(n.id));
      const moved = nodesToMove.map((n) => ({ ...n, position: { ...n.position, y: n.position.y + yOffset } }));
      const remaining = allNodes.filter((n) => !nodesToMoveIds.has(n.id) && n.id !== "end");

      const combined = [...remaining, ...moved.filter((n) => n.id !== "end"), ...newNodes];
      const finalEndOffset = extraEndOffset + (["while", "for"].includes(newNodes[0]?.type ?? '') ? stepY : 0);
      const updatedEnd = { ...endNode, position: { x: endNode.position.x, y: computeEndY(combined) + finalEndOffset } };

      setEdges((eds) => {
        let baseEdges = edgesOverride ?? eds;
        let filtered = edgeToRemoveId ? baseEdges.filter((e) => e.id !== edgeToRemoveId) : baseEdges;
        return [...filtered, ...newEdgesToAdd];
      });

      return [...combined, updatedEnd];
    });
  }, [setNodes, setEdges, edges]);
  
  const addNodeOnSelectedEdge = useCallback((type: string, label: string) => {
      if (!selectedEdge) return;
      
      const { source, target, sourceHandle, targetHandle } = selectedEdge;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);

      if (!sourceNode || !targetNode) return;

      const newNodesToAdd: Node[] = [];
      const newEdgesToAdd: Edge[] = [];
      let newPosX = sourceNode.position.x;
      let extraYOffset = 0;

      if (sourceNode.type === "breakpoint") {
        const incomingEdge = edges.find((e) => e.target === sourceNode.id);
        const parentIf = nodes.find((n) => n.id === incomingEdge?.source);
        if (parentIf) newPosX = parentIf.position.x;
      }
      
      const baseY = sourceNode.position.y + stepY;

      if (type === "if") {
        const ifNode = createNode("if", label, newPosX, baseY);
        const bp = createNode("breakpoint", "", newPosX + 73, baseY + stepY);
        newNodesToAdd.push(ifNode, bp);
        newEdgesToAdd.push(
          createArrowEdge(sourceNode.id, ifNode.id, { sourceHandle: sourceHandle ?? undefined }),
          createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
          createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
          createArrowEdge(bp.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
        );
      } else if (type === "while" || type === "for") {
          const loopNode = createNode(type, label, newPosX, baseY + 60);
          newNodesToAdd.push(loopNode);
          const sourceHandleType = type === 'while' ? 'false' : 'next';
          const loopBodyHandle = type === 'while' ? 'true' : 'loop_body';
          const loopReturnHandle = type === 'while' ? 'loop_in' : 'loop_return';

          newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, loopNode.id, { sourceHandle: sourceHandle ?? undefined, targetHandle: "top" }),
            createArrowEdge(loopNode.id, targetNode.id, { label: "False", sourceHandle: sourceHandleType, targetHandle: targetHandle ?? undefined }),
            { ...createArrowEdge(loopNode.id, loopNode.id, { label: "True", sourceHandle: loopBodyHandle, targetHandle: loopReturnHandle }), type: "smoothstep", pathOptions: { offset: 60 } }
          );
          extraYOffset = 60;
      } else {
        const createdType = mapTypeForNode(type) as string;
        const newNode = createNode(createdType, label, newPosX, baseY);
        newNodesToAdd.push(newNode);
        newEdgesToAdd.push(
            createArrowEdge(sourceNode.id, newNode.id, { sourceHandle: sourceHandle ?? undefined }),
            createArrowEdge(newNode.id, targetNode.id, { targetHandle: targetHandle ?? undefined })
        );
      }
      
      // --- LOGIC ใหม่: ส่ง `target` เข้าไปเป็น `splitTargetId` ---
      insertAfter(source, target, newNodesToAdd, newEdgesToAdd, selectedEdge.id, undefined, undefined, extraYOffset);
      closeModal();
      
  }, [nodes, edges, selectedEdge, setNodes, setEdges, closeModal, createNode, insertAfter]);

  const addNode = useCallback((type: string, label: string, anchorId?: string) => {
    const startNode = nodes.find((n) => n.id === "start");
    const endNode = nodes.find((n) => n.id === "end");
    if (!startNode || !endNode) return;

    if (anchorId) {
        const anchorNode = nodes.find((n) => n.id === anchorId);
        if (!anchorNode) return;

        const outgoingEdges = edges.filter(e => e.source === anchorId);
        // หา target ของ node ที่จะแทรก, ถ้าไม่มีเส้นออก ให้เชื่อมไปที่ end node
        const targetNodeId = outgoingEdges.length > 0 ? outgoingEdges[0].target : endNode.id; 
        const edgeToRemove = outgoingEdges.length > 0 ? outgoingEdges[0] : null;

        let newNodes: Node[] = [];
        let newEdges: Edge[] = [];
        
        const baseY = anchorNode.position.y + stepY;

        if (type === "if") {
            const ifNode = createNode("if", label, anchorNode.position.x, baseY);
            const bp = createNode("breakpoint", "", anchorNode.position.x + 73, baseY + stepY);
            newNodes = [ifNode, bp];
            newEdges.push(
                createArrowEdge(anchorId, ifNode.id),
                createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }),
                createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }),
                createArrowEdge(bp.id, targetNodeId)
            );
        } else { // Handle other types
            const createdType = mapTypeForNode(type) as string;
            const newNode = createNode(createdType, label, anchorNode.position.x, baseY);
            newNodes = [newNode];
            newEdges.push(
                createArrowEdge(anchorId, newNode.id),
                createArrowEdge(newNode.id, targetNodeId)
            );
        }
        
        // เมื่อเพิ่ม node จาก node อื่น, edge ที่จะถูกแทนที่คือ edge ที่ออกจาก anchor node
        insertAfter(anchorId, targetNodeId, newNodes, newEdges, edgeToRemove?.id);
        closeNodeModal();
        return;
    }
    
    if (selectedEdge) {
      addNodeOnSelectedEdge(type, label);
      return;
    }

    // Fallback logic for adding node when nothing is selected (adds before the end)
    const lastNode = nodes.find(n => edges.some(e => e.source === n.id && e.target === 'end')) ?? startNode;
    addNode(type, label, lastNode.id);

  }, [nodes, edges, selectedEdge, addNodeOnSelectedEdge, createNode, insertAfter, setEdges, setNodes, closeModal, closeNodeModal]);

  return { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode, addNodeOnSelectedEdge };
};