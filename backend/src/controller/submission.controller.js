// src/controller/submission.controller.js
import express from "express";
import prisma from "../lib/prisma.js";
import SubmissionService from "../service/submission/index.js";
import { sendMail } from "../lib/mailer.js";
const router = express.Router();

/**
 * POST /api/submission/submit
 * body: { flowchartId, userId, debug? }
 */
router.post("/api/submission/submit", async (req, res) => {
  try {
    let raw = req.body;
    if (typeof raw === "string") raw = JSON.parse(raw);
    const { flowchartId, userId, debug = false } = raw || {};

    if (!flowchartId || !userId) {
      return res.status(400).json({
        ok: false,
        message: "flowchartId & userId required",
      });
    }

    const fc = await prisma.flowchart.findUnique({
      where: { flowchartId: Number(flowchartId) },
    });
    if (!fc) return res.status(404).json({ ok: false, message: "flowchart not found" });
    if (!fc.labId) return res.status(400).json({ ok: false, message: "flowchart has no labId" });

    const alreadyConfirmed = await SubmissionService.isConfirmed({
      userId: Number(userId),
      labId: Number(fc.labId),
    });
    if (alreadyConfirmed) {
      return res.status(403).json({
        ok: false,
        message:
          "This lab has already been CONFIRMED for this student. Editing or re-submitting is not allowed.",
      });
    }

    const result = await SubmissionService.submitFromFlowchart({
      flowchartId: Number(flowchartId),
      userId: Number(userId),
      options: { debug: Boolean(debug) },
    });

    return res.json({ ok: true, summary: result.summary, normalizedResults: result.normalizedResults ?? null });
  } catch (err) {
    console.error("submission/submit error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * GET /api/submission/lab/:labId
 * - list submissions grouped by user for a lab
 */
router.get("/api/submission/lab/:labId", async (req, res) => {
  try {
    const { labId } = req.params;
    if (!labId) return res.status(400).json({ ok: false, message: "labId required" });

    // 1) ดึง submissions ทั้งหมดของ lab
    const submissions = await prisma.submission.findMany({
      where: { labId: Number(labId) },
      orderBy: { createAt: "desc" },
    });

    // 2) ดึง testcases ของ lab
    const testcases = await prisma.testcase.findMany({
      where: { labId: Number(labId) },
    });
    const testcaseMap = new Map(testcases.map(tc => [tc.testcaseId, tc]));

    // 3) group submissions by user
    const map = new Map();
    for (const s of submissions) {
      if (!map.has(s.userId)) map.set(s.userId, []);
      map.get(s.userId).push(s);
    }

    // 4) build data with scoreSummary
    const data = [];
    for (const [userId, userSubs] of map.entries()) {
      let totalScore = 0;
      let totalMaxScore = 0;

      const subsWithScore = userSubs.map(s => {
        const tc = testcaseMap.get(s.testcaseId);
        const maxScore = tc?.score ?? 1;
        const awarded = s.status === "PASS" ? maxScore : 0;
        totalScore += awarded;
        totalMaxScore += maxScore;

        return { ...s, scoreAwarded: awarded, maxScore };
      });

      data.push({
        userId,
        submissions: subsWithScore,
        scoreSummary: `${totalScore}/${totalMaxScore}`
      });
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error("submission getByLab error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * GET /api/submission/user/:userId/lab/:labId/latest
 */
router.get("/api/submission/user/:userId/lab/:labId/latest", async (req, res) => {
  try {
    const { userId, labId } = req.params;
    if (!userId || !labId) return res.status(400).json({ ok: false, message: "userId & labId required" });
    const rows = await SubmissionService.getLatestForUserLab({ userId: Number(userId), labId: Number(labId) });
    return res.json({ ok: true, submissions: rows });
  } catch (err) {
    console.error("get latest submission error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * POST /api/submission/lab/:labId/user/:userId/confirm
 * body: { reviewerId? }
 */
router.post("/api/submission/lab/:labId/user/:userId/confirm", async (req, res) => {
  try {
    const { labId, userId } = req.params;

    if (!labId || !userId) {
      return res.status(400).json({ ok: false, message: "labId & userId required" });
    }

    // 1) อัปเดตสถานะ submission
    await SubmissionService.confirmSubmissions({
      userId: Number(userId),
      labId: Number(labId),
    });

    // 2) โหลด user + lab
    const [user, lab] = await Promise.all([
      prisma.user.findUnique({ where: { id: Number(userId) } }),
      prisma.lab.findUnique({ where: { labId: Number(labId) } }),
    ]);

    if (user?.email && lab) {
      const studentName = user.name || `${user.fname || ""} ${user.lname || ""}`.trim() || "นักศึกษา";
      const labName = lab.labname;
      const appUrl = `http://localhost:3000/labs/${lab.labId}`;

      await sendMail({
        to: user.email,
        subject: `✅ ผลการตรวจงาน: ${labName}`,
        html: `
          <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
              
              <div style="background:#1d4ed8; color:#ffffff; padding:20px 24px;">
                <h2 style="margin:0; font-weight:600;">EasyFlow • ผลการตรวจงาน</h2>
              </div>

              <div style="padding:24px; color:#111827;">
                <p style="font-size:16px;">เรียน คุณ${studentName},</p>

                <p style="font-size:15px; line-height:1.6;">
                  งานของคุณสำหรับแลปด้านล่างได้รับการตรวจและ 
                  <b style="color:#16a34a;">ผ่านการยืนยันแล้ว</b>
                </p>

                <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                  <tr>
                    <td style="padding:8px 0; color:#6b7280; width:120px;">Lab</td>
                    <td style="padding:8px 0; font-weight:600;">${labName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#6b7280;">สถานะ</td>
                    <td style="padding:8px 0; font-weight:600; color:#16a34a;">CONFIRMED</td>
                  </tr>
                </table>

                <p style="font-size:14px; color:#374151; line-height:1.6;">
                  คุณสามารถเข้าสู่ระบบเพื่อดูรายละเอียดผลการประเมินได้ที่ปุ่มด้านล่าง
                </p>

                <div style="text-align:center; margin:24px 0;">
                  <a href="${appUrl}" 
                    style="background:#1d4ed8; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600; display:inline-block;">
                    ดูผลการประเมิน
                  </a>
                </div>

                <p style="font-size:14px; color:#374151;">
                  หากมีข้อสงสัยเพิ่มเติม กรุณาติดต่ออาจารย์ผู้สอนหรือผู้ดูแลระบบ
                </p>

                <p style="margin-top:32px; font-size:14px; color:#6b7280;">
                  ขอแสดงความยินดี และขอให้ประสบความสำเร็จในการเรียนรู้ต่อไป<br/>
                  <b>EasyFlow Team</b>
                </p>
              </div>

              <div style="background:#f3f4f6; padding:12px 24px; font-size:12px; color:#6b7280; text-align:center;">
                © ${new Date().getFullYear()} EasyFlow. All rights reserved.
              </div>

            </div>
          </div>
        `,
      });
    }

    return res.json({ ok: true, message: "Confirmed" });
  } catch (err) {
    console.error("confirm error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});


/**
 * POST /api/submission/lab/:labId/user/:userId/cancel
 * - นักเรียนยกเลิกการส่งงานของ lab นี้ทั้งหมด
 */
router.post("/api/submission/lab/:labId/user/:userId/cancel", async (req, res) => {
  try {
    const { labId, userId } = req.params;
    if (!labId || !userId) {
      return res.status(400).json({ ok: false, message: "labId & userId required" });
    }

    // 1) เช็คว่าเคย confirm แล้วหรือยัง
    const alreadyConfirmed = await SubmissionService.isConfirmed({
      userId: Number(userId),
      labId: Number(labId),
    });

    if (alreadyConfirmed) {
      return res.status(403).json({
        ok: false,
        message: "This lab has already been CONFIRMED. Cancel is not allowed.",
      });
    }

    // 2) ลบ submissions ทั้งหมดของ user + lab นี้
    const deleted = await prisma.submission.deleteMany({
      where: {
        userId: Number(userId),
        labId: Number(labId),
      },
    });

    return res.json({
      ok: true,
      message: "Submission cancelled",
      deletedCount: deleted.count,
    });
  } catch (err) {
    console.error("cancel submission error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});

/**
 * POST /api/submission/lab/:labId/user/:userId/reject
 * body: { reviewerId? }
 */
router.post("/api/submission/lab/:labId/user/:userId/reject", async (req, res) => {
  try {
    const { labId, userId } = req.params;

    if (!labId || !userId) {
      return res.status(400).json({ ok: false, message: "labId & userId required" });
    }

    // 1) อัปเดตสถานะ submission → rejected + ลบ rows
    await SubmissionService.rejectSubmissions({
      userId: Number(userId),
      labId: Number(labId),
    });

    // 2) โหลด user + lab
    const [user, lab] = await Promise.all([
      prisma.user.findUnique({ where: { id: Number(userId) } }),
      prisma.lab.findUnique({ where: { labId: Number(labId) } }),
    ]);

    if (user?.email && lab) {
      const studentName =
        user.name ||
        `${user.fname || ""} ${user.lname || ""}`.trim() ||
        "นักศึกษา";

      const labName = lab.labname;
      const appUrl = `http://localhost:3000/labs/${lab.labId}`;

      await sendMail({
        to: user.email,
        subject: `❌ งานถูกปฏิเสธ: ${labName}`,
        html: `
          <div style="font-family: Arial, sans-serif; background:#f6f8fb; padding:24px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
              
              <div style="background:#b91c1c; color:#ffffff; padding:20px 24px;">
                <h2 style="margin:0; font-weight:600;">EasyFlow • ผลการตรวจงาน</h2>
              </div>

              <div style="padding:24px; color:#111827;">
                <p style="font-size:16px;">เรียน คุณ${studentName},</p>

                <p style="font-size:15px; line-height:1.6;">
                  งานของคุณสำหรับแลปด้านล่าง 
                  <b style="color:#dc2626;">ยังไม่ผ่านการยืนยัน</b>
                  และถูกปฏิเสธโดยผู้สอน
                </p>

                <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                  <tr>
                    <td style="padding:8px 0; color:#6b7280; width:120px;">Lab</td>
                    <td style="padding:8px 0; font-weight:600;">${labName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#6b7280;">สถานะ</td>
                    <td style="padding:8px 0; font-weight:600; color:#dc2626;">REJECTED</td>
                  </tr>
                </table>

                <p style="font-size:14px; color:#374151; line-height:1.6;">
                  กรุณาแก้ไข Flowchart ของคุณให้ถูกต้องตามเงื่อนไขของโจทย์  
                  และส่งงานใหม่อีกครั้งผ่านระบบ EasyFlow
                </p>

                <div style="text-align:center; margin:24px 0;">
                  <a href="${appUrl}" 
                    style="background:#b91c1c; color:#ffffff; text-decoration:none; padding:12px 20px; border-radius:6px; font-weight:600; display:inline-block;">
                    แก้ไขและส่งงานใหม่
                  </a>
                </div>

                <p style="font-size:14px; color:#374151;">
                  หากคุณไม่แน่ใจว่าควรแก้ไขส่วนใด  
                  กรุณาติดต่ออาจารย์ผู้สอนเพื่อขอคำแนะนำเพิ่มเติม
                </p>

                <p style="margin-top:32px; font-size:14px; color:#6b7280;">
                  ขอเป็นกำลังใจในการปรับปรุงงาน และขอให้ประสบความสำเร็จ<br/>
                  <b>EasyFlow Team</b>
                </p>
              </div>

              <div style="background:#f3f4f6; padding:12px 24px; font-size:12px; color:#6b7280; text-align:center;">
                © ${new Date().getFullYear()} EasyFlow. All rights reserved.
              </div>

            </div>
          </div>
        `,
      });
    }

    return res.json({ ok: true, message: "Rejected and submissions removed" });
  } catch (err) {
    console.error("reject error:", err);
    return res.status(500).json({ ok: false, message: String(err.message ?? err) });
  }
});


export default router;
