// src/service/flowchart/nodeHandlers/index.js
import StartHandler from "./starthandler.js";
import StopHandler from "./stophandler.js";
import InputHandler from "./InputHandler.js";
import OutputHandler from "./outputhandler.js";
import IfHandler from "./ifhandler.js";
import AssignHandler from "./assignhandler.js";
import WHHandler from "./whhandler.js";
import FRHandler from "./frhandler.js";
import DeclareHandler from "./declarehandler.js";
import BPHandler from "./bphandler.js";
// ✅ DEBUG: confirm handlers are loaded
console.log("✅ nodeHandlers/index.js loaded");

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
  if (!type) return null;

  // ✅ normalize type (CRITICAL)
  const key = String(type).trim().toUpperCase();
  const handler = handlers[key];

  if (!handler) {
    console.warn(`⚠️ No handler registered for node type "${type}"`);
    return (node, context) => ({ nextCondition: "auto" });
  }

  return handler;
}

// ❌ REMOVE default export (important)
// export default getHandler;
