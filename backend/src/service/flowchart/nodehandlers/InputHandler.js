console.log("🔎 InputHandler v6 loaded");

export default function InputHandler(node, context, flowchart, options = {}) {
  const varName = node?.data?.variable || node?.data?.name;
  const varTypeRaw = node?.data?.varType;
  if (!varName) throw new Error("IN handler requires node.data.variable");

  /**
   * IN node reads input by default
   * Only skip when node.data.skipIfExists === true
   */
  const existing = context.get(varName);
  if (node?.data?.skipIfExists === true && existing !== undefined) {
    console.log(`IN: ${varName} already set = ${JSON.stringify(existing)} (skip input by config)`);
    return { nextCondition: "auto" };
  }

  // pick provider (priority: options.inputProvider > flowchart._inputProvider)
  const provider =
    typeof options.inputProvider === "function"
      ? options.inputProvider
      : flowchart && typeof flowchart._inputProvider === "function"
      ? flowchart._inputProvider
      : null;

  let provided;

  // ✅ TRY GET INPUT
  if (provider) {
    try {
      provided = provider(node.data?.prompt ?? "", varName);
    } catch {
      provided = undefined;
    }
  } else if (node?.data?.default !== undefined) {
    provided = node.data.default;
  }

  // ⏸ STILL NO INPUT → WAIT (❗ ไม่ throw แล้ว)
  if (provided === undefined || provided === null) {
    console.log(`⏸ Waiting for input: ${varName}`);
    return {
      nextCondition: "wait",
      waitFor: varName,
    };
  }

  // debug
  try {
    console.log(`InputHandler: raw provided for ${varName}:`, provided, "typeof:", typeof provided);
  } catch {}

  // normalize
  const normalizeProvided = (val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === "number" || typeof val === "boolean") return val;
    if (typeof val === "object") return val;

    const s = String(val).trim();
    const low = s.toLowerCase();

    if (low === "true") return true;
    if (low === "false") return false;
    if (low === "1") return 1;
    if (low === "0") return 0;

    if (/^[+-]?\d+$/.test(s)) return Number(s);
    if (/^[+-]?\d*\.\d+$/.test(s) || /^[+-]?\d+\.\d*$/.test(s)) return Number(s);

    return s;
  };

  const declared = varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined;
  let finalType = declared;
  let finalValue;

  const norm = normalizeProvided(provided);

  try {
    if (declared) {
      switch (declared) {
        case "int":
        case "integer": {
          const n = Number(norm);
          if (!Number.isInteger(n))
            throw Object.assign(new Error(`Invalid integer for ${varName}`), { code: "INVALID_VALUE" });
          finalValue = n;
          finalType = "int";
          break;
        }
        case "float":
        case "number": {
          const f = Number(norm);
          if (isNaN(f))
            throw Object.assign(new Error(`Invalid number for ${varName}`), { code: "INVALID_VALUE" });
          finalValue = f;
          finalType = "float";
          break;
        }
        case "bool":
        case "boolean": {
          if (typeof norm === "boolean") finalValue = norm;
          else if (norm === 1 || norm === "1" || String(norm).toLowerCase() === "true") finalValue = true;
          else if (norm === 0 || norm === "0" || String(norm).toLowerCase() === "false") finalValue = false;
          else
            throw Object.assign(new Error(`Invalid boolean for ${varName}`), { code: "INVALID_VALUE" });
          finalType = "bool";
          break;
        }
        case "string":
        default:
          finalValue = String(norm);
          finalType = "string";
      }
    } else {
      if (typeof norm === "number") {
        finalType = Number.isInteger(norm) ? "int" : "float";
        finalValue = norm;
      } else if (typeof norm === "boolean") {
        finalType = "bool";
        finalValue = norm;
      } else {
        finalType = "string";
        finalValue = String(norm);
      }
    }
  } catch (e) {
    const err = new Error(e.message || `Invalid input for ${varName}`);
    err.code = e.code || "INVALID_VALUE";
    throw err; // ❗ type error ยัง throw ได้ (ถูกต้องแล้ว)
  }

  // store
  let storeVarType = finalType;
  if ((typeof finalValue === "number" || typeof finalValue === "boolean") && finalType === "string") {
    storeVarType = undefined;
  }

  context.set(varName, finalValue, storeVarType);

  try {
    const stored = context.get(varName);
    console.log(`Input: ${varName} = ${JSON.stringify(stored)} (type=${typeof stored})`);
  } catch {}

  return { nextCondition: "auto" };
}
