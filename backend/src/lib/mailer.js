// src/lib/mailer.js
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = Number(process.env.SMTP_PORT || 587);

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465, // 465 = SSL, 587 = STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // ต้องเป็น App Password
  },
  tls: {
    rejectUnauthorized: false, // dev-friendly
  },
});

// เรียกตอน boot server เพื่อตรวจว่า login ได้จริงไหม
export async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log("✅ SMTP transporter verified OK");
  } catch (e) {
    console.error("❌ SMTP verify failed:", e?.message || e);
  }
}

export async function sendMail({ to, subject, html, text = null }) {
  if (!to) throw new Error("sendMail: 'to' is required");

  const mail = {
    from: process.env.SMTP_FROM || `"EasyFlow" <${process.env.SMTP_USER}>`,
    to,
    subject,
  };

  if (html) mail.html = html;
  if (text) mail.text = text;

  const info = await transporter.sendMail(mail);
  console.log("📨 Mail sent:", info.messageId, "→", to);
  return info;
}

export default { transporter, sendMail, verifyTransporter };
