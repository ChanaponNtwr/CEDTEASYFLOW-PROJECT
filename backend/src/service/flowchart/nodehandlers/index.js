// src/service/flowchart/nodeHandlers/index.js
import StartHandler from "./StartHandler.js";
import StopHandler from "./StopHandler.js";
import InputHandler from "./InputHandler.js";
import OutputHandler from "./OutputHandler.js";
import IfHandler from "./IfHandler.js";
import AssignHandler from "./AssignHandler.js";
import WHHandler from "./WHHandler.js";
import FRHandler from "./FRHandler.js";
import DeclareHandler from "./DeclareHandler.js";
import BPHandler from "./BPHandler.js";

// mapping short codes -> handler functions
const handlers = {
  ST: StartHandler,
  EN: StopHandler,
  IN: InputHandler,
  OU: OutputHandler,
  IF: IfHandler,
  AS: AssignHandler,
  WH: WHHandler,
  FR: FRHandler,
  DC: DeclareHandler,
  BP: BPHandler,
};

export function getHandler(type) {
  const h = handlers[type];
  if (h) return h;

  // fallback handler (function) — must be a function that accepts (node, context, flowchart)
  return (node, context /*, flowchart */) => {
    console.warn(`No handler registered for node type "${type}" — using noop fallback.`);
    return { nextCondition: "auto" };
  };
}

export default getHandler;
