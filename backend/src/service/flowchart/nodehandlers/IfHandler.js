export default function IfHandler(node, context /*, flowchart optional */) {
    try {
        const keys = context.variables.map(v => v.name);
        const values = context.variables.map(v => v.value);

        // ประเมิน condition
        const cond = Function(...keys, `return ${node.data.condition};`)(...values);
        console.log(`If ${node.data.condition} => ${cond}`);
        return { nextCondition: cond ? "true" : "false" };
    } catch (e) {
        console.error(`❌ Error evaluating If condition '${node.data.condition}': ${e.message}`);
        return { nextCondition: "false" };
    }
}
