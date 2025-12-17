// src/service/flowchart/classexecutor.js
import Context from "./classcontext.js";
import { getHandler } from "./nodeHandlers/index.js";

class Executor {
  constructor(flowchart, options = {}) {
    this.flowchart = flowchart;
    this.context = new Context();
    this.currentNodeId = (this.flowchart && (this.flowchart.startNodeId || this.flowchart.start)) 
  ? (this.flowchart.startNodeId || this.flowchart.start)
  : "n_start";
    this.finished = false;

    // Breakpoint
    this.paused = false;
    this._pendingNextEdgeId = null;

    this.stepCount = 0;
    this.history = [];

    this.options = Object.assign({}, options);

    if (this.flowchart && typeof this.options.inputProvider === "function") {
      this.flowchart._inputProvider = this.options.inputProvider;
    }

    const fcLimits =
      this.flowchart && typeof this.flowchart.getExecutionLimits === "function"
        ? this.flowchart.getExecutionLimits()
        : {};

    this.maxSteps = Number.isFinite(options.maxSteps)
      ? options.maxSteps
      : Number.isFinite(fcLimits.maxSteps)
      ? fcLimits.maxSteps
      : 100000;

    this.maxTimeMs = Number.isFinite(options.maxTimeMs)
      ? options.maxTimeMs
      : Number.isFinite(fcLimits.maxTimeMs)
      ? fcLimits.maxTimeMs
      : 5000;

    this.maxLoopIterationsPerNode = Number.isFinite(options.maxLoopIterationsPerNode)
      ? options.maxLoopIterationsPerNode
      : Number.isFinite(fcLimits.maxLoopIterationsPerNode)
      ? fcLimits.maxLoopIterationsPerNode
      : 20000;

    this._startTime = Date.now();
  }

  setInputProvider(fn) {
    if (typeof fn === "function") {
      this.options.inputProvider = fn;
      if (this.flowchart) this.flowchart._inputProvider = fn;
    } else {
      delete this.options.inputProvider;
      if (this.flowchart && this.flowchart._inputProvider) delete this.flowchart._inputProvider;
    }
  }

  /* ===================== STATE SNAPSHOT ===================== */

  serializeState() {
    try {
      const flowchartNodeInternal = {};

      if (this.flowchart && this.flowchart.nodes) {
        for (const [nid, node] of Object.entries(this.flowchart.nodes)) {
          flowchartNodeInternal[nid] = {
            _initialized: !!node._initialized,
            _phase: node._phase ?? null,
            _loopCount: Number(node._loopCount || 0),
            _scopePushed: !!node._scopePushed,
            _initValue:
              typeof node._initValue !== "undefined"
                ? node._initValue
                : null
          };
        }
      }

      return {
        currentNodeId: this.currentNodeId,
        finished: this.finished,
        paused: this.paused,
        stepCount: this.stepCount,

        context: {
          variables: JSON.parse(JSON.stringify(this.context.variables || [])),
          output: JSON.parse(JSON.stringify(this.context.output || [])),
          scopeStack: Array.isArray(this.context._scopeStack)
            ? JSON.parse(JSON.stringify(this.context._scopeStack))
            : [0]
        },

        flowchartNodeInternal
      };
    } catch (e) {
      console.warn("Executor.serializeState failed:", e);
      return null;
    }
  }

  restoreState(state) {
    if (!state || typeof state !== "object") return;

    try {
      this.currentNodeId = state.currentNodeId ?? this.currentNodeId;
      this.finished = !!state.finished;
      this.paused = !!state.paused;
      this.stepCount = Number(state.stepCount || 0);

      /* restore context (atomic, controller-style) */
      if (state.context) {
        this.context = new Context();

        if (Array.isArray(state.context.scopeStack)) {
          this.context._scopeStack = JSON.parse(
            JSON.stringify(state.context.scopeStack)
          );
        }

        if (Array.isArray(state.context.variables)) {
          for (const v of state.context.variables) {
            this.context.variables.push({ ...v });
          }
        }

        if (Array.isArray(state.context.output)) {
          this.context.output = [...state.context.output];
        }
      }

      /* restore node internals */
      if (state.flowchartNodeInternal && this.flowchart) {
        for (const [nid, snap] of Object.entries(state.flowchartNodeInternal)) {
          const node = this.flowchart.getNode(nid);
          if (!node) continue;

          node._initialized = !!snap._initialized;
          node._phase = snap._phase;
          node._loopCount = Number(snap._loopCount || 0);
          node._scopePushed = !!snap._scopePushed;
          node._initValue = snap._initValue;
        }
      }
    } catch (e) {
      console.warn("Executor.restoreState failed:", e);
    }
  }

  /* ===================== EXECUTION ===================== */

  step(stepOptions = {}) {
    const { forceAdvanceBP = false, ...handlerOptions } = stepOptions;

    if (this.finished) return { done: true, context: this.context };

    const elapsed = Date.now() - this._startTime;
    if (elapsed > this.maxTimeMs) {
      this.finished = true;
      return { error: new Error("Execution timeout"), done: true };
    }

    if (this.stepCount >= this.maxSteps) {
      this.finished = true;
      return { error: new Error("Max steps exceeded"), done: true };
    }

    if (this.paused) {
      if (!this._pendingNextEdgeId) {
        this.paused = false;
        return { paused: false, done: this.finished, context: this.context };
      }
      const edge = this.flowchart.getEdge(this._pendingNextEdgeId);
      if (!edge) {
        this.paused = false;
        this._pendingNextEdgeId = null;
        return { error: new Error("Pending edge not found"), done: true };
      }
      this.currentNodeId = edge.target;
      this.paused = false;
      this._pendingNextEdgeId = null;
    }

    const node = this.flowchart.getNode(this.currentNodeId);
    if (!node) throw new Error(`Node ${this.currentNodeId} not found`);

    const handler = getHandler(node.type);
    let result = {};
    try {
      result = handler(node, this.context, this.flowchart, handlerOptions) || {};
    } catch (err) {
      this.finished = true;
      return { error: err, done: true };
    }

    let nextEdgeId = null;
    const wantsReenter = !!result.reenter;

    if (!wantsReenter) {
      if (result.nextNode) nextEdgeId = result.nextNode;
      else {
        const autoEdge = (node.outgoingEdgeIds || [])
          .map(id => this.flowchart.getEdge(id))
          .find(e => e && e.condition === "auto");
        nextEdgeId = autoEdge?.id || node.outgoingEdgeIds?.[0];
      }
    }

    this.stepCount++;

    if (node.type === "BP" && !forceAdvanceBP) {
      this._pendingNextEdgeId = nextEdgeId;
      this.paused = true;
      return { paused: true, node, context: this.context };
    }

    if (!wantsReenter && nextEdgeId) {
      const edge = this.flowchart.getEdge(nextEdgeId);
      if (!edge) {
        this.finished = true;
      } else {
        this.currentNodeId = edge.target;
        const nextNode = this.flowchart.getNode(this.currentNodeId);
        if (nextNode?.type === "EN") this.finished = true;
      }
    }

    return { node, context: this.context, done: this.finished };
  }

  runAll(options = {}) {
    const { ignoreBreakpoints = false, ...handlerOptions } = options;
    this._startTime = Date.now();

    while (!this.finished) {
      const res = this.step({ forceAdvanceBP: ignoreBreakpoints, ...handlerOptions });
      if (res?.error || (this.paused && !ignoreBreakpoints)) break;
    }
    return this.context;
  }

  resume(options = {}) {
    return this.step(options);
  }

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
