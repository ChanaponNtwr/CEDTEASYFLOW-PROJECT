export default function OutputHandler(node, context /*, flowchart optional */) {
  let message = String(node.data.message).trim();

  try {
    // 1) ถ้าตรงชื่อ variable ให้ push ค่าปัจจุบัน
    const variable = context.variables.find(v => v.name === message);
    if (variable) {
      console.log(`📤 Output: ${variable.name} = ${variable.value}`);
      context.output.push(variable.value);
      return { nextCondition: "auto" };
    }

    // 2) ถ้าเป็น assignment expression เช่น "line = line + '*'" ให้ประเมินขวาแล้ว set กลับ context
    if (message.includes("=")) {
      // แยกครั้งแรกเท่านั้น (support expressions containing = อื่น ๆ เป็นกรณีพิเศษ)
      const [leftRaw, ...rest] = message.split("=");
      const varName = leftRaw.trim();
      const expr = rest.join("=").trim();

      const keys = context.variables.map(v => v.name);
      const values = context.variables.map(v => v.value);

      let value;
      try {
        value = Function(...keys, `return (${expr});`)(...values);
      } catch (e) {
        console.error(`❌ Error evaluating output-assignment '${message}': ${e.message}`);
        value = undefined;
      }

      context.set(varName, value);
      console.log(`📤 Output (assign -> context.set): ${varName} = ${value}`);
      // โดยปกติ assignment ผ่าน OU จะไม่ push เป็น output line (เราใช้เพื่อเปลี่ยน context)
      return { nextCondition: "auto" };
    }

    // 3) ข้อความธรรมดา -> push เดิม
    console.log(`📤 Output: ${message}`);
    context.output.push(message);
    return { nextCondition: "auto" };

  } catch (e) {
    console.error(`❌ Error evaluating output '${message}': ${e.message}`);
    return { nextCondition: "auto" };
  }
}
