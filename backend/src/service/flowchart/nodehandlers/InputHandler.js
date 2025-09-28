// src/service/flowchart/nodeHandlers/input.js
export default function InputHandler(node, context, flowchart) {
    const varName = node.data.variable;
    const varType = node.data.varType;

    if (!varName) {
        throw new Error("IN handler requires node.data.variable");
    }

    // หา variable ที่ถูกกำหนดไว้ใน context
    let variableIndex = context.index_map[varName];
    let variable = (variableIndex !== undefined) ? context.variables[variableIndex] : undefined;

    // ถ้าไม่พบ variable ใน context -> ลองเรียก inputProvider (จาก flowchart._inputProvider)
    if (!variable) {
        const provider = flowchart && typeof flowchart._inputProvider === "function" ? flowchart._inputProvider : null;
        if (provider) {
            try {
                const provided = provider(node.data.prompt ?? "", varName);
                // provider อาจคืนค่า undefined -> treat as missing
                if (provided !== undefined) {
                    // สร้างตัวแปรใน context ถ้ายังไม่มี
                    context.set(varName, provided, varType || undefined);
                    variableIndex = context.index_map[varName];
                    variable = context.variables[variableIndex];
                    console.log(`InputProvider: ${varName} = ${provided}`);
                } else {
                    throw new Error(`Input provider returned undefined for ${varName}`);
                }
            } catch (e) {
                throw new Error(e.message || `Error calling input provider for ${varName}`);
            }
        } else {
            throw new Error(`❌ Missing required variable: ${varName}`);
        }
    }

    // แปลงค่าให้ตรงตาม type (ถ้ามี)
    let inputValue = variable.value;
    switch (varType) {
        case "int":
            inputValue = parseInt(inputValue, 10);
            if (isNaN(inputValue)) throw new Error(`Variable ${varName} must be integer`);
            break;
        case "float":
            inputValue = parseFloat(inputValue);
            if (isNaN(inputValue)) throw new Error(`Variable ${varName} must be number`);
            break;
        case "bool":
            inputValue = String(inputValue).toLowerCase() === "true";
            break;
        case "string":
        default:
            inputValue = String(inputValue);
    }

    // update value back to context
    context.set(varName, inputValue, varType || context.variables[context.index_map[varName]].varType);

    console.log(`Input: ${varName} = ${inputValue}`);
    return { nextCondition: "auto" };
}
