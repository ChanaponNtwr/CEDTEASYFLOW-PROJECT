// src/service/flowchart/classexecutor.js
import Context from "./classcontext.js";
import { getHandler } from "./nodehandlers/index.js";

class Executor {
  constructor(flowchart, options = {}) {
    this.flowchart = flowchart;
    this.context = new Context();
    // choose start node from flowchart when available (fallback n_start)
    this.currentNodeId =
      (this.flowchart && (this.flowchart.startNodeId || this.flowchart.start)) ||
      "n_start";
    this.finished = false;

    // Breakpoint
    this.paused = false;
    this._pendingNextEdgeId = null;

    this.stepCount = 0;
    this.history = [];

    // store default options (can include inputProvider)
    this.options = Object.assign({}, options);

    // expose provider onto flowchart if provided at construction time
    if (this.flowchart && typeof this.options.inputProvider === "function") {
      this.flowchart._inputProvider = this.options.inputProvider;
    }

    // read limits from flowchart if available (fallback empty)
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

    this.maxLoopIterationsPerNode = Number.isFinite(
      options.maxLoopIterationsPerNode
    )
      ? options.maxLoopIterationsPerNode
      : Number.isFinite(fcLimits.maxLoopIterationsPerNode)
      ? fcLimits.maxLoopIterationsPerNode
      : 20000;

    this._startTime = Date.now();
  }

  // helper: set inputProvider at runtime (exposed to handlers via flowchart._inputProvider)
  setInputProvider(fn) {
    if (typeof fn === "function") {
      this.options.inputProvider = fn;
      if (this.flowchart) this.flowchart._inputProvider = fn;
    } else {
      delete this.options.inputProvider;
      if (this.flowchart && this.flowchart._inputProvider) delete this.flowchart._inputProvider;
    }
  }

  /**
   * === State serialization helpers ===
   * These let you save/restore execution state between separate Executor instances,
   * which is required to make step/resume across HTTP calls work correctly.
   *
   * serializeState() -> returns plain object
   * restoreState(state) -> restores executor/context/flowchart node internals
   */

  // Create a compact state snapshot safe for JSON serialization
  serializeState() {
    try {
      const nodesState = {};
      if (this.flowchart && this.flowchart.nodes) {
        for (const [nid, nodeObj] of Object.entries(this.flowchart.nodes)) {
          nodesState[nid] = {
            // persist only the internal props that handlers rely on
            _initialized: Boolean(nodeObj._initialized),
            _phase: nodeObj._phase || null,
            _loopCount: Number(nodeObj._loopCount || 0),
            _scopePushed: Boolean(nodeObj._scopePushed),
            _initValue:
              typeof nodeObj._initValue !== "undefined" ? nodeObj._initValue : null
          };
        }
      }

      const ctx = {
        variables: Array.isArray(this.context.variables) ? this.context.variables : [],
        output: Array.isArray(this.context.output) ? this.context.output : []
      };

      // Attempt to persist internal scope stack if present (Context implementation dependent)
      if (Array.isArray(this.context._scopeStack)) {
        try {
          ctx._scopeStack = JSON.parse(JSON.stringify(this.context._scopeStack));
        } catch (e) {
          ctx._scopeStack = undefined;
        }
      }

      const state = {
        currentNodeId: this.currentNodeId,
        finished: this.finished,
        paused: this.paused,
        stepCount: this.stepCount,
        context: ctx,
        nodesState
      };

      return state;
    } catch (e) {
      console.warn("Executor.serializeState failed:", e);
      return null;
    }
  }

  // Restore previously serialized state into this Executor instance
  restoreState(state) {
    if (!state || typeof state !== "object") return;

    try {
      if ("currentNodeId" in state) this.currentNodeId = state.currentNodeId;
      if ("finished" in state) this.finished = Boolean(state.finished);
      if ("paused" in state) this.paused = Boolean(state.paused);
      if ("stepCount" in state) this.stepCount = Number(state.stepCount || 0);

      // Restore context
      if (state.context && typeof state.context === 'object') {
        try {
          // If Context supports internal _scopeStack, restore that first
          if (Array.isArray(state.context._scopeStack) && Array.isArray(this.context._scopeStack)) {
            this.context._scopeStack = JSON.parse(JSON.stringify(state.context._scopeStack));
            if (typeof this.context._syncVariables === "function") this.context._syncVariables();
          } else if (Array.isArray(state.context.variables)) {
            for (const v of state.context.variables) {
              if (v && v.name) {
                try {
                  this.context.set(v.name, v.value, v.varType);
                } catch (e) {
                  try {
                    this.context.variables = this.context.variables || [];
                    const existingIndex = this.context.variables.findIndex(x => x.name === v.name);
                    if (existingIndex !== -1) this.context.variables[existingIndex] = { name: v.name, value: v.value, varType: v.varType };
                    else this.context.variables.push({ name: v.name, value: v.value, varType: v.varType });
                    if (typeof this.context._rebuildIndexMap === "function") this.context._rebuildIndexMap();
                  } catch (ee) { /* ignore */ }
                }
              }
            }
            if (typeof this.context._syncVariables === "function") this.context._syncVariables();
          }

          if (Array.isArray(state.context.output)) this.context.output = Array.from(state.context.output);
        } catch (e) {
          console.warn("Executor.restoreState: context restore partial failure:", e);
        }
      }

      // restore nodes internal state (only known small set)
      if (state.nodesState && this.flowchart && this.flowchart.nodes) {
        for (const [nid, snapshot] of Object.entries(state.nodesState)) {
          const node = this.flowchart.getNode(nid);
          if (!node || !snapshot) continue;
          if ('_initialized' in snapshot) node._initialized = Boolean(snapshot._initialized);
          if ('_phase' in snapshot) node._phase = snapshot._phase;
          if ('_loopCount' in snapshot) node._loopCount = Number(snapshot._loopCount || 0);
          if ('_scopePushed' in snapshot) node._scopePushed = Boolean(snapshot._scopePushed);
          if ('_initValue' in snapshot) node._initValue = snapshot._initValue;
        }
      }
    } catch (e) {
      console.warn("Executor.restoreState failed:", e);
    }
  }

  // stepOptions may include: { forceAdvanceBP, inputProvider, ... }
  step(stepOptions = {}) {
    const { forceAdvanceBP = false, ...handlerOptions } = stepOptions;

    if (this.finished) return { done: true, context: this.context };

    // update start time check
    const elapsed = Date.now() - this._startTime;
    if (elapsed > this.maxTimeMs) {
      const err = new Error(`⏱️ Execution time limit exceeded (${elapsed}ms > ${this.maxTimeMs}ms)`);
      console.error(err.message);
      this.finished = true;
      return { error: err, done: true, context: this.context };
    }

    if (this.stepCount >= this.maxSteps) {
      const err = new Error(`⚠️ Max step count exceeded (${this.stepCount} >= ${this.maxSteps})`);
      console.error(err.message);
      this.finished = true;
      return { error: err, done: true, context: this.context };
    }

    // if paused -> resume using pending edge
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
      this.currentNodeId = pendingEdge.target;
      this.paused = false;
      this._pendingNextEdgeId = null;
    }

    const node = this.flowchart.getNode(this.currentNodeId);
    if (!node) throw new Error(`Node ${this.currentNodeId} not found`);

    console.log(`➡️ Step ${this.stepCount + 1}: Executing node ${node.id} (${node.type})`);

    // Ensure the effective inputProvider is applied to flowchart for handlers
    const effectiveProvider = typeof handlerOptions.inputProvider === "function"
      ? handlerOptions.inputProvider
      : typeof this.options.inputProvider === "function"
      ? this.options.inputProvider
      : null;

    if (this.flowchart) {
      if (effectiveProvider) this.flowchart._inputProvider = effectiveProvider;
      else if (this.flowchart._inputProvider && !this.options.inputProvider && !handlerOptions.inputProvider) {
        delete this.flowchart._inputProvider;
      }
    }

    const handler = getHandler(node.type);
    let result = {};
    try {
      result = handler(node, this.context, this.flowchart, handlerOptions) || {};
    } catch (err) {
      console.error(`❌ Error in handler for node ${node.id} (${node.type}):`, err && err.message ? err.message : err);
      this.finished = true;
      return { error: err, node, context: this.context, done: true };
    }

    // decide next edge/node
    let nextEdgeId = null;
    const wantsReenter = Boolean(result.reenter); // handler wants to be called again on same node

    if (!wantsReenter) {
      if (["WH", "FR"].includes(node.type)) {
        nextEdgeId = result.nextNode || node.loopExitEdge || node.outgoingEdgeIds[0];
      } else if (node.type === "IF") {
        const outgoingEdges = (node.outgoingEdgeIds || []).map(id => this.flowchart.getEdge(id)).filter(Boolean);
        if (result.nextCondition) {
          const edge = outgoingEdges.find(e => e.condition === result.nextCondition);
          if (edge) nextEdgeId = edge.id;
        }
        if (!nextEdgeId) {
          const autoEdge = outgoingEdges.find(e => e.condition === "auto");
          if (autoEdge) nextEdgeId = autoEdge.id;
        }
      } else {
        if (result.nextNode) {
          nextEdgeId = result.nextNode;
        } else {
          const autoEdge = (node.outgoingEdgeIds || []).map(id => this.flowchart.getEdge(id)).find(e => e && e.condition === "auto");
          nextEdgeId = autoEdge ? autoEdge.id : (node.outgoingEdgeIds || [])[0];
        }
      }
    }

    // save snapshot to history (best-effort)
    try {
      this.history.push({ nodeId: node.id, context: JSON.parse(JSON.stringify(this.context)) });
    } catch (e) {
      console.warn("Failed to snapshot context for history:", e);
    }
    this.stepCount++;

    // breakpoint handling
    if (node.type === "BP" && !forceAdvanceBP) {
      if (nextEdgeId) this._pendingNextEdgeId = nextEdgeId;
      else this._pendingNextEdgeId = null;
      this.paused = true;
      console.log(`⏸️ Hit breakpoint at ${node.id}; execution paused. Call step() or resume() to continue.`);
      return { node, context: this.context, paused: true, done: false };
    }

    // if handler asked to reenter => do not move currentNodeId
    if (wantsReenter) {
      return { node, context: this.context, reenter: true, done: this.finished, paused: this.paused };
    }

    // move to next node if edge exists
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

  /**
   * runAll
   * options:
   *   - ignoreBreakpoints: boolean
   *   - inputProvider: function(prompt, varName) -> value (synchronous)
   *   - any other handlerOptions forwarded to step/handlers
   */
  runAll(options = {}) {
    const { ignoreBreakpoints = false, ...handlerOptions } = options;

    if (typeof handlerOptions.inputProvider === "function") {
      this.setInputProvider(handlerOptions.inputProvider);
    } else if (typeof this.options.inputProvider === "function") {
      if (this.flowchart) this.flowchart._inputProvider = this.options.inputProvider;
    }

    this._startTime = Date.now();

    while (!this.finished) {
      const res = this.step({ forceAdvanceBP: ignoreBreakpoints, ...handlerOptions });
      if (res && res.error) break;
      if (this.paused && !ignoreBreakpoints) break;
    }
    return this.context;
  }

  // resume from breakpoint (forward options to step)
  resume(options = {}) {
    return this.step(options);
  }

  reset() {
    this.context = new Context();
    // preserve flowchart start if available
    this.currentNodeId =
      (this.flowchart && (this.flowchart.startNodeId || this.flowchart.start)) ||
      "n_start";
    this.finished = false;
    this.paused = false;
    this._pendingNextEdgeId = null;
    this.stepCount = 0;
    this.history = [];
    this._startTime = Date.now();
    if (this.flowchart && typeof this.options.inputProvider === "function") {
      this.flowchart._inputProvider = this.options.inputProvider;
    }
  }
}

export default Executor;
