// src/service/testcase/testcaseRepository.js
/**
 * TestcaseRepository
 * - tries to use Prisma if available; otherwise fallback to in-memory store
 *
 * Methods:
 *  - findByLab(labId)
 *  - saveResult(result)
 *  - createSession(session)
 *  - saveSession(session)
 *
 * Note: In production you should implement persistent storage and proper IDs.
 */

import Testcase from './testcase_model.js';

let PrismaClient;
try {
  // eslint-disable-next-line global-require
  PrismaClient = (await import('@prisma/client')).PrismaClient;
} catch (e) {
  PrismaClient = null;
}

class InMemoryStore {
  constructor() {
    this.testcases = new Map(); // labId => [Testcase]
    this.sessions = new Map(); // runId => session
    this.results = [];
    this._nextTestcaseId = 1;
    this._nextRunId = 1;
    this._nextResultId = 1;
  }

  findByLab(labId) {
    const arr = this.testcases.get(Number(labId)) || [];
    return arr.map(t => new Testcase(t));
  }

  saveTestcase(labId, tcPayload) {
    const list = this.testcases.get(Number(labId)) || [];
    const id = this._nextTestcaseId++;
    const tc = new Testcase({ testcaseId: id, labId: Number(labId), ...tcPayload });
    list.push(tc);
    this.testcases.set(Number(labId), list);
    return tc;
  }

  createSession(sessionPayload) {
    const runId = this._nextRunId++;
    const s = { ...sessionPayload, runId };
    this.sessions.set(runId, s);
    return s;
  }

  saveSession(session) {
    this.sessions.set(session.runId, session);
    return session;
  }

  saveResult(result) {
    const r = { ...result, resultId: this._nextResultId++ };
    this.results.push(r);
    return r;
  }
}

export default class TestcaseRepository {
  constructor() {
    if (PrismaClient) {
      this.prisma = new PrismaClient();
      this.backend = 'prisma';
    } else {
      this.store = new InMemoryStore();
      this.backend = 'memory';
    }
  }

  async findByLab(labId) {
    if (this.backend === 'prisma') {
      // example mapping - adapt to your prisma schema
      const rows = await this.prisma.testcase.findMany({ where: { labId: Number(labId) } });
      return rows.map(r => new Testcase(r));
    }
    return this.store.findByLab(labId);
  }

  // convenience to add testcase (for dev/testing)
  async saveTestcase(labId, tcPayload) {
    if (this.backend === 'prisma') {
      const row = await this.prisma.testcase.create({ data: { labId: Number(labId), ...tcPayload }});
      return new Testcase(row);
    }
    return this.store.saveTestcase(labId, tcPayload);
  }

  async createSession(session) {
    if (this.backend === 'prisma') {
      const row = await this.prisma.testSession.create({ data: session }); // adapt
      return row;
    }
    return this.store.createSession(session);
  }

  async saveSession(session) {
    if (this.backend === 'prisma') {
      // adapt to your schema
      return session;
    }
    return this.store.saveSession(session);
  }

  async saveResult(result) {
    if (this.backend === 'prisma') {
      // adapt to your prisma model for testcase result
      return result;
    }
    return this.store.saveResult(result);
  }
}
