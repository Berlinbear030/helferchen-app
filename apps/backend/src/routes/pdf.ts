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

function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return '—';
  return new Date(utcMs(s)).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtTime(s: string | Date | null | undefined): string {
  if (!s) return '—';
  return new Date(utcMs(s)).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

function calcPrice(minutes: number): number {
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
const SEP_COLOR = '#D1D5DB';
const LOGO_PATH = '/var/www/helferchen/logo.png';
const IBAN = 'DE12 1005 0000 1064 2171 99';
const BIC = 'BELADEBEXXX';
const TAX_RATE = 0.19;
const GESCHAEFTSFUEHRER = 'Fabian Marquardt (Geschäftsführer)';
const STEUERNUMMER = '36/434/00685';

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
  const isPaid = !!signature;
  const minutes = (timelog?.start_time && timelog?.end_time)
    ? Math.max(0, Math.round((utcMs(timelog.end_time as any) - utcMs(timelog.start_time as any)) / 60000))
    : 0;
  const basePrice = calcPrice(minutes);
  const voucherDiscount = report.voucher_discount_amount ? Number(report.voucher_discount_amount) : 0;
  const price = Math.max(0, basePrice - voucherDiscount);
  const extraBlocks = minutes > 15 ? Math.ceil((minutes - 15) / 15) : 0;
  const extraCost = extraBlocks * 15;
  const invoiceNum = report.invoice_number || `HCH-${reportId.slice(0, 8).toUpperCase()}`;
  const invoiceDate = report.created_at ? fmtDate(report.created_at) : new Date().toLocaleDateString('de-DE');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 595.28;
    const M = 50;
    const CW = W - M * 2;

    // ── HELFERCHEN header ───────────────────────────────────────────────────────
    doc.rect(0, 0, W, 78).fill('#FFFFFF');

    let logoDrawn = false;
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, W / 2 - 65, 14, { height: 50, fit: [130, 50] });
        logoDrawn = true;
      } catch { /* fallback to text below */ }
    }
    if (!logoDrawn) {
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(34)
        .text('HELFERCHEN', 0, 18, { width: W, align: 'center' });
    }
    doc.moveTo(M, 72).lineTo(W - M, 72).stroke(SEP_COLOR);

    // ── Title strip ────────────────────────────────────────────────────────────
    doc.rect(0, 76, W, 30).fill(GREEN);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(11)
      .text('RECHNUNG / ARBEITSNACHWEIS', M, 85, { width: CW / 2 });
    doc.fillColor(LIGHT_GREEN).font('Helvetica').fontSize(9)
      .text(`Rechnungsnummer: ${invoiceNum}   ·   Datum: ${invoiceDate}`, M + CW / 2, 88, { width: CW / 2, align: 'right' });

    let y = 126;

    // ── Customer & employee block ──────────────────────────────────────────────
    doc.fillColor(GRAY).font('Helvetica').fontSize(8)
      .text('RECHNUNGSEMPFÄNGER', M, y);
    y += 13;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
      .text(customer ? `${customer.first_name} ${customer.last_name}` : '—', M, y);
    y += 15;
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(customer?.address || '—', M, y);
    y += 13;
    if (customer?.phone_number) {
      doc.text(`Tel: ${customer.phone_number}`, M, y); y += 13;
    }

    const rx = M + CW / 2;
    let ry = 126;
    doc.fillColor(GRAY).font('Helvetica').fontSize(8)
      .text('BEARBEITET VON', rx, ry);
    ry += 13;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
      .text(employee?.full_name || '—', rx, ry);
    ry += 15;
    if (assignment) {
      doc.fillColor(DARK).font('Helvetica').fontSize(10)
        .text(`Auftrag: ${assignment.title}`, rx, ry, { width: CW / 2 - 10 });
      ry += 13;
    }
    if (assignment?.scheduled_at) {
      doc.fillColor(DARK).font('Helvetica').fontSize(10)
        .text(`Termin: ${fmtDate(assignment.scheduled_at)}`, rx, ry); ry += 13;
    }

    y = Math.max(y, ry) + 18;

    // ── Table header ───────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 10;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8)
      .text('LEISTUNG', M, y)
      .text('ARBEITSZEIT', M + CW * 0.5, y)
      .text('BETRAG', W - M - 70, y, { width: 70, align: 'right' });
    y += 12;
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 10;

    // Service row — shows extra cost above Grundgebühr (0 for ≤15 min)
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
      .text(assignment?.title || 'Service', M, y, { width: CW * 0.45 });
    if (timelog?.start_time) {
      const timeStr = timelog.end_time
        ? `${fmtTime(timelog.start_time)} – ${fmtTime(timelog.end_time)}`
        : `Ab ${fmtTime(timelog.start_time)}`;
      doc.font('Helvetica').fontSize(10)
        .text(timeStr, M + CW * 0.5, y, { width: CW * 0.3 });
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
      .text(euro(extraCost), W - M - 70, y, { width: 70, align: 'right' });
    y += 16;

    if (assignment?.description) {
      doc.font('Helvetica').fontSize(9).fillColor(GRAY)
        .text(assignment.description, M, y, { width: CW * 0.45 });
      y += 14;
    }

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
    if (voucherDiscount > 0) {
      const vLabel = report.voucher_label || 'Gutschein';
      const vCode = report.voucher_code || '';
      doc.font('Helvetica').fontSize(9).fillColor('#16a34a')
        .text(`${vLabel} (Code: ${vCode})`, M, y, { width: CW - 80 });
      doc.fillColor('#16a34a')
        .text(`−${euro(voucherDiscount)}`, W - M - 70, y, { width: 70, align: 'right' });
      y += 14;
    }

    y += 6;
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 8;

    // ── GESAMTBETRAG box ───────────────────────────────────────────────────────
    // Design: dark teal box, GESAMTBETRAG label left, Zwischensumme/MwSt/Total right
    const netto = price / (1 + TAX_RATE);
    const mwstAmount = price - netto;
    // Without discount: 5+13+13+14 = ~45 → 48px; with discount: +12+12 = ~69 → 74px
    const boxH = voucherDiscount > 0 ? 74 : 48;
    doc.rect(M, y, CW, boxH).fill(GREEN);

    // Left: big GESAMTBETRAG label — vertically centred
    doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
      .text('GESAMTBETRAG', M + 10, y + boxH / 2 - 8, { width: CW * 0.45 });

    // Right: summary column
    const summaryX = M + CW * 0.5;
    const summaryW = CW * 0.5 - 10;
    let sy = y + 5;
    if (voucherDiscount > 0) {
      doc.fillColor(LIGHT_GREEN).font('Helvetica').fontSize(9)
        .text(`Brutto:`, summaryX, sy, { width: summaryW - 60 })
        .text(euro(basePrice), summaryX + summaryW - 60, sy, { width: 60, align: 'right' });
      sy += 12;
      doc.fillColor('#86efac').font('Helvetica').fontSize(9)
        .text(`Rabatt (${report.voucher_label || 'Gutschein'}):`, summaryX, sy, { width: summaryW - 60 })
        .text(`−${euro(voucherDiscount)}`, summaryX + summaryW - 60, sy, { width: 60, align: 'right' });
      sy += 12;
    }
    doc.fillColor(LIGHT_GREEN).font('Helvetica').fontSize(9)
      .text(`Zwischensumme:`, summaryX, sy, { width: summaryW - 60 })
      .text(euro(price), summaryX + summaryW - 60, sy, { width: 60, align: 'right' });
    sy += 13;
    doc.fillColor(LIGHT_GREEN).font('Helvetica').fontSize(9)
      .text(`inkl. ${Math.round(TAX_RATE * 100)} % MwSt.:`, summaryX, sy, { width: summaryW - 60 })
      .text(euro(mwstAmount), summaryX + summaryW - 60, sy, { width: 60, align: 'right' });
    sy += 13;
    doc.fillColor('white').font('Helvetica-Bold').fontSize(10)
      .text(`GESAMTBETRAG: ${euro(price)}`, summaryX, sy, { width: summaryW });

    y += boxH + 14;

    // ── Arbeitsbericht ─────────────────────────────────────────────────────────
    if (report.notes) {
      doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text('ARBEITSBERICHT', M, y);
      y += 13;
      doc.fillColor(DARK).font('Helvetica').fontSize(10)
        .text(report.notes, M, y, { width: CW, lineGap: 3 });
      y += doc.heightOfString(report.notes, { width: CW, lineGap: 3 }) + 16;
    }

    // ── Payment status ─────────────────────────────────────────────────────────
    doc.moveTo(M, y).lineTo(W - M, y).stroke(SEP_COLOR);
    y += 12;
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8).text('ZAHLUNGSSTATUS', M, y);
    y += 13;

    if (isPaid) {
      doc.rect(M, y, CW, 32).fill('#F0FDF4');
      doc.fillColor('#15803D').font('Helvetica-Bold').fontSize(13)
        .text('✓  Bar bezahlt', M + 12, y + 8);
      if (signature?.signed_at) {
        doc.font('Helvetica').fontSize(9).fillColor('#15803D')
          .text(`Kassiert am ${fmtDate(signature.signed_at)}`, M + 160, y + 12);
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
      doc.moveTo(M, sigY).lineTo(M + 200, sigY).stroke(DARK);
      doc.fillColor(DARK).font('Helvetica').fontSize(9)
        .text(signature.signer_name, M, sigY + 4)
        .text(`Datum: ${fmtDate(signature.signed_at)}`, M, sigY + 16);

      y = sigY + 34;
    } else {
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
        .text('Noch nicht unterschrieben.', M, y);
      y += 20;
    }

    y += 20;

    // ── Footer ─────────────────────────────────────────────────────────────────
    const footerY = 841.89 - 44;
    doc.rect(0, footerY, W, 44).fill(GREEN);
    doc.fillColor('white').font('Helvetica').fontSize(8)
      .text(`${GESCHAEFTSFUEHRER}  ·  Steuernummer: ${STEUERNUMMER}`, M, footerY + 7, { width: CW, align: 'center' })
      .text(`info@helferchen.info  ·  www.helferchen.info`, M, footerY + 19, { width: CW, align: 'center' })
      .text(`IBAN: ${IBAN}  ·  Rechnungsnummer: ${invoiceNum}  ·  Erstellt: ${invoiceDate}`, M, footerY + 31, { width: CW, align: 'center' });

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
