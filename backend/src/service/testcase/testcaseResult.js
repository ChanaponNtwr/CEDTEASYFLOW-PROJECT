// src/service/testcase/testcaseResult.js
export default class TestcaseResult {
  constructor({
    resultId = null,
    runId = null,
    testcaseId = null,
    status = 'ERROR',
    expected = [],
    actual = [],
    scoreAwarded = 0,
    timeMs = null,
    errorMessage = null,
    createdAt = null
  } = {}) {
    this.resultId = resultId;
    this.runId = runId;
    this.testcaseId = testcaseId;
    this.status = status;
    this.expected = Array.isArray(expected) ? expected : [expected];
    this.actual = Array.isArray(actual) ? actual : [actual];
    this.scoreAwarded = Number(scoreAwarded || 0);
    this.timeMs = timeMs;
    this.errorMessage = errorMessage;
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
  }

  isPass() {
    return this.status === 'PASS';
  }

  toPublicView(hideDetails = false) {
    if (hideDetails) {
      return {
        testcaseId: this.testcaseId,
        status: this.status,
        scoreAwarded: this.scoreAwarded,
        createdAt: this.createdAt
      };
    }
    return {
      testcaseId: this.testcaseId,
      status: this.status,
      expected: this.expected,
      actual: this.actual,
      scoreAwarded: this.scoreAwarded,
      timeMs: this.timeMs,
      errorMessage: this.errorMessage,
      createdAt: this.createdAt
    };
  }
}
