export default function BPHandler(node, context /*, flowchart optional */) {
    // BP เป็นแค่จุดพัก ไม่ทำอะไร
    console.log(`Breakpoint ${node.id}`);
    return { nextCondition: "auto" };
}
