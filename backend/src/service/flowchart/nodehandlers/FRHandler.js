export default function FRHandler(node, context, flowchart) {
    const { init, condition, increment, varName } = node.data;

    // ensure var exists
    if (varName && context.get(varName) === undefined) {
        context.set(varName, 0, "int");
    }

    // init (ทำครั้งเดียวตอนเริ่ม)
    if (!node._initialized) {
        if (init) {
            try {
                if (typeof init === "string") {
                    const [left, right] = init.split("=").map(s => s.trim());
                    if (right !== undefined) {
                        const keys = context.variables.map(v => v.name);
                        const values = context.variables.map(v => v.value);
                        const value = Function(...keys, `return (${right});`)(...values);
                        context.set(left, value);
                    } else {
                        const value = Function(`return (${init});`)();
                        context.set(varName, value);
                    }
                } else {
                    context.set(varName, init);
                }
            } catch (e) {
                console.error("FR init error:", e);
            }
        }
        node._initialized = true;
        node._phase = "condition"; // เริ่มจากตรวจ condition
        node._loopCount = 0;
    }

    // helper eval condition
    const evalCondition = () => {
        try {
            const keys = context.variables.map(v => v.name);
            const values = context.variables.map(v => v.value);
            return Function(...keys, `return (${condition});`)(...values);
        } catch (e) {
            console.error("FR condition error:", e);
            return false;
        }
    };

    // edge ตัวถัดไป
    const nextEdge = () => node.outgoingEdgeIds
        .map(id => flowchart.getEdge(id)).find(e => e && e.condition === "true");
    const doneEdge = () => node.outgoingEdgeIds
        .map(id => flowchart.getEdge(id)).find(e => e && e.condition === "false");

    const globalMax = node.maxLoopIterations || flowchart.maxLoopIterationsPerNode || 20000;

    // FSM (phase-based)
    switch (node._phase) {
        case "condition": {
            const cond = evalCondition();
            if (cond) {
                node._loopCount++;
                if (node._loopCount > globalMax) {
                    throw new Error(`Loop ${node.id} exceeded max iterations (${globalMax})`);
                }
                node._phase = "body"; // หลังจากรัน body แล้วไป increment
                const e = nextEdge();
                return { nextNode: e ? e.id : node.outgoingEdgeIds[0] };
            } else {
                // จบ loop
                node._initialized = false;
                node._loopCount = 0;
                node._phase = "done";
                const e = doneEdge();
                return { nextNode: e ? e.id : node.loopExitEdge };
            }
        }
        case "body": {
            // หลังจาก body เสร็จ → increment
            node._phase = "increment";
            return { reenter: true }; // ให้ executor เรียก FRHandler อีกครั้งทันที
        }
        case "increment": {
            if (increment && varName) {
                try {
                    const current = context.get(varName);
                    const body = `let ${varName} = ${JSON.stringify(current)}; ${increment}; return ${varName};`;
                    const newVal = Function(body)();
                    context.set(varName, newVal);
                } catch (e) {
                    console.error("FR increment error:", e);
                }
            }
            node._phase = "condition"; // กลับไปเช็ค condition ต่อ
            return { reenter: true };   // ให้ executor เข้ามาเช็ค condition เลย
        }
        default: {
            node._initialized = false;
            node._phase = "done";
            const e = doneEdge();
            return { nextNode: e ? e.id : node.loopExitEdge };
        }
    }
}
