// src/service/testcase/inputProvider.js

export class InputMissingError extends Error {
  constructor(message) {
    super(message || 'INPUT_MISSING');
    this.name = 'InputMissingError';
    this.code = 'INPUT_MISSING';
  }
}

/**
 * ArrayInputProvider
 * - inputs: array of "input items"
 *   Each item can be primitive or an array/set of params depending on your executor's expectation.
 */
export default class ArrayInputProvider {
  constructor(inputs = []) {
    // make a shallow copy to avoid mutation from outside
    this.inputs = Array.isArray(inputs) ? [...inputs] : [inputs];
    this.index = 0;
  }

  next(prompt, varName) {
    if (this.index >= this.inputs.length) {
      // throw InputMissingError with helpful message (TestRunner will interpret)
      throw new InputMissingError(`Input ไม่พอ: Flowchart ขอค่าเพิ่มเติมสำหรับ "${varName || prompt || 'input'}" แต่ไม่มีค่าให้ (provided ${this.inputs.length})`);
    }
    const value = this.inputs[this.index++];
    return value;
  }

  hasNext() {
    return this.index < this.inputs.length;
  }

  reset() {
    this.index = 0;
  }

  remaining() {
    return this.inputs.length - this.index;
  }
}
