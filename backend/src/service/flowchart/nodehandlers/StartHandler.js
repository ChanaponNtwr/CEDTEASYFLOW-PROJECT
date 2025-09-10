export default function StartHandler(node, context /*, flowchart optional */) {
    console.log("Start Node");
    return { nextCondition: "auto" };
}
