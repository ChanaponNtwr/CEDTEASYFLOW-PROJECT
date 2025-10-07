export default function InputHandler(node, context, flowchart, options = {}) {
  const varName = node?.data?.variable || node?.data?.name;
  const varTypeRaw = node?.data?.varType;
  if (!varName) throw new Error("IN handler requires node.data.variable");

  // ถ้ามีค่าแล้ว และไม่ได้ตั้ง override ให้ข้าม
  const existing = context.get(varName);
  if (existing !== undefined && node?.data?.override !== true) {
    console.log(`IN: ${varName} already set = ${JSON.stringify(existing)} (skip input)`);
    return { nextCondition: "auto" };
  }

  // เลือก provider (priority: options.inputProvider > flowchart._inputProvider)
  const provider = (typeof options.inputProvider === "function")
    ? options.inputProvider
    : (flowchart && typeof flowchart._inputProvider === "function")
      ? flowchart._inputProvider
      : null;

  let provided;
  if (provider) {
    try {
      provided = provider(node.data.prompt ?? "", varName);
    } catch (e) {
      console.warn("Input provider threw:", e);
      provided = node?.data?.default ?? "";
    }
  } else {
    provided = node?.data?.default ?? "";
  }

  // cast according to varType if given (else let Context infer)
  const varType = varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined;
  let inputValue = provided;
  try {
    switch (varType) {
      case "int":
      case "integer":
      case "number":
        inputValue = parseInt(provided, 10);
        if (isNaN(inputValue)) throw new Error(`Variable ${varName} must be integer`);
        break;
      case "float":
        inputValue = parseFloat(provided);
        if (isNaN(inputValue)) throw new Error(`Variable ${varName} must be number`);
        break;
      case "bool":
      case "boolean":
        inputValue = String(provided).toLowerCase() === "true" || provided === 1 || provided === "1";
        break;
      case "string":
      default:
        inputValue = provided === null || provided === undefined ? "" : String(provided);
    }
  } catch (e) {
    throw new Error(e.message || `Invalid input for ${varName}`);
  }

  context.set(varName, inputValue, varType);
  console.log(`Input: ${varName} = ${JSON.stringify(context.get(varName))}`);
  return { nextCondition: "auto" };
}
