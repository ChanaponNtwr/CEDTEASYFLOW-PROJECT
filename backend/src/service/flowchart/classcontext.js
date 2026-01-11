// src/service/flowchart/classcontext.js
export default class Context {
    constructor(variables = []) {
        this._scopeStack = [ {} ];
        this.output = [];

        for (const v of variables) {
            const name = v.name;
            const value = v.value;
            const varType = v.varType || Context._inferVarType(value);
            this._scopeStack[0][name] = { value, varType };
        }

        this.variables = [];
        this._syncVariables();
    }


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

    _syncVariables() {
        const merged = {};
        for (const scope of this._scopeStack) {
            for (const k of Object.keys(scope)) {
                merged[k] = scope[k];
            }
        }

        this.variables = Object.keys(merged).map(name => ({
            name,
            value: merged[name].value,
            varType: merged[name].varType || null
        }));

        this._rebuildIndexMap();
    }

    _rebuildIndexMap() {
        this.index_map = {};
        (this.variables || []).forEach((v, i) => {
            this.index_map[v.name] = i;
        });
    }


    pushScope(bindings = {}) {
        const scope = {};
        for (const k of Object.keys(bindings)) {
            const v = bindings[k];
            if (v && typeof v === "object" && ("value" in v)) {
                scope[k] = {
                    value: v.value,
                    varType: v.varType || Context._inferVarType(v.value)
                };
            } else {
                scope[k] = {
                    value: v,
                    varType: Context._inferVarType(v)
                };
            }
        }
        this._scopeStack.push(scope);
        this._syncVariables();
    }

    popScope() {
        if (this._scopeStack.length > 1) {
            this._scopeStack.pop();
            this._syncVariables();
        }
    }


    get(name) {
        for (let i = this._scopeStack.length - 1; i >= 0; i--) {
            const scope = this._scopeStack[i];
            if (Object.prototype.hasOwnProperty.call(scope, name)) {
                return scope[name].value;
            }
        }
        return undefined;
    }

    set(name, value, varType) {
        for (let i = this._scopeStack.length - 1; i >= 0; i--) {
            const scope = this._scopeStack[i];
            if (Object.prototype.hasOwnProperty.call(scope, name)) {
                scope[name].value = value;
                scope[name].varType =
                    varType || scope[name].varType || Context._inferVarType(value);
                this._syncVariables();
                return;
            }
        }

        const top = this._scopeStack[this._scopeStack.length - 1];
        top[name] = {
            value,
            varType: varType || Context._inferVarType(value)
        };
        this._syncVariables();
    }

    showAll() {
        return (this.variables || [])
            .map(v => `${v.name}=${JSON.stringify(v.value)} (${v.varType})`)
            .join(", ");
    }

    serialize() {
        try {
            return {
                variables: JSON.parse(JSON.stringify(this.variables || [])),
                output: JSON.parse(JSON.stringify(this.output || [])),
                scopeStack: JSON.parse(JSON.stringify(this._scopeStack || []))
            };
        } catch (e) {
            console.warn("Context.serialize failed:", e);
            return {
                variables: [],
                output: [],
                scopeStack: [ {} ]
            };
        }
    }

    restore(snapshot) {
        if (!snapshot || typeof snapshot !== "object") return;

        try {
            if (Array.isArray(snapshot.scopeStack) && snapshot.scopeStack.length > 0) {
                this._scopeStack = JSON.parse(JSON.stringify(snapshot.scopeStack));
            } else {
                this._scopeStack = [ {} ];
            }

            this.output = Array.isArray(snapshot.output)
                ? JSON.parse(JSON.stringify(snapshot.output))
                : [];

            this._syncVariables();
        } catch (e) {
            console.warn("Context.restore failed:", e);
        }
    }
}
