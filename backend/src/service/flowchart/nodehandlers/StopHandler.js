export default function StopHandler(node, context /*, flowchart optional */) {
    console.log("End Node");
    return { nextCondition: "auto" };
}
