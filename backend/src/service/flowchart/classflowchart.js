// src/service/flowchart/classflowchart.js
import Edge from "./classedge.js";
import Node from "./classnode.js";

class Flowchart {
  constructor() {
    this.nodes = {};              // เก็บ node ทั้งหมด
    this.edges = {};              // เก็บ edge ทั้งหมด
    this._autoCounter = 1;        // ใช้ gen id อัตโนมัติ สำหรับ nodes
    this._edgeCounter = 1;        // ใช้ gen id อัตโนมัติ สำหรับ edges

    // ค่าจำกัดการรัน (แก้ได้ด้วย setExecutionLimits)
    this.maxSteps = 100000;
    this.maxTimeMs = 5000;
    this.maxLoopIterationsPerNode = 20000;

    // สร้าง Start และ End node เริ่มต้น
    const startNode = new Node("n_start", "ST", "Start", { label: "Start" });
    const endNode = new Node("n_end", "EN", "End", { label: "End" });
    this.addNode(startNode);
    this.addNode(endNode);

    // เชื่อม start → end อัตโนมัติ (รักษา id เดิมไว้เพื่อ compatibility)
    const defaultId = "n_start-n_end";
    this._addEdgeInternal(new Edge(defaultId, startNode.id, endNode.id, "auto"));
  }

  // ตั้งค่าขีดจำกัดการทำงาน
  setExecutionLimits({ maxSteps, maxTimeMs, maxLoopIterationsPerNode } = {}) {
    if (Number.isFinite(maxSteps)) this.maxSteps = maxSteps;
    if (Number.isFinite(maxTimeMs)) this.maxTimeMs = maxTimeMs;
    if (Number.isFinite(maxLoopIterationsPerNode)) this.maxLoopIterationsPerNode = maxLoopIterationsPerNode;
  }

  // gen id ใหม่แบบไม่ซ้ำ (nodes)
  genId(prefix = "n") {
    let id;
    do {
      id = `${prefix}${this._autoCounter++}`;
    } while (this.getNode(id));
    return id;
  }

  // gen id ใหม่แบบไม่ซ้ำ (edges)
  _genEdgeId(prefix = "e") {
    let id;
    do {
      id = `${prefix}${this._edgeCounter++}`;
    } while (this.getEdge(id));
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

  // helper: หา edge id โดย source & target (ถ้ามี)
  findEdgeIdByEndpoints(source, target) {
    const e = Object.values(this.edges).find(ed => ed.source === source && ed.target === target);
    return e ? e.id : null;
  }

  /**
   * เพิ่ม edge ภายใน (เชื่อม source → target)
   * - ถ้า edge.id ไม่ถูกระบุ จะสร้าง auto id
   * - สร้าง placeholder สำหรับ source/target ถ้ายังไม่มี
   * - อัปเดต incoming/outgoing ของ node
   */
  _addEdgeInternal(edge) {
    // assign id if missing
    if (!edge.id) edge.id = this._genEdgeId();

    if (this.edges[edge.id]) return;

    // ถ้าไม่มี target หรือ source ให้สร้าง placeholder nodeก่อน
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
   * Public addEdge
   * - id optional
   * - preserves canonical n_start-n_end id when source/target are start/end
   */
  addEdge(source, target, condition = "auto", id = null) {
    // keep canonical start->end for compatibility
    if (source === "n_start" && target === "n_end") {
      const existing = this.findEdgeIdByEndpoints(source, target);
      if (existing) return this.edges[existing];
      const eid = "n_start-n_end";
      const e = new Edge(eid, source, target, condition);
      this._addEdgeInternal(e);
      return e;
    }

    const eid = id || this._genEdgeId();
    if (this.edges[eid]) return this.edges[eid];
    const e = new Edge(eid, source, target, condition);
    this._addEdgeInternal(e);

    // ถ้าเพิ่ม edge จาก n_start และก่อนหน้านี้ยังมี default n_start-n_end,
    // และตอนนี้มี outgoing มากกว่า 1 ให้ลบ default start->end
    try {
      if (source === "n_start") {
        const defaultId = this.findEdgeIdByEndpoints("n_start", "n_end");
        const sourceNode = this.nodes[source];
        if (defaultId && this.edges[defaultId] && sourceNode && sourceNode.outgoingEdgeIds.includes(defaultId)) {
          const others = (sourceNode.outgoingEdgeIds || []).filter(x => x !== defaultId);
          if (others.length > 0) {
            this.removeEdge(defaultId);
          }
        }
      }
    } catch (e) {
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

  // เปลี่ยน target ของ edge (repoint) — คืนค่า edge object
  updateEdgeTarget(edgeId, newTarget, newCondition = undefined) {
    const edge = this.edges[edgeId];
    if (!edge) throw new Error(`Edge ${edgeId} not found`);
    const oldTarget = edge.target;
    if (oldTarget === newTarget) {
      if (newCondition !== undefined) edge.condition = newCondition;
      return edge;
    }

    // remove from old target incoming list
    const oldT = this.nodes[oldTarget];
    if (oldT) oldT.incomingEdgeIds = (oldT.incomingEdgeIds || []).filter(id => id !== edgeId);

    // assign new target
    edge.target = newTarget;
    if (newCondition !== undefined) edge.condition = newCondition;

    // ensure new target node exists
    if (!this.nodes[newTarget]) this.addNode(new Node(newTarget, "PH", "Placeholder", { note: "auto-created" }));

    // add to new target incoming list
    const newT = this.nodes[newTarget];
    newT.incomingEdgeIds = newT.incomingEdgeIds || [];
    if (!newT.incomingEdgeIds.includes(edgeId)) newT.incomingEdgeIds.push(edgeId);

    return edge;
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
   * - ไม่ลบ edge เดิม แต่เปลี่ยนให้ชี้มาที่ newNode (repoint)
   * - สร้าง edge ใหม่จาก newNode -> oldTarget (และ edges เพิ่มเติมตามประเภท node)
   */
  insertNodeAtEdge(edgeId, newNode, edgeLabel = "auto") {
    const edge = this.edges[edgeId];
    if (!edge) throw new Error(`ไม่พบ edge id = ${edgeId}`);
    const { source, target: oldTarget, condition: originalCondition } = edge;

    // เพิ่ม node ใหม่ก่อน
    this.addNode(newNode);

    // repoint existing edge to point to newNode (source -> newNode)
    this.updateEdgeTarget(edgeId, newNode.id, originalCondition || edgeLabel);

    if (newNode.type === "IF") {
      // แทรก IF จะมี Breakpoint node เพิ่มเข้ามาด้วย
      const bpNodeId = `bp_${newNode.id}`;
      const bpNode = new Node(bpNodeId, "BP", "Breakpoint", { note: "BP for IF" });
      this.addNode(bpNode);

      // newNode -> bp (true/false)
      const eTrue = this.addEdge(newNode.id, bpNodeId, "true");
      const eFalse = this.addEdge(newNode.id, bpNodeId, "false");
      // bp -> oldTarget
      const eBpOut = this.addEdge(bpNodeId, oldTarget, "auto");

      // ensure newNode.loop fields not set for IF
      newNode.loopEdge = newNode.loopEdge || null;
      newNode.loopExitEdge = newNode.loopExitEdge || null;

    } else if (newNode.type === "WH" || newNode.type === "FR") {
      // แทรก While / For → มี loopEdge + exitEdge
      const loopCond = (newNode.type === "WH") ? "true" : "next";
      const exitCond = (newNode.type === "WH") ? "false" : "done";

      const loopE = this.addEdge(newNode.id, newNode.id, loopCond);
      const exitE = this.addEdge(newNode.id, oldTarget, exitCond);
      newNode.loopEdge = loopE.id;
      newNode.loopExitEdge = exitE.id;

    } else {
      // Node ปกติ: สร้าง newNode -> oldTarget (auto)
      const forwardE = this.addEdge(newNode.id, oldTarget, "auto");
    }

    // อัปเดต node ที่เคยใช้ edgeId เดิม (ถ้ามี) — edge id เดิมยังอยู่แต่ชี้ไป newNode
    Object.values(this.nodes).forEach(n => {
      if (n.loopExitEdge === edgeId) n.loopExitEdge = edgeId;
      if (n.loopEdge === edgeId) n.loopEdge = edgeId;
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
   * - โค้ดนี้ปรับให้ใช้ addEdge(...) แทนการสร้าง id ด้วย `${src}-${tgt}` โดยตรง
   */
  removeNode(nodeId) {
    const node = this.nodes[nodeId];
    if (!node) return;
    if (node.type === "ST" || node.type === "EN") return;

    const isLoopEdge = (edgeId) => {
      return Object.values(this.nodes).some(n => (n.loopEdge === edgeId) || (n.loopExitEdge === edgeId));
    };

    const allEdges = Object.values(this.edges);
    const incomingEdges = allEdges.filter(e => e.target === nodeId);
    const outgoingEdges = allEdges.filter(e => e.source === nodeId);

    let targets = [];

    if (node.type === "IF") {
      const bpId = `bp_${nodeId}`;
      const bpNode = this.getNode(bpId);

      if (bpNode) {
        const bpOutgoingEdges = Object.values(this.edges).filter(e => e.source === bpId);
        const bpTargets = bpOutgoingEdges.map(e => e.target).filter(t => t && t !== bpId && t !== nodeId);
        targets = (bpTargets.length > 0) ? bpTargets : outgoingEdges.map(e => e.target).filter(t => t !== nodeId);

        for (const inEdge of incomingEdges) {
          for (const t of targets) {
            if (!t) continue;
            if (inEdge.source === t) continue;
            // use addEdge instead of manual id
            if (this.getNode(inEdge.source) && this.getNode(t)) {
              this.addEdge(inEdge.source, t, "auto");
            }
          }
        }

        const edgesToRemove = [];
        outgoingEdges.forEach(e => { if (!isLoopEdge(e.id)) edgesToRemove.push(e.id); });
        const bpRelatedEdges = Object.values(this.edges).filter(e => e.source === bpId || e.target === bpId).map(e => e.id);
        for (const eid of bpRelatedEdges) if (!isLoopEdge(eid)) edgesToRemove.push(eid);
        for (const inE of incomingEdges) if (!isLoopEdge(inE.id)) edgesToRemove.push(inE.id);

        const uniq = Array.from(new Set(edgesToRemove));
        for (const eid of uniq) this.removeEdge(eid);

        if (this.getNode(bpId)) {
          delete this.nodes[bpId];
          console.log(`BP node ${bpId} ถูกลบพร้อมกับ IF ${nodeId}`);
        }
      } else {
        targets = outgoingEdges.map(e => e.target).filter(t => t !== nodeId);
        for (const inEdge of incomingEdges) {
          for (const t of targets) {
            if (!t) continue;
            if (inEdge.source === t) continue;
            if (this.getNode(inEdge.source) && this.getNode(t)) this.addEdge(inEdge.source, t, "auto");
          }
        }

        const edgesToRemove = [
          ...outgoingEdges.filter(e => !isLoopEdge(e.id)).map(e => e.id),
          ...incomingEdges.filter(e => !isLoopEdge(e.id)).map(e => e.id)
        ];
        for (const eid of Array.from(new Set(edgesToRemove))) this.removeEdge(eid);
      }
    } else if (node.type === "WH" || node.type === "FR") {
      const exitTargets = [];
      if (node.loopExitEdge && this.edges[node.loopExitEdge]) {
        const exitEdge = this.edges[node.loopExitEdge];
        if (exitEdge && exitEdge.target) exitTargets.push(exitEdge.target);
      }
      if (exitTargets.length === 0) {
        const possibleExits = outgoingEdges.filter(e => e.condition === "false" || e.condition === "done" || e.condition === "auto");
        for (const e of possibleExits) {
          if (e.target && e.target !== nodeId) exitTargets.push(e.target);
        }
      }

      const bodySeeds = outgoingEdges.map(e => e.target).filter(t => t && t !== nodeId && !exitTargets.includes(t));

      const bodyNodes = new Set();
      const stack = [...bodySeeds];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (!cur) continue;
        if (cur === nodeId) continue;
        if (exitTargets.includes(cur)) continue;
        if (bodyNodes.has(cur)) continue;
        bodyNodes.add(cur);

        const curOutgoing = Object.values(this.edges).filter(e => e.source === cur);
        for (const oe of curOutgoing) {
          const tgt = oe.target;
          if (!tgt) continue;
          if (tgt === nodeId) continue;
          if (exitTargets.includes(tgt)) continue;
          if (!bodyNodes.has(tgt)) stack.push(tgt);
        }
      }

      let finalTargets = exitTargets.slice();
      if (finalTargets.length === 0 && this.getNode("n_end")) finalTargets = ["n_end"];

      for (const inEdge of incomingEdges) {
        for (const t of finalTargets) {
          if (!t) continue;
          if (inEdge.source === t) continue;
          if (this.getNode(inEdge.source) && this.getNode(t)) this.addEdge(inEdge.source, t, "auto");
        }
      }

      const bodyNodeIds = Array.from(bodyNodes);
      const edgesToRemove = Object.values(this.edges)
        .filter(e => {
          if (bodyNodeIds.includes(e.source) || bodyNodeIds.includes(e.target)) return !isLoopEdge(e.id);
          if (e.source === nodeId || e.target === nodeId) return true;
          return false;
        })
        .map(e => e.id);

      for (const eid of edgesToRemove) {
        if (isLoopEdge(eid) && !(eid === node.loopEdge || eid === node.loopExitEdge)) continue;
        this.removeEdge(eid);
      }

      for (const nid of bodyNodeIds) {
        if (this.getNode(nid)) {
          delete this.nodes[nid];
          console.log(`Loop body node ${nid} ถูกลบเนื่องจาก loop ${nodeId} ถูกลบ`);
        }
      }

      if (node.loopEdge && this.edges[node.loopEdge]) this.removeEdge(node.loopEdge);
      if (node.loopExitEdge && this.edges[node.loopExitEdge]) this.removeEdge(node.loopExitEdge);
    } else {
      targets = outgoingEdges.map(e => e.target).filter(t => t !== nodeId);

      for (const inEdge of incomingEdges) {
        for (const t of targets) {
          if (!t) continue;
          if (inEdge.source === t) continue;
          if (this.getNode(inEdge.source) && this.getNode(t)) this.addEdge(inEdge.source, t, "auto");
        }
      }

      if ((!targets || targets.length === 0) && this.getNode("n_end")) {
        targets = ["n_end"];
        for (const inEdge of incomingEdges) {
          if (this.getNode(inEdge.source) && this.getNode("n_end")) this.addEdge(inEdge.source, "n_end", "auto");
        }
      }

      const incomingNow = Object.values(this.edges).filter(e => e.target === nodeId).map(e => e.id).filter(id => !isLoopEdge(id));
      const outgoingNow = Object.values(this.edges).filter(e => e.source === nodeId).map(e => e.id).filter(id => !isLoopEdge(id));
      for (const eid of [...incomingNow, ...outgoingNow]) this.removeEdge(eid);
    }

    if (this.getNode(nodeId)) {
      delete this.nodes[nodeId];
      console.log(`Node ${nodeId} ถูกลบเรียบร้อย (rewired to: ${targets.join(", ")})`);
    }

    // หลังการลบ: scan for edges pointing to missing targets and rewire loop sources
    const existingNodeIds = new Set(Object.keys(this.nodes));

    const createLoopExitEdgeIfNeeded = (srcNode, newTarget) => {
      if (!srcNode || !newTarget) return;
      // do not create duplicate source->target
      const existing = this.findEdgeIdByEndpoints(srcNode.id, newTarget);
      if (existing) return;
      let cond = "auto";
      if (srcNode.type === "WH") cond = "false";
      if (srcNode.type === "FR") cond = "done";
      this.addEdge(srcNode.id, newTarget, cond);
      console.log(`Rewired loop exit: created edge ${srcNode.id}->${newTarget} condition=${cond}`);
    };

    const edgesNow = Object.values(this.edges).map(e => ({ id: e.id, source: e.source, target: e.target, condition: e.condition }));
    for (const e of edgesNow) {
      if (!existingNodeIds.has(e.target)) {
        const srcNode = this.getNode(e.source);
        if (srcNode && (srcNode.type === "WH" || srcNode.type === "FR")) {
          let replacement = null;
          if (targets && targets.length > 0) {
            replacement = targets[0];
          } else {
            const srcIncoming = Object.values(this.edges).filter(ed => ed.target === srcNode.id);
            const pred = srcIncoming.map(ed => ed.source).find(s => s && s !== srcNode.id && existingNodeIds.has(s));
            if (pred) replacement = pred;
            else replacement = (this.getNode("n_end") ? "n_end" : null);
          }

          if (replacement && replacement !== e.source) {
            createLoopExitEdgeIfNeeded(srcNode, replacement);
          }
          this.removeEdge(e.id);
        } else {
          this.removeEdge(e.id);
        }
      }
    }

    // cleanup lists
    Object.values(this.nodes).forEach(n => {
      n.outgoingEdgeIds = (n.outgoingEdgeIds || []).filter(id => this.edges[id]);
      n.incomingEdgeIds = (n.incomingEdgeIds || []).filter(id => this.edges[id]);
      if (n.loopExitEdge && !this.edges[n.loopExitEdge]) n.loopExitEdge = null;
      if (n.loopEdge && !this.edges[n.loopEdge]) n.loopEdge = null;
    });

    // recover loop edges/exit edges if possible
    Object.values(this.nodes).forEach(n => {
      if (!n) return;
      if (n.type !== "WH" && n.type !== "FR") return;

      if (!n.loopEdge || !this.edges[n.loopEdge]) {
        const selfLoop = Object.values(this.edges).find(e => e.source === n.id && e.target === n.id && (e.condition === "true" || e.condition === "next" || e.condition === "auto"));
        if (selfLoop) {
          n.loopEdge = selfLoop.id;
          if (!n.outgoingEdgeIds.includes(selfLoop.id)) n.outgoingEdgeIds.push(selfLoop.id);
          console.log(`Recovered loopEdge for ${n.id} => ${selfLoop.id}`);
        }
      }

      if (!n.loopExitEdge || !this.edges[n.loopExitEdge]) {
        const candidates = Object.values(this.edges).filter(e => e.source === n.id && e.target && this.getNode(e.target) && e.target !== n.id);
        const preferredOrder = (n.type === "WH") ? ["false", "auto", "done"] : ["done", "auto", "false"];
        let chosen = null;
        for (const pref of preferredOrder) {
          chosen = candidates.find(c => c.condition === pref);
          if (chosen) break;
        }
        if (!chosen && candidates.length > 0) chosen = candidates[0];

        if (chosen) {
          const desiredCond = (n.type === "WH") ? "false" : "done";
          if (chosen.condition !== desiredCond) {
            // create an exit edge with desired condition if none exists
            const existing = this.findEdgeIdByEndpoints(n.id, chosen.target);
            if (!existing) {
              const newExit = this.addEdge(n.id, chosen.target, desiredCond);
              n.loopExitEdge = newExit.id;
              if (!n.outgoingEdgeIds.includes(newExit.id)) n.outgoingEdgeIds.push(newExit.id);
              const tgtNode = this.getNode(chosen.target);
              if (tgtNode && !(tgtNode.incomingEdgeIds || []).includes(newExit.id)) tgtNode.incomingEdgeIds.push(newExit.id);

              // remove duplicates pointing to same target
              for (const eid of Object.keys(this.edges)) {
                const eo = this.edges[eid];
                if (!eo) continue;
                if (eo.source === n.id && eo.target === chosen.target && eid !== newExit.id) {
                  this.removeEdge(eid);
                  console.log(`Removed duplicate edge ${eid} pointing to ${chosen.target}`);
                }
              }

              console.log(`Recovered loopExitEdge for ${n.id} => ${newExit.id} (created with cond=${desiredCond})`);
            }
          } else {
            n.loopExitEdge = chosen.id;
            if (!n.outgoingEdgeIds.includes(chosen.id)) n.outgoingEdgeIds.push(chosen.id);
            const tgtNode = this.getNode(chosen.target);
            if (tgtNode && !(tgtNode.incomingEdgeIds || []).includes(chosen.id)) tgtNode.incomingEdgeIds.push(chosen.id);
            console.log(`Recovered loopExitEdge for ${n.id} => ${chosen.id} (cond=${chosen.condition})`);
          }
        } else {
          n.loopExitEdge = null;
        }
      }
    });

    // restore default start->end if needed
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
