// src/service/flowchart/nodeHandlers/FRHandler.js
// For-loop handler (FR) - improved: merge increment+condition when returning from body
export default function FRHandler(node, context, flowchart) {
    const { init, condition, increment, varName } = node.data;

    // utility: safe evaluator using current context variables
    const evalWithVars = (expr) => {
        const vars = {};
        for (const v of (context.variables || [])) {
            if (v && typeof v.name !== "undefined") vars[String(v.name)] = v.value;
        }
        return Function('vars', `with (vars) { return (${expr}); }`)(vars);
    };

    // parse init (like "int a = 2" or "a = 2")
    const parseInitValue = (initRaw) => {
        try {
            if (typeof initRaw === "string") {
                const parts = initRaw.split("=");
                const left = parts[0].trim();
                const right = (parts.length > 1) ? parts.slice(1).join("=").trim() : undefined;
                const initName = left.split(/\s+/).pop();
                if (right !== undefined && right !== "") {
                    const value = evalWithVars(right);
                    return { name: initName, value };
                } else {
                    const value = evalWithVars(initRaw);
                    return { name: initName || varName, value };
                }
            } else {
                return { name: varName, value: initRaw };
            }
        } catch (e) {
            console.error("FR parseInitValue error:", e, "initRaw:", initRaw);
            return { name: varName, value: context.get(varName) };
        }
    };

    // initialize node-local state (only once)
    if (!node._initialized) {
        try {
            if (typeof init !== "undefined" && init !== null) {
                node._initValue = parseInitValue(init);
            } else {
                node._initValue = { name: varName, value: context.get(varName) };
            }
        } catch (e) {
            console.error("FR init error:", e);
            node._initValue = { name: varName, value: context.get(varName) };
        }
        node._initialized = true;
        node._phase = "condition"; // start at condition
        node._loopCount = 0;
        node._scopePushed = false;
    }

    // evaluate condition using current context.vars
    const evalCondition = () => {
        try {
            if (!condition || String(condition).trim() === "") return false;
            return Function('vars', `with (vars) { return (${condition}); }`)(
                (context.variables || []).reduce((acc, v) => {
                    if (v && typeof v.name !== "undefined") acc[v.name] = v.value;
                    return acc;
                }, {})
            );
        } catch (e) {
            console.error("FR condition error:", e);
            try {
                console.error("FR eval debug - var names:", (context.variables || []).map(v => v && v.name));
                console.error("FR eval debug - condition:", condition);
            } catch (ee) { /* ignore */ }
            return false;
        }
    };

    // choose body edge (prefer explicit 'next', non-self edges)
    const findBodyEdgeId = () => {
        const outs = (node.outgoingEdgeIds || []).map(id => flowchart.getEdge(id)).filter(Boolean);
        const nextEdge = outs.find(e => e.condition === "next");
        if (nextEdge) return nextEdge.id;
        for (const e of outs) {
            if (e.id === node.loopEdge || e.id === node.loopExitEdge) continue;
            if (e.source === node.id && e.target !== node.id) return e.id;
        }
        const nonSelf = outs.find(e => e.target !== node.id);
        if (nonSelf) return nonSelf.id;
        return node.loopEdge || (outs[0] && outs[0].id);
    };

    // choose exit edge
    const findExitEdgeId = () => {
        const outs = (node.outgoingEdgeIds || []).map(id => flowchart.getEdge(id)).filter(Boolean);
        const done = outs.find(e => e.condition === "done" || e.condition === "false");
        if (done) return done.id;
        if (node.loopExitEdge) return node.loopExitEdge;
        const nonSelf = outs.find(e => e.target !== node.id);
        return nonSelf ? nonSelf.id : (outs[0] && outs[0].id);
    };

    const globalMax = node.maxLoopIterations || flowchart.maxLoopIterationsPerNode || 20000;

    switch (node._phase) {
        case "condition": {
            // push loop-local binding BEFORE first condition evaluation
            if (!node._scopePushed) {
                const initName = (node._initValue && node._initValue.name) ? node._initValue.name : varName;
                const initVal = (node._initValue && typeof node._initValue.value !== "undefined") ? node._initValue.value : context.get(varName);
                const existing = (context.variables || []).find(v => v.name === initName);
                // if Context supports push/pop scope prefer them
                if (typeof context.pushScope === "function") {
                    const binding = {};
                    binding[initName] = { value: initVal, varType: existing && existing.varType ? existing.varType : null };
                    context.pushScope(binding);
                } else {
                    context.set(initName, initVal, existing && existing.varType ? existing.varType : null);
                }
                node._scopePushed = true;
            }

            const cond = evalCondition();

            if (cond) {
                node._loopCount = (node._loopCount || 0) + 1;
                if (node._loopCount > globalMax) throw new Error(`Loop ${node.id} exceeded max iterations (${globalMax})`);
                // go to body
                node._phase = "body";
                const bodyEdgeId = findBodyEdgeId();
                console.log(`FR ${node.id} -> bodyEdgeId =`, bodyEdgeId);
                return { nextNode: bodyEdgeId ? bodyEdgeId : (node.outgoingEdgeIds && node.outgoingEdgeIds[0]) };
            } else {
                // exit loop + cleanup
                if (node._scopePushed) {
                    if (typeof context.popScope === "function") context.popScope();
                    node._scopePushed = false;
                }
                node._initialized = false;
                node._loopCount = 0;
                node._phase = "done";
                const exitEdgeId = findExitEdgeId();
                console.log(`FR ${node.id} -> exitEdgeId =`, exitEdgeId);
                return { nextNode: exitEdgeId ? exitEdgeId : node.loopExitEdge };
            }
        }

        case "body": {
            // When FR is executed after returning from body-node we:
            //  1) apply increment (if any),
            //  2) evaluate condition again, and
            //  3) route to body (loop) or exit immediately.
            // This merges increment+condition into a single handler call (reduces extra reenter cycles).
            if (increment && varName) {
                try {
                    const vars = {};
                    for (const v of (context.variables || [])) {
                        if (v && typeof v.name !== "undefined") vars[String(v.name)] = v.value;
                    }
                    const bodyExpr = `with (vars) { ${increment}; return (typeof ${varName} !== "undefined") ? ${varName} : vars["${String(varName)}"]; }`;
                    const newVal = Function('vars', bodyExpr)(vars);
                    const existing = (context.variables || []).find(v => v.name === varName);
                    context.set(varName, newVal, existing && existing.varType ? existing.varType : "int");
                } catch (e) {
                    console.error("FR increment error:", e);
                }
            }

            // now re-evaluate condition and route
            const condAfterInc = evalCondition();
            if (condAfterInc) {
                node._loopCount = (node._loopCount || 0) + 1;
                if (node._loopCount > globalMax) throw new Error(`Loop ${node.id} exceeded max iterations (${globalMax})`);
                // stay in loop: go to body again
                node._phase = "body"; // prepare for next return-from-body
                const bodyEdgeId = findBodyEdgeId();
                console.log(`FR ${node.id} (after increment) -> bodyEdgeId =`, bodyEdgeId);
                return { nextNode: bodyEdgeId ? bodyEdgeId : (node.outgoingEdgeIds && node.outgoingEdgeIds[0]) };
            } else {
                // exit loop and cleanup
                if (node._scopePushed) {
                    if (typeof context.popScope === "function") context.popScope();
                    node._scopePushed = false;
                }
                node._initialized = false;
                node._loopCount = 0;
                node._phase = "done";
                const exitEdgeId = findExitEdgeId();
                console.log(`FR ${node.id} (after increment) -> exitEdgeId =`, exitEdgeId);
                return { nextNode: exitEdgeId ? exitEdgeId : node.loopExitEdge };
            }
        }

        default: {
            // graceful fallback: cleanup if needed and exit
            if (node._scopePushed && typeof context.popScope === "function") {
                context.popScope();
                node._scopePushed = false;
            }
            node._initialized = false;
            node._phase = "done";
            const exitEdgeId = findExitEdgeId();
            return { nextNode: exitEdgeId ? exitEdgeId : node.loopExitEdge };
        }
    }
}
