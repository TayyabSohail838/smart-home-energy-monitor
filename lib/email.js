import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Sends a plain-text email. Returns true on success. Never throws: email is a bonus,
// the alert row in the database is the main record.
// Without a verified domain, Resend's onboarding@resend.dev sender only delivers to
// the email the Resend account was created with.
export async function sendAlertEmail(to, subject, text) {
  if (!resend || !process.env.ALERT_FROM_EMAIL) {
    console.warn("email skipped: RESEND_API_KEY or ALERT_FROM_EMAIL not set");
    return false;
  }
  try {
    const { error } = await resend.emails.send({
      from: `Energy Monitor <${process.env.ALERT_FROM_EMAIL}>`,
      to,
      subject,
      text,
    });
    if (error) {
      console.error("email failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("email failed:", err.message);
    return false;
  }
}
