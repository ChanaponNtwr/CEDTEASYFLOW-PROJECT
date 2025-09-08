export default function FRHandler(node, context, flowchart) {
    const { init, condition, increment, varName } = node.data;
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ensure var exists
    if (varName && context.get(varName) === undefined) {
        context.set(varName, 0, "int");
    }

    // init (run once)
    if (!node._initialized) {
        if (init !== undefined && init !== null) {
            try {
                if (typeof init !== "string") {
                    context.set(varName || init.name || varName, init);
                } else {
                    const trimmed = init.trim();
                    if (trimmed.includes("=")) {
                        const splitIdx = trimmed.indexOf("=");
                        const left = trimmed.slice(0, splitIdx).trim();
                        const right = trimmed.slice(splitIdx + 1).trim();
                        const keys = context.variables.map(v => v.name);
                        const values = context.variables.map(v => v.value);
                        const value = Function(...keys, `return (${right});`)(...values);
                        context.set(left, value);
                    } else {
                        const keys = context.variables.map(v => v.name);
                        const values = context.variables.map(v => v.value);
                        const value = Function(...keys, `return (${trimmed});`)(...values);
                        if (varName) context.set(varName, value);
                    }
                }
            } catch (e) {
                console.error("FR init error:", e);
            }
        }
        node._initialized = true;
        node._awaitingIncrement = false; // new flag: false means next call does condition check
        node._loopCount = 0;
    }

    // helpers
    const evalCondition = () => {
        const keys = context.variables.map(v => v.name);
        const values = context.variables.map(v => v.value);
        try {
            return Function(...keys, `return (${condition});`)(...values);
        } catch (e) {
            console.error("FR condition error:", e);
            return false;
        }
    };
    const nextEdge = () => node.outgoingEdgeIds
        .map(id => flowchart.getEdge(id)).find(e => e && e.condition === "next");
    const doneEdge = () => node.outgoingEdgeIds
        .map(id => flowchart.getEdge(id)).find(e => e && e.condition === "done");

    const globalMax = node.maxLoopIterations || flowchart.maxLoopIterationsPerNode || 20000;

    // If we are NOT awaiting increment -> this call should do condition check and possibly go to body
    if (!node._awaitingIncrement) {
        const cond = evalCondition();
        if (cond) {
            // entering body — mark that when we return here we must run increment
            node._awaitingIncrement = true;
            node._loopCount = (node._loopCount || 0) + 1;
            if (node._loopCount > globalMax) {
                throw new Error(`Loop ${node.id} exceeded max iterations (${globalMax})`);
            }
            const e = nextEdge();
            return { nextNode: e ? e.id : node.outgoingEdgeIds[0] };
        } else {
            // finished
            node._initialized = false;
            node._awaitingIncrement = false;
            node._loopCount = 0;
            const doneE = doneEdge();
            return { nextNode: doneE ? doneE.id : node.loopExitEdge };
        }
    }

    // ELSE: we are awaiting increment -> this call is the one after body executed
    // apply increment now (if any), then evaluate condition to decide continue or exit
    if (increment && varName) {
        const idx = context.variables.findIndex(v => v.name === varName);
        if (idx !== -1) {
            const current = context.variables[idx].value;
            const incTrim = String(increment).trim();
            const varNameRegex = new RegExp(`\\b${escapeRegex(varName)}\\b`);
            let opExpr;
            if (varNameRegex.test(incTrim)) {
                opExpr = incTrim;
            } else {
                if (/^(\+\+|--)/.test(incTrim) || /^(\+=|-=|\*=|\/=)/.test(incTrim) || /^[+\-/*]/.test(incTrim)) {
                    opExpr = `${varName}${incTrim}`;
                } else {
                    opExpr = `${varName} = ${incTrim}`;
                }
            }

            // find other identifiers in opExpr
            const idRegex = /\b([a-zA-Z_]\w*)\b/g;
            const ids = new Set();
            let m;
            while ((m = idRegex.exec(opExpr)) !== null) ids.add(m[1]);
            const jsGlobals = new Set(["Math","Number","String","Boolean","Array","Object","Date","parseInt","parseFloat","console","undefined","null","true","false","NaN","Infinity"]);
            ids.delete(varName);

            const keysOther = [];
            const valuesOther = [];
            ids.forEach(id => {
                if (jsGlobals.has(id)) return;
                const v = context.get(id);
                if (v === undefined) {
                    console.warn(`FRHandler: identifier "${id}" used in increment but not found in context — providing undefined`);
                }
                keysOther.push(id);
                valuesOther.push(v);
            });

            try {
                const body = `let ${varName} = ${JSON.stringify(current)}; ${opExpr}; return ${varName};`;
                const newVal = keysOther.length > 0 ? Function(...keysOther, body)(...valuesOther) : Function(body)();
                context.set(varName, newVal, context.variables[idx].varType || "int");
            } catch (e) {
                console.error("FR increment evaluation error:", e);
            }
        }
    }

    // reset awaitingIncrement flag and decide next step
    node._awaitingIncrement = false;
    const condAfter = evalCondition();
    if (condAfter) {
        // continue: mark awaitingIncrement true again and go to body
        node._awaitingIncrement = true;
        node._loopCount = (node._loopCount || 0) + 1;
        if (node._loopCount > globalMax) {
            throw new Error(`Loop ${node.id} exceeded max iterations (${globalMax})`);
        }
        const e = nextEdge();
        return { nextNode: e ? e.id : node.outgoingEdgeIds[0] };
    } else {
        node._initialized = false;
        node._loopCount = 0;
        const doneE = doneEdge();
        return { nextNode: doneE ? doneE.id : node.loopExitEdge };
    }
}
