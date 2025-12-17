// src/service/flowchart/nodeHandlers/InputHandler.js
console.log("🔎 InputHandler v4 loaded");

export default function InputHandler(node, context, flowchart, options = {}) {
  // validate
  const varName = node?.data?.variable || node?.data?.name;
  const varTypeRaw = node?.data?.varType;
  if (!varName) throw new Error("IN handler requires node.data.variable");

  // if already set and not override => skip
  const existing = context.get(varName);
  if (existing !== undefined && node?.data?.override !== true) {
    console.log(`IN: ${varName} already set = ${JSON.stringify(existing)} (skip input)`);
    return { nextCondition: "auto" };
  }

  // pick provider (priority: options.inputProvider > flowchart._inputProvider)
  const provider = (typeof options.inputProvider === "function")
    ? options.inputProvider
    : (flowchart && typeof flowchart._inputProvider === "function")
      ? flowchart._inputProvider
      : null;

  // obtain provided value
  let provided;
  if (provider) {
    try {
      provided = provider(node.data?.prompt ?? "", varName);
    } catch (e) {
      const err = new Error(`Input missing for '${varName}': ${e.message || 'no value provided'}`);
      err.code = 'INPUT_MISSING';
      throw err;
    }
  } else {
    if (node?.data?.default !== undefined) {
      provided = node.data.default;
    } else {
      const err = new Error(`Input missing for '${varName}': no input provider and no default`);
      err.code = 'INPUT_MISSING';
      throw err;
    }
  }

  if (provided === undefined || provided === null) {
    const err = new Error(`Input missing for '${varName}': provided value is ${String(provided)}`);
    err.code = 'INPUT_MISSING';
    throw err;
  }

  // debug: raw value from provider
  try { console.log(`InputHandler: raw provided for ${varName}:`, provided, "typeof:", typeof provided); } catch (e) {}

  // normalizer: coerce strings that look like numbers/booleans into real types
  const normalizeProvided = (val) => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (typeof val === 'object') return val;

    const s = String(val).trim();
    const low = s.toLowerCase();

    if (low === 'true') return true;
    if (low === 'false') return false;
    if (low === '1') return 1;
    if (low === '0') return 0;

    if (/^[+-]?\d+$/.test(s)) return Number(s);
    if (/^[+-]?\d*\.\d+$/.test(s) || /^[+-]?\d+\.\d*$/.test(s)) return Number(s);

    return s;
  };

  const declared = varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined;
  let finalType = declared;
  let finalValue;

  const raw = provided;
  const norm = normalizeProvided(raw);

  try {
    if (declared) {
      switch (declared) {
        case 'int':
        case 'integer': {
          const n = Number(norm);
          if (!Number.isInteger(n)) {
            const err = new Error(`Invalid integer for ${varName}`);
            err.code = 'INVALID_VALUE';
            throw err;
          }
          finalValue = n;
          finalType = 'int';
          break;
        }
        case 'float':
        case 'number': {
          const f = Number(norm);
          if (isNaN(f)) {
            const err = new Error(`Invalid number for ${varName}`);
            err.code = 'INVALID_VALUE';
            throw err;
          }
          finalValue = f;
          finalType = 'float';
          break;
        }
        case 'bool':
        case 'boolean': {
          if (typeof norm === 'boolean') finalValue = norm;
          else {
            const low = String(norm).toLowerCase();
            if (low === 'true' || low === '1') finalValue = true;
            else if (low === 'false' || low === '0') finalValue = false;
            else {
              const err = new Error(`Invalid boolean for ${varName}`);
              err.code = 'INVALID_VALUE';
              throw err;
            }
          }
          finalType = 'bool';
          break;
        }
        case 'string':
        default:
          finalValue = String(norm);
          finalType = 'string';
      }
    } else {
      // infer
      if (typeof norm === 'number') {
        finalType = Number.isInteger(norm) ? 'int' : 'float';
        finalValue = norm;
      } else if (typeof norm === 'boolean') {
        finalType = 'bool';
        finalValue = norm;
      } else {
        finalType = 'string';
        finalValue = String(norm);
      }
    }
  } catch (e) {
    if (e && e.code === 'INPUT_MISSING') throw e;
    const err = new Error(e.message || `Invalid input for ${varName}`);
    err.code = e.code || 'INVALID_VALUE';
    throw err;
  }

  // CRITICAL: if runtime value is numeric/boolean but declared varType is 'string',
  // don't force string storage — allow Context to infer/store typed value.
  let storeVarType = finalType;
  if ((typeof finalValue === 'number' || typeof finalValue === 'boolean') && finalType === 'string') {
    storeVarType = undefined;
  }

  context.set(varName, finalValue, storeVarType);

  // final debug
  try {
    const stored = context.get(varName);
    console.log(`Input: ${varName} = ${JSON.stringify(stored)} (type=${typeof stored})`);
  } catch (e) {}

  return { nextCondition: "auto" };
}
