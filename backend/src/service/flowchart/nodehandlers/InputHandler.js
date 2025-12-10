// InputHandler.js (patch)
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

  // try to get provided value
  let provided;
  if (provider) {
    try {
      provided = provider(node.data.prompt ?? "", varName);
    } catch (e) {
      // provider explicitly failed => interpret as INPUT MISSING
      const err = new Error(`Input missing for '${varName}': ${e.message || 'no value provided'}`);
      err.code = 'INPUT_MISSING';
      // rethrow so Executor/TestRunner can mark INPUT_MISSING
      throw err;
    }
  } else {
    // no provider — use default if exists, otherwise treat as missing
    if (node?.data?.default !== undefined) {
      provided = node.data.default;
    } else {
      const err = new Error(`Input missing for '${varName}': no input provider and no default`);
      err.code = 'INPUT_MISSING';
      throw err;
    }
  }

  // Normalize provided (treat null/undefined as missing)
  if (provided === undefined || provided === null) {
    const err = new Error(`Input missing for '${varName}': provided value is ${String(provided)}`);
    err.code = 'INPUT_MISSING';
    throw err;
  }

  // cast according to varType if given (else let Context infer)
  const varType = varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined;
  let inputValue = provided;
  try {
    // normalize strings by trimming
    const normalized = (typeof provided === 'string') ? provided.trim() : provided;

    switch (varType) {
      case "int":
      case "integer":
        // Empty string => missing
        if (normalized === "") {
          const err = new Error(`Input missing for '${varName}' (empty)`);
          err.code = 'INPUT_MISSING';
          throw err;
        }
        if (isNaN(Number(normalized))) {
          throw new Error(`Invalid value for ${varName}: must be integer`);
        }
        const intVal = Number(normalized);
        if (!Number.isInteger(intVal)) throw new Error(`Invalid value for ${varName}: must be integer`);
        inputValue = intVal;
        break;

      case "number":
      case "float":
        if (normalized === "") {
          const err = new Error(`Input missing for '${varName}' (empty)`);
          err.code = 'INPUT_MISSING';
          throw err;
        }
        const numVal = Number(normalized);
        if (isNaN(numVal)) throw new Error(`Invalid value for ${varName}: must be number`);
        inputValue = numVal;
        break;

      case "bool":
      case "boolean":
        if (typeof normalized === "boolean") {
          inputValue = normalized;
        } else {
          const lower = String(normalized).toLowerCase();
          if (["true", "1"].includes(lower)) inputValue = true;
          else if (["false", "0"].includes(lower)) inputValue = false;
          else throw new Error(`Invalid value for ${varName}: must be boolean`);
        }
        break;

      case "string":
      default:
        inputValue = String(normalized);
        break;
    }
  } catch (e) {
    // if we set err.code earlier (INPUT_MISSING) rethrow
    if (e && e.code === 'INPUT_MISSING') throw e;
    // else wrap as INVALID_VALUE (keeps distinct from missing)
    const err = new Error(e.message || `Invalid input for ${varName}`);
    err.code = 'INVALID_VALUE';
    throw err;
  }

  context.set(varName, inputValue, varType);
  console.log(`Input: ${varName} = ${JSON.stringify(context.get(varName))}`);
  return { nextCondition: "auto" };
}
