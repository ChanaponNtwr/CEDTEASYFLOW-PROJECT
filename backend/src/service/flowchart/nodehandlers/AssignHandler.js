export default function AssignHandler(node, context /*, flowchart */) {
  const varName = node?.data?.variable || node?.data?.name;
  const raw = node?.data?.value;

  if (!varName) return { nextCondition: "auto" };

  /* ================= build env ================= */

  const env = {};
  context.variables.forEach(v => {
    let val = v.value;

    // 🔥 FIX: auto-cast numeric strings
    if (typeof val === "string") {
      const s = val.trim();

      // int
      if (/^[+-]?\d+$/.test(s)) {
        val = Number(s);
      }
      // float
      else if (/^[+-]?\d*\.\d+$/.test(s) || /^[+-]?\d+\.\d*$/.test(s)) {
        val = Number(s);
      }
      // boolean
      else if (s.toLowerCase() === "true") {
        val = true;
      }
      else if (s.toLowerCase() === "false") {
        val = false;
      }
    }

    env[v.name] = val;
  });

  const names = Object.keys(env);
  const vals = names.map(n => env[n]);

  /* ================= evaluate ================= */

  let value;
  try {
    if (typeof raw !== "string") {
      value = raw;
    } else {
      const expr = raw.trim();
      if (expr === "") {
        value = "";
      } else {
        const fn = new Function(...names, `return (${expr});`);
        value = fn(...vals);
      }
    }
  } catch (e) {
    console.error(`❌ Assign eval error: ${raw}`, e.message);
    return { nextCondition: "auto" };
  }

  /* ================= set result ================= */

  let varType;
  if (typeof value === "number") {
    varType = Number.isInteger(value) ? "int" : "float";
  } else if (typeof value === "boolean") {
    varType = "bool";
  } else {
    varType = "string";
  }

  context.set(varName, value, varType);

  console.log(
    `Assigned: ${varName} = ${JSON.stringify(value)} (${varType})`
  );

  return { nextCondition: "auto" };
}
