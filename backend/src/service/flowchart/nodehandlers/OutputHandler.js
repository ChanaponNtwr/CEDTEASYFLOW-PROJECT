export default function OutputHandler(node, context /*, flowchart optional */) {
  // ensure context.output exists
  if (!Array.isArray(context.output)) context.output = [];

  let message = (node.data && node.data.message != null) ? String(node.data.message).trim() : "";

  try {
    // 1) ถ้าตรงชื่อ variable ให้ push ค่าปัจจุบัน
    const variable = (context.variables || []).find(v => v.name === message);
    if (variable) {
      console.log(`📤 Output: ${variable.name} = ${variable.value}`);
      context.output.push(variable.value);
      return { nextCondition: "auto" };
    }

    // 2) ถ้าเป็น assignment expression เช่น "line = line + '*'" 
    //    (ไม่ใช่ template literal)
    if (message.includes("=") && !/^`.*`\s*$/.test(message)) {
      const [leftRaw, ...rest] = message.split("=");
      const varName = leftRaw.trim();
      const expr = rest.join("=").trim();

      const keys = (context.variables || []).map(v => v.name);
      const values = (context.variables || []).map(v => v.value);

      let value;
      try {
        value = Function(...keys, `return (${expr});`)(...values);
      } catch (e) {
        console.error(`❌ Error evaluating output-assignment '${message}': ${e.message}`);
        value = undefined;
      }

      if (typeof context.set === "function") {
        context.set(varName, value);
      } else {
        // fallback: push into variables array or set directly
        context.variables = context.variables || [];
        const existing = context.variables.find(v => v.name === varName);
        if (existing) existing.value = value;
        else context.variables.push({ name: varName, value, varType: typeof value });
      }
      console.log(`📤 Output (assign -> context.set): ${varName} = ${value}`);
      return { nextCondition: "auto" };
    }

    // 3) ถ้าเป็น template literal (เริ่มและจบด้วย backtick) → evaluate
    if (message.startsWith("`") && message.endsWith("`")) {
      const keys = (context.variables || []).map(v => v.name);
      const values = (context.variables || []).map(v => v.value);

      let evaluated;
      try {
        evaluated = Function(...keys, `return ${message};`)(...values);
      } catch (e) {
        console.error(`❌ Error evaluating template literal '${message}': ${e.message}`);
        evaluated = message; // ถ้า fail ก็ push ดิบ
      }

      console.log(`📤 Output: ${evaluated}`);
      context.output.push(evaluated);
      return { nextCondition: "auto" };
    }

    // 4) ข้อความธรรมดา → push ตรง
    console.log(`📤 Output: ${message}`);
    context.output.push(message);
    return { nextCondition: "auto" };

  } catch (e) {
    console.error(`❌ Error evaluating output '${message}': ${e.message}`);
    return { nextCondition: "auto" };
  }
}
