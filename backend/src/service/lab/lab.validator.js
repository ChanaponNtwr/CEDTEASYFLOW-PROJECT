// src/service/lab/lab.validator.js

function isISODateString(d) {
  if (!d) return false;
  const dt = new Date(d);
  return !Number.isNaN(dt.getTime());
}

class LabValidator {
  validateCreate(payload, options = {}) {
    const errors = [];
    if (!payload) {
      errors.push("payload missing");
      return errors;
    }
    if (!payload.ownerUserId) errors.push("ownerUserId is required");
    if (!payload.labname || String(payload.labname).trim() === "") errors.push("labname is required");

    if (payload.dueDate) {
      if (!isISODateString(payload.dueDate)) errors.push("dueDate must be a valid date string (ISO)");
      else if (options.disallowPastDueDate) {
        const d = new Date(payload.dueDate);
        if (d.getTime() < Date.now()) errors.push("dueDate must not be in the past");
      }
    }

    const numericFields = ["inSymVal", "outSymVal", "declareSymVal", "assignSymVal", "ifSymVal", "forSymVal", "whileSymVal"];
    for (const f of numericFields) {
      if (payload[f] !== undefined && isNaN(Number(payload[f]))) errors.push(`${f} must be a number`);
    }

    if (payload.testcases !== undefined) {
      if (!Array.isArray(payload.testcases)) errors.push("testcases must be an array");
      else {
        payload.testcases.forEach((t, i) => {
          if (t.inputVal === undefined) errors.push(`testcases[${i}].inputVal required`);
          if (t.outputVal === undefined) errors.push(`testcases[${i}].outputVal required`);
        });
      }
    }

    return errors;
  }

  validateUpdate(payload) {
    const errors = [];
    if (!payload) return errors;
    if (payload.dueDate && !isISODateString(payload.dueDate)) errors.push("dueDate must be valid date");
    return errors;
  }
}

export default new LabValidator();
