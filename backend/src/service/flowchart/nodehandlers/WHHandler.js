export default function WHHandler(node, context, flowchart) {
    const { condition, varName, increment } = node.data;
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const keys = context.variables.map(v => v.name);
    const values = context.variables.map(v => v.value);
    let conditionResult = false;
    try {
        conditionResult = Function(...keys, `return (${condition});`)(...values);
    } catch (e) {
        console.error("WH condition error:", e);
    }

    node._loopCount = node._loopCount || 0;
    const globalMax = node.maxLoopIterations || flowchart.maxLoopIterationsPerNode || 20000;

    if (conditionResult) {
        node._loopCount++;
        if (node._loopCount > globalMax) throw new Error(`Loop ${node.id} exceeded max iterations (${globalMax})`);

        if (increment && varName) {
            const idx = context.variables.findIndex(v => v.name === varName);
            if (idx !== -1) {
                const current = context.variables[idx].value;
                const idRegex = /\b([a-zA-Z_]\w*)\b/g;
                const ids = new Set();
                let m;
                while ((m = idRegex.exec(String(increment))) !== null) ids.add(m[1]);
                const jsGlobals = new Set(["Math","Number","String","Boolean","Array","Object","Date","parseInt","parseFloat","console","undefined","null","true","false","NaN","Infinity"]);
                ids.delete(varName);

                const keysOther = [];
                const valuesOther = [];
                ids.forEach(id => {
                    if (jsGlobals.has(id)) return;
                    const v = context.get(id);
                    if (v === undefined) {
                        console.warn(`WHHandler: identifier "${id}" used in increment but not found in context — providing undefined`);
                    }
                    keysOther.push(id);
                    valuesOther.push(v);
                });

                const incTrim = String(increment).trim();
                const varNameRegex = new RegExp(`\\b${escapeRegex(varName)}\\b`);
                let opExpr;
                if (varNameRegex.test(incTrim)) {
                    opExpr = incTrim;
                } else {
                    if (/^(\+\+|--)/.test(incTrim) || /^(\+=|-=|\*=|\/=)/.test(incTrim)) {
                        opExpr = `${varName}${incTrim}`;
                    } else if (/^[+\-*/]/.test(incTrim)) {
                        opExpr = `${varName}${incTrim}`;
                    } else {
                        opExpr = `${varName} = ${incTrim}`;
                    }
                }

                try {
                    const body = `let ${varName} = ${JSON.stringify(current)}; ${opExpr}; return ${varName};`;
                    let newVal;
                    if (keysOther.length > 0) newVal = Function(...keysOther, body)(...valuesOther);
                    else newVal = Function(body)();
                    context.set(varName, newVal, context.variables[idx].varType || "int");
                } catch (e) {
                    console.error("WH increment error:", e);
                }
            }
        }

        const trueEdge = node.outgoingEdgeIds.map(id => flowchart.getEdge(id)).find(e => e && e.condition === "true");
        return { nextNode: trueEdge ? trueEdge.id : node.outgoingEdgeIds[0] };
    } else {
        node._loopCount = 0;
        return { nextNode: node.loopExitEdge || node.outgoingEdgeIds.find(id => {
            const e = flowchart.getEdge(id);
            return e && (e.condition === "false" || e.condition === "done");
        }) };
    }
}
