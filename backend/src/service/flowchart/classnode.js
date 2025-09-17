const NodeType = Object.freeze({ 
    ST: "start",
    EN: "end",
    DC: "declare",
    IF: "if",
    AS: "assign",
    FR: "for",
    WH: "while",
    IN: "input",
    OU: "output",
    DO: "do",
    BP: "breakpoint"
});

// reverse mapping: string เต็ม → ตัวย่อ
const NodeTypeShort = Object.freeze(
    Object.fromEntries(Object.entries(NodeType).map(([short, full]) => [full, short]))
);

class Node {
    constructor(
        id,
        type,
        label = "",
        data, 
        position = { x: 0, y: 0 },
        incomingEdgeIds = [],
        outgoingEdgeIds = [],
    ) {
        let shortType = type;
        // ถ้า user ส่ง full string เช่น "while" ให้แปลงเป็น short "WH"
        if (NodeTypeShort[type]) shortType = NodeTypeShort[type];
        else if (!NodeType[type]) {
            // ถ้า type ถูกส่งมาเป็น short code เช่น "WH" แต่ไม่ตรงกับ NodeType key
            if (!Object.keys(NodeType).includes(type)) throw new Error(`Invalid type: ${type}`);
            shortType = type;
        }

        this.id = id;
        this.type = shortType; // เก็บ short code เช่น "WH", "FR"
        this.label = label || NodeType[shortType];

        // ตรวจสอบ data (มี default data ตามชนิด)
        const requiredDataKeys = Object.keys(Node.getDefaultData(shortType));
        if (!data && requiredDataKeys.length > 0) {
            throw new Error(`Node ${id} type ${shortType} ต้องใส่ข้อมูล data`);
        }
        const missingKeys = requiredDataKeys.filter(k => !(k in (data || {})));
        if (missingKeys.length > 0) {
            throw new Error(`Node ${id} type ${shortType} ขาด data keys: ${missingKeys.join(", ")}`);
        }

        this.data = data || Node.getDefaultData(shortType);
        this.position = position;
        this.incomingEdgeIds = incomingEdgeIds;
        this.outgoingEdgeIds = outgoingEdgeIds;
        // สำหรับ loop node เราใช้ property นี้เพื่อเก็บ edge id ที่เป็น exit
        this.loopExitEdge = this.loopExitEdge || null;
    }

    static getDefaultData(shortType) {
        switch (shortType) {
            case "ST": return { label: "Start" };
            case "EN": return { label: "End" };
            case "DC": return { name: "", value: null, varType: "" };
            case "IF": return { condition: "" };
            case "AS": return  { variable: "", value: "" };
            case "FR": return { init: "", condition: "", increment: "", varName: "" };
            case "WH": return { condition: "", varName: "", increment: "" };
            case "IN": return { variable: "", prompt: "", varType: "" };
            case "OU": return { message: "" };
            case "BP": return { note: "" };
            case "DO": return { acction: "" };
            default: return {};
        }
    }

    addIncomingEdge(edgeId) {
        if (!this.incomingEdgeIds.includes(edgeId)) {
            this.incomingEdgeIds.push(edgeId);
        }
    }

    updateData(newData) {
        if (typeof newData !== 'object') throw new Error("newData must be an object");
        this.data = { ...this.data, ...newData };
    }
}
export { NodeType, NodeTypeShort };
export default Node;
