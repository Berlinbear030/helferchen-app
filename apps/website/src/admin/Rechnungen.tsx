import { useEffect, useState, useCallback } from 'react';

const API_BASE = '/api';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...authHeaders(), ...(options?.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

interface Invoice {
  id: string;
  assignment_id: string;
  timelog_id: string;
  created_by_user_id: string;
  notes: string | null;
  signature_id: string | null;
  invoice_number: string | null;
  invoice_notes: string | null;
  invoice_amount_override: number | null;
  voucher_code: string | null;
  voucher_label: string | null;
  voucher_discount_amount: number | null;
  payment_method: string | null;
  payment_due_days: number | null;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  total_price: number | null;
  customer_name: string | null;
  customer_address: string | null;
  employee_name: string | null;
  assignment_title: string | null;
  created_at: string;
}

interface InvoiceItem {
  id: string;
  report_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number;
}

function fmtDate(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('de-DE');
}

function fmtMoney(n: number | string | null) {
  if (n == null) return '—';
  return Number(n).toFixed(2).replace('.', ',') + ' €';
}

function fmtDuration(min: number | null) {
  if (min == null) return '—';
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

const IBAN = 'DE12 1005 0000 1064 2171 99';
const BIC = 'BELADEBEXXX';
const STEUERNUMMER = '36/434/00685';
const TAX_RATE = 0.19;

function printInvoice(inv: Invoice, items: InvoiceItem[]) {
  const totalItems = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const grossAmount = inv.invoice_amount_override != null ? Number(inv.invoice_amount_override) : Number(inv.total_price ?? totalItems);
  const voucherDiscount = inv.voucher_discount_amount ? Number(inv.voucher_discount_amount) : 0;
  const amount = Math.max(0, grossAmount - voucherDiscount);
  const netto = amount / (1 + TAX_RATE);
  const mwst = amount - netto;
  const invoiceNum = inv.invoice_number || `RE-${inv.id.slice(-8).toUpperCase()}`;
  const paymentMethod = inv.payment_method || 'bar';
  const dueDays = inv.payment_due_days ?? 14;

  const dueDate = (() => {
    const d = new Date(inv.created_at);
    d.setDate(d.getDate() + dueDays);
    return d.toLocaleDateString('de-DE');
  })();

  const itemRows = items.length > 0
    ? items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.description}</td>
        <td class="r">${Number(it.quantity).toFixed(2).replace('.', ',')}</td>
        <td class="r">${Number(it.unit_price).toFixed(2).replace('.', ',')} €</td>
        <td class="r">${(Number(it.quantity) * Number(it.unit_price)).toFixed(2).replace('.', ',')} €</td>
      </tr>`).join('')
    : `<tr>
        <td>1</td>
        <td>Haushaltsservice — ${inv.assignment_title || 'Dienstleistung'}${inv.duration_minutes ? ` (${fmtDuration(inv.duration_minutes)})` : ''}</td>
        <td class="r">1</td>
        <td class="r">${grossAmount.toFixed(2).replace('.', ',')} €</td>
        <td class="r">${grossAmount.toFixed(2).replace('.', ',')} €</td>
      </tr>`;

  const discountRow = voucherDiscount > 0
    ? `<tr class="disc">
        <td></td>
        <td>Rabatt: ${inv.voucher_label || inv.voucher_code || 'Gutschein'} (${inv.voucher_code || ''})</td>
        <td></td>
        <td></td>
        <td class="r">−${voucherDiscount.toFixed(2).replace('.', ',')} €</td>
      </tr>`
    : '';

  const paymentBlock = paymentMethod === 'bar'
    ? `<div class="pay-bar">
        <span class="chk">&#x2713;</span>&nbsp;<strong>Bar bezahlt</strong>
        ${inv.signature_id ? `<span class="pay-date">Kassiert am ${fmtDate(inv.created_at)}</span>` : ''}
      </div>`
    : `<div class="pay-bank">
        <strong>Bitte überweisen Sie den Betrag bis zum ${dueDate}:</strong>
        <table>
          <tr><td>Empfänger:</td><td>Helferchen / Fabian Marquardt</td></tr>
          <tr><td>IBAN:</td><td>${IBAN}</td></tr>
          <tr><td>BIC:</td><td>${BIC}</td></tr>
          <tr><td>Verwendungszweck:</td><td>${invoiceNum}</td></tr>
          <tr><td>Zahlungsziel:</td><td>${dueDate} (${dueDays} Tage)</td></tr>
        </table>
      </div>`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Rechnung ${invoiceNum}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1F2937}
  .hdr{background:#fff;text-align:center;padding:18px 50px 0;border-bottom:1px solid #D1D5DB}
  .hdr-name{font-size:32px;font-weight:bold;color:#00454A;padding-bottom:14px}
  .strip{background:#00454A;color:#fff;padding:8px 50px;display:flex;justify-content:space-between;align-items:center}
  .strip-title{font-weight:bold;font-size:11px;letter-spacing:.5px}
  .strip-meta{font-size:9px;color:#E6F4F3;text-align:right}
  .body{padding:20px 50px}
  .parties{display:flex;justify-content:space-between;margin:16px 0 20px}
  .party h4{font-size:8px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
  .party strong{font-size:11px;display:block;margin-bottom:4px}
  .sep{border:0;border-top:1px solid #D1D5DB;margin:14px 0}
  table.items{width:100%;border-collapse:collapse;margin:8px 0}
  table.items th{font-size:8px;color:#6B7280;font-weight:bold;text-transform:uppercase;padding:6px 4px;border-bottom:2px solid #D1D5DB;text-align:left}
  table.items th.r,table.items td.r{text-align:right}
  table.items td{padding:7px 4px;border-bottom:1px solid #E5E7EB;font-size:10px;vertical-align:top}
  table.items tr.disc td{color:#16a34a}
  .tot-box{background:#00454A;color:#fff;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;margin:12px 0}
  .tot-box .lbl{font-weight:bold;font-size:13px}
  .tot-box .detail{text-align:right;font-size:9px;color:#E6F4F3;line-height:1.6}
  .tot-box .detail .main{font-weight:bold;font-size:10px;color:#fff;margin-top:4px}
  .pay-section h4{font-size:8px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;margin-top:16px}
  .pay-bar{background:#F0FDF4;border-left:4px solid #16a34a;padding:10px 16px;color:#15803D;display:flex;align-items:center;gap:10px;font-size:12px}
  .pay-bar .chk{font-size:16px;font-weight:bold}
  .pay-bar .pay-date{font-size:10px;margin-left:auto}
  .pay-bank{background:#FFF7ED;border-left:4px solid #D97706;padding:12px 16px;color:#92400E;font-size:10px}
  .pay-bank strong{display:block;margin-bottom:8px;font-size:11px}
  .pay-bank table{border-collapse:collapse;width:100%}
  .pay-bank table td{padding:2px 8px 2px 0;vertical-align:top}
  .pay-bank table td:first-child{font-weight:bold;white-space:nowrap;width:160px}
  .notes{background:#fafafa;border-left:3px solid #D1D5DB;padding:10px 14px;margin:14px 0;font-size:10px}
  .footer{background:#00454A;color:#fff;padding:10px 50px;text-align:center;font-size:8px;margin-top:30px;line-height:1.8}
  .footer p{color:#E6F4F3}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<div class="hdr"><div class="hdr-name">HELFERCHEN</div></div>
<div class="strip">
  <div class="strip-title">RECHNUNG</div>
  <div class="strip-meta">Rechnungsnummer: ${invoiceNum}&nbsp;&nbsp;·&nbsp;&nbsp;Datum: ${fmtDate(inv.created_at)}${inv.start_time ? `&nbsp;&nbsp;·&nbsp;&nbsp;Leistungsdatum: ${fmtDate(inv.start_time)}` : ''}</div>
</div>
<div class="body">
  <div class="parties">
    <div class="party">
      <h4>Rechnungsempfänger</h4>
      <strong>${inv.customer_name || 'Kunde'}</strong>
      ${(inv.customer_address || '').replace(/\n/g, '<br>')}
    </div>
    <div class="party" style="text-align:right">
      <h4>Von</h4>
      <strong>Helferchen</strong>
      Fabian Marquardt (Geschäftsführer)<br>
      info@helferchen.info<br>
      ${inv.employee_name ? `Bearbeitet von: ${inv.employee_name}` : ''}
    </div>
  </div>
  <hr class="sep">
  <table class="items">
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>Beschreibung</th>
        <th class="r" style="width:70px">Menge</th>
        <th class="r" style="width:110px">Einzelpreis</th>
        <th class="r" style="width:110px">Gesamt</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${discountRow}
    </tbody>
  </table>
  <div class="tot-box">
    <div class="lbl">GESAMTBETRAG</div>
    <div class="detail">
      ${voucherDiscount > 0 ? `<div>Brutto: ${grossAmount.toFixed(2).replace('.', ',')} €</div><div style="color:#86efac">Rabatt: −${voucherDiscount.toFixed(2).replace('.', ',')} €</div>` : ''}
      <div>Netto: ${netto.toFixed(2).replace('.', ',')} €</div>
      <div>inkl. 19 % MwSt.: ${mwst.toFixed(2).replace('.', ',')} €</div>
      <div class="main">GESAMT: ${amount.toFixed(2).replace('.', ',')} €</div>
    </div>
  </div>
  <div class="pay-section">
    <h4>Zahlungsstatus</h4>
    ${paymentBlock}
  </div>
  ${inv.invoice_notes ? `<div class="notes"><strong>Notizen:</strong><br>${inv.invoice_notes}</div>` : ''}
</div>
<div class="footer">
  <p>Fabian Marquardt (Geschäftsführer) &nbsp;·&nbsp; Steuernummer: ${STEUERNUMMER}</p>
  <p>info@helferchen.info &nbsp;·&nbsp; www.helferchen.info</p>
  <p>IBAN: ${IBAN} &nbsp;·&nbsp; BIC: ${BIC} &nbsp;·&nbsp; Rechnungsnummer: ${invoiceNum}</p>
</div>
<script>window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

function ItemRow({ item, onSave, onDelete }: { item: InvoiceItem; onSave: (id: string, fields: Partial<InvoiceItem>) => void; onDelete: (id: string) => void }) {
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(String(item.unit_price));

  const rowTotal = (parseFloat(qty) || 0) * (parseFloat(price) || 0);

  const save = () => {
    onSave(item.id, { description: desc, quantity: parseFloat(qty) || 0, unit_price: parseFloat(price) || 0 });
  };

  return (
    <tr>
      <td><input className="inv-input" value={desc} onChange={e => setDesc(e.target.value)} onBlur={save} /></td>
      <td><input className="inv-input inv-input--num" value={qty} onChange={e => setQty(e.target.value)} onBlur={save} /></td>
      <td><input className="inv-input inv-input--num" value={price} onChange={e => setPrice(e.target.value)} onBlur={save} /></td>
      <td className="inv-td-total">{rowTotal.toFixed(2).replace('.', ',')} €</td>
      <td><button className="inv-btn-del" onClick={() => onDelete(item.id)} title="Zeile löschen">✕</button></td>
    </tr>
  );
}

function InvoiceEditor({ invoice, onBack }: { invoice: Invoice; onBack: () => void }) {
  const [inv, setInv] = useState(invoice);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const paymentMethod = inv.payment_method || 'bar';
  const paymentDueDays = inv.payment_due_days ?? 14;

  useEffect(() => {
    apiFetch<InvoiceItem[]>(`/invoices/${invoice.id}/items`).then(setItems).catch(() => {});
  }, [invoice.id]);

  const patchInvoice = useCallback(async (fields: Partial<Invoice>) => {
    setSaving(true);
    try {
      await apiFetch(`/invoices/${inv.id}`, { method: 'PATCH', body: JSON.stringify(fields) });
      setInv(prev => ({ ...prev, ...fields }));
    } finally {
      setSaving(false);
    }
  }, [inv.id]);

  const addItem = async () => {
    const newItem = await apiFetch<InvoiceItem>(`/invoices/${inv.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ description: 'Neue Position', quantity: 1, unit_price: 0, position: items.length + 1 }),
    });
    setItems(prev => [...prev, newItem]);
  };

  const saveItem = async (id: string, fields: Partial<InvoiceItem>) => {
    await apiFetch(`/invoices/items/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...fields } : it));
  };

  const deleteItem = async (id: string) => {
    await apiFetch(`/invoices/items/${id}`, { method: 'DELETE' });
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const invoiceNum = inv.invoice_number || `RE-${inv.id.slice(-8).toUpperCase()}`;
  const totalItems = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const grossAmount = inv.invoice_amount_override != null ? Number(inv.invoice_amount_override) : Number(inv.total_price ?? totalItems);
  const voucherDiscount = inv.voucher_discount_amount ? Number(inv.voucher_discount_amount) : 0;
  const displayAmount = Math.max(0, grossAmount - voucherDiscount);

  return (
    <div className="inv-editor">
      <div className="inv-editor-nav">
        <button className="btn-portal" onClick={onBack}>← Zurück zur Liste</button>
        <h2 className="inv-editor-title">Rechnung {invoiceNum}</h2>
        <button className="btn-primary" onClick={() => printInvoice(inv, items)}>PDF drucken</button>
      </div>

      <div className="inv-cards">
        <div className="inv-card">
          <h3>Rechnungsdetails</h3>
          <div className="inv-field-grid">
            <label>Rechnungsnummer
              <input className="inv-input" defaultValue={inv.invoice_number || ''} onBlur={e => patchInvoice({ invoice_number: e.target.value || null as any })} placeholder={invoiceNum} />
            </label>
            <label>Datum
              <input className="inv-input" value={fmtDate(inv.created_at)} readOnly />
            </label>
            <label>Leistungsdatum
              <input className="inv-input" value={fmtDate(inv.start_time)} readOnly />
            </label>
            <label>Dauer
              <input className="inv-input" value={fmtDuration(inv.duration_minutes)} readOnly />
            </label>
          </div>
        </div>

        <div className="inv-card">
          <h3>Beteiligte</h3>
          <div className="inv-field-grid">
            <label>Kunde
              <input className="inv-input" value={inv.customer_name || '—'} readOnly />
            </label>
            <label>Adresse
              <input className="inv-input" value={inv.customer_address || '—'} readOnly />
            </label>
            <label>Mitarbeiter
              <input className="inv-input" value={inv.employee_name || '—'} readOnly />
            </label>
            <label>Auftrag
              <input className="inv-input" value={inv.assignment_title || '—'} readOnly />
            </label>
          </div>
        </div>
      </div>

      <div className="inv-card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Positionen</h3>
          <button className="btn-primary" style={{ padding: '4px 12px', fontSize: '0.85rem' }} onClick={addItem}>+ Position hinzufügen</button>
        </div>
        <table className="inv-items-table">
          <thead>
            <tr>
              <th>Beschreibung</th>
              <th style={{ width: '80px' }}>Menge</th>
              <th style={{ width: '110px' }}>Einzelpreis (€)</th>
              <th style={{ width: '110px' }}>Gesamt</th>
              <th style={{ width: '40px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <ItemRow key={it.id} item={it} onSave={saveItem} onDelete={deleteItem} />
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#999', padding: '16px' }}>
                Keine Positionen. Wird automatisch aus Timelog berechnet.
              </td></tr>
            )}
          </tbody>
        </table>
        <div className="inv-total-row">
          <span>Betrag überschreiben (€):</span>
          <input
            className="inv-input inv-input--num"
            style={{ width: '130px' }}
            defaultValue={inv.invoice_amount_override != null ? String(inv.invoice_amount_override) : ''}
            placeholder={displayAmount.toFixed(2)}
            onBlur={e => patchInvoice({ invoice_amount_override: e.target.value ? parseFloat(e.target.value) : null as any })}
          />
          <span className="inv-total-amount">Gesamt: <strong>{displayAmount.toFixed(2).replace('.', ',')} €</strong></span>
        </div>
      </div>

      <div className="inv-card" style={{ marginTop: '1rem' }}>
        <h3>Notizen</h3>
        <textarea
          className="inv-textarea"
          defaultValue={inv.invoice_notes || ''}
          placeholder="Notizen zur Rechnung..."
          onBlur={e => patchInvoice({ invoice_notes: e.target.value })}
        />
      </div>

      <div className="inv-card" style={{ marginTop: '1rem' }}>
        <h3>Zahlungsart</h3>
        <div className="inv-field-grid">
          <label>Zahlungsmethode
            <select
              className="inv-input"
              value={paymentMethod}
              onChange={e => {
                const val = e.target.value;
                setInv(prev => ({ ...prev, payment_method: val }));
                patchInvoice({ payment_method: val } as any);
              }}
            >
              <option value="bar">Barzahlung ✓</option>
              <option value="ueberweisung">Überweisung</option>
            </select>
          </label>
          {paymentMethod === 'ueberweisung' && (
            <label>Zahlungsziel (Tage)
              <input
                className="inv-input inv-input--num"
                type="number"
                min={1}
                max={90}
                value={paymentDueDays}
                onChange={e => {
                  const val = parseInt(e.target.value) || 14;
                  setInv(prev => ({ ...prev, payment_due_days: val }));
                }}
                onBlur={e => patchInvoice({ payment_due_days: parseInt(e.target.value) || 14 } as any)}
              />
            </label>
          )}
        </div>
        {paymentMethod === 'ueberweisung' && (
          <div style={{ marginTop: '0.75rem', padding: '10px 14px', background: '#FFF7ED', borderLeft: '4px solid #D97706', fontSize: '0.85rem', color: '#92400E' }}>
            <strong>Überweisungsblock (erscheint im Druck):</strong><br />
            Empfänger: Helferchen / Fabian Marquardt<br />
            IBAN: DE12 1005 0000 1064 2171 99 &nbsp;|&nbsp; BIC: BELADEBEXXX<br />
            Zahlungsziel: {paymentDueDays} Tage ab Rechnungsdatum
          </div>
        )}
        {paymentMethod === 'bar' && (
          <div style={{ marginTop: '0.75rem', padding: '10px 14px', background: '#F0FDF4', borderLeft: '4px solid #16a34a', fontSize: '0.85rem', color: '#15803D' }}>
            <strong>✓ Bar bezahlt</strong> — Erscheint mit Häkchen im Druck
          </div>
        )}
      </div>

      {saving && <div className="inv-saving">Speichere...</div>}
    </div>
  );
}

export default function Rechnungen() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Invoice | null>(null);

  useEffect(() => {
    apiFetch<Invoice[]>('/invoices').then(setInvoices).catch(e => setError(e.message));
  }, []);

  if (selected) {
    return <InvoiceEditor invoice={selected} onBack={() => setSelected(null)} />;
  }

  const filtered = filter
    ? invoices.filter(i =>
        (i.customer_name || '').toLowerCase().includes(filter.toLowerCase()) ||
        (i.invoice_number || '').toLowerCase().includes(filter.toLowerCase()) ||
        (i.employee_name || '').toLowerCase().includes(filter.toLowerCase())
      )
    : invoices;

  return (
    <div>
      <h2>Rechnungen</h2>
      {error && <p className="error">{error}</p>}
      <input
        className="admin-search"
        placeholder="Nach Kunde, Mitarbeiter oder Rechnungsnummer filtern..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      <table className="admin-table">
        <thead>
          <tr>
            <th>Rechnungsnr.</th>
            <th>Datum</th>
            <th>Kunde</th>
            <th>Mitarbeiter</th>
            <th>Dauer</th>
            <th>Betrag</th>
            <th>Signiert</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(inv => {
            const invoiceNum = inv.invoice_number || `RE-${inv.id.slice(-8).toUpperCase()}`;
            const gross = inv.invoice_amount_override != null ? Number(inv.invoice_amount_override) : (inv.total_price != null ? Number(inv.total_price) : null);
            const voucherDiscount = inv.voucher_discount_amount ? Number(inv.voucher_discount_amount) : 0;
            const amount = gross != null ? Math.max(0, gross - voucherDiscount) : null;
            return (
              <tr key={inv.id}>
                <td>
                  <button className="inv-link" onClick={() => setSelected(inv)}>{invoiceNum}</button>
                </td>
                <td>{fmtDate(inv.created_at)}</td>
                <td>{inv.customer_name || '—'}</td>
                <td>{inv.employee_name || '—'}</td>
                <td>{fmtDuration(inv.duration_minutes)}</td>
                <td>{fmtMoney(amount)}</td>
                <td>
                  {inv.signature_id
                    ? <span className="badge badge--success">✓ Ja</span>
                    : <span className="badge badge--neutral">Nein</span>}
                </td>
                <td>
                  <button className="btn-primary" style={{ padding: '3px 10px', fontSize: '0.8rem' }} onClick={() => setSelected(inv)}>
                    Bearbeiten
                  </button>
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: '#999' }}>Keine Rechnungen gefunden</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
