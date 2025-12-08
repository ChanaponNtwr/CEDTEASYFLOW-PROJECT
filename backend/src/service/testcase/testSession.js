// src/service/testcase/testSession.js
import TestcaseResult from './testcaseResult.js';

export default class TestSession {
  constructor({
    runId = null,
    userId = null,
    labId = null,
    flowchartId = null,
    mode = 'batch',
    createdAt = null
  } = {}) {
    this.runId = runId;
    this.userId = userId;
    this.labId = labId;
    this.flowchartId = flowchartId;
    this.mode = mode;
    this.createdAt = createdAt ? new Date(createdAt) : new Date();
    this.totalScore = 0;
    /** @type {TestcaseResult[]} */
    this.results = [];
  }

  start() {
    this.createdAt = new Date();
  }

  recordResult(r) {
    const res = r instanceof TestcaseResult ? r : new TestcaseResult(r);
    this.results.push(res);
    this.totalScore += Number(res.scoreAwarded || 0);
  }

  finish() {
    // finalize if need (e.g. round score)
    this.totalScore = Number(this.totalScore);
  }

  toSummary(forStudent = true) {
    if (forStudent) {
      return {
        runId: this.runId,
        labId: this.labId,
        flowchartId: this.flowchartId,
        mode: this.mode,
        createdAt: this.createdAt,
        totalScore: this.totalScore,
        results: this.results.map(r => r.toPublicView(/* hideDetails for hidden*/ false))
      };
    }
    return {
      runId: this.runId,
      userId: this.userId,
      labId: this.labId,
      flowchartId: this.flowchartId,
      mode: this.mode,
      createdAt: this.createdAt,
      totalScore: this.totalScore,
      results: this.results
    };
  }
}
