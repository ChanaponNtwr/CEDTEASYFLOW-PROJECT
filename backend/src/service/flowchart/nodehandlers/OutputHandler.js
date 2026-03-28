export default function OutputHandler(node, context) {
  if (!Array.isArray(context.output)) context.output = [];

  let message =
    node && node.data && node.data.message != null
      ? String(node.data.message)
      : "";

  // helper: build env map
  const buildEnv = () => {
    const env = {};
    (context.variables || []).forEach((v) => {
      env[v.name] = v.value;
    });
    return env;
  };

  const stripQuotes = (val) => {
    if (typeof val !== "string") return val;
    const s = val.trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      return s.slice(1, -1);
    }
    return s;
  };

  const pushValues = (val) => {
    if (val == null) return;

    // ถ้าเป็น array ค่อยแตกทีละค่า
    if (Array.isArray(val)) {
      val.forEach((x) => pushValues(x));
      return;
    }

    // ถ้าเป็น string
    if (typeof val === "string") {
      const trimmed = val.trim();

      // ถ้าเป็น JSON array string เช่น "[1,2,3]" ค่อย parse
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parsed.forEach((x) => pushValues(x));
            return;
          }
        } catch (e) {
          // ไม่ใช่ JSON array ก็ปล่อยผ่าน
        }
      }

      // กรณีเป็นหลาย token ที่ครอบ quote แยกกัน เช่น: "p" "p"
      // จะ split เฉพาะ pattern นี้เท่านั้น
      const quotedTokens = trimmed.match(/"[^"]*"|'[^']*'/g);
      if (quotedTokens && quotedTokens.length > 1) {
        const cleanedQuoted = quotedTokens.map((t) => stripQuotes(t));
        const rejoined = quotedTokens.join(" ").trim();

        // split เฉพาะเมื่อทั้งสตริงประกอบด้วย quoted tokens เป็นหลัก
        if (rejoined === trimmed) {
          cleanedQuoted.forEach((x) => context.output.push(x));
          return;
        }
      }

      // string ปกติ: เก็บทั้งก้อน ไม่ split ตาม space
      context.output.push(stripQuotes(trimmed));
      return;
    }

    // number / boolean / อื่น ๆ
    context.output.push(val);
  };

  try {
    const trimmed = message.trim();

    /* ============================================================
     * 1) Exact variable name → output variable value (expand arrays)
     * ============================================================ */
    if (/^[A-Za-z_]\w*$/.test(trimmed)) {
      const variable = (context.variables || []).find(
        (v) => v.name === trimmed,
      );
      if (variable) {
        console.log(`Output: ${variable.name} = ${variable.value}`);
        pushValues(variable.value);
        return { nextCondition: "auto" };
      }
    }

    /* ============================================================
     * 2) Assignment expression (unchanged behavior for setting vars)
     * ============================================================ */
    const assignMatch = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const expr = assignMatch[2];

      const env = buildEnv();
      const names = Object.keys(env);
      const vals = names.map((n) => env[n]);

      let value;
      try {
        const fn = new Function(...names, `return (${expr});`);
        value = fn(...vals);
      } catch (e) {
        console.error(
          `Error evaluating output-assignment '${message}': ${e.message}`,
        );
        value = undefined;
      }

      try {
        if (typeof context.set === "function") {
          context.set(varName, value);
        } else {
          const existing = (context.variables || []).find(
            (v) => v.name === varName,
          );
          if (existing) existing.value = value;
          else
            context.variables.push({
              name: varName,
              value,
              varType: typeof value,
            });
        }
        console.log(`Output (assign): ${varName} = ${value}`);
      } catch (e) {
        console.warn("Failed to set variable from output-assignment:", e);
      }
      return { nextCondition: "auto" };
    }

    /* ============================================================
     * 3) Template literal (unchanged) — if result is array, expand
     * ============================================================ */
    if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
      const env = buildEnv();
      const names = Object.keys(env);
      const vals = names.map((n) => env[n]);

      let evaluated;
      try {
        const fn = new Function(...names, `return ${message};`);
        evaluated = fn(...vals);
      } catch (e) {
        console.error(
          `Error evaluating template literal '${message}': ${e.message}`,
        );
        evaluated = message;
      }

      console.log(`Output: ${evaluated}`);
      pushValues(evaluated);
      return { nextCondition: "auto" };
    }

    /* ============================================================
     * 4) Expression / concatenation — evaluate and expand arrays
     * ============================================================ */
    if (/[+\-*/]/.test(trimmed)) {
      const env = buildEnv();
      const names = Object.keys(env);
      const vals = names.map((n) => env[n]);

      try {
        const fn = new Function(...names, `return (${message});`);
        let evaluated = fn(...vals);

        // normalize string literal result
        evaluated = stripQuotes(evaluated);

        console.log(`Output (expr): ${evaluated}`);
        pushValues(evaluated);
        return { nextCondition: "auto" };
      } catch (e) {
        // fallthrough to plain message
      }
    }

    /* ============================================================
     * 5) Placeholder &var — replace placeholders, then expand arrays if any
     * ============================================================ */
    const placeholderRegex = /&\s*([A-Za-z_]\w*)/g;
    if (placeholderRegex.test(message)) {
      const env = buildEnv();
      const replaced = message.replace(placeholderRegex, (_, varName) => {
        if (Object.prototype.hasOwnProperty.call(env, varName)) {
          const val = env[varName];
          return val == null ? "" : String(val);
        }
        return "";
      });

      console.log(`Output (placeholder): ${replaced}`);
      pushValues(replaced);
      return { nextCondition: "auto" };
    }

    /* ============================================================
     * 6) Plain literal → strip quotes if needed, then expand arrays
     * ============================================================ */
    const finalMessage = stripQuotes(message);
    console.log(`Output: ${finalMessage}`);
    pushValues(finalMessage);
    return { nextCondition: "auto" };
  } catch (e) {
    console.error(`Error evaluating output '${message}': ${e.message}`);
    return { nextCondition: "auto" };
  }
}