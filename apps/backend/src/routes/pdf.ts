import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import fs from 'fs';
import { ReportRepo, TimelogRepo, AssignmentRepo, CustomerRepo, UserRepo, SignatureRepo, AuditRepo } from '../db/queries';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function utcMs(s: string | Date | null | undefined): number {
  if (!s) return 0;
  if (s instanceof Date) return s.getTime();
  const str = String(s);
  return new Date(str.endsWith('Z') || str.includes('+') ? str : str.replace(' ', 'T') + 'Z').getTime();
}

function fmtDateTime(s: string | Date | null | undefined): string {
  if (!s) return '—';
  return new Date(utcMs(s)).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return '—';
  return new Date(utcMs(s)).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(s: string | Date | null | undefined): string {
  if (!s) return '—';
  return new Date(utcMs(s)).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

function calcPrice(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes <= 15) return 20;
  return 20 + Math.ceil((minutes - 15) / 15) * 15;
}

function euro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

const GREEN = '#00454A';
const LIGHT_GREEN = '#E6F4F3';
const GRAY = '#6B7280';
const DARK = '#1F2937';
const SEP_COLOR = '#E5E7EB';
const LOGO_PATH = '/var/www/helferchen/logo.png';
const IBAN = 'DE12 1005 0000 1064 2171 99';
const BIC = 'BELADEBEXXX';
const COMPANY_NAME = 'Helferchen UG (haftungsbeschränkt)';
const COMPANY_ADDRESS = 'info@helferchen.info · www.helferchen.info';

// ── PDF Builder ────────────────────────────────────────────────────────────────

async function buildPdf(reportId: string): Promise<Buffer> {
  const report = await ReportRepo.findById(reportId);
  if (!report) throw new Error('Report not found');

  const [timelog, assignment, employee, signature] = await Promise.all([
    TimelogRepo.findById(report.timelog_id),
    AssignmentRepo.findById(report.assignment_id),
    UserRepo.findById(report.created_by_user_id),
    report.signature_id ? SignatureRepo.findById(report.signature_id) : Promise.resolve(null),
  ]);

  const customer = assignment ? await CustomerRepo.findById(assignment.customer_id) : null;
  const isPaid = assignment?.status === 'completed';
  const minutes = (timelog?.start_time && timelog?.end_time)
    ? Math.max(0, Math.round((utcMs(timelog.end_time as any) - utcMs(timelog.start_time as any)) / 60000))
    : 0;
  const price = calcPrice(minutes);
  const extraBlocks = minutes > 15 ? Math.ceil((minutes - 15) / 15) : 0;
  const invoiceNum = `HCH-${reportId.slice(0, 8).toUpperCase()}`;
  const invoiceDate = report.created_at ? fmtDate(report.created_at) : new Date().toLocaleDateString('de-DE');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28; // A4 width pt
    const M = 50;     // margin
    const CW = W - M * 2; // content width

    // ── Header bar ─────────────────────────────────────────────────────────────
    doc.rect(0, 0, W, 90).fill(GREEN);

    // Logo (left)
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, M, 14, { height: 50, fit: [130, 60] });
      } catch { /* skip logo if it fails */ }
    }

    // Company name (right of logo area)
    doc.fillColor('white')
      .font('Helvetica-Bold').fontSize(18)
      .text(COMPANY_NAME, 200, 20, { width: W - 200 - M, align: 'right' });
    doc.font('Helvetica').fontSize(9)
      .text(COMPANY_ADDRESS, 200, 44, { width: W - 200 - M, align: 'right' });

    // ── Document title strip ───────────────────────────────────────────────────
    doc.rect(0, 90, W, 30).fill(LIGHT_GREEN);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(13)
      .text('RECHNUNG / ABRECHNUNGSSEITE', M, 99, { width: CW / 2 });
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
      .text(`Rechnungsnummer: ${invoiceNum}   ·   Datum: ${invoiceDate}`, M + CW / 2, 101, { width: CW / 2, align: 'right' });

    let y = 140;

    // ── Customer & employee address block ──────────────────────────────────────
    // Left: Customer
    doc.fillColor(GRAY).font('Helvetica').fontSize(8)
      .text('RECHNUNGSEMPFÄNGER', M, y);
    y += 14;
    if (customer) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
        .text(`Kunden-Nr.: ${customer.id.slice(0, 8).toUpperCase()}`, M, y);
      y += 13;
    }
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
      .text(customer ? `${customer.first_name} ${customer.last_name}` : '—', M, y);
    y += 15;
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(customer?.address || '—', M, y);
    y += 13;
    if (customer?.phone_number) {
      doc.text(`Tel: ${customer.phone_number}`, M, y); y += 13;
    }

    // Right: Employee + assignment
    const rx = M + CW / 2;
    let ry = 140;
    doc.fillColor(GRAY).font('Helvetica').fontSize(8)
      .text('BEARBEITET VON', rx, ry);
    ry += 14;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
      .text(employee?.full_name || '—', rx, ry);
    ry += 15;
    if (assignment) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
        .text(`Auftragnummer: ${assignment.id.slice(0, 8).toUpperCase()}`, rx, ry);
      ry += 13;
    }
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(`Aufgabe: ${assignment?.title || '—'}`, rx, ry);
    ry += 13;
    if (assignment?.scheduled_at) {
      doc.text(`Termin: ${fmtDate(assignment.scheduled_at)}`, rx, ry); ry += 13;
    }

    y = Math.max(y, ry) + 20;

    // ── Separator ─────────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 14;

    // ── Leistungsübersicht header ──────────────────────────────────────────────
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8)
      .text('BESCHREIBUNG', M, y)
      .text('ARBEITSZEIT', M + CW * 0.5, y)
      .text('BETRAG', W - M - 70, y, { width: 70, align: 'right' });
    y += 12;
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 10;

    // Service row
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
      .text(assignment?.title || 'Service', M, y, { width: CW * 0.45 });
    if (timelog?.start_time) {
      const timeStr = timelog.end_time
        ? `${fmtTime(timelog.start_time)} – ${fmtTime(timelog.end_time)}`
        : `Ab ${fmtTime(timelog.start_time)}`;
      doc.font('Helvetica').fontSize(10)
        .text(timeStr, M + CW * 0.5, y, { width: CW * 0.3 });
    }
    doc.font('Helvetica-Bold').fontSize(10)
      .text(euro(price), W - M - 70, y, { width: 70, align: 'right' });
    y += 16;

    if (assignment?.description) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(assignment.description, M, y, { width: CW * 0.45 });
      y += 14;
    }

    // Duration detail
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      .text(`Dauer: ${minutes} Minuten`, M + CW * 0.5, y - 14, { width: CW * 0.3 });

    y += 6;
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 10;

    // Price breakdown rows
    const rowY = (label: string, amount: string) => {
      doc.font('Helvetica').fontSize(9).fillColor(DARK)
        .text(label, M, y, { width: CW - 80 });
      doc.text(amount, W - M - 70, y, { width: 70, align: 'right' });
      y += 14;
    };

    rowY('Grundgebühr (erste 15 Minuten)', euro(20));
    if (extraBlocks > 0) {
      rowY(`Zusatzzeit: ${extraBlocks} × 15 Min à 15,00 €`, euro(extraBlocks * 15));
    }

    // MwSt breakdown
    const mwstRate = 0.07;
    const netto = price / (1 + mwstRate);
    const mwstAmount = price - netto;

    y += 6;
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 8;

    const summaryLabelX = W - M - 240;
    const summaryAmtX = W - M - 70;
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
      .text('Zwischensumme (Netto):', summaryLabelX, y, { width: 160 })
      .text(euro(netto), summaryAmtX, y, { width: 70, align: 'right' });
    y += 14;
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
      .text('Inkl. 7 % MwSt:', summaryLabelX, y, { width: 160 })
      .text(euro(mwstAmount), summaryAmtX, y, { width: 70, align: 'right' });
    y += 12;

    // Total row
    doc.rect(M, y, CW, 28).fill(GREEN);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(12)
      .text('GESAMTBETRAG', M + 10, y + 8, { width: CW - 90 });
    doc.fontSize(13)
      .text(euro(price), W - M - 80, y + 7, { width: 70, align: 'right' });
    y += 42;

    // ── Separator ─────────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 14;

    // ── Bericht ────────────────────────────────────────────────────────────────
    if (report.notes) {
      doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text('ARBEITSBERICHT', M, y);
      y += 14;
      doc.fillColor(DARK).font('Helvetica').fontSize(10)
        .text(report.notes, M, y, { width: CW, lineGap: 3 });
      y += doc.heightOfString(report.notes, { width: CW, lineGap: 3 }) + 18;
    }

    // ── Payment status ─────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 14;

    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text('ZAHLUNGSSTATUS', M, y);
    y += 14;

    if (isPaid) {
      doc.rect(M, y, CW, 32).fill('#F0FDF4');
      doc.fillColor('#15803D').font('Helvetica-Bold').fontSize(12)
        .text('✓  Bezahlt', M + 12, y + 9);
      if (signature?.signed_at) {
        doc.font('Helvetica').fontSize(9).fillColor('#15803D')
          .text(`Kassiert am ${fmtDate(signature.signed_at)}`, M + 120, y + 12);
      }
      y += 46;
    } else {
      doc.rect(M, y, CW, 52).fill('#FFF7ED');
      doc.fillColor('#92400E').font('Helvetica-Bold').fontSize(11)
        .text('Rechnung offen — bitte überweisen', M + 12, y + 8);
      doc.font('Helvetica').fontSize(10).fillColor('#92400E')
        .text(`IBAN:  ${IBAN}`, M + 12, y + 26)
        .text(`BIC:   ${BIC}`, M + 12, y + 40)
        .text(`Verwendungszweck: ${invoiceNum}`, M + CW / 2, y + 26, { width: CW / 2 - 10 });
      y += 66;
    }

    y += 10;
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 14;

    // ── Signature ──────────────────────────────────────────────────────────────
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text('UNTERSCHRIFT DES KUNDEN', M, y);
    y += 14;

    if (signature) {
      if (signature.image_data?.startsWith('data:image/')) {
        try {
          const base64 = signature.image_data.split(',')[1];
          const imgBuf = Buffer.from(base64, 'base64');
          doc.image(imgBuf, M, y, { width: 200, height: 70, fit: [200, 70] });
        } catch {
          doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('[Unterschrift-Bild]', M, y);
        }
      }

      const sigY = y + 76;
      // Signature line
      doc.moveTo(M, sigY).lineTo(M + 200, sigY).stroke(DARK);
      doc.fillColor(DARK).font('Helvetica').fontSize(9)
        .text(signature.signer_name, M, sigY + 4)
        .text(`Datum: ${fmtDate(signature.signed_at)}`, M, sigY + 16);

      // Employee counter-signature area
      doc.moveTo(W - M - 200, sigY).lineTo(W - M, sigY).stroke(DARK);
      doc.text('Mitarbeiter', W - M - 200, sigY + 4)
        .text(employee?.full_name || '—', W - M - 200, sigY + 16);

      y = sigY + 34;
    } else {
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
        .text('Noch nicht unterschrieben.', M, y);
      y += 20;
    }

    y += 20;

    // ── Footer ─────────────────────────────────────────────────────────────────
    const footerY = 841.89 - 40; // A4 height - footer height
    doc.rect(0, footerY, W, 40).fill(GREEN);
    doc.fillColor('white').font('Helvetica').fontSize(8)
      .text(`${COMPANY_NAME}  ·  ${COMPANY_ADDRESS}  ·  IBAN: ${IBAN}`, M, footerY + 8, { width: CW, align: 'center' })
      .text(`Rechnungsnummer: ${invoiceNum}  ·  Erstellt: ${invoiceDate}`, M, footerY + 22, { width: CW, align: 'center' });

    doc.end();
  });
}

// GET /api/pdf/:reportId — stream PDF
router.get('/:reportId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const pdfBuffer = await buildPdf(req.params.reportId as string);
    await AuditRepo.create('report', req.params.reportId as string, 'pdf_generated', req.user!.id, 'PDF generated');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="helferchen-rechnung-${req.params.reportId as string}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(404).json({ message: err.message || 'Error generating PDF' });
  }
});

// POST /api/pdf/:reportId/email — generate PDF and send via email
router.post('/:reportId/email', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ message: 'to email address is required' });

  try {
    const pdfBuffer = await buildPdf(req.params.reportId as string);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '25'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@helferchen.info',
      to,
      subject: `Helferchen Rechnung`,
      text: 'Anbei finden Sie Ihre Rechnung / Ihren Arbeitsnachweis von Helferchen.',
      attachments: [{ filename: `helferchen-rechnung.pdf`, content: pdfBuffer }],
    });
    await AuditRepo.create('report', req.params.reportId as string, 'email_sent', req.user!.id, `PDF emailed to ${to}`);
    res.json({ message: 'Email sent successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error sending email' });
  }
});

export default router;
