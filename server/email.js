import { formatMoney } from "../src/lib/pricing.ts";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function configured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

const logoUrl = "https://www.linenhousekeeping.co.uk/email-logo.png";

function firstName(name) {
  return name.trim().split(/\s+/)[0] || name;
}

function rows(booking) {
  const lines = [
    ["Reference", booking.reference],
    ["Service", booking.serviceName],
    ["Home", booking.sizeLabel],
    ["When", `${booking.displayDate}, ${booking.window}`],
    ["Duration", booking.hoursLabel],
    ["Address", `${booking.address}, ${booking.postcode}`],
  ];

  for (const extra of booking.extras) {
    lines.push([extra.label, formatMoney(extra.price)]);
  }

  lines.push(["Visit price", formatMoney(booking.total)]);
  if (booking.notes) lines.push(["Access notes", booking.notes]);
  return lines;
}

function textBody(booking) {
  const lines = [
    `Hello ${firstName(booking.name)},`,
    "",
    "Your cleaning visit is confirmed.",
    "",
    ...rows(booking).map(([label, value]) => `${label}: ${value}`),
    "",
    "No payment is taken online. The price above is the full price for this visit.",
    "",
    "We'll arrive at the start of the time you chose. Please make sure we can get in.",
    "To change or cancel, reply to this email at least 24 hours before the visit.",
    "",
    "Linen Housekeeping",
  ];
  return lines.join("\n");
}

function htmlBody(booking, logoSrc = logoUrl) {
  const lines = rows(booking);
  const totalIndex = lines.findIndex(([label]) => label === "Visit price");
  const total = totalIndex >= 0 ? lines.splice(totalIndex, 1)[0] : null;
  const detailRows = lines
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid #d5e0da;color:#3c4b44;font-size:14px;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(label)}</td>
          <td style="padding:11px 0;border-bottom:1px solid #d5e0da;text-align:right;color:#12201a;font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  const totalRow = total
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#e5f6ee;border-radius:12px;">
        <tr>
          <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0a6240;">${escapeHtml(total[0])}</td>
          <td style="padding:14px 16px;text-align:right;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0d7a4b;">${escapeHtml(total[1])}</td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7f5;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(booking.serviceName)} on ${escapeHtml(booking.displayDate)}. Reference ${escapeHtml(booking.reference)}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:32px 28px;font-family:Arial,Helvetica,sans-serif;color:#12201a;">
            <tr>
              <td>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-right:12px;"><img src="${logoSrc}" width="44" height="44" alt="Linen" style="display:block;border:0;border-radius:10px;" /></td>
                    <td>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.03em;line-height:1;color:#12201a;">Linen</div>
                      <div style="padding-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#3c4b44;">Housekeeping</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding-top:28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0d7a4b;">Confirmed</td>
            </tr>
            <tr>
              <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.03em;">Your visit is confirmed.</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#24312b;">Hello ${escapeHtml(firstName(booking.name))}, we've reserved your clean. The details are below.</td>
            </tr>
            <tr>
              <td style="padding-top:18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detailRows}</table>
                ${totalRow}
              </td>
            </tr>
            <tr>
              <td style="padding-top:22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#24312b;">No payment is taken online. We'll arrive at the start of your chosen time — please make sure we can get in. To change or cancel, reply to this email at least 24 hours before the visit.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ownerText(booking) {
  return [
    `New booking ${booking.reference}`,
    "",
    `Customer: ${booking.name}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone}`,
    "",
    ...rows(booking).map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
}

function ownerHtml(booking) {
  return htmlBody(booking)
    .replace("Your visit is confirmed.", `New booking ${escapeHtml(booking.reference)}`)
    .replace(
      `Hello ${escapeHtml(firstName(booking.name))}, we've reserved your clean. The details are below.`,
      `${escapeHtml(booking.name)} booked a clean. ${escapeHtml(booking.email)} · ${escapeHtml(booking.phone)}`,
    );
}

function emptyResult(status) {
  return { emailSent: false, emailStatus: status, previewUrl: "", notifyUrl: "" };
}

async function deliver(to, subject, text, html, replyTo, recipientName) {
  const body = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME || "Linen Housekeeping",
    },
    to: [{ email: to, ...(recipientName ? { name: recipientName } : {}) }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  if (replyTo) body.replyTo = { email: replyTo, name: "Linen Housekeeping" };

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Brevo returned ${response.status}`);
  }
  return { ok: true, response: data.messageId || "" };
}

export async function sendConfirmation(booking) {
  if (!configured()) return emptyResult("not_configured");

  const subject = `Linen confirmation · ${booking.displayDate}`;
  const replyTo = process.env.BREVO_REPLY_TO || process.env.NOTIFY_EMAIL || "";
  try {
    await deliver(booking.email, subject, textBody(booking), htmlBody(booking), replyTo, booking.name);

    const notifyTo = process.env.NOTIFY_EMAIL;
    if (notifyTo && notifyTo.toLowerCase() !== booking.email.toLowerCase()) {
      try {
        await deliver(notifyTo, `New booking ${booking.reference}`, ownerText(booking), ownerHtml(booking), booking.email, "Linen Housekeeping");
      } catch (error) {
        console.error("Booking alert failed:", error instanceof Error ? error.message : error);
      }
    }

    return { emailSent: true, emailStatus: "sent", previewUrl: "", notifyUrl: "" };
  } catch (error) {
    console.error("Confirmation email failed:", error instanceof Error ? error.message : error);
    return emptyResult("failed");
  }
}

export function emailIsConfigured() {
  return configured();
}
