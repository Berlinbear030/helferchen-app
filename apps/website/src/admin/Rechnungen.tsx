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

function printInvoice(inv: Invoice, items: InvoiceItem[]) {
  const totalItems = items.reduce((s, it) => s + Number(it.quantity) * Number(it.unit_price), 0);
  const grossAmount = inv.invoice_amount_override != null ? Number(inv.invoice_amount_override) : Number(inv.total_price ?? totalItems);
  const voucherDiscount = inv.voucher_discount_amount ? Number(inv.voucher_discount_amount) : 0;
  const amount = Math.max(0, grossAmount - voucherDiscount);
  const invoiceNum = inv.invoice_number || `RE-${inv.id.slice(-8).toUpperCase()}`;
  const html = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Rechnung ${invoiceNum}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#222;margin:0;padding:40px}
  .header{display:flex;justify-content:space-between;margin-bottom:30px}
  .company{font-size:14px;font-weight:bold}
  .invoice-meta{text-align:right}
  .bill-section{display:flex;justify-content:space-between;margin:20px 0 30px}
  .bill-to h4,.bill-from h4{margin:0 0 6px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th{background:#f5f5f5;text-align:left;padding:8px;border-bottom:2px solid #ccc;font-size:11px}
  td{padding:8px;border-bottom:1px solid #eee}
  .amount-row td{font-weight:bold;border-top:2px solid #ccc;font-size:13px}
  .notes{margin-top:20px;padding:12px;background:#fafafa;border-left:3px solid #ccc}
  .footer{margin-top:40px;text-align:center;font-size:10px;color:#999}
  @media print{.no-print{display:none}}
</style>
</head>
<body>
<div class="header">
  <div class="company">Helferchen<br><span style="font-weight:normal;font-size:11px">Ihr Haushaltsservice</span></div>
  <div class="invoice-meta">
    <strong>Rechnung ${invoiceNum}</strong><br>
    Datum: ${fmtDate(inv.created_at)}<br>
    ${inv.start_time ? `Leistungsdatum: ${fmtDate(inv.start_time)}` : ''}
  </div>
</div>
<div class="bill-section">
  <div class="bill-from">
    <h4>Von</h4>
    Helferchen GmbH<br>
    info@helferchen.info
    ${inv.employee_name ? `<br>Mitarbeiter: ${inv.employee_name}` : ''}
  </div>
  <div class="bill-to">
    <h4>An</h4>
    <strong>${inv.customer_name || 'Kunde'}</strong><br>
    ${inv.customer_address || ''}
  </div>
</div>
<table>
  <thead><tr><th>#</th><th>Beschreibung</th><th style="text-align:right">Menge</th><th style="text-align:right">Einzelpreis</th><th style="text-align:right">Gesamt</th></tr></thead>
  <tbody>
    ${items.length > 0 ? items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.description}</td>
      <td style="text-align:right">${it.quantity}</td>
      <td style="text-align:right">${it.unit_price.toFixed(2).replace('.', ',')} €</td>
      <td style="text-align:right">${(it.quantity * it.unit_price).toFixed(2).replace('.', ',')} €</td>
    </tr>`).join('') : `
    <tr>
      <td>1</td>
      <td>Haushaltsservice — ${inv.assignment_title || 'Dienstleistung'}${inv.duration_minutes ? ` (${fmtDuration(inv.duration_minutes)})` : ''}</td>
      <td style="text-align:right">1</td>
      <td style="text-align:right">${grossAmount.toFixed(2).replace('.', ',')} €</td>
      <td style="text-align:right">${grossAmount.toFixed(2).replace('.', ',')} €</td>
    </tr>`}
    ${voucherDiscount > 0 ? `<tr style="color:#16a34a"><td colspan="4">Gutschein: ${inv.voucher_label || inv.voucher_code} (${inv.voucher_code})</td><td style="text-align:right">−${voucherDiscount.toFixed(2).replace('.', ',')} €</td></tr>` : ''}
    <tr class="amount-row"><td colspan="4">Gesamtbetrag (inkl. MwSt.)</td><td style="text-align:right">${amount.toFixed(2).replace('.', ',')} €</td></tr>
  </tbody>
</table>
${inv.invoice_notes ? `<div class="notes"><strong>Notizen:</strong><br>${inv.invoice_notes}</div>` : ''}
<div class="footer">Helferchen — Danke für Ihr Vertrauen!</div>
<script>window.print();</script>
</body></html>`;
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
