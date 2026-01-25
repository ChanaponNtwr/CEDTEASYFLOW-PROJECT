// src/service/class/class.service.js
import classRepo from "./class.repository.js";
import validator from "./class.validator.js";
import prisma from "../../lib/prisma.js";
import { sendMail } from "../../lib/mailer.js";

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
  /**
   * Search users by name/email.
   * If excludeClassId provided, exclude users who are already in that class.
   * @param {string} query
   * @param {number|null} excludeClassId
   */
  async searchUsers(query, excludeClassId = null) {
    if (!query) return [];

    const q = String(query).trim();

    // If need exclude, get userIds in that class
    let excludedIds = [];
    if (excludeClassId !== null && excludeClassId !== undefined) {
      const members = await classRepo.listUsersInClass(excludeClassId);
      excludedIds = (members || []).map(m => Number(m.userId)).filter(Boolean);
    }

    // Build where clause
    const where = {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } }
      ]
    };

    if (Array.isArray(excludedIds) && excludedIds.length > 0) {
      where.AND = [{ id: { notIn: excludedIds } }];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
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

    const actorId = Number(currentUserId);
    if (!Number.isInteger(actorId) || actorId <= 0) {
      throw Object.assign(
        new Error("Invalid currentUserId"),
        { code: "FORBIDDEN" }
      );
    }

    // เช็กว่ามี user จริง
    const userExists = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true }
    });

    if (!userExists) {
      throw Object.assign(
        new Error("Actor user not found"),
        { code: "FORBIDDEN" }
      );
    }

    // ใช้ transaction กันครึ่ง ๆ กลาง ๆ
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          classname: String(payload.classname).trim(),
          createAt: payload.createAt ? new Date(payload.createAt) : undefined
        }
      });

      let ownerRole = await tx.role.findFirst({
        where: { roleName: "owner" }
      });

      if (!ownerRole) {
        ownerRole = await tx.role.create({
          data: { roleName: "owner" }
        });
      }

      await tx.userClass.create({
        data: {
          userId: actorId,
          classId: created.classId,
          roleId: ownerRole.roleId
        }
      });

      return created;
    });

    return classRepo.findById(result.classId);
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

  async addLabToClass(classId, labId, actorUserId, dueDate = null) {
    if (!actorUserId) {
      throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });
    }

    const actorUC = await prisma.userClass.findUnique({
      where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
      include: { role: true }
    });

    assertClassRole(actorUC, ["owner", "teacher"]);

    const errs = validator.validateAddLab({ labId });
    if (errs.length) {
      throw Object.assign(new Error("Validation failed"), { details: errs });
    }

    if (!await classRepo.existsClass(classId)) {
      throw Object.assign(new Error("Class not found"), { code: "NOT_FOUND" });
    }

    if (!await classRepo.existsLab(labId)) {
      throw Object.assign(new Error("Lab not found"), { code: "NOT_FOUND" });
    }

    // ❌ กันแลปซ้ำในคลาส
    const existing = await classRepo.listLabs(classId);
    if (existing.some(l => Number(l.labId) === Number(labId))) {
      throw Object.assign(
        new Error("Lab already exists in this class"),
        { code: "BAD_REQUEST" } // หรือ "CONFLICT"
      );
    }

    // parse dueDate
    let parsedDueDate = null;
    if (dueDate) {
      parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        throw Object.assign(new Error("Invalid dueDate"), { code: "BAD_REQUEST" });
      }
    }

    // ✅ เพิ่ม relation class–lab
    const result = await classRepo.addLabToClass(classId, labId, parsedDueDate);

    // 🔔 แจ้งเตือนนักเรียน (fire & forget)
    this.notifyStudentsLabAdded(classId, labId)
      .catch(err => console.error("❌ notifyStudentsLabAdded error:", err));

    return result;
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
    if (!actorUserId) {
      throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });
    }

    const cId = Number(classId);
    const lId = Number(labId);
    const aId = Number(actorUserId);

    // 1) ตรวจ actor อยู่ในคลาส + role
    const actorUC = await prisma.userClass.findUnique({
      where: {
        userId_classId: {
          userId: aId,
          classId: cId
        }
      },
      include: { role: true }
    });

    if (!actorUC) {
      throw Object.assign(
        new Error("You are not in this class"),
        { code: "FORBIDDEN" }
      );
    }

    const roleName = actorUC.role?.roleName;

    // 2) หา record class–lab
    const classLab = await prisma.classLabs.findUnique({
      where: {
        classId_labId: {
          classId: cId,
          labId: lId
        }
      },
      include: {
        lab: true   // << เอา ownerUserId ของแลปมาด้วย
      }
    });

    if (!classLab) {
      throw Object.assign(
        new Error("Lab not found in this class"),
        { code: "NOT_FOUND" }
      );
    }

    // 3) เช็คสิทธิ์
    if (roleName === "owner") {
      // owner ลบได้ทุกแลป
    } 
    else if (["teacher", "ta"].includes(roleName)) {
      // teacher / ta ลบได้เฉพาะแลปที่ตัวเองสร้าง
      if (Number(classLab.lab.ownerUserId) !== aId) {
        throw Object.assign(
          new Error("Forbidden: you can only remove labs you created"),
          { code: "FORBIDDEN" }
        );
      }
    } 
    else {
      // student หรือ role อื่น
      throw Object.assign(
        new Error("Forbidden: insufficient role"),
        { code: "FORBIDDEN" }
      );
    }

    // 4) ลบจริง
    await prisma.classLabs.delete({
      where: {
        classId_labId: {
          classId: cId,
          labId: lId
        }
      }
    });

    return { ok: true };
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

  /**
 * Update role of a user in a class.
 * Only owner of the class can perform this.
 */
  async updateUserRoleInClass(userId, classId, roleId, actorUserId) {
    if (!actorUserId) {
      throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });
    }

    const cId = Number(classId);
    const uId = Number(userId);
    const rId = Number(roleId);
    const aId = Number(actorUserId);

    // 1. ตรวจว่า class มีอยู่จริง
    if (!await classRepo.existsClass(cId)) {
      throw Object.assign(new Error("Class not found"), { code: "NOT_FOUND" });
    }

    // 2. ตรวจ actor อยู่ในคลาส และเป็น owner
    const actorUC = await prisma.userClass.findUnique({
      where: {
        userId_classId: {
          userId: aId,
          classId: cId
        }
      },
      include: { role: true }
    });

    if (!actorUC) {
      throw Object.assign(new Error("You are not in this class"), { code: "FORBIDDEN" });
    }

    assertClassRole(actorUC, ["owner"]);

    // 3. กัน owner เปลี่ยน role ตัวเอง
    if (aId === uId) {
      throw Object.assign(
        new Error("Owner cannot change their own role"),
        { code: "FORBIDDEN" }
      );
    }

    // 4. ตรวจว่า user เป้าหมายอยู่ในคลาสนี้จริง
    const targetUC = await prisma.userClass.findUnique({
      where: {
        userId_classId: {
          userId: uId,
          classId: cId
        }
      }
    });

    if (!targetUC) {
      throw Object.assign(
        new Error("Target user is not in this class"),
        { code: "NOT_FOUND" }
      );
    }

    // 5. ตรวจว่า role มีอยู่จริง
    const roleExists = await prisma.role.findUnique({
      where: { roleId: rId }
    });

    if (!roleExists) {
      throw Object.assign(new Error("Role not found"), { code: "NOT_FOUND" });
    }

    // 6. อัปเดต role
    const updated = await prisma.userClass.update({
      where: {
        userId_classId: {
          userId: uId,
          classId: cId
        }
      },
      data: {
        roleId: rId
      },
      include: {
        user: true,
        role: true
      }
    });

    return updated;
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

  async searchUsersNotInClass(query, classId, actorUserId) {
    if (!actorUserId) throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });

  // ตรวจว่า actor เป็น owner ของคลาสนี้
  const actorUC = await prisma.userClass.findUnique({
    where: { userId_classId: { userId: Number(actorUserId), classId: Number(classId) } },
    include: { role: true }
  });

  assertClassRole(actorUC, ["owner"]);

  // ดึง userId ที่อยู่ในคลาสนี้แล้ว
  const members = await prisma.userClass.findMany({
    where: { classId: Number(classId) },
    select: { userId: true }
  });

  const memberIds = members.map(m => m.userId);

  // ค้นหา user ที่ชื่อหรือ email ตรง และ NOT อยู่ในคลาสนี้
  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } }
          ]
        },
        {
          id: { notIn: memberIds.length ? memberIds : [0] }
        }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true
    },
    take: 20
  });

  return users;
  }

  async leaveClass(classId, actorUserId) {
    if (!actorUserId) {
      throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });
    }

    const uc = await prisma.userClass.findUnique({
      where: {
        userId_classId: {
          userId: Number(actorUserId),
          classId: Number(classId)
        }
      },
      include: { role: true }
    });

    if (!uc) {
      throw Object.assign(new Error("You are not in this class"), { code: "NOT_FOUND" });
    }

    if (uc.role?.roleName === "owner") {
      throw Object.assign(
        new Error("Owner cannot leave their own class"),
        { code: "FORBIDDEN" }
      );
    }

    await prisma.userClass.delete({
      where: {
        userId_classId: {
          userId: Number(actorUserId),
          classId: Number(classId)
        }
      }
    });

    return { message: "Left class successfully" };
  }

  async deleteClass(classId, actorUserId) {
    if (!actorUserId) {
      throw Object.assign(new Error("actorUserId required"), { code: "FORBIDDEN" });
    }

    const cId = Number(classId);

    const actorUC = await prisma.userClass.findUnique({
      where: {
        userId_classId: { userId: Number(actorUserId), classId: cId }
      },
      include: { role: true }
    });

    if (!actorUC) {
      throw Object.assign(new Error("You are not in this class"), { code: "FORBIDDEN" });
    }

    assertClassRole(actorUC, ["owner"]);

    const exists = await classRepo.existsClass(cId);
    if (!exists) {
      throw Object.assign(new Error("Class not found"), { code: "NOT_FOUND" });
    }

    // ลบ relations ทั้งหมดก่อน
    await prisma.userClass.deleteMany({
      where: { classId: cId }
    });

    await prisma.classLabs.deleteMany({
      where: { classId: cId }
    });

    await prisma.packageClass.deleteMany({   // ✅ ชื่อ model ถูกต้อง
      where: { classId: cId }
    });

    // ลบ class จริง
    await prisma.class.delete({
      where: { classId: cId }
    });

    return { message: "Class deleted successfully" };
  }

  async notifyStudentsLabAdded(classId, labId) {
    console.log("📨 notifyStudentsLabAdded called:", { classId, labId });

    const cls = await prisma.class.findUnique({
      where: { classId: Number(classId) }
    });

    const lab = await prisma.lab.findUnique({
      where: { labId: Number(labId) }
    });

    if (!cls || !lab) {
      console.warn("⚠️ class or lab not found");
      return;
    }

    const members = await prisma.userClass.findMany({
      where: { classId: Number(classId) },
      include: { user: true, role: true }
    });

    const students = members.filter(
      m => String(m.role?.roleName || "").toLowerCase() === "student"
    );

    console.log("🎓 students:", students.map(s => s.user?.email));

    if (!students.length) {
      console.warn("⚠️ no students in class");
      return;
    }

    for (const m of students) {
      if (!m.user?.email) continue;

      const studentName =
        m.user.name ||
        m.user.fname ||
        m.user.email.split("@")[0] ||
        "นักศึกษา";

      const className = cls.classname;
      const labName = lab.labname;

      const dueDateStr = lab.dueDate
        ? new Date(lab.dueDate).toLocaleString("th-TH")
        : null;

      const appUrl = `http://localhost:3000/classes/${cls.classId}/labs/${lab.labId}`;

      const subject = `EasyFlow: เพิ่มแลปใหม่ "${labName}" ในคลาส ${className}`;

      const html = `
  <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05);">

      <div style="background:#0f766e; color:#ffffff; padding:20px 24px;">
        <h2 style="margin:0; font-weight:600;">EasyFlow • แจ้งเตือนแลปใหม่</h2>
      </div>

      <div style="padding:24px; color:#111827;">
        <p style="font-size:16px;">เรียน คุณ${studentName},</p>

        <p style="font-size:15px; line-height:1.6;">
          มีการเพิ่มแลปใหม่ในคลาส <b>${className}</b>  
          กรุณาตรวจสอบรายละเอียดด้านล่าง
        </p>

        <table style="width:100%; border-collapse:collapse; margin:16px 0;">
          <tr>
            <td style="padding:8px 0; color:#6b7280; width:140px;">Class</td>
            <td style="padding:8px 0; font-weight:600;">${className}</td>
          </tr>
          <tr>
            <td style="padding:8px 0; color:#6b7280;">Lab</td>
            <td style="padding:8px 0; font-weight:600;">${labName}</td>
          </tr>
          ${
            dueDateStr
              ? `
          <tr>
            <td style="padding:8px 0; color:#6b7280;">กำหนดส่ง</td>
            <td style="padding:8px 0; font-weight:600;">${dueDateStr}</td>
          </tr>
          `
              : ""
          }
        </table>

        <p style="font-size:14px; color:#374151; line-height:1.6;">
          กรุณาเข้าสู่ระบบ EasyFlow เพื่อเริ่มทำแลปนี้ภายในเวลาที่กำหนด
        </p>

        <div style="text-align:center; margin:24px 0;">
          <a href="${appUrl}"
            style="background:#0f766e; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600; display:inline-block;">
            เปิดแลปนี้ใน EasyFlow
          </a>
        </div>

        <p style="font-size:14px; color:#374151;">
          หากมีข้อสงสัยเกี่ยวกับโจทย์หรือกำหนดส่ง  
          กรุณาติดต่ออาจารย์ผู้สอนหรือผู้ดูแลระบบ
        </p>

        <p style="margin-top:32px; font-size:14px; color:#6b7280;">
          ขอให้สนุกกับการเรียนรู้ และขอให้ประสบความสำเร็จ<br/>
          <b>EasyFlow Team</b>
        </p>
      </div>

      <div style="background:#f3f4f6; padding:12px 24px; font-size:12px; color:#6b7280; text-align:center;">
        © ${new Date().getFullYear()} EasyFlow. All rights reserved.
      </div>

    </div>
  </div>
  `;

      try {
        console.log("✉️ sending mail to:", m.user.email);

        await sendMail({
          to: m.user.email,
          subject,
          html
        });
      } catch (e) {
        console.error("❌ EMAIL SEND FAIL:", m.user.email, e);
      }
    }
    
  }
  
}

export default new ClassService();
