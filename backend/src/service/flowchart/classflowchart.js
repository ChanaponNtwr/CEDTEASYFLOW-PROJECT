// src/service/flowchart/classflowchart.js
import Edge from "./classedge.js";
import Node from "./classnode.js";

class Flowchart {
  constructor() {
    this.nodes = {};              // เก็บ node ทั้งหมด
    this.edges = {};              // เก็บ edge ทั้งหมด
    this._autoCounter = 1;        // ใช้ gen id อัตโนมัติ

    // ค่าจำกัดการรัน (แก้ได้ด้วย setExecutionLimits)
    this.maxSteps = 100000;
    this.maxTimeMs = 5000;
    this.maxLoopIterationsPerNode = 20000;

    // สร้าง Start และ End node เริ่มต้น
    const startNode = new Node("n_start", "ST", "Start", { label: "Start" });
    const endNode = new Node("n_end", "EN", "End", { label: "End" });
    this.addNode(startNode);
    this.addNode(endNode);

    // เชื่อม start → end อัตโนมัติ
    this._addEdgeInternal(new Edge(`${startNode.id}-${endNode.id}`, startNode.id, endNode.id, "auto"));
  }

  // ตั้งค่าขีดจำกัดการทำงาน
  setExecutionLimits({ maxSteps, maxTimeMs, maxLoopIterationsPerNode } = {}) {
    if (Number.isFinite(maxSteps)) this.maxSteps = maxSteps;
    if (Number.isFinite(maxTimeMs)) this.maxTimeMs = maxTimeMs;
    if (Number.isFinite(maxLoopIterationsPerNode)) this.maxLoopIterationsPerNode = maxLoopIterationsPerNode;
  }

  // gen id ใหม่แบบไม่ซ้ำ
  genId(prefix = "n") {
    let id;
    do {
      id = `${prefix}${this._autoCounter++}`;
    } while (this.getNode(id));
    return id;
  }

  // เพิ่ม node เข้าไปใน flowchart
  addNode(node) {
    if (!this.nodes[node.id]) {
      node.outgoingEdgeIds = node.outgoingEdgeIds || [];
      node.incomingEdgeIds = node.incomingEdgeIds || [];
      this.nodes[node.id] = node;
    } else {
      // ถ้า node มีอยู่แล้ว ให้แน่ใจว่ามี array ของ edge
      this.nodes[node.id].outgoingEdgeIds = this.nodes[node.id].outgoingEdgeIds || [];
      this.nodes[node.id].incomingEdgeIds = this.nodes[node.id].incomingEdgeIds || [];
    }
  }

  // สร้าง node ใหม่แบบ auto id
  createNode(type, label = "", data = {}, position = { x: 0, y: 0 }) {
    const id = this.genId();
    const node = new Node(id, type, label, data, position);
    this.addNode(node);
    return node;
  }

  /**
   * เพิ่ม edge ภายใน (เชื่อม source → target)
   * - สร้าง placeholder สำหรับ source/target ถ้ายังไม่มี
   * - ตรวจสอบและสร้าง outgoing/incoming arrays ก่อน push
   * - ไม่เพิ่ม edge id ซ้ำ
   */
  _addEdgeInternal(edge) {
    if (this.edges[edge.id]) return;

    // ถ้าไม่มี target หรือ source ให้สร้าง placeholder node ก่อน (ป้องกันกรณี id เป็นชื่อที่ยังไม่มี node)
    if (!this.nodes[edge.target]) {
      this.addNode(new Node(edge.target, "PH", "Placeholder", { note: "auto-created" }));
    }
    if (!this.nodes[edge.source]) {
      this.addNode(new Node(edge.source, "PH", "Placeholder", { note: "auto-created" }));
    }

    // บันทึก edge
    this.edges[edge.id] = edge;

    // อัปเดต outgoing/incoming lists อย่างปลอดภัย (ไม่เพิ่มซ้ำ)
    const sourceNode = this.nodes[edge.source];
    if (sourceNode) {
      sourceNode.outgoingEdgeIds = sourceNode.outgoingEdgeIds || [];
      if (!sourceNode.outgoingEdgeIds.includes(edge.id)) sourceNode.outgoingEdgeIds.push(edge.id);
    }
    const targetNode = this.nodes[edge.target];
    if (targetNode) {
      targetNode.incomingEdgeIds = targetNode.incomingEdgeIds || [];
      if (!targetNode.incomingEdgeIds.includes(edge.id)) targetNode.incomingEdgeIds.push(edge.id);
    }
  }

  /**
   * เพิ่ม edge ใหม่ (public API)
   * ปรับปรุง: ถ้าเป็นการเพิ่มจาก n_start และมี default start->end อยู่ ให้ลบ default นี้
   */
  addEdge(source, target, condition = "auto") {
    const id = `${source}-${target}`;
    if (this.edges[id]) return this.edges[id];
    const e = new Edge(id, source, target, condition);
    this._addEdgeInternal(e);

    // ถ้าเพิ่ม edge จาก n_start และก่อนหน้านี้ยังมี default n_start-n_end,
    // และตอนนี้มี outgoing มากกว่า 1 ให้ลบ default start->end
    try {
      if (source === "n_start") {
        const defaultId = "n_start-n_end";
        const sourceNode = this.nodes[source];
        if (this.edges[defaultId] && sourceNode && sourceNode.outgoingEdgeIds.includes(defaultId)) {
          // ถ้ามี outgoing edge อื่น ๆ นอกจาก default ให้ลบ default
          const others = (sourceNode.outgoingEdgeIds || []).filter(x => x !== defaultId);
          if (others.length > 0) {
            this.removeEdge(defaultId);
          }
        }
      }
    } catch (e) {
      // ignore safety
      console.warn("addEdge post-check failed:", e);
    }

    return e;
  }

  // ลบ edge ออกจากกราฟ
  removeEdge(edgeId) {
    const edge = this.edges[edgeId];
    if (!edge) return;
    const { source, target } = edge;
    const srcNode = this.nodes[source];
    const tgtNode = this.nodes[target];
    if (srcNode) srcNode.outgoingEdgeIds = srcNode.outgoingEdgeIds.filter(id => id !== edgeId);
    if (tgtNode) tgtNode.incomingEdgeIds = tgtNode.incomingEdgeIds.filter(id => id !== edgeId);
    delete this.edges[edgeId];
  }

  // เลือก outgoing edge ของ node ตามลำดับ condition ที่ต้องการ
  chooseOutgoingEdgeId(nodeId, preferredConditions = ["auto", "true", "next", "false", "done"]) {
    const node = this.getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (!node.outgoingEdgeIds || node.outgoingEdgeIds.length === 0) throw new Error(`Node ${nodeId} has no outgoing edges`);
    const edges = node.outgoingEdgeIds.map(id => this.getEdge(id)).filter(Boolean);
    for (const cond of preferredConditions) {
      const e = edges.find(ed => ed.condition === cond);
      if (e) return e.id;
    }
    return node.outgoingEdgeIds[0];
  }

  /**
   * แทรก node ใหม่ตรงกลาง edge
   * logic:
   *  - ถอด edge เดิม แล้วสร้าง node ใหม่ + edge แทนที่ให้ถูกต้องตามประเภท node (IF / WH/FR / ปกติ)
   */
  insertNodeAtEdge(edgeId, newNode, edgeLabel = "auto") {
    const edge = this.edges[edgeId];
    if (!edge) throw new Error(`ไม่พบ edge id = ${edgeId}`);
    const { source, target, condition: originalCondition } = edge;

    // ลบ edge เดิมก่อน เพื่อเตรียมเชื่อมใหม่
    this.removeEdge(edgeId);
    this.addNode(newNode);
    const replacementEdgeId = `${source}-${newNode.id}`;

    if (newNode.type === "IF") {
      // แทรก IF จะมี Breakpoint node เพิ่มเข้ามาด้วย
      const bpNodeId = `bp_${newNode.id}`;
      const bpNode = new Node(bpNodeId, "BP", "Breakpoint", { note: "BP for IF" });
      this.addNode(bpNode);

      this._addEdgeInternal(new Edge(replacementEdgeId, source, newNode.id, originalCondition || edgeLabel));
      this._addEdgeInternal(new Edge(`${newNode.id}-true`, newNode.id, bpNodeId, "true"));
      this._addEdgeInternal(new Edge(`${newNode.id}-false`, newNode.id, bpNodeId, "false"));
      this._addEdgeInternal(new Edge(`${bpNodeId}-${target}`, bpNodeId, target, "auto"));
    } else if (newNode.type === "WH" || newNode.type === "FR") {
      // แทรก While / For → มี loopEdge + exitEdge
      let loopEdge, exitEdge;
      if (newNode.type === "WH") {
        loopEdge = new Edge(`${newNode.id}-true`, newNode.id, newNode.id, "true");
        exitEdge = new Edge(`${newNode.id}-false`, newNode.id, target, "false");
      } else {
        loopEdge = new Edge(`${newNode.id}-next`, newNode.id, newNode.id, "next");
        exitEdge = new Edge(`${newNode.id}-done`, newNode.id, target, "done");
      }
      this._addEdgeInternal(loopEdge);
      this._addEdgeInternal(exitEdge);
      newNode.loopEdge = loopEdge.id;
      newNode.loopExitEdge = exitEdge.id;
      this._addEdgeInternal(new Edge(replacementEdgeId, source, newNode.id, originalCondition || edgeLabel));
    } else {
      // Node ปกติ: เชื่อม source -> newNode, newNode -> target (auto)
      this._addEdgeInternal(new Edge(replacementEdgeId, source, newNode.id, originalCondition || edgeLabel));
      this._addEdgeInternal(new Edge(`${newNode.id}-${target}`, newNode.id, target, "auto"));
    }

    // อัปเดต node ที่เคยใช้ edgeId เดิม (ถ้ามี)
    Object.values(this.nodes).forEach(n => {
      if (n.loopExitEdge === edgeId) n.loopExitEdge = replacementEdgeId;
      if (n.loopEdge === edgeId) n.loopEdge = replacementEdgeId;
    });

    console.log(`Node ${newNode.id} ถูกแทรกระหว่าง edge ${edgeId}`);
  }

  // แทรก node ใหม่ต่อท้าย node เดิม
  insertAfterNode(nodeId, newNode, preferredConditions = ["auto"]) {
    const edgeId = this.chooseOutgoingEdgeId(nodeId, preferredConditions);
    this.insertNodeAtEdge(edgeId, newNode);
    return newNode;
  }

  // แทรก node เข้าไปใน loop body
  insertIntoLoopBody(loopNodeId, newNode) {
    const loopNode = this.getNode(loopNodeId);
    if (!loopNode) throw new Error(`Loop node ${loopNodeId} not found`);
    if (!loopNode.loopEdge) throw new Error(`Loop node ${loopNodeId} has no loopEdge`);
    this.insertNodeAtEdge(loopNode.loopEdge, newNode);
    return newNode;
  }

  // แทรก node ที่ตำแหน่ง loop exit
  insertAtLoopExit(loopNodeId, newNode) {
    const loopNode = this.getNode(loopNodeId);
    if (!loopNode) throw new Error(`Loop node ${loopNodeId} not found`);
    if (!loopNode.loopExitEdge) throw new Error(`Loop node ${loopNodeId} has no loopExitEdge`);
    this.insertNodeAtEdge(loopNode.loopExitEdge, newNode);
    return newNode;
  }

  /**
   * ลบ node ออกจาก flowchart (ยกเว้น Start/End)
   * ปรับปรุง logic การเชื่อมต่อใหม่:
   *  - ไม่เชื่อมไปยัง target ที่อยู่ใน visited set (ชุด node ที่กำลังถูกลบแล้ว)
   *  - ไม่สร้าง self-loop (source === target)
   *  - ไม่สร้าง edge ที่มี id เดิมอยู่แล้ว (ป้องกัน duplicate)
   */
  removeNode(nodeId) {
    const node = this.nodes[nodeId];
    if (!node) return;
    if (node.type === "ST" || node.type === "EN") return;

    const visited = new Set();

    const recursiveRemove = (currentNode) => {
      if (!currentNode || visited.has(currentNode.id)) return;
      visited.add(currentNode.id);

      // edges ที่เข้าหา node นี้ และ edges ที่ออกจาก node นี้
      const incomingEdges = Object.values(this.edges).filter(e => e.target === currentNode.id);
      const outgoingEdges = Object.values(this.edges).filter(e => e.source === currentNode.id);

      // หา target node ที่ต้องเชื่อมแทน (ไม่เอา target ที่เป็น self)
      // และกรองออกถ้า target อยู่ใน visited (กำลังถูกลบแล้ว)
      let targets = outgoingEdges
        .map(e => e.target)
        .filter(t => t !== currentNode.id && !visited.has(t));

      if (targets.length === 0) targets = ["n_end"];

      // เชื่อม source เดิม → target ใหม่ (ไม่สร้าง self-loop, ไม่สร้าง duplicate)
      for (let inEdge of incomingEdges) {
        for (let targetId of targets) {
          if (inEdge.source === targetId) continue; // skip self-loop
          const newEdgeId = `${inEdge.source}-${targetId}`;
          if (!this.edges[newEdgeId]) {
            this._addEdgeInternal(new Edge(newEdgeId, inEdge.source, targetId, "auto"));
          }
        }
      }

      // ลบ edge ที่เชื่อมอยู่จริง ๆ
      for (let e of [...incomingEdges, ...outgoingEdges]) {
        this.removeEdge(e.id);
      }

      // ลบ node นี้
      delete this.nodes[currentNode.id];
      console.log(`Node ${currentNode.id} ถูกลบเรียบร้อย`);

      // cleanup references: ล้าง outgoing/incoming ที่อ้างถึง edge ที่หายไป
      Object.values(this.nodes).forEach(n => {
        n.outgoingEdgeIds = n.outgoingEdgeIds.filter(id => this.edges[id]);
        n.incomingEdgeIds = n.incomingEdgeIds.filter(id => this.edges[id]);
        if (n.loopExitEdge && !this.edges[n.loopExitEdge]) n.loopExitEdge = null;
        if (n.loopEdge && !this.edges[n.loopEdge]) n.loopEdge = null;
      });

      // ดำเนินการลบต่อไปสำหรับ node ที่เคยอยู่ใน outgoingTargets (ถ้ายังไม่ถูกลบ)
      // (ถ้าต้องการลบ subtree ทั้งหมด จะเรียก recursiveRemove สำหรับ target nodes ด้วย)
      for (const out of outgoingEdges) {
        const nextNode = this.getNode(out.target);
        if (nextNode && !visited.has(nextNode.id)) {
          recursiveRemove(nextNode);
        }
      }
    };

    recursiveRemove(node);
  }

  // getter node/edge
  getNode(id) { return this.nodes[id]; }
  getEdge(id) { return this.edges[id]; }
}

export default Flowchart;
