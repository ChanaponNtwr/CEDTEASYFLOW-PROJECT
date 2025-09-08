export default function InputHandler(node, context /*, flowchart optional */) {
    const varName = node.data.variable;
    const varType = node.data.varType;

    // หา variable ที่ถูกกำหนดไว้ใน context (API ต้องส่งเข้ามาแล้ว)
    let variable = context.variables.find(v => v.name === varName);
    if (!variable) {
        throw new Error(`❌ Missing required variable: ${varName}`);
    }

    let inputValue = variable.value;

    // แปลงค่าให้ตรงตาม type
    switch (varType) {
        case "int":
            inputValue = parseInt(inputValue, 10);
            if (isNaN(inputValue)) throw new Error(`Variable ${varName} ต้องเป็นจำนวนเต็ม`);
            break;
        case "float":
            inputValue = parseFloat(inputValue);
            if (isNaN(inputValue)) throw new Error(`Variable ${varName} ต้องเป็นตัวเลข`);
            break;
        case "bool":
            inputValue = String(inputValue).toLowerCase() === "true";
            break;
        case "string":
        default:
            inputValue = String(inputValue);
    }

    // update ค่าใหม่กลับเข้า context
    variable.value = inputValue;
    // update index_map just in case
    context.variables.forEach((v,i)=> context.index_map[v.name]=i);

    console.log(`Input: ${varName} = ${inputValue}`);
    return { nextCondition: "auto" };
}
