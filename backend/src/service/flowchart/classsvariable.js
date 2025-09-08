class VariableItem{
    constructor(
        name,
        value,
        varType,
    ){
        if (!name) throw new Error("Variable name required");
        if (!["int", "string", "float", "bool", "array", "object"].includes(varType)) {
            throw new Error("varType must be one of 'int','string','float','bool','array','object'");
        }
        this.name = name;
        this.value = value;
        this.varType = varType;
    }
}
export default VariableItem;
