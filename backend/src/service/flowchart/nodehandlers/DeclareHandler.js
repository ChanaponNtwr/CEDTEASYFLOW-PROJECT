export default function DeclareHandler(node, context /*, flowchart optional */) {
  const varName = node?.data?.name;
  if (!varName) return { nextCondition: "auto" };

  let raw = node.data.value ?? 0;
  const varTypeRaw = node.data.varType || null; // allow infer if not provided

  // ถ้ามีค่าใน context อยู่แล้ว และไม่ได้บังคับ override ให้ข้ามการประกาศ
  const existing = context.get(varName);
  if (existing !== undefined && node?.data?.force !== true) {
    console.log(`DC: variable ${varName} already set (${JSON.stringify(existing)}), skipping declaration`);
    return { nextCondition: "auto" };
  }

  // Evaluate string expressions if given (safe-ish)
  const keys = context.variables.map(v => v.name);
  const values = context.variables.map(v => v.value);

  let value = raw;
  try {
    if (typeof raw === "string") {
      const expr = raw.trim();
      if (expr === "") {
        value = "";
      } else {
        value = Function(...keys, `return (${expr});`)(...values);
      }
    }
  } catch (e) {
    console.error(`❌ Error evaluating declare value '${raw}': ${e.message}`);
    value = raw;
  }

  // set (Context will cast/normalize)
  const normalizedType = varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined;
  context.set(varName, value, normalizedType);

  const stored = context.get(varName);
  const storedType = context.variables[context.index_map[varName]]?.varType;
  console.log(`Declared variable: ${varName} = ${JSON.stringify(stored)} (${storedType})`);
  return { nextCondition: "auto" };
}
