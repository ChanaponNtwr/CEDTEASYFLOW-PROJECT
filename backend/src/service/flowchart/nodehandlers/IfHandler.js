// src/service/flowchart/nodeHandlers/IfHandler.js
export default function IfHandler(node, context /*, flowchart optional */) {
    try {
        // build variable names and values from context
        const keys = (context.variables || []).map(v => v && v.name).filter(Boolean);
        const values = (context.variables || []).map(v => v && v.value);

        // helper Char injected so expressions like Char(a,i) work
        function Char(str, index) {
            if (typeof str !== "string") return ".";
            const i = Number(index);
            if (!Number.isFinite(i)) return ".";
            if (i < 0 || i >= str.length) return ".";
            return str.charAt(i);
        }

        const conditionRaw = node && node.data && node.data.condition ? String(node.data.condition) : "";

        if (!conditionRaw.trim()) {
            console.log(`If: empty condition -> false`);
            return { nextCondition: "false" };
        }

        // create function with Char injected first, then variables
        // example: Function("Char", "a", "b", "return (Char(a,i) == ' ')")
        const fn = Function("Char", ...keys, `return (${conditionRaw});`);
        const cond = fn(Char, ...values);

        console.log(`If ${conditionRaw} => ${cond}`);
        return { nextCondition: cond ? "true" : "false" };
    } catch (e) {
        console.error(`❌ Error evaluating If condition '${(node && node.data && node.data.condition) || ""}': ${e && e.message ? e.message : e}`);
        return { nextCondition: "false" };
    }
}
