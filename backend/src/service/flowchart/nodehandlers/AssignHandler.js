export default function AssignHandler(node, context /*, flowchart optional */) {
  const varName = node.data.variable;
  const raw = node.data.value;

  // สร้าง key-value จาก context.variables
  const keys = context.variables.map(v => v.name);
  const values = context.variables.map(v => v.value);

  let value;
  try {
    // ถ้า value ที่มาจาก node ไม่ใช่ string ให้ถือว่าเป็นค่า literal แล้วเซ็ตตรง ๆ
    if (typeof raw !== "string") {
      value = raw;
    } else {
      const expr = raw.trim();
      // ถ้าเป็นสตริงว่าง (ไม่มีนิพจน์) ให้ตีความเป็น empty string
      if (expr === "") {
        value = "";
      } else {
        // ประเมิน expression (รองรับทั้ง "'...'" / "\"...\"" หรือ การอ้างตัวแปร/นิพจน์)
        // ใส่วงเล็บเพื่อป้องกัน object-literal ambiguity
        value = Function(...keys, `return (${expr});`)(...values);
      }
    }
  } catch (e) {
    console.error(`❌ Error evaluating assignment '${raw}': ${e.message}`);
    return { nextCondition: "auto" };
  }

  // เก็บลง context.variables (ให้ Context infer type เอง)
  context.set(varName, value);

  console.log(`Assigned: ${varName} = ${value}`);
  return { nextCondition: "auto" };
}
