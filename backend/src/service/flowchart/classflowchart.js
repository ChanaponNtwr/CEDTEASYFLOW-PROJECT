// src/service/flowchart/classflowchart.js
import Edge from "./classedge.js";
import Node from "./classnode.js";

class Flowchart {
  constructor() {
    this.nodes = {};
    this.edges = {};
    this._autoCounter = 1;
    this._edgeCounter = 1;

    this.maxSteps = 100000;
    this.maxTimeMs = 5000;
    this.maxLoopIterationsPerNode = 20000;

    const startNode = new Node("n_start", "ST", "Start", { label: "Start" });
    const endNode = new Node("n_end", "EN", "End", { label: "End" });
    this.addNode(startNode);
    this.addNode(endNode);

    const defaultId = "n_start-n_end";
    this._addEdgeInternal(
      new Edge(defaultId, startNode.id, endNode.id, "auto"),
    );
  }

  // ─── Limits ────────────────────────────────────────────────────────────────

  setExecutionLimits({ maxSteps, maxTimeMs, maxLoopIterationsPerNode } = {}) {
    if (Number.isFinite(maxSteps)) this.maxSteps = maxSteps;
    if (Number.isFinite(maxTimeMs)) this.maxTimeMs = maxTimeMs;
    if (Number.isFinite(maxLoopIterationsPerNode))
      this.maxLoopIterationsPerNode = maxLoopIterationsPerNode;
  }

  // ─── ID generators ─────────────────────────────────────────────────────────

  genId(prefix = "n") {
    let id;
    do {
      id = `${prefix}${this._autoCounter++}`;
    } while (this.getNode(id));
    return id;
  }

  _genEdgeId(prefix = "e") {
    let id;
    do {
      id = `${prefix}${this._edgeCounter++}`;
    } while (this.getEdge(id));
    return id;
  }

  // ─── Node helpers ──────────────────────────────────────────────────────────

  addNode(node) {
    if (!this.nodes[node.id]) {
      node.outgoingEdgeIds = node.outgoingEdgeIds || [];
      node.incomingEdgeIds = node.incomingEdgeIds || [];
      node.parentIfId = node.parentIfId ?? null;
      this.nodes[node.id] = node;
    } else {
      this.nodes[node.id].outgoingEdgeIds =
        this.nodes[node.id].outgoingEdgeIds || [];
      this.nodes[node.id].incomingEdgeIds =
        this.nodes[node.id].incomingEdgeIds || [];
      this.nodes[node.id].parentIfId = this.nodes[node.id].parentIfId ?? null;
    }
  }

  createNode(type, label = "", data = {}, position = { x: 0, y: 0 }) {
    const id = this.genId();
    const node = new Node(id, type, label, data, position);
    this.addNode(node);
    return node;
  }

  // ─── Edge helpers ──────────────────────────────────────────────────────────

  findEdgeIdByEndpoints(source, target) {
    const e = Object.values(this.edges).find(
      (ed) => ed.source === source && ed.target === target,
    );
    return e ? e.id : null;
  }

  /**
   * เพิ่ม edge ภายใน
   * FIX: ลบการสร้าง "PH" placeholder ออกทั้งหมด เพราะ "PH" ไม่มีใน NodeType
   *      และจะ throw error ทันทีที่ Node constructor ถูกเรียก
   *      แทนด้วย guard ที่ throw error ชัดเจนถ้า node ไม่มีอยู่จริง
   */
  _addEdgeInternal(edge) {
    if (!edge.id) edge.id = this._genEdgeId();
    if (this.edges[edge.id]) return;

    if (!this.nodes[edge.source]) {
      throw new Error(
        `_addEdgeInternal: source node "${edge.source}" ไม่มีอยู่ใน flowchart`,
      );
    }
    if (!this.nodes[edge.target]) {
      throw new Error(
        `_addEdgeInternal: target node "${edge.target}" ไม่มีอยู่ใน flowchart`,
      );
    }

    this.edges[edge.id] = edge;

    const sourceNode = this.nodes[edge.source];
    sourceNode.outgoingEdgeIds = sourceNode.outgoingEdgeIds || [];
    if (!sourceNode.outgoingEdgeIds.includes(edge.id))
      sourceNode.outgoingEdgeIds.push(edge.id);

    const targetNode = this.nodes[edge.target];
    targetNode.incomingEdgeIds = targetNode.incomingEdgeIds || [];
    if (!targetNode.incomingEdgeIds.includes(edge.id))
      targetNode.incomingEdgeIds.push(edge.id);
  }

  /**
   * สร้าง edge และเพิ่มเข้า flowchart
   * FIX: เพิ่ม duplicate guard — source+target+condition เหมือนกันจะไม่สร้างซ้ำ
   */
  addEdge(source, target, condition = "auto", id = null) {
    // รักษา canonical start→end id
    if (source === "n_start" && target === "n_end") {
      const existing = this.findEdgeIdByEndpoints(source, target);
      if (existing) return this.edges[existing];
      const eid = "n_start-n_end";
      const e = new Edge(eid, source, target, condition);
      this._addEdgeInternal(e);
      return e;
    }

    // FIX: ป้องกัน duplicate
    const dupEdge = Object.values(this.edges).find(
      (ed) =>
        ed.source === source &&
        ed.target === target &&
        ed.condition === condition,
    );
    if (dupEdge) return dupEdge;

    const eid = id || this._genEdgeId();
    if (this.edges[eid]) return this.edges[eid];
    const e = new Edge(eid, source, target, condition);
    this._addEdgeInternal(e);

    // ลบ default start→end เมื่อมี real edge ออกจาก n_start แล้ว
    try {
      if (source === "n_start") {
        const defaultId = this.findEdgeIdByEndpoints("n_start", "n_end");
        const srcNode = this.nodes[source];
        if (
          defaultId &&
          this.edges[defaultId] &&
          srcNode?.outgoingEdgeIds.includes(defaultId)
        ) {
          const others = srcNode.outgoingEdgeIds.filter((x) => x !== defaultId);
          if (others.length > 0) this.removeEdge(defaultId);
        }
      }
    } catch (err) {
      console.warn("addEdge post-check failed:", err);
    }

    return e;
  }

  removeEdge(edgeId) {
    const edge = this.edges[edgeId];
    if (!edge) return;
    const srcNode = this.nodes[edge.source];
    const tgtNode = this.nodes[edge.target];
    if (srcNode)
      srcNode.outgoingEdgeIds = (srcNode.outgoingEdgeIds || []).filter(
        (id) => id !== edgeId,
      );
    if (tgtNode)
      tgtNode.incomingEdgeIds = (tgtNode.incomingEdgeIds || []).filter(
        (id) => id !== edgeId,
      );
    delete this.edges[edgeId];
  }

  /**
   * เปลี่ยน target ของ edge
   * FIX: ลบการสร้าง "PH" placeholder — throw ถ้า newTarget ไม่มีอยู่จริง
   */
  updateEdgeTarget(edgeId, newTarget, newCondition = undefined) {
    const edge = this.edges[edgeId];
    if (!edge) throw new Error(`Edge ${edgeId} not found`);

    if (!this.nodes[newTarget]) {
      throw new Error(
        `updateEdgeTarget: target node "${newTarget}" ไม่มีอยู่ใน flowchart`,
      );
    }

    const oldTarget = edge.target;
    if (oldTarget === newTarget) {
      if (newCondition !== undefined) edge.condition = newCondition;
      return edge;
    }

    const oldT = this.nodes[oldTarget];
    if (oldT)
      oldT.incomingEdgeIds = (oldT.incomingEdgeIds || []).filter(
        (id) => id !== edgeId,
      );

    edge.target = newTarget;
    if (newCondition !== undefined) edge.condition = newCondition;

    const newT = this.nodes[newTarget];
    newT.incomingEdgeIds = newT.incomingEdgeIds || [];
    if (!newT.incomingEdgeIds.includes(edgeId))
      newT.incomingEdgeIds.push(edgeId);

    return edge;
  }

  chooseOutgoingEdgeId(
    nodeId,
    preferredConditions = ["auto", "true", "next", "false", "done"],
  ) {
    const node = this.getNode(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found`);
    if (!node.outgoingEdgeIds || node.outgoingEdgeIds.length === 0)
      throw new Error(`Node ${nodeId} has no outgoing edges`);
    const edges = node.outgoingEdgeIds
      .map((id) => this.getEdge(id))
      .filter(Boolean);
    for (const cond of preferredConditions) {
      const e = edges.find((ed) => ed.condition === cond);
      if (e) return e.id;
    }
    return node.outgoingEdgeIds[0];
  }

  // ─── Insert ────────────────────────────────────────────────────────────────

  /**
   * แทรก node ใหม่ตรงกลาง edge
   *
   * โครงสร้างหลังแทรก:
   *   ทั่วไป : source -[originalCond]→ newNode -["auto"]→ oldTarget
   *   IF     : source -[originalCond]→ IF -["true"] → BP -["auto"]→ oldTarget
   *                                       -["false"]→ BP  (merge point เดียวกัน)
   *   WH/FR  : source -[originalCond]→ LOOP -[loopCond]→ LOOP (self-loop)
   *                                          -[exitCond]→ oldTarget
   *
   * FIX 1: edge เดิม (source→newNode) คง originalCondition ไว้ ไม่ถูกทับด้วย "auto"
   * FIX 2: BP node ถูกสร้างด้วย type "BP" และ data { note: "" } ผ่าน Node validator
   * FIX 3: BP มี outgoing condition "auto" → oldTarget เสมอ ให้ runtime เดินต่อได้
   * FIX 4: เก็บ bpNodeId, trueEdge, falseEdge บน IF node เพื่อใช้ตอน removeNode
   */
  insertNodeAtEdge(edgeId, newNode, edgeLabel = "auto") {
    const edge = this.edges[edgeId];
    if (!edge) throw new Error(`ไม่พบ edge id = ${edgeId}`);

    const { source, target: oldTarget } = edge;
    const sourceNode = this.getNode(source);

    // ✅ resolve scope ให้ถูกก่อน
    const scopeIfId = this._resolveParentIfIdForEdge(edgeId);

    // ✅ node ใหม่อยู่ใน scope เดียวกับ edge ที่ถูก split
    newNode.parentIfId = scopeIfId;

    this.addNode(newNode);

    if (edge.id === "n_start-n_end") {
      const created = this.addEdge(source, newNode.id, "auto");
      newNode.incomingEdgeIds = newNode.incomingEdgeIds || [];
      if (!newNode.incomingEdgeIds.includes(created.id)) {
        newNode.incomingEdgeIds.push(created.id);
      }

      if (this.edges[edgeId]) {
        const srcNode = this.getNode(source);
        const others = (srcNode?.outgoingEdgeIds || []).filter(
          (x) => x !== edgeId,
        );
        if (others.length > 0) this.removeEdge(edgeId);
      }
    } else {
      this.updateEdgeTarget(edgeId, newNode.id);
    }

    if (newNode.type === "IF") {
      const bpNodeId = `bp_${newNode.id}`;
      const bpNode = new Node(bpNodeId, "BP", "BP", { note: "" });
      bpNode.parentIfId = newNode.id;
      this.addNode(bpNode);

      const eTrue = this.addEdge(newNode.id, bpNodeId, "true");
      const eFalse = this.addEdge(newNode.id, bpNodeId, "false");
      this.addEdge(bpNodeId, oldTarget, "auto");

      newNode.bpNodeId = bpNodeId;
      newNode.trueEdge = eTrue.id;
      newNode.falseEdge = eFalse.id;
      newNode.loopEdge = null;
      newNode.loopExitEdge = null;
    } else if (newNode.type === "WH" || newNode.type === "FR") {
      const loopCond = newNode.type === "WH" ? "true" : "next";
      const exitCond = newNode.type === "WH" ? "false" : "done";

      const loopE = this.addEdge(newNode.id, newNode.id, loopCond);
      const exitE = this.addEdge(newNode.id, oldTarget, exitCond);
      newNode.loopEdge = loopE?.id ?? loopE;
      newNode.loopExitEdge = exitE?.id ?? exitE;
    } else {
      this.addEdge(newNode.id, oldTarget, "auto");
    }

    Object.values(this.nodes).forEach((n) => {
      if (n.loopExitEdge === edgeId) n.loopExitEdge = edgeId;
      if (n.loopEdge === edgeId) n.loopEdge = edgeId;
    });

    console.log(`Node ${newNode.id} ถูกแทรกระหว่าง edge ${edgeId}`);
  }

  insertAfterNode(nodeId, newNode, preferredConditions = ["auto"]) {
    const edgeId = this.chooseOutgoingEdgeId(nodeId, preferredConditions);
    this.insertNodeAtEdge(edgeId, newNode);
    return newNode;
  }

  insertIntoLoopBody(loopNodeId, newNode) {
    const loopNode = this.getNode(loopNodeId);
    if (!loopNode) throw new Error(`Loop node ${loopNodeId} not found`);
    if (!loopNode.loopEdge)
      throw new Error(`Loop node ${loopNodeId} has no loopEdge`);
    this.insertNodeAtEdge(loopNode.loopEdge, newNode);
    return newNode;
  }

  insertAtLoopExit(loopNodeId, newNode) {
    const loopNode = this.getNode(loopNodeId);
    if (!loopNode) throw new Error(`Loop node ${loopNodeId} not found`);
    if (!loopNode.loopExitEdge)
      throw new Error(`Loop node ${loopNodeId} has no loopExitEdge`);
    this.insertNodeAtEdge(loopNode.loopExitEdge, newNode);
    return newNode;
  }

  _resolveParentIfIdForEdge(edgeId) {
    const edge = this.edges[edgeId];
    if (!edge) return null;

    const sourceNode = this.getNode(edge.source);
    const targetNode = this.getNode(edge.target);

    // เริ่ม branch ใหม่จาก IF node => scope คือ IF ตัวนั้น
    if (sourceNode?.type === "IF") {
      return sourceNode.id;
    }

    // edge ออกจาก BP:
    // - ถ้าไป BP อีกตัว ให้ใช้ outer scope ของ target BP
    // - ถ้าไป node ปกติ ให้ใช้ scope ของ target ถ้ามี
    // - ถ้าไม่มี ให้ถือว่าอยู่นอก IF แล้ว
    if (sourceNode?.type === "BP") {
      if (targetNode?.type === "BP") {
        return targetNode.parentIfId ?? null;
      }
      return targetNode?.parentIfId ?? null;
    }

    // ถ้าปลายทางเป็น BP ให้ใช้ scope ของ BP นั้น
    if (targetNode?.type === "BP") {
      return targetNode.parentIfId ?? null;
    }

    // กรณีทั่วไป: ใช้ scope ที่มีอยู่จากฝั่ง source ก่อน
    if (sourceNode?.parentIfId) return sourceNode.parentIfId;
    if (targetNode?.parentIfId) return targetNode.parentIfId;

    return null;
  }

  // ─── Internal cleanup helpers ─────────────────────────────────────────────

  _collectReachableNodeIds(startId = "n_start") {
    const visited = new Set();
    const stack = [startId];

    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur || visited.has(cur)) continue;

      const node = this.getNode(cur);
      if (!node) continue;

      visited.add(cur);

      for (const eid of node.outgoingEdgeIds || []) {
        const e = this.getEdge(eid);
        if (e && e.target && !visited.has(e.target)) {
          stack.push(e.target);
        }
      }
    }

    return visited;
  }

  _cleanupDanglingRefs() {
    // ลบ edge ที่ปลายทางหรือ source หายไป
    for (const eid of Object.keys(this.edges)) {
      const e = this.edges[eid];
      if (!e) continue;
      if (!this.nodes[e.source] || !this.nodes[e.target]) {
        this.removeEdge(eid);
      }
    }

    // sync refs ใน node
    Object.values(this.nodes).forEach((n) => {
      n.outgoingEdgeIds = (n.outgoingEdgeIds || []).filter(
        (id) => this.edges[id],
      );
      n.incomingEdgeIds = (n.incomingEdgeIds || []).filter(
        (id) => this.edges[id],
      );

      if (n.loopEdge && !this.edges[n.loopEdge]) n.loopEdge = null;
      if (n.loopExitEdge && !this.edges[n.loopExitEdge]) n.loopExitEdge = null;
      if (n.bpNodeId && !this.nodes[n.bpNodeId]) n.bpNodeId = null;
      if (n.parentIfId && !this.nodes[n.parentIfId]) n.parentIfId = null;
    });
  }

  _repairLoopConnections() {
    for (const n of Object.values(this.nodes)) {
      if (!n || (n.type !== "WH" && n.type !== "FR")) continue;

      // ซ่อม loopEdge
      if (!n.loopEdge || !this.edges[n.loopEdge]) {
        const selfLoop = Object.values(this.edges).find(
          (e) =>
            e.source === n.id &&
            e.target === n.id &&
            (e.condition === "true" ||
              e.condition === "next" ||
              e.condition === "auto"),
        );
        if (selfLoop) {
          n.loopEdge = selfLoop.id;
        }
      }

      // ซ่อม loopExitEdge
      if (!n.loopExitEdge || !this.edges[n.loopExitEdge]) {
        const candidates = Object.values(this.edges).filter(
          (e) =>
            e.source === n.id &&
            e.target &&
            this.getNode(e.target) &&
            e.target !== n.id,
        );

        const preferredOrder =
          n.type === "WH"
            ? ["false", "auto", "done"]
            : ["done", "auto", "false"];

        let chosen = null;
        for (const pref of preferredOrder) {
          chosen = candidates.find((c) => c.condition === pref);
          if (chosen) break;
        }
        if (!chosen && candidates.length > 0) chosen = candidates[0];

        if (chosen) {
          n.loopExitEdge = chosen.id;
        } else if (this.getNode("n_end")) {
          const desiredCond = n.type === "WH" ? "false" : "done";
          const created = this.addEdge(n.id, "n_end", desiredCond);
          n.loopExitEdge = created.id;
        }
      }

      // sync ids
      n.outgoingEdgeIds = n.outgoingEdgeIds || [];
      if (
        n.loopEdge &&
        this.edges[n.loopEdge] &&
        !n.outgoingEdgeIds.includes(n.loopEdge)
      ) {
        n.outgoingEdgeIds.push(n.loopEdge);
      }
      if (
        n.loopExitEdge &&
        this.edges[n.loopExitEdge] &&
        !n.outgoingEdgeIds.includes(n.loopExitEdge)
      ) {
        n.outgoingEdgeIds.push(n.loopExitEdge);
      }
    }
  }

  // ─── Remove ────────────────────────────────────────────────────────────────

  removeNode(nodeId) {
    const node = this.nodes[nodeId];
    if (!node) return;
    if (node.type === "ST" || node.type === "EN") return;

    const isLoopEdge = (edgeId) =>
      Object.values(this.nodes).some(
        (n) => n.loopEdge === edgeId || n.loopExitEdge === edgeId,
      );

    const allEdges = Object.values(this.edges);
    const incomingEdges = allEdges.filter((e) => e.target === nodeId);
    const outgoingEdges = allEdges.filter((e) => e.source === nodeId);

    let targets = [];

    // ── IF ──────────────────────────────────────────────────────────────────
    if (node.type === "IF") {
      const bpId = node.bpNodeId || `bp_${nodeId}`;
      const bpNode = this.getNode(bpId);

      if (bpNode) {
        // หา body nodes ใต้ IF แบบ DFS แต่หยุดที่ BP
        const bodyNodes = new Set();
        const stack = outgoingEdges
          .map((e) => e.target)
          .filter((t) => t && t !== nodeId && t !== bpId);

        while (stack.length > 0) {
          const cur = stack.pop();
          if (!cur || cur === bpId || cur === nodeId || bodyNodes.has(cur))
            continue;

          const curNode = this.getNode(cur);
          if (!curNode) continue;

          bodyNodes.add(cur);

          for (const oe of Object.values(this.edges)) {
            if (oe.source !== cur) continue;
            if (!oe.target || oe.target === bpId || oe.target === nodeId)
              continue;
            if (!bodyNodes.has(oe.target)) stack.push(oe.target);
          }
        }

        // reconnect incoming ของ IF → BP
        for (const inEdge of incomingEdges) {
          if (!inEdge || inEdge.source === bpId) continue;
          if (bodyNodes.has(inEdge.source)) continue;
          if (this.getNode(inEdge.source)) {
            this.addEdge(inEdge.source, bpId, inEdge.condition || "auto");
          }
        }

        // ลบ edges + nodes ใน body
        for (const nid of bodyNodes) {
          const relatedEdges = Object.values(this.edges)
            .filter((e) => e.source === nid || e.target === nid)
            .map((e) => e.id);

          for (const eid of relatedEdges) {
            if (!isLoopEdge(eid)) this.removeEdge(eid);
          }

          if (this.getNode(nid)) {
            delete this.nodes[nid];
            console.log(
              `IF body node ${nid} cascade-deleted with IF ${nodeId}`,
            );
          }
        }

        // ลบ edges ของ IF เอง
        const edgesToRemove = [
          ...incomingEdges.map((e) => e.id),
          ...outgoingEdges.map((e) => e.id),
        ].filter((id) => !isLoopEdge(id));

        for (const eid of Array.from(new Set(edgesToRemove))) {
          this.removeEdge(eid);
        }

        delete this.nodes[nodeId];
        console.log(`IF node ${nodeId} ถูกลบ, incoming rewired → BP ${bpId}`);

        // ถ้า BP ไม่มี incoming แล้ว ให้ลบ BP ทิ้งด้วย
        const bpNow = this.getNode(bpId);
        if (
          bpNow &&
          (!bpNow.incomingEdgeIds || bpNow.incomingEdgeIds.length === 0)
        ) {
          const bpEdges = Object.values(this.edges)
            .filter((e) => e.source === bpId || e.target === bpId)
            .map((e) => e.id);

          for (const eid of bpEdges) this.removeEdge(eid);
          delete this.nodes[bpId];
          console.log(`BP ${bpId} cascade-deleted (no incoming left)`);
        }
      } else {
        // fallback: ไม่มี BP → reconnect incoming ไปยัง outgoing โดยตรง
        targets = outgoingEdges
          .map((e) => e.target)
          .filter((t) => t && t !== nodeId);

        for (const inEdge of incomingEdges) {
          for (const t of targets) {
            if (!t || inEdge.source === t) continue;
            if (this.getNode(inEdge.source) && this.getNode(t)) {
              this.addEdge(inEdge.source, t, inEdge.condition || "auto");
            }
          }
        }

        const toRemove = [
          ...incomingEdges.filter((e) => !isLoopEdge(e.id)).map((e) => e.id),
          ...outgoingEdges.filter((e) => !isLoopEdge(e.id)).map((e) => e.id),
        ];

        for (const eid of Array.from(new Set(toRemove))) this.removeEdge(eid);
        delete this.nodes[nodeId];
      }

      // ── WH / FR ────────────────────────────────────────────────────────────
    } else if (node.type === "WH" || node.type === "FR") {
      const exitTargets = [];

      if (node.loopExitEdge && this.edges[node.loopExitEdge]) {
        const exitEdge = this.edges[node.loopExitEdge];
        if (exitEdge?.target && exitEdge.target !== nodeId) {
          exitTargets.push(exitEdge.target);
        }
      }

      if (exitTargets.length === 0) {
        for (const e of outgoingEdges) {
          if (
            (e.condition === "false" ||
              e.condition === "done" ||
              e.condition === "auto") &&
            e.target &&
            e.target !== nodeId &&
            !exitTargets.includes(e.target)
          ) {
            exitTargets.push(e.target);
          }
        }
      }

      const bodySeeds = outgoingEdges
        .map((e) => e.target)
        .filter((t) => t && t !== nodeId && !exitTargets.includes(t));

      const bodyNodes = new Set();
      const stack = [...bodySeeds];

      while (stack.length > 0) {
        const cur = stack.pop();
        if (
          !cur ||
          cur === nodeId ||
          exitTargets.includes(cur) ||
          bodyNodes.has(cur)
        )
          continue;

        const curNode = this.getNode(cur);
        if (!curNode) continue;

        bodyNodes.add(cur);

        for (const oe of Object.values(this.edges)) {
          if (oe.source !== cur) continue;
          if (
            !oe.target ||
            oe.target === nodeId ||
            exitTargets.includes(oe.target)
          )
            continue;
          if (!bodyNodes.has(oe.target)) stack.push(oe.target);
        }
      }

      const finalTargets =
        exitTargets.length > 0
          ? exitTargets
          : this.getNode("n_end")
            ? ["n_end"]
            : [];

      // reconnect incoming ไปยัง exit
      for (const inEdge of incomingEdges) {
        for (const t of finalTargets) {
          if (!t || inEdge.source === t) continue;
          if (this.getNode(inEdge.source) && this.getNode(t)) {
            this.addEdge(inEdge.source, t, inEdge.condition || "auto");
          }
        }
      }

      // ลบ body nodes
      for (const nid of bodyNodes) {
        const relatedEdges = Object.values(this.edges)
          .filter((e) => e.source === nid || e.target === nid)
          .map((e) => e.id);

        for (const eid of relatedEdges) {
          if (!isLoopEdge(eid)) this.removeEdge(eid);
        }

        if (this.getNode(nid)) {
          delete this.nodes[nid];
          console.log(
            `Loop body node ${nid} ถูกลบเนื่องจาก loop ${nodeId} ถูกลบ`,
          );
        }
      }

      // ลบ edges ของ loop node เอง
      const nodeEdgesToRemove = [
        ...incomingEdges.map((e) => e.id),
        ...outgoingEdges.map((e) => e.id),
      ].filter((id) => !isLoopEdge(id));

      for (const eid of Array.from(new Set(nodeEdgesToRemove))) {
        this.removeEdge(eid);
      }

      if (node.loopEdge && this.edges[node.loopEdge])
        this.removeEdge(node.loopEdge);
      if (node.loopExitEdge && this.edges[node.loopExitEdge])
        this.removeEdge(node.loopExitEdge);

      delete this.nodes[nodeId];

      // ── Node ทั่วไป ──────────────────────────────────────────────────────────
    } else {
      targets = outgoingEdges
        .map((e) => e.target)
        .filter((t) => t && t !== nodeId);

      for (const inEdge of incomingEdges) {
        for (const t of targets) {
          if (!t || inEdge.source === t) continue;
          if (this.getNode(inEdge.source) && this.getNode(t)) {
            this.addEdge(inEdge.source, t, inEdge.condition || "auto");
          }
        }
      }

      if ((!targets || targets.length === 0) && this.getNode("n_end")) {
        targets = ["n_end"];
        for (const inEdge of incomingEdges) {
          if (this.getNode(inEdge.source)) {
            this.addEdge(inEdge.source, "n_end", inEdge.condition || "auto");
          }
        }
      }

      const inNow = Object.values(this.edges)
        .filter((e) => e.target === nodeId && !isLoopEdge(e.id))
        .map((e) => e.id);

      const outNow = Object.values(this.edges)
        .filter((e) => e.source === nodeId && !isLoopEdge(e.id))
        .map((e) => e.id);

      for (const eid of [...inNow, ...outNow]) this.removeEdge(eid);
      delete this.nodes[nodeId];

      console.log(
        `Node ${nodeId} ถูกลบเรียบร้อย (rewired to: ${targets.join(", ")})`,
      );
    }

    // ─── Final cleanup ───────────────────────────────────────────────────────

    this._cleanupDanglingRefs();
    this._repairLoopConnections();
    this._cleanupDanglingRefs();

    // ลบ node ที่ unreachable จริง ๆ แต่ไม่แตะ ST/EN
    const reachable = this._collectReachableNodeIds("n_start");
    for (const nid of Object.keys(this.nodes)) {
      if (nid === "n_start" || nid === "n_end") continue;
      if (!reachable.has(nid)) {
        delete this.nodes[nid];
        console.log(`🧹 cleanup: removed unreachable node ${nid}`);
      }
    }

    this._cleanupDanglingRefs();

    // restore default start→end ถ้า n_start ไม่มี outgoing เหลือ
    const startNode = this.getNode("n_start");
    if (
      startNode &&
      (!startNode.outgoingEdgeIds || startNode.outgoingEdgeIds.length === 0)
    ) {
      if (this.getNode("n_end") && !this.edges["n_start-n_end"]) {
        this._addEdgeInternal(
          new Edge("n_start-n_end", "n_start", "n_end", "auto"),
        );
      }
    }
  }

  getNode(id) {
    return this.nodes[id];
  }

  getEdge(id) {
    return this.edges[id];
  }
}

export default Flowchart;
