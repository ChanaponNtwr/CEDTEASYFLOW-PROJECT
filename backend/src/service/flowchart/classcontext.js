// src/service/flowchart/classcontext.js

export default class Context {
  constructor() {
    this.variables = [];      // [{ name, value, varType }]
    this.index_map = {};      // name -> index
  }

  set(name, value, varType) {
    if (!name) return;

    // 🔥 ห้ามแปลง value เป็น string
    const storedValue = value;

    if (this.index_map[name] !== undefined) {
      const idx = this.index_map[name];
      this.variables[idx].value = storedValue;

      // update type only if provided
      if (varType) {
        this.variables[idx].varType = varType;
      }
    } else {
      const idx = this.variables.length;
      this.index_map[name] = idx;
      this.variables.push({
        name,
        value: storedValue,
        varType: varType,
      });
    }
  }

  get(name) {
    const idx = this.index_map[name];
    if (idx === undefined) return undefined;
    return this.variables[idx].value;
  }

  has(name) {
    return this.index_map[name] !== undefined;
  }

  dump() {
    return this.variables.map(v => ({
      name: v.name,
      value: v.value,
      type: typeof v.value,
      varType: v.varType,
    }));
  }

  reset() {
    this.variables = [];
    this.index_map = {};
  }
}
