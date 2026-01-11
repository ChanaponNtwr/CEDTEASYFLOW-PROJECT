export default function OutputHandler(node, context /*, flowchart optional */) {
  if (!Array.isArray(context.output)) context.output = [];

  let message =
    node && node.data && node.data.message != null
      ? String(node.data.message)
      : "";

  // helper: build env map
  const buildEnv = () => {
    const env = {};
    (context.variables || []).forEach(v => {
      env[v.name] = v.value;
    });
    return env;
  };

  // helper: strip wrapping quotes ("A" or 'A')
  const stripQuotes = (val) => {
    if (typeof val !== "string") return val;
    const s = val.trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      return s.slice(1, -1);
    }
    return val;
  };

  // helper: push value(s) into context.output, expanding arrays
  const pushValues = (val) => {
    if (val == null) {
      // keep behavior: push null/undefined? here we skip null/undefined to avoid noisy outputs.
      return;
    }

    // If it's already an array, push each element
    if (Array.isArray(val)) {
      val.forEach(x => context.output.push(x));
      return;
    }

    // If looks like a JSON array string (e.g. "[1,2,3]"), try parse
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parsed.forEach(x => context.output.push(x));
            return;
          }
        } catch (e) {
          // fallthrough: not a valid JSON array string
        }
      }
    }

    // otherwise push the single value
    context.output.push(val);
  };

  try {
    const trimmed = message.trim();

    /* ============================================================
     * 1) Exact variable name → output variable value (expand arrays)
     * ============================================================ */
    if (/^[A-Za-z_]\w*$/.test(trimmed)) {
      const variable = (context.variables || []).find(v => v.name === trimmed);
      if (variable) {
        console.log(`📤 Output: ${variable.name} = ${variable.value}`);
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
      const vals = names.map(n => env[n]);

      let value;
      try {
        const fn = new Function(...names, `return (${expr});`);
        value = fn(...vals);
      } catch (e) {
        console.error(`❌ Error evaluating output-assignment '${message}': ${e.message}`);
        value = undefined;
      }

      try {
        if (typeof context.set === "function") {
          context.set(varName, value);
        } else {
          const existing = (context.variables || []).find(v => v.name === varName);
          if (existing) existing.value = value;
          else context.variables.push({ name: varName, value, varType: typeof value });
        }
        console.log(`📤 Output (assign): ${varName} = ${value}`);
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
      const vals = names.map(n => env[n]);

      let evaluated;
      try {
        const fn = new Function(...names, `return ${message};`);
        evaluated = fn(...vals);
      } catch (e) {
        console.error(`❌ Error evaluating template literal '${message}': ${e.message}`);
        evaluated = message;
      }

      console.log(`📤 Output: ${evaluated}`);
      pushValues(evaluated);
      return { nextCondition: "auto" };
    }

    /* ============================================================
     * 4) Expression / concatenation — evaluate and expand arrays
     * ============================================================ */
    if (/[+\-*/]/.test(trimmed)) {
      const env = buildEnv();
      const names = Object.keys(env);
      const vals = names.map(n => env[n]);

      try {
        const fn = new Function(...names, `return (${message});`);
        let evaluated = fn(...vals);

        // normalize string literal result
        evaluated = stripQuotes(evaluated);

        console.log(`📤 Output (expr): ${evaluated}`);
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

      console.log(`📤 Output (placeholder): ${replaced}`);
      pushValues(replaced);
      return { nextCondition: "auto" };
    }

    /* ============================================================
     * 6) Plain literal → strip quotes if needed, then expand arrays
     * ============================================================ */
    const finalMessage = stripQuotes(message);
    console.log(`📤 Output: ${finalMessage}`);
    pushValues(finalMessage);
    return { nextCondition: "auto" };

  } catch (e) {
    console.error(`❌ Error evaluating output '${message}': ${e.message}`);
    return { nextCondition: "auto" };
  }
}
