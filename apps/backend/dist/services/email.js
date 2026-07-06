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
function emailHeader(title) {
    return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:600px;">
      <!-- LOGO-HEADER -->
      <tr>
        <td style="background:#00454A;padding:24px 36px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:middle;">
                <img src="https://helferchen.info/logo.png" alt="HELFERCHEN" height="44" width="auto"
                     style="display:block;height:44px;width:auto;border:0;outline:none;" />
              </td>
              <td align="right" style="vertical-align:middle;">
                <span style="color:#a7d7d9;font-size:12px;font-style:italic;">Ihr Helfer vor Ort</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- GOLD-TRENNLINIE -->
      <tr><td style="background:#FFB300;height:3px;font-size:0;line-height:0;"></td></tr>`;
}
function emailFooter() {
    return `      <!-- SIGNATUR -->
      <tr>
        <td style="background:#ffffff;padding:24px 36px 20px;border-top:1px solid #E5E7EB;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="vertical-align:top;padding-right:20px;">
                <p style="margin:0 0 2px;font-size:14px;font-weight:bold;color:#00454A;">Fabian Marquardt</p>
                <p style="margin:0 0 8px;font-size:12px;color:#6B7280;">Inhaber &middot; Helferchen</p>
                <p style="margin:0;font-size:13px;">
                  <a href="tel:015222074984" style="color:#00454A;text-decoration:none;font-weight:600;">0152 2207 4984</a><br>
                  <a href="mailto:info@helferchen.info" style="color:#00454A;text-decoration:none;">info@helferchen.info</a><br>
                  <a href="https://helferchen.info" style="color:#00454A;text-decoration:none;">www.helferchen.info</a>
                </p>
              </td>
              <td style="vertical-align:top;border-left:3px solid #FFB300;padding-left:16px;width:160px;">
                <p style="margin:0;font-size:11px;color:#4B5563;font-style:italic;line-height:1.5;">
                  &bdquo;Zuverlässig, freundlich &amp; direkt aus Ihrer Nachbarschaft.&rdquo;
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <!-- PFLICHTANGABEN (Kleingedrucktes) -->
      <tr>
        <td style="background:#F9FAFB;padding:12px 36px;border-top:1px solid #E5E7EB;border-radius:0 0 12px 12px;">
          <p style="margin:0;font-size:9.5px;color:#9CA3AF;line-height:1.7;">
            <strong style="color:#6B7280;">Helferchen</strong> &middot;
            Fabian Marquardt (Inhaber) &middot;
            Tel.: 0152&nbsp;2207&nbsp;4984 &middot;
            <a href="mailto:info@helferchen.info" style="color:#9CA3AF;text-decoration:none;">info@helferchen.info</a> &middot;
            <a href="https://helferchen.info" style="color:#9CA3AF;text-decoration:none;">helferchen.info</a><br>
            Steuernummer:&nbsp;36/434/00685 &middot; Finanzamt Berlin &middot;
            Kleinunternehmer gem&auml;&szlig; &sect;&nbsp;19 UStG &ndash; kein Umsatzsteuerausweis &middot;
            <a href="https://helferchen.info/impressum" style="color:#9CA3AF;text-decoration:none;">Impressum</a> &middot;
            <a href="https://helferchen.info/datenschutz" style="color:#9CA3AF;text-decoration:none;">Datenschutz</a>
          </p>
          <p style="margin:3px 0 0;font-size:9px;color:#D1D5DB;line-height:1.5;">
            Diese E-Mail kann vertrauliche Informationen enthalten. Wenn Sie nicht der beabsichtigte Empf&auml;nger sind, informieren Sie bitte sofort den Absender und l&ouml;schen Sie diese Nachricht.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
function bookingConfirmationHtml(b) {
    return emailHeader('Buchungsbestätigung') + `
      <!-- INHALT -->
      <tr>
        <td style="padding:36px 36px 28px;">
          <h2 style="color:#00454A;margin:0 0 8px;font-size:22px;">Buchungsanfrage eingegangen &#10003;</h2>
          <p style="color:#4B5563;margin:0 0 24px;font-size:15px;">
            Hallo <strong>${escapeHtml(b.name)}</strong>,<br>
            wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.
          </p>

          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f0faf4;border-radius:8px;border-left:4px solid #00454A;margin-bottom:28px;">
            <tr>
              <td style="padding:20px 24px;">
                <p style="margin:0 0 12px;font-weight:bold;color:#00454A;font-size:15px;">Ihre Anfrage im Überblick</p>
                <table cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding:4px 0;color:#6B7280;font-size:14px;width:120px;">&#128197; Termin</td>
                    <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(b.preferred_date)} um ${escapeHtml(b.preferred_time)} Uhr</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#6B7280;font-size:14px;">&#128205; Adresse</td>
                    <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(b.fullAddress)}</td>
                  </tr>
                  <tr>
                    <td style="padding:4px 0;color:#6B7280;font-size:14px;vertical-align:top;">&#128221; Leistung</td>
                    <td style="padding:4px 0;color:#111827;font-size:14px;">${escapeHtml(b.service_description)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="color:#6B7280;font-size:14px;margin:0 0 6px;">Bei Fragen erreichen Sie uns unter:</p>
          <p style="margin:0;font-size:15px;">
            <a href="tel:015222074984" style="color:#00454A;font-weight:bold;text-decoration:none;">0152 2207 4984</a>
          </p>
        </td>
      </tr>
` + emailFooter();
}
function adminBookingNotificationHtml(b) {
    return emailHeader('Neue Buchungsanfrage') + `
      <!-- INHALT -->
      <tr>
        <td style="padding:32px 36px 28px;">
          <h2 style="color:#00454A;margin:0 0 20px;font-size:20px;">&#128203; Neue Buchungsanfrage</h2>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;">
            <tr style="background:#f9fafb;">
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;width:130px;">Kunde</td>
              <td style="padding:10px 16px;color:#111827;font-size:14px;border-bottom:1px solid #E5E7EB;">${escapeHtml(b.name)}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#374151;font-size:14px;border-bottom:1px solid #E5E7EB;">E-Mail</td>
              <td style="padding:10px 16px;font-size:14px;border-bottom:1px solid #E5E7EB;">
                <a href="mailto:${escapeHtml(b.email)}" style="color:#00454A;">${escapeHtml(b.email)}</a>
              </td>
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
          <p style="margin:20px 0 0;color:#6B7280;font-size:13px;">
            Automatisch generiert &middot;
            <a href="https://helferchen.info/portal" style="color:#00454A;">helferchen.info/portal</a>
          </p>
        </td>
      </tr>
` + emailFooter();
}
function shopOrderHtml(order) {
    const rows = order.items.map(i => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #E5E7EB;font-size:14px;color:#111827;">${escapeHtml(i.name)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #E5E7EB;text-align:center;font-size:14px;color:#111827;">${i.quantity}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #E5E7EB;text-align:right;font-size:14px;color:#111827;">${(i.price * i.quantity).toFixed(2)} &euro;</td>
    </tr>`).join('');
    return emailHeader('Neue Shop-Bestellung') + `
      <!-- INHALT -->
      <tr>
        <td style="padding:32px 36px 28px;">
          <h2 style="color:#00454A;margin:0 0 16px;font-size:20px;">&#128722; Neue Shop-Bestellung</h2>
          <p style="margin:0 0 20px;color:#374151;font-size:14px;">
            <strong>Kunde:</strong> ${escapeHtml(order.customerName)}<br>
            <strong>E-Mail:</strong> <a href="mailto:${escapeHtml(order.customerEmail)}" style="color:#00454A;">${escapeHtml(order.customerEmail)}</a>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="border:1px solid #E5E7EB;border-radius:8px;border-collapse:collapse;">
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
                <td colspan="2" style="padding:12px;font-weight:bold;color:#374151;text-align:right;font-size:14px;">Gesamt:</td>
                <td style="padding:12px;font-weight:bold;color:#00454A;font-size:16px;text-align:right;">${order.total.toFixed(2)} &euro;</td>
              </tr>
            </tfoot>
          </table>
        </td>
      </tr>
` + emailFooter();
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
