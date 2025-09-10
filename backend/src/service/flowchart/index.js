// src/service/flowchart/index.js
// Central re-exports for the flowchart service.
// IMPORTANT: import nodeHandlers for side-effects so handlers get registered when this module is loaded.


// Ensure handlers are executed (they register themselves on import)
import "./nodeHandlers/index.js";


// Re-export implementation modules as named exports
export { default as Flowchart } from "./classflowchart.js";
export { default as Edge } from "./classedge.js";
export { default as Node } from "./classnode.js";
export { default as Executor } from "./classexecutor.js";
export { default as Context } from "./classcontext.js";
export { default as VariableItem } from "./classsvariable.js";
export { getHandler } from "./nodeHandlers/index.js";
export { hydrateFlowchart } from "./serializer.js";


// Also provide a default export (convenience object)
// We re-import the defaults to build a single default-export object.
import FlowchartDefault from "./classflowchart.js";
import EdgeDefault from "./classedge.js";
import NodeDefault from "./classnode.js";
import ExecutorDefault from "./classexecutor.js";
import ContextDefault from "./classcontext.js";
import VariableItemDefault from "./classsvariable.js";
import { getHandler as getHandlerFn } from "./nodeHandlers/index.js";
import { hydrateFlowchart as hydrateFn } from "./serializer.js";


export default {
Flowchart: FlowchartDefault,
Edge: EdgeDefault,
Node: NodeDefault,
Executor: ExecutorDefault,
Context: ContextDefault,
VariableItem: VariableItemDefault,
getHandler: getHandlerFn,
hydrateFlowchart: hydrateFn
};
