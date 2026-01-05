// src/service/class/class.validator.js

function isISODateString(d) {
  if (!d) return false;
  const dt = new Date(d);
  return !Number.isNaN(dt.getTime());
}

class ClassValidator {
  validateCreate(payload = {}) {
    const errors = [];
    if (!payload) { errors.push("payload missing"); return errors; }
    if (!payload.classname || String(payload.classname).trim() === "") errors.push("classname is required");
    // optional numeric checks (none required for creation)
    return errors;
  }

  validateUpdate(payload = {}) {
    const errors = [];
    if (!payload) return errors;
    if (payload.createAt && !isISODateString(payload.createAt)) errors.push("createAt must be an ISO date");
    return errors;
  }

  validateAddUser({ userId, roleId } = {}) {
    const errors = [];
    if (!userId) errors.push("userId is required");
    if (!roleId) errors.push("roleId is required");
    return errors;
  }

  validateAddLab({ labId } = {}) {
    const errors = [];
    if (!labId) errors.push("labId is required");
    return errors;
  }

  validateAddPackage({ packageId } = {}) {
    const errors = [];
    if (!packageId) errors.push("packageId is required");
    return errors;
  }
}

export default new ClassValidator();
