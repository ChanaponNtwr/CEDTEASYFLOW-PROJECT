// src/service/testcase/testcase.model.js
export default class Testcase {
  constructor({
    testcaseId = null,
    labId = null,
    title = '',
    inputVal = '[]',
    outputVal = '[]',
    inHiddenVal = null,
    outHiddenVal = null,
    score = 0,
    comparatorType = 'exact',
    isHidden = false,
    createdAt = null
  } = {}) {
    this.testcaseId = testcaseId;
    this.labId = labId;
    this.title = title;
    this.inputVal = inputVal;
    this.outputVal = outputVal;
    this.inHiddenVal = inHiddenVal;
    this.outHiddenVal = outHiddenVal;
    this.score = Number(score || 0);
    this.comparatorType = comparatorType || 'exact';
    this.isHidden = Boolean(isHidden);
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  // parseInputs: expected to return array of input-sets.
  // Each element can be primitive or array (e.g. [[a,b],[c,d]] or [1,2,3])
  parseInputs() {
    try {
      const parsed = JSON.parse(this.inputVal);
      if (!Array.isArray(parsed)) return [parsed];
      return parsed;
    } catch (e) {
      throw new Error(`Testcase.parseInputs: invalid JSON in inputVal (${e.message})`);
    }
  }

  parseOutputs() {
    try {
      const parsed = JSON.parse(this.outputVal);
      if (!Array.isArray(parsed)) return [parsed];
      return parsed;
    } catch (e) {
      throw new Error(`Testcase.parseOutputs: invalid JSON in outputVal (${e.message})`);
    }
  }

  // number of expected items (used by OutputSplitter)
  expectedCount() {
    const out = this.parseOutputs();
    return Array.isArray(out) ? out.length : 1;
  }

  // Validate basic JSON format and shape
  validateFormat() {
    try {
      const ins = this.parseInputs();
      const outs = this.parseOutputs();
      return { ok: true, message: null, inputsLength: ins.length, outputsLength: outs.length };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  }

  // public view: hide hidden fields if isHidden
  toPublicView() {
    return {
      testcaseId: this.testcaseId,
      labId: this.labId,
      title: this.title,
      inputVal: this.isHidden ? null : this.inputVal,
      outputVal: this.isHidden ? null : this.outputVal,
      score: this.score,
      comparatorType: this.comparatorType,
      isHidden: this.isHidden,
      createdAt: this.createdAt
    };
  }
// =============== เพิ่มเข้าไปในไฟล์นี้ (ด้านล่างสุดของ class) ==================

  // clone testcase
  clone() {
    return new Testcase({
      testcaseId: this.testcaseId,
      labId: this.labId,
      title: this.title,
      inputVal: this.inputVal,
      outputVal: this.outputVal,
      inHiddenVal: this.inHiddenVal,
      outHiddenVal: this.outHiddenVal,
      score: this.score,
      comparatorType: this.comparatorType,
      isHidden: this.isHidden,
      createdAt: this.createdAt
    });
  }

  // summary used by TestRunner.toSummary()
  toSummary() {
    return {
      testcaseId: this.testcaseId,
      labId: this.labId,
      expected: this.parseOutputs(),
      score: this.score,
      comparatorType: this.comparatorType
    };
  }

    hasHidden() {
    return this.inHiddenVal !== null || this.outHiddenVal !== null;
  }

  parseHiddenInputs() {
    if (!this.inHiddenVal) return null;
    return JSON.parse(this.inHiddenVal);
  }

  parseHiddenOutputs() {
    if (!this.outHiddenVal) return null;
    return JSON.parse(this.outHiddenVal);
  }

}

// =================== END (เพิ่มเท่านี้) ===================


