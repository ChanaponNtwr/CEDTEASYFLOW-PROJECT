export default function DeclareHandler(node, context) {

  // ป้องกันการรันซ้ำ
  if (node._initialized) {
    return { nextCondition: "auto" };
  }

  const rawName = node?.data?.name;
  if (!rawName) return { nextCondition: "auto" };

  const varName = String(rawName).trim();
  const force = Boolean(node?.data?.force);

  if (typeof context.isDeclared === "function" && context.isDeclared(varName) && !force) {
    node._initialized = true;
    return { nextCondition: "auto" };
  }

  let raw = node.data?.value ?? undefined;
  const varTypeRaw = node.data?.varType || null;

  const keys = (context.variables || []).map(v => v.name);
  const values = (context.variables || []).map(v => v.value);

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
    console.error(`❌ Error evaluating declare value '${raw}':`, e.message);
    value = raw;
  }

  if (force && context.isDeclared(varName)) {
    context.set(varName, value, varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined);
  } else {
    context.declare(varName, value, varTypeRaw ? String(varTypeRaw).toLowerCase() : undefined);
  }

  node._initialized = true;

  const stored = context.get(varName);
  const storedType = context.variables[context.index_map[varName]]?.varType;

  console.log(`Declared variable: ${varName} = ${JSON.stringify(stored)} (${storedType})`);

  return { nextCondition: "auto" };
}