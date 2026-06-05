import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import nodemailer from 'nodemailer';
import db, { addAudit } from '../db';
import { AuthRequest, authenticateToken } from '../middleware/auth';

const router = Router();

function buildPdf(reportId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const report = db.reports.find(r => r.id === reportId);
    if (!report) return reject(new Error('Report not found'));

    const timelog = db.timelogs.find(t => t.id === report.timelog_id);
    const assignment = db.assignments.find(a => a.id === report.assignment_id);
    const customer = assignment ? db.customers.find(c => c.id === assignment.customer_id) : null;
    const employee = db.users.find(u => u.id === report.created_by_user_id);
    const signature = report.signature_id ? db.signatures.find(s => s.id === report.signature_id) : null;

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).text('Helferchen — Arbeitsbericht', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Auftrag: ${assignment?.title || '—'}`);
    doc.text(`Beschreibung: ${assignment?.description || '—'}`);
    doc.moveDown();

    doc.text(`Kunde: ${customer ? `${customer.first_name} ${customer.last_name}` : '—'}`);
    doc.text(`Adresse: ${customer?.address || '—'}`);
    doc.text(`Telefon: ${customer?.phone_number || '—'}`);
    doc.moveDown();

    doc.text(`Mitarbeiter: ${employee?.full_name || '—'}`);
    doc.moveDown();

    if (timelog) {
      const start = new Date(timelog.start_time);
      const end = timelog.end_time ? new Date(timelog.end_time) : null;
      const duration = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
      doc.text(`Arbeitsbeginn: ${start.toLocaleString('de-DE')}`);
      doc.text(`Arbeitsende:   ${end ? end.toLocaleString('de-DE') : 'laufend'}`);
      if (duration !== null) doc.text(`Dauer: ${duration} Minuten`);
    }
    doc.moveDown();

    if (report.notes) {
      doc.text(`Notizen: ${report.notes}`);
      doc.moveDown();
    }

    if (signature) {
      doc.text(`Unterschrift: ${signature.signer_name}`);
      doc.text(`Unterschrieben am: ${new Date(signature.signed_at).toLocaleString('de-DE')}`);
      if (signature.image_data.startsWith('data:image/')) {
        try {
          const base64 = signature.image_data.split(',')[1];
          const imgBuffer = Buffer.from(base64, 'base64');
          doc.moveDown().image(imgBuffer, { width: 200 });
        } catch {
          doc.text('[Unterschrift-Bild konnte nicht geladen werden]');
        }
      }
    } else {
      doc.text('Unterschrift: nicht vorhanden');
    }

    doc.end();
  });
}

// GET /api/pdf/:reportId — stream PDF
router.get('/:reportId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const pdfBuffer = await buildPdf(req.params.reportId as string);
    const report = db.reports.find(r => r.id === req.params.reportId as string)!;
    report.pdf_generated = true;
    addAudit('report', req.params.reportId as string, 'pdf_generated', req.user!.id, 'PDF generated');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bericht-${req.params.reportId as string}.pdf"`);
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
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@helferchen.info',
      to,
      subject: `Helferchen Arbeitsbericht #${req.params.reportId as string}`,
      text: 'Anbei finden Sie den Arbeitsbericht als PDF.',
      attachments: [{ filename: `bericht-${req.params.reportId as string}.pdf`, content: pdfBuffer }],
    });

    const report = db.reports.find(r => r.id === req.params.reportId as string)!;
    report.pdf_generated = true;
    report.email_sent = true;
    addAudit('report', req.params.reportId as string, 'email_sent', req.user!.id, `PDF emailed to ${to}`);

    res.json({ message: 'Email sent successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error sending email' });
  }
});

export default router;
