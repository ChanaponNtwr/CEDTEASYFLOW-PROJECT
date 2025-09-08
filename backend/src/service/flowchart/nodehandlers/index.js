import StartHandler from "./StartHandler.js";
import StopHandler from "./StopHandler.js";
import InputHandler from "./InputHandler.js";
import OutputHandler from "./OutputHandler.js";
import IfHandler from "./IfHandler.js";
import AssignHandler from "./AssignHandler.js";
import WHHandler  from "./WHHandler.js";
import FRHandler  from "./FRHandler.js";
import DeclareHandler from "./DeclareHandler.js";
import BPHandler from "./BPHandler.js";

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
    return handlers[type] || (() => {
        console.warn(`No handler for node type ${type}`);
        return (node, context) => ({ nextCondition: "auto" });
    });
}
