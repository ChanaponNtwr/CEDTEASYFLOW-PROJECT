// src/service/testcase/inputCombiner.js
/**
 * InputCombiner
 * - combine(testcases) -> combinedInputs (array)
 * - validateCombinedInputs(flowchartMeta, combinedInputs) -> {ok,message,required,provided}
 *
 * NOTE: flowchartMeta is flexible. If you have a flowchart object, you can pass it.
 * We attempt to detect "required number of inputs" by checking flowchart.countInputNodes(),
 * or by heuristics (if flowchart.nodes exists).
 */
import outputSplitter from "./outputSplitter.js";

export default class InputCombiner {
  combine(testcases = []) {
    const combined = [];
    for (const tc of testcases) {
      const ins = tc.parseInputs();
      // push ins in sequence — each ins element is an "input item" (primitive or array)
      for (const i of ins) combined.push(i);
    }
    return combined;
  }

  // Try to detect minimal requirement from flowchart
  validateCombinedInputs(flowchartMeta = null, combinedInputs = []) {
    // Attempt to determine required count:
    let required = null;

    try {
      if (!flowchartMeta) {
        required = null;
      } else if (typeof flowchartMeta.countInputNodes === 'function') {
        required = flowchartMeta.countInputNodes();
      } else if (flowchartMeta.nodes && typeof flowchartMeta.nodes === 'object') {
        // guess node types: 'IN','INPUT','input','NodeInput'
        const nodes = Object.values(flowchartMeta.nodes);
        const candidates = nodes.filter(
          (n) => {
            const t = (n.type || n.nodeType || '').toString().toLowerCase();
            return ['in', 'input', 'nodeinput', 'input_node'].includes(t);
          }
        );
        required = candidates.length > 0 ? candidates.length : null;
      }
    } catch (e) {
      required = null;
    }

    const provided = Array.isArray(combinedInputs) ? combinedInputs.length : 0;
    if (required === null) {
      return { ok: true, message: 'unknown requirement (flowchart meta not explicit)', required: null, provided };
    }
    if (provided < required) {
      return {
        ok: false,
        message: `Flowchart ต้องการ input อย่างน้อย ${required} ค่า แต่มีเพียง ${provided}`,
        required,
        provided
      };
    }
    return { ok: true, required, provided, message: null };
  }
}