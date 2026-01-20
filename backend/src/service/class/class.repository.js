// src/service/class/class.repository.js
import prisma from "../../lib/prisma.js";

class ClassRepository {

  /* =====================================================
   * CLASS
   * =================================================== */

  async createClass(data) {
    return prisma.class.create({ data });
  }

  async findById(classId) {
    return prisma.class.findUnique({
      where: { classId: Number(classId) },
      include: {
        classLabs: { include: { lab: true } },
        packageClasses: { include: { package: true } },
        userClasses: { include: { user: true, role: true } }
      }
    });
  }

  async findMany(opts = {}) {
    const { skip = 0, take = 50, orderBy = { createAt: "desc" } } = opts;
    return prisma.class.findMany({
      skip,
      take,
      orderBy,
      include: {
        userClasses: { include: { role: true } }
      }
    });
  }

  async updateClass(classId, data) {
    return prisma.class.update({
      where: { classId: Number(classId) },
      data
    });
  }

  async deleteClassCascade(classId) {
    const id = Number(classId);
    return prisma.$transaction(async (tx) => {
      await tx.classLabs.deleteMany({ where: { classId: id } });
      await tx.packageClass.deleteMany({ where: { classId: id } });
      await tx.userClass.deleteMany({ where: { classId: id } });
      return tx.class.delete({ where: { classId: id } });
    });
  }

  /**
   * ✅ สำคัญมาก: ใช้กับ GET /classes/mine
   * ดึงเฉพาะ class ที่ user เป็น owner หรือ member
   */
  async listClassesForUser(userId) {
    return prisma.class.findMany({
      where: {
        userClasses: {
          some: {
            userId: Number(userId)
          }
        }
      },
      include: {
        userClasses: {
          include: { role: true }
        }
      }
    });
  }

  async addLabToClass(classId, labId, dueDate = null) {
    return prisma.classLabs.create({
      data: {
        classId: Number(classId),
        labId: Number(labId),
        dueDate: dueDate ? new Date(dueDate) : null, // <-- ใช้ argument ที่ส่งมา
      }
    });
  }

  async removeLabFromClass(classId, labId) {
    return prisma.classLabs.delete({
      where: {
        classId_labId: {
          classId: Number(classId),
          labId: Number(labId)
        }
      }
    });
  }

  async listLabs(classId) {
    return prisma.classLabs.findMany({
      where: { classId: Number(classId) },
      include: {
        lab: true // lab info
      },
      orderBy: { labId: "asc" } // ถ้าต้องการเรียง
    });
  }

  async updateLabDueDate(classId, labId, dueDate) {
    return prisma.classLabs.update({
      where: {
        classId_labId: {
          classId: Number(classId),
          labId: Number(labId)
        }
      },
      data: {
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });
  }

  async addUserToClass(userId, classId, roleId) {
    return prisma.userClass.create({
      data: {
        userId: Number(userId),
        classId: Number(classId),
        roleId: Number(roleId)
      }
    });
  }

  async removeUserFromClass(userId, classId) {
    return prisma.userClass.delete({
      where: {
        userId_classId: {
          userId: Number(userId),
          classId: Number(classId)
        }
      }
    });
  }

  async listUsersInClass(classId) {
    return prisma.userClass.findMany({
      where: { classId: Number(classId) },
      include: {
        user: true,
        role: true
      }
    });
  }

  async isUserInClass(userId, classId) {
    return prisma.userClass.findUnique({
      where: {
        userId_classId: {
          userId: Number(userId),
          classId: Number(classId)
        }
      }
    });
  }

  /**
   * Update role of a class member and return updated userClass (with user & role)
   */
  async updateUserRole(userId, classId, roleId) {
    const updated = await prisma.userClass.update({
      where: {
        userId_classId: {
          userId: Number(userId),
          classId: Number(classId)
        }
      },
      data: { roleId: Number(roleId) },
      include: { user: true, role: true }
    });
    return updated;
  }

  async addPackageToClass(
    classId,
    packageId,
    { purchasedAt = new Date(), startDate = null, endDate = null } = {}
  ) {
    return prisma.packageClass.create({
      data: {
        classId: Number(classId),
        packageId: Number(packageId),
        purchasedAt,
        startDate,
        endDate
      }
    });
  }

  /* =====================================================
   * UTIL / EXISTS
   * =================================================== */

  async existsClass(classId) {
    return prisma.class.findUnique({
      where: { classId: Number(classId) }
    });
  }

  async existsLab(labId) {
    return prisma.lab.findUnique({
      where: { labId: Number(labId) }
    });
  }

  async existsUser(userId) {
    return prisma.user.findUnique({
      where: { id: Number(userId) }
    });
  }

  async existsRole(roleId) {
    return prisma.role.findUnique({
      where: { roleId: Number(roleId) }
    });
  }
}

export default new ClassRepository();
