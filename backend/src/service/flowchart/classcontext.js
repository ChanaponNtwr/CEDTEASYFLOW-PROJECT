export default class Context {
    constructor(variables = []) {
        this.variables = variables.map(v => ({
            name: v.name,
            value: v.value,
            varType: v.varType || Context._inferVarType(v.value)
        })); // [{name, value, varType}]
        this.index_map = {};
        this.output = [];

        // ensure defaults for internal usage
        this._rebuildIndexMap();
    }

    _rebuildIndexMap() {
        this.index_map = {};
        this.variables.forEach((v, i) => {
            this.index_map[v.name] = i;
        });
    }

    // ดึงค่าตัวแปร ถ้าไม่พบ return undefined
    get(varName) {
        const idx = this.index_map[varName];
        if (idx !== undefined) return this.variables[idx].value;
        return undefined;
    }

    // helper: infer varType จากค่า
    static _inferVarType(value) {
        if (value === null || value === undefined) return "int";
        if (Array.isArray(value)) return "array";
        const t = typeof value;
        if (t === "boolean") return "bool";
        if (t === "string") return "string";
        if (t === "number") return Number.isInteger(value) ? "int" : "float";
        if (t === "object") return "object";
        return "int";
    }

    // ตั้งค่าตัวแปร ถ้าไม่มีใน context ให้เพิ่มใหม่
    // หากผู้เรียกไม่ส่ง varType จะ infer ให้โดยอัตโนมัติ
    set(varName, value, varType) {
        const idx = this.index_map[varName];
        const resolvedType = varType || Context._inferVarType(value);
        if (idx !== undefined) {
            this.variables[idx].value = value;
            this.variables[idx].varType = varType || this.variables[idx].varType || resolvedType;
        } else {
            this.variables.push({ name: varName, value, varType: resolvedType });
            this.index_map[varName] = this.variables.length - 1;
        }
    }

    // helper: แสดงตัวแปรทั้งหมด (debug)
    showAll() {
        return this.variables.map(v => `${v.name}=${JSON.stringify(v.value)} (${v.varType})`).join(", ");
    }
}
