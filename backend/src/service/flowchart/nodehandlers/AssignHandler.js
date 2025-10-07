export default function AssignHandler(node, context /*, flowchart optional */) {
  const varName = node?.data?.variable || node?.data?.name;
  const raw = node?.data?.value;

  if (!varName) return { nextCondition: "auto" };

  // build env from context and cast numeric types to Number so arithmetic works
  const env = {};
  context.variables.forEach(v => {
    const vt = String(v.varType || "").toLowerCase();
    if (["int", "integer", "number", "float"].includes(vt)) env[v.name] = Number(v.value);
    else if (["bool", "boolean"].includes(vt)) env[v.name] = Boolean(v.value);
    else env[v.name] = v.value;
  });

  const names = Object.keys(env);
  const vals = names.map(n => env[n]);

  let value;
  try {
    if (typeof raw !== "string") {
      value = raw;
    } else {
      const expr = raw.trim();
      if (expr === "") {
        value = "";
      } else {
        // evaluate expression in a Function scope
        const fn = new Function(...names, `return (${expr});`);
        value = fn(...vals);
      }
    }
  } catch (e) {
    console.error(`❌ Error evaluating assignment '${raw}': ${e.message}`);
    // don't throw — just skip assignment (or you could set undefined)
    return { nextCondition: "auto" };
  }

  // decide varType: prefer existing, else hint from node, else infer
  let targetVarType;
  const idx = context.index_map[varName];
  if (idx !== undefined && context.variables[idx]) {
    targetVarType = context.variables[idx].varType;
  } else {
    targetVarType = node?.data?.varType ? String(node.data.varType).toLowerCase() : undefined;
  }

  context.set(varName, value, targetVarType);
  const stored = context.get(varName);
  const storedType = context.variables[context.index_map[varName]]?.varType;
  console.log(`Assigned: ${varName} = ${JSON.stringify(stored)} (${storedType})`);
  return { nextCondition: "auto" };
}
