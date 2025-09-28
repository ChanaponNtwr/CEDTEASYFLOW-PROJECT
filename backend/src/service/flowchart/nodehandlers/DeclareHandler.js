export default function DeclareHandler(node, context /*, flowchart optional */) {
  const varName = node.data.name;
  let raw = node.data.value ?? 0;
  const varType = node.data.varType || null; // allow infer if not provided

  // ถ้า raw เป็น string ให้ประเมินเป็น expression (รองรับ "'...'", "\"...\"" และนิพจน์)
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
    // ถ้า error ให้ fallback เป็น raw (ไม่ประเมิน)
    value = raw;
  }

  // ใช้ context.set (ให้ Context infer type ถ้า varType ไม่กำหนด)
  context.set(varName, value, varType || undefined);

  console.log(`Declared variable: ${varName} = ${JSON.stringify(value)} (${context.get(varName) === undefined ? "unknown" : typeof value})`);
  return { nextCondition: "auto" };
}
