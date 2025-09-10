class Edge {
    constructor (
        id,
        source,
        target,
        condition = "auto",
    ){
        if (!["true", "false", "auto","next","done"].includes(condition)) {
            throw new Error(`Invalid edge label: ${condition}`);
        }

        this.id = id;
        this.source = source;
        this.target = target;
        this.condition = condition;
    }
}
export default Edge;
