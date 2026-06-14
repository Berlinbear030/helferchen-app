"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBookingConfirmation = sendBookingConfirmation;
exports.sendNewBookingAdminNotification = sendNewBookingAdminNotification;
exports.sendShopOrderEmail = sendShopOrderEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const FROM = process.env.SMTP_FROM || 'no-reply@helferchen.info';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@helferchen.info';
function createTransporter() {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '25');
    const isLocalhost = host === 'localhost' || host === '127.0.0.1';
    return nodemailer_1.default.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true',
        ignoreTLS: isLocalhost,
        auth: process.env.SMTP_USER ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        } : undefined,
    });
}
async function sendBookingConfirmation(booking) {
    if (!booking.email)
        return false;
    const transporter = createTransporter();
    const fullAddress = booking.street
        ? `${booking.street} ${booking.house_number}, ${booking.zip} ${booking.city}`
        : booking.address || '';
    try {
        await transporter.sendMail({
            from: `"Helferchen" <${FROM}>`,
            to: booking.email,
            subject: `Buchungsbestätigung – ${booking.preferred_date}`,
            html: bookingConfirmationHtml({ ...booking, fullAddress }),
            text: `Hallo ${booking.name},\n\nwir haben Ihre Anfrage erhalten und melden uns bald.\n\nTermin: ${booking.preferred_date} um ${booking.preferred_time} Uhr\nAdresse: ${fullAddress}\nLeistung: ${booking.service_description}\n\nMit freundlichen Grüßen\nIhr Helferchen-Team`,
        });
        console.log(`[email] Booking confirmation sent to ${booking.email}`);
        return true;
    }
    catch (err) {
        console.error('[email] Booking confirmation failed:', err);
        return false;
    }
}
async function sendNewBookingAdminNotification(booking) {
    const transporter = createTransporter();
    try {
        await transporter.sendMail({
            from: `"Helferchen System" <${FROM}>`,
            to: ADMIN_EMAIL,
            replyTo: booking.email || undefined,
            subject: `📋 Neue Buchungsanfrage – ${booking.name}`,
            html: adminBookingNotificationHtml(booking),
            text: `Neue Buchungsanfrage eingegangen!\n\nKunde: ${booking.name}\nE-Mail: ${booking.email}\nTelefon: ${booking.phone || '-'}\nTermin: ${booking.preferred_date} um ${booking.preferred_time} Uhr\nAdresse: ${booking.address || '-'}\nLeistung: ${booking.service_description}`,
        });
        console.log(`[email] Admin booking notification sent to ${ADMIN_EMAIL}`);
        return true;
    }
    catch (err) {
        console.error('[email] Admin booking notification failed:', err);
        return false;
    }
}
async function sendShopOrderEmail(order) {
    const transporter = createTransporter();
    const itemsList = order.items
        .map(i => `  • ${i.name} × ${i.quantity} = ${(i.price * i.quantity).toFixed(2)} €`)
        .join('\n');
    try {
        await transporter.sendMail({
            from: `"Helferchen Shop" <${FROM}>`,
            to: order.shopEmail,
            subject: `Neue Shop-Bestellung von ${order.customerName}`,
            html: shopOrderHtml(order),
            text: `Neue Bestellung von ${order.customerName} (${order.customerEmail})\n\n${itemsList}\n\nGesamt: ${order.total.toFixed(2)} €`,
        });
        console.log(`[email] Shop order notification sent to ${order.shopEmail}`);
        return true;
    }
    catch (err) {
        console.error('[email] Shop order email failed:', err);
        return false;
    }
}
function bookingConfirmationHtml(b) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buchungsbestätigung</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#00454A;padding:32px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:-0.5px;">Helferchen</h1>
            <p style="color:#a7d7d9;margin:8px 0 0;font-size:14px;">Ihr Helfer vor Ort</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#00454A;margin:0 0 8px;font-size:22px;">Buchungsanfrage eingegangen ✓</h2>
            <p style="color:#4B5563;margin:0 0 24px;font-size:15px;">Hallo <strong>${escapeHtml(b.name)}</strong>,<br>wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0faf4;border-radius:8px;border-left:4px solid #00454A;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;font-weight:bold;color:#00454A;font-size:16px;">Ihre Anfrage im Überblick</p>
                  <table cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:4px 0;color:#6B7280;font-size:14px;width:120px;">📅 Termin</td>
                      <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(b.preferred_date)} um ${escapeHtml(b.preferred_time)} Uhr</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#6B7280;font-size:14px;">📍 Adresse</td>
                      <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(b.fullAddress)}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;color:#6B7280;font-size:14px;vertical-align:top;">📝 Leistung</td>
                      <td style="padding:4px 0;color:#111827;font-size:14px;">${escapeHtml(b.service_description)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="color:#6B7280;font-size:14px;margin:0 0 8px;">Bei Fragen erreichen Sie uns unter:</p>
            <p style="margin:0;font-size:15px;"><a href="tel:015220749884" style="color:#00454A;font-weight:bold;text-decoration:none;">01522 07 49 84</a></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="color:#9CA3AF;font-size:12px;margin:0;">Helferchen · Ihre Nachbarschaftshilfe · <a href="mailto:info@helferchen.info" style="color:#9CA3AF;">info@helferchen.info</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function adminBookingNotificationHtml(b) {
    return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Neue Buchungsanfrage</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:#00454A;padding:24px 40px;">
          <h1 style="color:#fff;margin:0;font-size:20px;">📋 Neue Buchungsanfrage</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;">
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;width:140px;">Kunde</td>
              <td style="padding:10px 16px;color:#111827;font-size:14px;border-bottom:1px solid #E5E7EB;">${escapeHtml(b.name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;">E-Mail</td>
              <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #E5E7EB;"><a href="mailto:${escapeHtml(b.email)}" style="color:#00454A;">${escapeHtml(b.email)}</a></td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;">Telefon</td>
              <td style="padding:10px 16px;color:#111827;font-size:14px;border-bottom:1px solid #E5E7EB;">${escapeHtml(b.phone || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;">Termin</td>
              <td style="padding:10px 16px;color:#111827;font-size:14px;border-bottom:1px solid #E5E7EB;">${escapeHtml(b.preferred_date)} um ${escapeHtml(b.preferred_time)} Uhr</td>
            </tr>
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;">Adresse</td>
              <td style="padding:10px 16px;color:#111827;font-size:14px;border-bottom:1px solid #E5E7EB;">${escapeHtml(b.address || '-')}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;">Leistung</td>
              <td style="padding:10px 16px;color:#111827;font-size:14px;">${escapeHtml(b.service_description)}</td>
            </tr>
          </table>
          <p style="margin:24px 0 0;color:#6B7280;font-size:13px;">Diese E-Mail wurde automatisch vom Helferchen-System versendet.<br>Zur Buchungsanfrage: <a href="https://helferchen.info/portal" style="color:#00454A;">helferchen.info/portal</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function shopOrderHtml(order) {
    const rows = order.items.map(i => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">${escapeHtml(i.name)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right;">${(i.price * i.quantity).toFixed(2)} €</td>
    </tr>`).join('');
    return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Neue Bestellung</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:#00454A;padding:28px 40px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">Neue Shop-Bestellung</h1>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="margin:0 0 20px;color:#374151;font-size:15px;">
            <strong>Von:</strong> ${escapeHtml(order.customerName)}<br>
            <strong>E-Mail:</strong> ${escapeHtml(order.customerEmail)}
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB;">Artikel</th>
                <th style="padding:10px 12px;text-align:center;font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB;">Menge</th>
                <th style="padding:10px 12px;text-align:right;font-size:13px;color:#6B7280;border-bottom:1px solid #E5E7EB;">Preis</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding:12px;font-weight:bold;color:#374151;text-align:right;">Gesamt:</td>
                <td style="padding:12px;font-weight:bold;color:#00454A;font-size:16px;text-align:right;">${order.total.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
