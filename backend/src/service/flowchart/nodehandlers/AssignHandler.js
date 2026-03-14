export default function AssignHandler(node, context /*, flowchart */) {

  const varName = node?.data?.variable || node?.data?.name;
  const raw = node?.data?.value;

  if (!varName) return { nextCondition: "auto" };

  /* ❗ CHECK DECLARE FIRST */
  if (!context.isDeclared(varName)) {
    throw new Error(`Variable '${varName}' is not declared before assignment`);
  }

  /* ================= build env ================= */

  const env = {};

  context.variables.forEach(v => {
    let val = v.value;

    if (typeof val === "string") {
      const s = val.trim();

      if (/^[+-]?\d+$/.test(s)) {
        val = Number(s);
      }
      else if (/^[+-]?\d*\.\d+$/.test(s) || /^[+-]?\d+\.\d*$/.test(s)) {
        val = Number(s);
      }
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
    }
    else {

      const expr = raw.trim();

      if (expr === "") {
        value = "";
      }
      else {
        const fn = new Function(...names, `return (${expr});`);
        value = fn(...vals);
      }

    }

  } catch (e) {

    console.error(`❌ Assign eval error: ${raw}`, e.message);
    throw new Error(`Invalid expression in Assign: ${raw}`);

  }

  /* ================= set result ================= */

  let varType;

  if (typeof value === "number") {
    varType = Number.isInteger(value) ? "int" : "float";
  }
  else if (typeof value === "boolean") {
    varType = "bool";
  }
  else {
    varType = "string";
  }

  context.set(varName, value, varType);

  console.log(
    `Assigned: ${varName} = ${JSON.stringify(value)} (${varType})`
  );

  return { nextCondition: "auto" };
}