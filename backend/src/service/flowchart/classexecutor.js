import Context from "./classcontext.js";
import { getHandler } from "./nodeHandlers/index.js";

class Executor {
    constructor(flowchart, options = {}) {
        this.flowchart = flowchart;
        this.context = new Context();
        this.currentNodeId = "n_start";
        this.finished = false; // flag บอกว่าจบหรือยัง

        // สำหรับ Breakpoint
        this.paused = false;
        this._pendingNextEdgeId = null;

        this.stepCount = 0; // นับจำนวน step ที่ทำไปแล้ว
        this.history = []; // เก็บประวัติการทำงาน

        // อ่าน limits จาก flowchart (ถ้ามี) — ถ้าไม่มีใช้ค่าดีฟอลต์
        const fcLimits = (flowchart && typeof flowchart.getExecutionLimits === "function")
          ? flowchart.getExecutionLimits()
          : {};

        // ตั้งค่าขีดจำกัดต่างๆ (step/time/loop) — ให้ options มี priority ก่อน แล้ว fallback ไปที่ flowchart limits
        this.maxSteps = Number.isFinite(options.maxSteps) ? options.maxSteps
                       : (Number.isFinite(fcLimits.maxSteps) ? fcLimits.maxSteps : 100000);

        this.maxTimeMs = Number.isFinite(options.maxTimeMs) ? options.maxTimeMs
                       : (Number.isFinite(fcLimits.maxTimeMs) ? fcLimits.maxTimeMs : 5000);

        this.maxLoopIterationsPerNode = Number.isFinite(options.maxLoopIterationsPerNode) ? options.maxLoopIterationsPerNode
                       : (Number.isFinite(fcLimits.maxLoopIterationsPerNode) ? fcLimits.maxLoopIterationsPerNode : 20000);

        this._startTime = Date.now(); // เวลาเริ่มต้น
    }

    // เดินโปรแกรม 1 step
    step(options = {}) {
        const { forceAdvanceBP = false } = options;

        if (this.finished) return { done: true, context: this.context };
        
        // ตรวจสอบเวลาเกินกำหนด
        const elapsed = Date.now() - this._startTime;
        if (elapsed > this.maxTimeMs) {
            const err = new Error(`⏱️ Execution time limit exceeded (${elapsed}ms > ${this.maxTimeMs}ms)`);
            console.error(err.message);
            this.finished = true;
            return { error: err, done: true, context: this.context };
        }
        // ตรวจสอบ step เกินกำหนด
        if (this.stepCount >= this.maxSteps) {
            const err = new Error(`⚠️ Max step count exceeded (${this.stepCount} >= ${this.maxSteps})`);
            console.error(err.message);
            this.finished = true;
            return { error: err, done: true, context: this.context };
        }

        // ถ้าหยุดอยู่ที่ Breakpoint → resume ไปยัง edge ที่ค้างอยู่
        if (this.paused) {
            if (!this._pendingNextEdgeId) {
                console.warn("Executor.step: paused but no pending edge — clearing pause");
                this.paused = false;
                return { paused: false, done: this.finished, context: this.context };
            }
            const pendingEdge = this.flowchart.getEdge(this._pendingNextEdgeId);
            if (!pendingEdge) {
                console.error(`⚠️ Pending edge ${this._pendingNextEdgeId} not found when resuming from breakpoint`);
                this.paused = false;
                this._pendingNextEdgeId = null;
                return { error: new Error("Pending edge not found"), done: this.finished, context: this.context };
            }
            // ไป node ถัดไป แล้วเคลียร์ paused
            this.currentNodeId = pendingEdge.target;
            this.paused = false;
            this._pendingNextEdgeId = null;
        }
        // ดึง node ปัจจุบัน
        const node = this.flowchart.getNode(this.currentNodeId);
        if (!node) throw new Error(`Node ${this.currentNodeId} not found`);

        console.log(`➡️ Step ${this.stepCount + 1}: Executing node ${node.id} (${node.type})`);

        // หา handler ตามประเภท node
        const handler = getHandler(node.type);
        let result = {};
        try {
            result = handler(node, this.context, this.flowchart) || {};
        } catch (err) {
            console.error(`❌ Error in handler for node ${node.id} (${node.type}):`, err.message);
            this.finished = true;
            return { error: err, node, context: this.context, done: true };
        }

        // ตัดสินใจว่าจะไป edge ไหนต่อ
        let nextEdgeId = null;

        if (["WH","FR"].includes(node.type)) {
            nextEdgeId = result.nextNode || node.loopExitEdge || node.outgoingEdgeIds[0];
        } else if (node.type === "IF") {
            const outgoingEdges = node.outgoingEdgeIds.map(id => this.flowchart.getEdge(id)).filter(e => e);
            if (result.nextCondition) {
                const edge = outgoingEdges.find(e => e.condition === result.nextCondition);
                if (edge) nextEdgeId = edge.id;
            }
            if (!nextEdgeId) {
                const autoEdge = outgoingEdges.find(e => e.condition === "auto");
                if (autoEdge) nextEdgeId = autoEdge.id;
            }
        } else { // Node ปกติ
            const autoEdge = node.outgoingEdgeIds.map(id => this.flowchart.getEdge(id)).find(e => e && e.condition === "auto");
            nextEdgeId = autoEdge ? autoEdge.id : node.outgoingEdgeIds[0];
        }

        // เก็บ context snapshot ลง history
        try {
            this.history.push({ nodeId: node.id, context: JSON.parse(JSON.stringify(this.context)) });
        } catch (e) {
            // safety: if snapshot fails, still continue
            console.warn("Failed to snapshot context for history:", e);
        }
        this.stepCount++;

        // ถ้าเจอ Breakpoint (BP) → หยุดไว้
        if (node.type === "BP" && !forceAdvanceBP) {
            if (nextEdgeId) this._pendingNextEdgeId = nextEdgeId;
            else this._pendingNextEdgeId = null;
            this.paused = true;
            console.log(`⏸️ Hit breakpoint at ${node.id}; execution paused. Call step() or resume() to continue.`);
            return { node, context: this.context, paused: true, done: false };
        }

        // ไป node ถัดไป
        if (nextEdgeId) {
            const nextEdge = this.flowchart.getEdge(nextEdgeId);
            if (!nextEdge) {
                console.error(`⚠️ Edge ${nextEdgeId} not found`);
                this.finished = true;
            } else {
                this.currentNodeId = nextEdge.target;
                const nextNode = this.flowchart.getNode(this.currentNodeId);
                if (nextNode && nextNode.type === "EN") {
                    console.log("✅ Reached End Node");
                    this.finished = true;
                }
            }
        } else {
            console.log("⚠️ No next edge, stopping execution");
            this.finished = true;
        }

        return { node, context: this.context, done: this.finished, paused: false };
    }

    // รันทั้งหมดจนกว่าจะจบ หรือหยุดที่ BP
    runAll(options = {}) {
        const { ignoreBreakpoints = false } = options;
        this._startTime = Date.now();

        while (!this.finished) {
            const res = this.step({ forceAdvanceBP: ignoreBreakpoints });
            if (res && res.error) break;
            // if paused and we're not ignoring breakpoints, stop the loop to let caller handle resume
            if (this.paused && !ignoreBreakpoints) break;
            // otherwise continue
        }
        return this.context;
    }

    // Resume ต่อจาก Breakpoint (เหมือนเรียก step อีกครั้ง)
    resume() {
        if (!this.paused) {
            // If not paused, do nothing but run one step
            return this.step();
        }
        return this.step();
    }
    
    // Reset executor กลับค่าเริ่มต้น
    reset() {
        this.context = new Context();
        this.currentNodeId = "n_start";
        this.finished = false;
        this.paused = false;
        this._pendingNextEdgeId = null;
        this.stepCount = 0;
        this.history = [];
        this._startTime = Date.now();
    }
}

export default Executor;
