// src/service/lab/lab.service.js
import labRepo from "./lab.repository.js";
import validator from "./lab.validator.js";

/**
 * Normalize testcase value
 * - string -> keep
 * - array/object -> JSON.stringify
 */
function normalize(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === "object") return JSON.stringify(val);
  return val;
}

function normalizeTestcase(tc = {}) {
  return {
    ...tc,
    inputVal: normalize(tc.inputVal),
    outputVal: normalize(tc.outputVal),
    inHiddenVal: normalize(tc.inHiddenVal),
    outHiddenVal: normalize(tc.outHiddenVal),
    score: Number(tc.score || 0)
  };
}

class LabService {
  async createLab(payload = {}, options = {}) {
    const errors = validator.validateCreate(payload, options);
    if (errors.length) {
      const e = new Error("Validation failed");
      e.details = errors;
      throw e;
    }

    const labData = {
      ownerUserId: Number(payload.ownerUserId),
      labname: String(payload.labname).trim(),
      problemSolving: payload.problemSolving ?? "",
      inSymVal: Number(payload.inSymVal ?? 0),
      outSymVal: Number(payload.outSymVal ?? 0),
      declareSymVal: Number(payload.declareSymVal ?? 0),
      assignSymVal: Number(payload.assignSymVal ?? 0),
      ifSymVal: Number(payload.ifSymVal ?? 0),
      forSymVal: Number(payload.forSymVal ?? 0),
      whileSymVal: Number(payload.whileSymVal ?? 0),
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      status: payload.status ?? "active"
    };

    if (Array.isArray(payload.testcases) && payload.testcases.length > 0) {
      const normalized = payload.testcases.map(normalizeTestcase);
      return labRepo.createLabWithTestcases(labData, normalized);
    }

    return labRepo.createLab(labData);
  }

  async getLab(labId) {
    const lab = await labRepo.findById(labId);
    if (!lab) {
      const e = new Error("Lab not found");
      e.code = "NOT_FOUND";
      throw e;
    }
    return lab;
  }

  async listLabsByOwner(ownerUserId, opts = {}) {
    return labRepo.findByOwner(ownerUserId, opts);
  }

  async updateLab(labId, payload = {}, currentUserId = null) {
    const errors = validator.validateUpdate(payload);
    if (errors.length) {
      const e = new Error("Validation failed");
      e.details = errors;
      throw e;
    }

    if (currentUserId !== null) {
      await this.ensureOwner(labId, currentUserId);
    }

    const data = {};
    if (payload.labname !== undefined) data.labname = String(payload.labname).trim();
    if (payload.problemSolving !== undefined) data.problemSolving = payload.problemSolving;
    if (payload.dueDate !== undefined) data.dueDate = payload.dueDate ? new Date(payload.dueDate) : null;
    if (payload.status !== undefined) data.status = payload.status;

    const numericFields = [
      "inSymVal", "outSymVal", "declareSymVal",
      "assignSymVal", "ifSymVal", "forSymVal", "whileSymVal"
    ];
    for (const f of numericFields) {
      if (payload[f] !== undefined) data[f] = Number(payload[f]);
    }

    if (Array.isArray(payload.testcases)) {
      if (Object.keys(data).length > 0) {
        await labRepo.updateLab(labId, data);
      }
      const normalized = payload.testcases.map(normalizeTestcase);
      return labRepo.replaceTestcasesAtomic(labId, normalized);
    }

    if (Object.keys(data).length > 0) {
      return labRepo.updateLab(labId, data);
    }

    return this.getLab(labId);
  }

  async deleteLab(labId, currentUserId = null) {
    if (currentUserId !== null) await this.ensureOwner(labId, currentUserId);
    return labRepo.deleteLabCascade(labId);
  }

  async addTestcase(labId, testcasePayload) {
    const prisma = await import("../../lib/prisma.js").then(m => m.default);
    const tc = normalizeTestcase(testcasePayload);

    return prisma.testcase.create({
      data: {
        labId: Number(labId),
        inputVal: tc.inputVal,
        outputVal: tc.outputVal,
        inHiddenVal: tc.inHiddenVal,
        outHiddenVal: tc.outHiddenVal,
        score: tc.score
      }
    });
  }

  async addTestcasesBulk(labId, testcasesArray = []) {
    if (!Array.isArray(testcasesArray)) throw new Error("testcases must be an array");
    const prisma = await import("../../lib/prisma.js").then(m => m.default);

    const data = testcasesArray.map(tc => ({
      labId: Number(labId),
      ...normalizeTestcase(tc)
    }));

    return prisma.testcase.createMany({ data });
  }

  async incrementSymVals(labId, deltas = {}) {
    const allowed = new Set([
      "inSymVal", "outSymVal", "declareSymVal",
      "assignSymVal", "ifSymVal", "forSymVal", "whileSymVal"
    ]);
    const clean = {};
    for (const k of Object.keys(deltas)) {
      if (allowed.has(k)) clean[k] = Number(deltas[k]);
    }
    if (Object.keys(clean).length === 0) throw new Error("no valid delta keys provided");
    return labRepo.incrementSymVals(labId, clean);
  }

  async setStatus(labId, status) {
    return labRepo.setStatus(labId, status);
  }

  async ensureOwner(labId, userId) {
    const lab = await this.getLab(labId);
    if (Number(lab.ownerUserId) !== Number(userId)) {
      const err = new Error("Forbidden: not lab owner");
      err.code = "FORBIDDEN";
      throw err;
    }
    return true;
  }

  async closeDueLabs() {
    const now = new Date();
    const labs = await labRepo.labsDueBefore(now);
    const results = [];
    for (const l of labs) {
      const updated = await labRepo.setStatus(l.labId, "closed");
      results.push(updated);
    }
    return results;
  }
}

export default new LabService();
