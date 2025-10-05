// src/service/flowchart/nodeHandlers/ou.js
export default function OutputHandler(node, context /*, flowchart optional */) {
  // ensure context.output exists
  if (!Array.isArray(context.output)) context.output = [];

  // normalize message to string (or empty)
  let message = (node && node.data && node.data.message != null) ? String(node.data.message) : "";

  // helper: build env maps
  const buildEnv = () => {
    const env = {};
    (context.variables || []).forEach(v => { env[v.name] = v.value; });
    return env;
  };

  try {
    // 0) Trim for some checks but keep original spacing for output replacement
    const trimmed = message.trim();

    // 1) If message is exactly a variable name → push the variable value
    if (/^[A-Za-z_]\w*$/.test(trimmed)) {
      const variable = (context.variables || []).find(v => v.name === trimmed);
      if (variable) {
        console.log(`📤 Output: ${variable.name} = ${variable.value}`);
        context.output.push(variable.value);
        return { nextCondition: "auto" };
      }
    }

    // 2) Assignment expression (e.g. "line = line + '*'" ) — detect only when the whole message looks like an assignment
    //    pattern: optional whitespace, identifier, =, rest-of-line
    const assignMatch = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
    if (assignMatch) {
      const varName = assignMatch[1];
      const expr = assignMatch[2];

      const env = buildEnv();
      const names = Object.keys(env);
      const vals = names.map(n => env[n]);

      let value;
      try {
        // evaluate expression using Function (names as params)
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
          // fallback
          context.variables = context.variables || [];
          const existing = context.variables.find(v => v.name === varName);
          if (existing) existing.value = value;
          else context.variables.push({ name: varName, value, varType: typeof value });
        }
        console.log(`📤 Output (assign -> context.set): ${varName} = ${value}`);
      } catch (e) {
        console.warn("Failed to set variable from output-assignment:", e);
      }
      return { nextCondition: "auto" };
    }

    // 3) Template literal (starts and ends with backtick) — evaluate as template
    if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
      const env = buildEnv();
      const names = Object.keys(env);
      const vals = names.map(n => env[n]);

      let evaluated;
      try {
        // evaluate the template literal (returns string)
        const fn = new Function(...names, `return ${message};`);
        evaluated = fn(...vals);
      } catch (e) {
        console.error(`❌ Error evaluating template literal '${message}': ${e.message}`);
        evaluated = message;
      }

      console.log(`📤 Output: ${evaluated}`);
      context.output.push(evaluated);
      return { nextCondition: "auto" };
    }

    // 4) Placeholder replacement for patterns like "& varName" or "&varName"
    //    Replace all occurrences with the corresponding context value (stringified)
    const placeholderRegex = /&\s*([A-Za-z_]\w*)/g;
    if (placeholderRegex.test(message)) {
      const env = buildEnv();
      const replaced = message.replace(placeholderRegex, (_, varName) => {
        if (Object.prototype.hasOwnProperty.call(env, varName)) {
          const val = env[varName];
          return (val === null || val === undefined) ? "" : String(val);
        }
        return ""; // unknown variable -> empty
      });
      console.log(`📤 Output (placeholder): ${replaced}`);
      context.output.push(replaced);
      return { nextCondition: "auto" };
    }

    // 5) Otherwise: plain message -> push as-is
    console.log(`📤 Output: ${message}`);
    context.output.push(message);
    return { nextCondition: "auto" };

  } catch (e) {
    console.error(`❌ Error evaluating output '${message}': ${e.message}`);
    return { nextCondition: "auto" };
  }
}
