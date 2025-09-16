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
    if (srcNode) srcNode.outgoingEdgeIds = (srcNode.outgoingEdgeIds || []).filter(id => id !== edgeId);
    if (tgtNode) tgtNode.incomingEdgeIds = (tgtNode.incomingEdgeIds || []).filter(id => id !== edgeId);
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
   *  - ถอด edge เดิมแล้วสร้าง node ใหม่ + edge แทนที่ให้ถูกต้องตามประเภท node (IF / WH/FR / ปกติ)
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
   * - รองรับการลบ IF (รวม bp_<id>) และ WH/FR (ลบ loop edges และ nodes ภายใน) โดยจะ rewire incoming -> outgoing targets
   * - ไม่ทำ recursive delete ของ downstream nodes นอก loop (ยกเว้นกรณี loop body ซึ่งจะถูกลบ)
   */
  removeNode(nodeId) {
    const node = this.nodes[nodeId];
    if (!node) return;
    if (node.type === "ST" || node.type === "EN") return;

    // สำเนา edges ปัจจุบันเพื่อใช้อ้างอิงแบบ immutable ในการคำนวณ
    const allEdges = Object.values(this.edges);

    // หา incoming / outgoing edges ปัจจุบัน
    const incomingEdges = allEdges.filter(e => e.target === nodeId);
    const outgoingEdges = allEdges.filter(e => e.source === nodeId);

    // targets ที่จะใช้เชื่อม incoming -> targets (default จะเติม n_end ถ้าไม่ระบุ)
    let targets = [];

    if (node.type === "IF") {
      // IF: ถ้ามี BP (bp_<id>) ให้ใช้ target ของ BP เป็น targets
      const bpId = `bp_${nodeId}`;
      const bpNode = this.getNode(bpId);

      if (bpNode) {
        // หา outgoing targets ของ bp node (มักจะเป็น target จริง)
        const bpOutgoingEdges = Object.values(this.edges).filter(e => e.source === bpId);
        const bpTargets = bpOutgoingEdges.map(e => e.target).filter(t => t && t !== bpId && t !== nodeId);

        // ถ้า bpTargets ว่าง ให้ fallback ไปใช้ outgoing ของ IF เอง
        targets = (bpTargets.length > 0) ? bpTargets : outgoingEdges.map(e => e.target).filter(t => t !== nodeId);

        // Rewire: สำหรับแต่ละ incoming edge ของ IF ให้สร้าง edge ใหม่จาก inEdge.source -> ทุก bpTarget
        for (const inEdge of incomingEdges) {
          for (const t of targets) {
            if (!t) continue;
            if (inEdge.source === t) continue; // skip self-loop
            const newEdgeId = `${inEdge.source}-${t}`;
            if (!this.edges[newEdgeId]) {
              if (this.getNode(inEdge.source) && this.getNode(t)) {
                this._addEdgeInternal(new Edge(newEdgeId, inEdge.source, t, "auto"));
              }
            }
          }
        }

        // ลบ edges ที่เกี่ยวข้องกับ BP และ IF (BP edges, IF->BP true/false, BP->next)
        const bpRelated = Object.values(this.edges)
          .filter(e => e.source === bpId || e.target === bpId || e.source === nodeId || e.target === nodeId)
          .map(e => e.id);

        for (const eid of bpRelated) {
          this.removeEdge(eid);
        }

        // ลบ bp node ถ้ายังอยู่
        if (this.getNode(bpId)) {
          delete this.nodes[bpId];
          console.log(`BP node ${bpId} ถูกลบพร้อมกับ IF ${nodeId}`);
        }
      } else {
        // ไม่มี BP: fallback behavior (เชื่อม incoming -> outgoing targets ของ IF เอง)
        targets = outgoingEdges.map(e => e.target).filter(t => t !== nodeId);

        for (const inEdge of incomingEdges) {
          for (const t of targets) {
            if (!t) continue;
            if (inEdge.source === t) continue;
            const newEdgeId = `${inEdge.source}-${t}`;
            if (!this.edges[newEdgeId]) {
              if (this.getNode(inEdge.source) && this.getNode(t)) {
                this._addEdgeInternal(new Edge(newEdgeId, inEdge.source, t, "auto"));
              }
            }
          }
        }

        // ลบ edges incoming/outgoing ของ IF (ต่อไปจะลบ node ด้วย)
        for (const e of [...incomingEdges, ...outgoingEdges]) {
          this.removeEdge(e.id);
        }
      }
    } else if (node.type === "WH" || node.type === "FR") {
      // Loop node: ต้องลบ node ภายใน loop และเชื่อม incoming -> exit targets (false/done)
      // หา exit target(s)
      const exitTargets = [];
      if (node.loopExitEdge && this.edges[node.loopExitEdge]) {
        const exitEdge = this.edges[node.loopExitEdge];
        if (exitEdge && exitEdge.target) exitTargets.push(exitEdge.target);
      }
      // ถ้าไม่มี exit target ให้ลองหา outgoing edges ที่มี condition false/done
      if (exitTargets.length === 0) {
        const possibleExits = outgoingEdges.filter(e => e.condition === "false" || e.condition === "done" || e.condition === "next" || e.condition === "auto");
        for (const e of possibleExits) {
          if (e.target && e.target !== nodeId) exitTargets.push(e.target);
        }
      }

      // หา seed ของ body (targets ของ loop node ยกเว้น self หรือ exit targets)
      const bodySeeds = outgoingEdges
        .map(e => e.target)
        .filter(t => t && t !== nodeId && !exitTargets.includes(t));

      // DFS/stack เพื่อหา nodes ภายใน loop (ไม่ข้าม exitTargets)
      const bodyNodes = new Set();
      const stack = [...bodySeeds];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) continue;
        if (cur === nodeId) continue;
        if (exitTargets.includes(cur)) continue;
        if (bodyNodes.has(cur)) continue;
        bodyNodes.add(cur);

        // หา outgoing ของ cur แล้วผลักต่อ (หลีกเลี่ยงการเข้า loop node หรือ exit targets)
        const curOutgoing = Object.values(this.edges).filter(e => e.source === cur);
        for (const oe of curOutgoing) {
          const tgt = oe.target;
          if (!tgt) continue;
          if (tgt === nodeId) continue;
          if (exitTargets.includes(tgt)) continue;
          if (!bodyNodes.has(tgt)) stack.push(tgt);
        }
      }

      // Rewire: เชื่อม incoming sources ของ loop node -> exitTargets (หรือ n_end ถ้าไม่มี)
      let finalTargets = exitTargets.slice();
      if (finalTargets.length === 0 && this.getNode("n_end")) finalTargets = ["n_end"];

      for (const inEdge of incomingEdges) {
        for (const t of finalTargets) {
          if (!t) continue;
          if (inEdge.source === t) continue;
          const newEdgeId = `${inEdge.source}-${t}`;
          if (!this.edges[newEdgeId]) {
            if (this.getNode(inEdge.source) && this.getNode(t)) {
              this._addEdgeInternal(new Edge(newEdgeId, inEdge.source, t, "auto"));
            }
          }
        }
      }

      // ลบ edges ที่เกี่ยวข้องกับ body nodes (รวม edges ที่มี source/target ใน bodyNodes)
      const bodyNodeIds = Array.from(bodyNodes);
      const edgesToRemove = Object.values(this.edges)
        .filter(e => bodyNodeIds.includes(e.source) || bodyNodeIds.includes(e.target) || e.source === nodeId || e.target === nodeId)
        .map(e => e.id);

      for (const eid of edgesToRemove) {
        this.removeEdge(eid);
      }

      // ลบ nodes ใน body
      for (const nid of bodyNodeIds) {
        if (this.getNode(nid)) {
          delete this.nodes[nid];
          console.log(`Loop body node ${nid} ถูกลบเนื่องจาก loop ${nodeId} ถูกลบ`);
        }
      }
    } else {
      // default: แค่ใช้ outgoing targets ปกติ (ไม่เอา self)
      targets = outgoingEdges.map(e => e.target).filter(t => t !== nodeId);

      // Rewire incoming -> each target
      for (const inEdge of incomingEdges) {
        for (const t of targets) {
          if (!t) continue;
          if (inEdge.source === t) continue;
          const newEdgeId = `${inEdge.source}-${t}`;
          if (!this.edges[newEdgeId]) {
            if (this.getNode(inEdge.source) && this.getNode(t)) {
              this._addEdgeInternal(new Edge(newEdgeId, inEdge.source, t, "auto"));
            }
          }
        }
      }

      // ถ้าไม่มี target ให้เชื่อมไป n_end (ถ้ามี)
      if ((!targets || targets.length === 0) && this.getNode("n_end")) {
        targets = ["n_end"];
        for (const inEdge of incomingEdges) {
          const newEdgeId = `${inEdge.source}-n_end`;
          if (!this.edges[newEdgeId]) {
            if (this.getNode(inEdge.source) && this.getNode("n_end")) {
              this._addEdgeInternal(new Edge(newEdgeId, inEdge.source, "n_end", "auto"));
            }
          }
        }
      }
    }

    // --- ลบ edges ทั้ง incoming + outgoing ของ node นี้ (เหลือที่ยังไม่ถูกลบ) ---
    // ใช้สำเนาเพื่อความปลอดภัย
    const incomingNow = Object.values(this.edges).filter(e => e.target === nodeId).map(e => e.id);
    const outgoingNow = Object.values(this.edges).filter(e => e.source === nodeId).map(e => e.id);
    for (const eid of [...incomingNow, ...outgoingNow]) {
      this.removeEdge(eid);
    }

    // ลบ node ตัวเอง
    if (this.getNode(nodeId)) {
      delete this.nodes[nodeId];
      console.log(`Node ${nodeId} ถูกลบเรียบร้อย (rewired to: ${targets.join(", ")})`);
    }

    // cleanup: ปรับ outgoing/incoming lists ของ node อื่น ๆ
    Object.values(this.nodes).forEach(n => {
      n.outgoingEdgeIds = (n.outgoingEdgeIds || []).filter(id => this.edges[id]);
      n.incomingEdgeIds = (n.incomingEdgeIds || []).filter(id => this.edges[id]);
      if (n.loopExitEdge && !this.edges[n.loopExitEdge]) n.loopExitEdge = null;
      if (n.loopEdge && !this.edges[n.loopEdge]) n.loopEdge = null;
    });

    // หลังการลบ: ถ้า start ไม่มี outgoing ใดๆ ให้คืน default start->end (ถ้ามี n_end)
    const startNode = this.getNode("n_start");
    if (startNode && (!startNode.outgoingEdgeIds || startNode.outgoingEdgeIds.length === 0)) {
      if (this.getNode("n_end")) {
        const defaultId = "n_start-n_end";
        if (!this.edges[defaultId]) this._addEdgeInternal(new Edge(defaultId, "n_start", "n_end", "auto"));
      }
    }
  }

  // getter node/edge
  getNode(id) { return this.nodes[id]; }
  getEdge(id) { return this.edges[id]; }
}

export default Flowchart;
