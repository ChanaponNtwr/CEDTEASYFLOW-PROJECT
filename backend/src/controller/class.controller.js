// src/controller/class.controller.js
import express from "express";
import { classService } from "../service/class/index.js";

const router = express.Router();

/**
 * helper: get current user from header or body
 */
function getActorUserId(req) {
  // header takes precedence
  return req.headers["x-user-id"] ?? req.body?.actorUserId ?? req.body?.currentUserId;
}

/* =========================================================
 * CLASS
 * ======================================================= */

/**
 * POST /classes
 * body: { classname }
 * header: x-user-id
 */
router.post("/", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    if (!actorUserId) {
      return res.status(403).json({ ok: false, message: "x-user-id required" });
    }

    const cls = await classService.createClass(req.body, actorUserId);
    return res.status(201).json({ ok: true, class: cls });
  } catch (err) {
    console.error("CREATE CLASS ERROR:", err);
    const status = err.code === "FORBIDDEN" ? 403 : 400;
    return res.status(status).json({ ok: false, message: err.message, details: err.details || null });
  }
});

/**
 * GET /classes/mine
 * header: x-user-id
 * → return { owned, joined }
 */
router.get("/mine", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(403).json({ ok: false, message: "x-user-id required" });
    }

    const result = await classService.listClassesForUser(userId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error("LIST MY CLASSES ERROR:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/**
 * GET /classes/:classId
 * (This route must be after /mine to avoid matching 'mine' as :classId)
 */
router.get("/:classId", async (req, res) => {
  try {
    const cls = await classService.getClass(req.params.classId);
    return res.json({ ok: true, class: cls });
  } catch (err) {
    console.error("GET CLASS ERROR:", err);
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "BAD_REQUEST" ? 400 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * GET /classes
 * (admin / debug) - keep at end
 */
router.get("/", async (req, res) => {
  try {
    const skip = req.query.skip ? Number(req.query.skip) : undefined;
    const take = req.query.take ? Number(req.query.take) : undefined;
    const classes = await classService.listClasses({ skip, take });
    return res.json({ ok: true, classes });
  } catch (err) {
    console.error("LIST CLASSES ERROR:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/* =========================================================
 * LAB RELATION
 * ======================================================= */

/**
 * POST /classes/:classId/labs
 * body: { labId }
 * header: x-user-id (owner | teacher)
 */
router.post("/:classId/labs", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    const { labId, dueDate } = req.body; // <-- ต้องรับค่า dueDate

    const r = await classService.addLabToClass(
      req.params.classId,
      labId,
      actorUserId,
      dueDate  // <-- ส่งเข้าไปด้วย
    );

    return res.status(201).json({ ok: true, result: r });
  } catch (err) {
    console.error("ADD LAB TO CLASS ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;

    return res.status(status).json({ ok: false, message: err.message });
  }
});
/**
 * GET /classes/:classId/labs
 */
// src/controller/class.controller.js

/**
 * GET /classes/:classId/labs
 */
router.get("/:classId/labs", async (req, res) => {
  try {
    const classId = req.params.classId;
    const labs = await classService.listLabsInClass(classId);
    
    // map ให้ frontend ใช้ง่าย: lab + dueDate
    const result = labs.map(cl => ({
      labId: cl.labId,
      dueDate: cl.dueDate,
      lab: cl.lab
    }));

    return res.json({ ok: true, labs: result });
  } catch (err) {
    console.error("LIST LABS ERROR:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});


router.get("/:classId/users/search", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    const query = String(req.query.q || "").trim();

    if (!query) return res.json({ ok: true, users: [] });

    const users = await classService.searchUsersNotInClass(
      query,
      req.params.classId,
      actorUserId
    );

    return res.json({ ok: true, users });
  } catch (err) {
    console.error("SEARCH USERS NOT IN CLASS ERROR:", err);
    const status = err.code === "FORBIDDEN" ? 403 : 500;
    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * PATCH /classes/:classId/users/:userId/role (update role)
 * body: { roleId }
 * header: x-user-id (must be owner)
 */
router.patch("/:classId/users/:userId/role", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    const { roleId } = req.body;

    const updated = await classService.updateUserRoleInClass(
      req.params.userId,
      req.params.classId,
      roleId,
      actorUserId
    );

    return res.json({ ok: true, result: updated });
  } catch (err) {
    console.error("UPDATE USER ROLE ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;

    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * POST /classes/:classId/users
 * body: { userId, roleId }
 * header: x-user-id (actor, must be owner)
 */
router.post("/:classId/users", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    const { userId, roleId } = req.body;

    const r = await classService.addUserToClass(
      userId,
      req.params.classId,
      roleId,
      actorUserId
    );

    return res.status(201).json({ ok: true, result: r });
  } catch (err) {
    console.error("ADD USER ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;

    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * DELETE /classes/:classId/users/:userId
 * header: x-user-id (actor)
 */
router.delete("/:classId/users/:userId", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);

    await classService.removeUserFromClass(
      req.params.userId,
      req.params.classId,
      actorUserId
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("REMOVE USER ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;

    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * PATCH /classes/:classId/labs/:labId
 * body: { dueDate }
 * header: x-user-id (owner | teacher)
 */
router.patch("/:classId/labs/:labId", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    const { dueDate } = req.body;

    const updated = await classService.updateLabDueDate(
      req.params.classId,
      req.params.labId,
      actorUserId,
      dueDate
    );

    return res.json({ ok: true, result: updated });
  } catch (err) {
    console.error("UPDATE LAB DUE DATE ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;
    return res.status(status).json({ ok: false, message: err.message });
  }
});

/**
 * GET /classes/:classId/users
 */
router.get("/:classId/users", async (req, res) => {
  try {
    const list = await classService.listUsersInClass(req.params.classId);
    return res.json({ ok: true, users: list });
  } catch (err) {
    console.error("LIST USERS ERROR:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

/* =========================================================
 * PACKAGE
 * ======================================================= */

/**
 * POST /classes/:classId/packages
 * body: { packageId, startDate?, endDate? }
 * header: x-user-id (must be owner)
 */
router.post("/:classId/packages", async (req, res) => {
  try {
    const actorUserId = getActorUserId(req);
    const { packageId, startDate = null, endDate = null } = req.body;

    const r = await classService.addPackageToClass(
      req.params.classId,
      packageId,
      { startDate, endDate },
      actorUserId
    );

    return res.status(201).json({ ok: true, result: r });
  } catch (err) {
    console.error("ADD PACKAGE ERROR:", err);
    const status =
      err.code === "FORBIDDEN" ? 403 :
      err.code === "NOT_FOUND" ? 404 : 400;

    return res.status(status).json({ ok: false, message: err.message });
  }
});

router.get("/:classId/packages", async (req, res) => {
  try {
    const list = await classService.listPackagesForClass(req.params.classId);
    return res.json({ ok: true, packages: list });
  } catch (err) {
    console.error("LIST PACKAGES ERROR:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
