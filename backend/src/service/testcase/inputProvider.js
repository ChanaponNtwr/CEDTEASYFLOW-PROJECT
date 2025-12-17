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
 * - inputs: array of input values
 * - IMPORTANT: must normalize string inputs to proper JS types
 *   so execution behaves same as flowchart.controller
 */
export default class ArrayInputProvider {
  constructor(inputs = []) {
    this.inputs = Array.isArray(inputs) ? [...inputs] : [inputs];
    this.index = 0;
  }

  /**
   * normalize input value
   * - "1"      -> 1
   * - "1.5"    -> 1.5
   * - "true"   -> true
   * - "false"  -> false
   * - others   -> string 그대로
   */
  normalize(value) {
    if (value === null || value === undefined) return value;

    // already typed
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // objects / arrays untouched
    if (typeof value === 'object') {
      return value;
    }

    // string normalization
    const s = String(value).trim();
    const lower = s.toLowerCase();

    if (lower === 'true') return true;
    if (lower === 'false') return false;

    // integer
    if (/^[+-]?\d+$/.test(s)) return Number(s);

    // float
    if (/^[+-]?\d*\.\d+$/.test(s) || /^[+-]?\d+\.\d*$/.test(s)) {
      return Number(s);
    }

    return s;
  }

  next(prompt, varName) {
    if (this.index >= this.inputs.length) {
      throw new InputMissingError(
        `Input ไม่พอ: Flowchart ขอค่า "${varName || prompt || 'input'}" แต่ไม่มีค่าให้ (provided ${this.inputs.length})`
      );
    }

    const raw = this.inputs[this.index++];
    const normalized = this.normalize(raw);

    console.log(
      `📥 Testcase InputProvider: ${varName || ''} =`,
      raw,
      '->',
      normalized,
      `(type=${typeof normalized})`
    );

    return normalized;
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
