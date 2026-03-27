export default function StopHandler(node, context) {
    console.log("End Node");
    return { nextCondition: "auto" };
}
