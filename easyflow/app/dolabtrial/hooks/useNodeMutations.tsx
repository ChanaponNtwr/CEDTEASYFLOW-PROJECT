// File: app/flowchart/hooks/useNodeMutations.ts

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
  
  const addNodeOnSelectedEdge = useCallback((type: string, label: string) => {
      if (!selectedEdge) return;
      const { source, target, sourceHandle, targetHandle } = selectedEdge;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode || !targetNode) return;

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

          // create self-loop edge separately so we don't place unknown props in an object literal
          const loopEdgeBase = { ...createArrowEdge(newNode.id, newNode.id, { label: "True", sourceHandle: isWhile ? "true" : "loop_body", targetHandle: isWhile ? "loop_in" : "loop_return" }) } as any;
          loopEdgeBase.type = "smoothstep";
          loopEdgeBase.animated = true;
          loopEdgeBase.pathOptions = { offset: 60 };
          edgesToAdd.push(loopEdgeBase as Edge);
        }

        setNodes((nds) => [...nds, ...nodesToAdd]);
        setEdges((eds) => [...eds.filter((e) => e.id !== selectedEdge.id), ...edgesToAdd]);
        closeModal();
        return;
      }
      
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
          createArrowEdge(whileNode.id, targetNode.id, { label: "False", sourceHandle: "false", targetHandle: targetHandle ?? undefined })
        );

        const selfLoopBase = { ...createArrowEdge(whileNode.id, whileNode.id, { label: "True", sourceHandle: "true", targetHandle: "loop_in" }) } as any;
        selfLoopBase.type = "smoothstep";
        selfLoopBase.animated = true;
        selfLoopBase.pathOptions = { offset: 60 };
        newEdgesToAdd.push(selfLoopBase as Edge);
      } else if (type === "for") {
        const forNode = createNode("for", label, newPosX, sourceNode.position.y + stepY + 60);
        newNodesToAdd.push(forNode);
        newEdgesToAdd.push(
          createArrowEdge(sourceNode.id, forNode.id, { sourceHandle: sourceHandle ?? undefined, targetHandle: "top" }),
          createArrowEdge(forNode.id, targetNode.id, { label: "False", sourceHandle: "next", targetHandle: targetHandle ?? undefined })
        );

        const selfLoopBase = { ...createArrowEdge(forNode.id, forNode.id, { label: "True", sourceHandle: "loop_body", targetHandle: "loop_return" }) } as any;
        selfLoopBase.type = "smoothstep";
        selfLoopBase.animated = true;
        selfLoopBase.pathOptions = { offset: 60 };
        newEdgesToAdd.push(selfLoopBase as Edge);
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
      setEdges((eds) => [...eds.filter((e) => e.id !== selectedEdge?.id), ...newEdgesToAdd]);
      closeModal();
  }, [nodes, edges, selectedEdge, setNodes, setEdges, closeModal, createNode]);
  
  const addNode = useCallback((type: string, label: string, anchorId?: string) => {
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

        const selfLoopBase = { ...createArrowEdge(loopNode.id, loopNode.id, { label: "True", sourceHandle: type === "while" ? "true" : "loop_body", targetHandle: type === "while" ? "loop_in" : "loop_return" }) } as any;
        selfLoopBase.type = "smoothstep";
        selfLoopBase.animated = true;
        selfLoopBase.pathOptions = { offset: 60 };
        newEdges.push(selfLoopBase as Edge);

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

    if (selectedEdge) {
      addNodeOnSelectedEdge(type, label);
      return;
    }

    const middleNodes = nodes.filter((n) => n.id !== "start" && n.id !== "end");
    const previousNode = middleNodes[middleNodes.length - 1] || nodes.find((n) => n.id === "start")!;
    const baseY = (nodes.find((n) => n.id === "start")!.position.y) + stepY * (middleNodes.length + 1);

    if (type === "if") {
      const ifNode = createNode("if", label, 300, baseY);
      const bp = createNode("breakpoint", "", 360, baseY + stepY);
      const newEdges = [createArrowEdge(previousNode.id, ifNode.id), createArrowEdge(ifNode.id, bp.id, { label: "True", sourceHandle: "right", targetHandle: "true" }), createArrowEdge(ifNode.id, bp.id, { label: "False", sourceHandle: "left", targetHandle: "false" }), createArrowEdge(bp.id, nodes.find((n) => n.id === "end")!.id)];
      const updatedNodes = [...nodes.filter(n => n.id !== 'end'), ifNode, bp, {...(nodes.find(n => n.id === 'end')!), position: {x: 300, y: computeEndY([...nodes, ifNode, bp])}}];
      setNodes(updatedNodes);
      setEdges((eds) => [...eds.filter((e) => !(e.source === previousNode.id && e.target === (nodes.find(n => n.id === 'end')!.id))), ...newEdges]);
      return;
    }
    if (type === "while" || type === "for") {
        const loopNode = createNode(type, label, 300, baseY);
        const newEdges: Edge[] = [
            createArrowEdge(previousNode.id, loopNode.id, { targetHandle: "top" }),
            createArrowEdge(loopNode.id, (nodes.find(n => n.id === 'end')!).id, { label: "False", sourceHandle: type === "while" ? "false" : "next" })
        ];

        const selfLoopBase = { ...createArrowEdge(loopNode.id, loopNode.id, { label: "True", sourceHandle: type === "while" ? "true" : "loop_body", targetHandle: type === "while" ? "loop_in" : "loop_return" }) } as any;
        selfLoopBase.type = "smoothstep";
        selfLoopBase.animated = true;
        selfLoopBase.pathOptions = { offset: 60 };
        newEdges.push(selfLoopBase as Edge);

        const updatedNodes = [...nodes.filter(n => n.id !== 'end'), loopNode, {...(nodes.find(n => n.id === 'end')!), position: {x: 300, y: computeEndY([...nodes, loopNode]) + stepY}}];
        setNodes(updatedNodes);
        setEdges(eds => [...eds.filter(e => !(e.source === previousNode.id && e.target === (nodes.find(n => n.id === 'end')!.id))), ...newEdges]);
        return;
    }

    const newNode = createNode(mapTypeForNode(type), label, 300, baseY);
    const newEdges = [createArrowEdge(previousNode.id, newNode.id), createArrowEdge(newNode.id, (nodes.find(n => n.id === 'end')!).id)];
    const updatedNodes = [...nodes.filter(n => n.id !== 'end'), newNode, {...(nodes.find(n => n.id === 'end')!), position: {x: 300, y: computeEndY([...nodes, newNode])}}];
    setNodes(updatedNodes);
    setEdges(eds => [...eds.filter(e => !(e.source === previousNode.id && e.target === (nodes.find(n => n.id === 'end')!.id))), ...newEdges]);
    
  }, [nodes, edges, selectedEdge, addNodeOnSelectedEdge, createNode, insertAfter, setEdges, setNodes]);


  return { onConnect, handleUpdateNode, deleteNodeAndReconnect, addNode, addNodeOnSelectedEdge };
};