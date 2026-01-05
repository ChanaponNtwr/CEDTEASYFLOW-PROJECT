// src/service/lab/lab.repository.js
import prisma from "../../lib/prisma.js"; // ตรวจสอบ path ให้ตรงกับโปรเจคของคุณ

class LabRepository {
  async createLab(data) {
    return prisma.lab.create({ data });
  }

  /**
   * สร้าง lab + testcases แบบ atomic (transaction)
   * testcases: array of { inputVal, outputVal, inHiddenVal?, outHiddenVal?, score? }
   */
  async createLabWithTestcases(labData, testcases = []) {
    return prisma.$transaction(async (tx) => {
      const createdLab = await tx.lab.create({ data: labData });

      if (Array.isArray(testcases) && testcases.length > 0) {
        const tcs = testcases.map((tc) => ({
          labId: createdLab.labId,
          inputVal: tc.inputVal,
          outputVal: tc.outputVal,
          inHiddenVal: tc.inHiddenVal ?? null,
          outHiddenVal: tc.outHiddenVal ?? null,
          score: Number(tc.score || 0)
        }));
        await tx.testcase.createMany({ data: tcs });
      }

      return tx.lab.findUnique({
        where: { labId: createdLab.labId },
        include: { testcases: true, owner: true }
      });
    });
  }

  async findById(labId) {
    return prisma.lab.findUnique({
      where: { labId: Number(labId) },
      include: { testcases: true, flowcharts: true, owner: true, submissions: true }
    });
  }

  async findByOwner(ownerUserId, opts = {}) {
    const { skip = 0, take = 50 } = opts;
    return prisma.lab.findMany({
      where: { ownerUserId: Number(ownerUserId) },
      orderBy: { createAt: "desc" },
      skip,
      take
    });
  }

  async updateLab(labId, data) {
    return prisma.lab.update({
      where: { labId: Number(labId) },
      data
    });
  }

  /**
   * Replace testcases for a lab inside a transaction:
   * - deleteMany testcases where labId
   * - createMany new testcases
   *
   * Returns lab with testcases
   */
  async replaceTestcasesAtomic(labId, testcases = []) {
    return prisma.$transaction(async (tx) => {
      const id = Number(labId);
      await tx.testcase.deleteMany({ where: { labId: id } });

      if (Array.isArray(testcases) && testcases.length > 0) {
        const tcs = testcases.map((tc) => ({
          labId: id,
          inputVal: tc.inputVal,
          outputVal: tc.outputVal,
          inHiddenVal: tc.inHiddenVal ?? null,
          outHiddenVal: tc.outHiddenVal ?? null,
          score: Number(tc.score || 0)
        }));
        await tx.testcase.createMany({ data: tcs });
      }

      return tx.lab.findUnique({
        where: { labId: id },
        include: { testcases: true }
      });
    });
  }

  /**
   * delete lab + related child rows (submissions/testcases/flowcharts) transactionally
   */
  async deleteLabCascade(labId) {
    return prisma.$transaction(async (tx) => {
      const id = Number(labId);
      await tx.submission.deleteMany({ where: { labId: id } });
      await tx.testcase.deleteMany({ where: { labId: id } });
      await tx.flowchart.deleteMany({ where: { labId: id } });
      return tx.lab.delete({ where: { labId: id } });
    });
  }

  async incrementSymVals(labId, deltas = {}) {
    const data = {};
    for (const k of Object.keys(deltas)) {
      data[k] = { increment: Number(deltas[k]) };
    }
    return prisma.lab.update({
      where: { labId: Number(labId) },
      data
    });
  }

  async setStatus(labId, status) {
    return prisma.lab.update({
      where: { labId: Number(labId) },
      data: { status }
    });
  }

  async labsDueBefore(date) {
    return prisma.lab.findMany({
      where: {
        dueDate: { lt: date },
        status: { not: "closed" }
      }
    });
  }
}

export default new LabRepository();
