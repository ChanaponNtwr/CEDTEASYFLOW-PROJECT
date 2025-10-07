// src/service/flowchart/classcontext.js
export default class Context {
    constructor(variables = []) {
        // scope stack: each scope is a map name -> { value, varType }
        this._scopeStack = [ {} ];
        this.output = [];

        // initialize from variables array (compatibility)
        for (const v of variables) {
            const name = v.name;
            const value = v.value;
            const varType = v.varType || Context._inferVarType(value);
            this._scopeStack[0][name] = { value, varType };
        }

        // public array-like view for backward compatibility
        this.variables = [];
        this._syncVariables();
    }

    // infer varType helper
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

    // merge scopes into variables[] (bottom->top, top overrides)
    _syncVariables() {
        const merged = {};
        for (const scope of this._scopeStack) {
            for (const k of Object.keys(scope)) {
                merged[k] = scope[k]; // later scopes override earlier ones
            }
        }
        // transform to array
        this.variables = Object.keys(merged).map(name => ({
            name,
            value: merged[name].value,
            varType: merged[name].varType || null
        }));
        // build quick lookup
        this._rebuildIndexMap();
    }

    _rebuildIndexMap() {
        this.index_map = {};
        (this.variables || []).forEach((v, i) => { this.index_map[v.name] = i; });
    }

    // scope operations
    pushScope(bindings = {}) {
        // normalize bindings so each entry is { value, varType }
        const scope = {};
        for (const k of Object.keys(bindings)) {
            const v = bindings[k];
            if (v && typeof v === "object" && ("value" in v)) scope[k] = { value: v.value, varType: v.varType || Context._inferVarType(v.value) };
            else scope[k] = { value: v, varType: Context._inferVarType(v) };
        }
        this._scopeStack.push(scope);
        this._syncVariables();
    }

    popScope() {
        if (this._scopeStack.length > 1) {
            this._scopeStack.pop();
            this._syncVariables();
        } else {
            // do nothing if already at global scope
        }
    }

    // get looks from top-most scope down
    get(name) {
        for (let i = this._scopeStack.length - 1; i >= 0; i--) {
            const scope = this._scopeStack[i];
            if (Object.prototype.hasOwnProperty.call(scope, name)) return scope[name].value;
        }
        return undefined;
    }

    // set writes to the first (top-most) scope that contains name; otherwise writes to top scope
    set(name, value, varType) {
        // find existing
        for (let i = this._scopeStack.length - 1; i >= 0; i--) {
            const scope = this._scopeStack[i];
            if (Object.prototype.hasOwnProperty.call(scope, name)) {
                scope[name].value = value;
                scope[name].varType = varType || scope[name].varType || Context._inferVarType(value);
                this._syncVariables();
                return;
            }
        }
        // not found -> set in top scope
        const top = this._scopeStack[this._scopeStack.length - 1];
        top[name] = { value, varType: varType || Context._inferVarType(value) };
        this._syncVariables();
    }

    // showAll for debug
    showAll() {
        return (this.variables || []).map(v => `${v.name}=${JSON.stringify(v.value)} (${v.varType})`).join(", ");
    }
}
