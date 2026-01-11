// src/service/class/class.service.js
import classRepo from "./class.repository.js";
import validator from "./class.validator.js";
import prisma from "../../lib/prisma.js";

/**
 * helper: assert role in class
 */
function assertClassRole(actorUC, allowedRoles) {
  const role = actorUC?.role?.roleName;
  if (!allowedRoles.includes(role)) {
    throw Object.assign(
      new Error(`Forbidden: requires role ${allowedRoles.join(" or ")}`),
      { code: "FORBIDDEN" }
    );
  }
}

class ClassService {

  /* =========================================================
   * CLASS
   * ======================================================= */
  async searchUsers(query) {
  if (!query) return [];

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } } // ถ้า schema ใช้ fname/lname ต้องแก้
      ]
    },
    select: {
      id: true,       // แก้จาก userId → id
      name: true,     // ถ้า schema มี fname/lname ต้องใช้ fname/lname
      email: true
    },
    take: 20
  });

  return users;
}


  async createClass(payload = {}, currentUserId = null) {
    const errors = validator.validateCreate(payload);
    if (errors.length) {
      const e = new Error("Validation failed");
      e.details = errors;
      throw e;
    }

    if (!currentUserId) {
      throw Object.assign(
        new Error("currentUserId is required"),
        { code: "FORBIDDEN" }
      );
    }

    const created = await classRepo.createClass({
      classname: String(payload.classname).trim(),
      createAt: payload.createAt ? new Date(payload.createAt) : undefined
    });

    let ownerRole = await prisma.role.findFirst({ where: { roleName: "owner" } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({ data: { roleName: "owner" } });
    }

    await prisma.userClass.create({
      data: {
        userId: Number(currentUserId),
        classId: created.classId,
        roleId: ownerRole.roleId
      }
    });

    return classRepo.findById(created.classId);
  }

  

  async getClass(classId) {
    // validate param
    const id = Number(classId);
    if (!Number.isInteger(id) || id <= 0) {
      const e = new Error("Invalid classId");
      e.code = "BAD_REQUEST";
      throw e;
    }

    const cls = await classRepo.findById(id);
    if (!cls) throw Object.assign(new Error("Class not found"), { code: "NOT_FOUND" });
    return cls;
  }

  async listClasses(opts = {}) {
    return classRepo.findMany(opts);
  }

  async listClassesForUser(userId) {
    const id = Number(userId);
    if (!Number.isInteger(id)) {
      throw Object.assign(new Error("Invalid userId"), { code: "BAD_REQUEST" });
    }

    const rows = await classRepo.listClassesForUser(id);
    const owned = [];
    const joined = [];

    for (const c of rows) {
      const uc = (c.userClasses || []).find(u => Number(u.userId) === Number(id));
      if (uc?.role?.roleName === "owner") owned.push(c);
      else joined.push(c);
    }

    return { owned, joined };
  }

  /* =========================================================
   * LAB RELATION (owner + teacher)
   * ======================================================= */

  async addLabToClass(classId, labId, actorUserId, dueDate = null) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

    const actorUC = await prisma.userClass.findUnique({
      where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner", "teacher"]);

    const errs = validator.validateAddLab({ labId });
    if (errs.length) throw Object.assign(new Error("Validation failed"), { details: errs });

    if (!await classRepo.existsClass(classId)) throw Object.assign(new Error("Class not found"), { code: "NOT_FOUND" });
    if (!await classRepo.existsLab(labId)) throw Object.assign(new Error("Lab not found"), { code: "NOT_FOUND" });

    const existing = await classRepo.listLabs(classId);
    if (existing.some(l => Number(l.labId) === Number(labId))) {
      return { ok: true, message: "already attached" };
    }

    // แปลง dueDate เป็น Date object ถ้าได้รับมา
    let parsedDueDate = null;
    if (dueDate) {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) throw Object.assign(new Error("Invalid dueDate"), { code: "BAD_REQUEST" });
    }

    return classRepo.addLabToClass(classId, labId, parsedDueDate);
  }
  
  async updateLabDueDate(classId, labId, actorUserId, dueDate) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

    // ตรวจสิทธิ์ (owner หรือ teacher)
    const actorUC = await prisma.userClass.findUnique({
      where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner", "teacher"]);

    if (!await classRepo.existsClass(classId)) throw Object.assign(new Error("Class not found"), { code: "NOT_FOUND" });
    if (!await classRepo.existsLab(labId)) throw Object.assign(new Error("Lab not found"), { code: "NOT_FOUND" });

    return classRepo.updateLabDueDate(classId, labId, dueDate);
  }


  async removeLabFromClass(classId, labId, actorUserId) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

    const actorUC = await prisma.userClass.findUnique({
      where: {
        userId_classId: {
          userId: Number(actorUserId),
          classId: Number(classId)
        }
      },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner", "teacher"]);

    return classRepo.removeLabFromClass(classId, labId);
  }

  async listLabsInClass(classId) {
    return classRepo.listLabs(classId);
  }

  /* =========================================================
   * USER (owner only)
   * ======================================================= */

  async addUserToClass(userId, classId, roleId, actorUserId) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

    const actorUC = await prisma.userClass.findUnique({
      where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner"]);

    const existing = await classRepo.isUserInClass(userId, classId);
    if (existing) {
      return prisma.userClass.update({
        where: { userId_classId: { userId: Number(userId), classId: Number(classId) } },
        data: { roleId: Number(roleId) }
      });
    }

    return classRepo.addUserToClass(userId, classId, roleId);
  }

  async removeUserFromClass(userId, classId, actorUserId) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

    const actorUC = await prisma.userClass.findUnique({
      where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner"]);

    return classRepo.removeUserFromClass(userId, classId);
  }

  async listUsersInClass(classId) {
    return classRepo.listUsersInClass(classId);
  }

  /* =========================================================
   * PACKAGE (owner only)
   * ======================================================= */

  async addPackageToClass(classId, packageId, opts, actorUserId) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

    const actorUC = await prisma.userClass.findUnique({
      where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner"]);

    return classRepo.addPackageToClass(classId, packageId, opts);
  }

  async listPackagesForClass(classId) {
    return classRepo.listPackagesForClass(classId);
  }
}

export default new ClassService();
