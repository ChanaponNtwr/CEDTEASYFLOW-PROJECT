// src/service/testcase/outputSplitter.js
/**
 * OutputSplitter:
 * - split(combinedOutputs, testcases) -> [{ testcaseId, expected, actual, ok? , error? }]
 * - validateLengths: check if combinedOutputs length equals sum(expected counts)
 *
 * NOTE: combinedOutputs should be an array of items aligned with expectedCount per testcase.
 */

export default class OutputSplitter {
  split(combinedOutputs = [], testcases = []) {
    const chunks = [];
    let pos = 0;
    for (const tc of testcases) {
      const expected = tc.parseOutputs();
      const expectedLen = Array.isArray(expected) ? expected.length : 1;
      const chunk = combinedOutputs.slice(pos, pos + expectedLen);
      pos += expectedLen;
      if (chunk.length < expectedLen) {
        chunks.push({
          testcaseId: tc.testcaseId,
          expected,
          actual: chunk,
          ok: false,
          error: `Output not enough for testcase ${tc.testcaseId}: expected ${expectedLen} got ${chunk.length}`
        });
      } else {
        chunks.push({
          testcaseId: tc.testcaseId,
          expected,
          actual: chunk,
          ok: true
        });
      }
    }
    // if extra outputs exist, attach info to last chunk
    if (pos < combinedOutputs.length) {
      const extra = combinedOutputs.slice(pos);
      chunks.push({
        testcaseId: null,
        expected: null,
        actual: extra,
        ok: false,
        error: `Extra outputs beyond expected: ${extra.length} items`
      });
    }
    return chunks;
  }

  validateLengths(combinedOutputs = [], testcases = []) {
    const expectedTotal = testcases.reduce((s, tc) => s + tc.expectedCount(), 0);
    const provided = Array.isArray(combinedOutputs) ? combinedOutputs.length : 0;
    if (provided !== expectedTotal) {
      return { ok: false, message: `Total expected outputs ${expectedTotal} but got ${provided}`, expectedTotal, provided };
    }
    return { ok: true, expectedTotal, provided };
  }
}
