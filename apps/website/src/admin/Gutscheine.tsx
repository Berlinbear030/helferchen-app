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

interface Voucher {
  id: string;
  code: string;
  label: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  actual_uses: number;
  active: boolean;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

function fmtDate(dt: string | null) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('de-DE');
}

function fmtDiscount(v: Voucher) {
  return v.discount_type === 'percent'
    ? `${v.discount_value} %`
    : `${Number(v.discount_value).toFixed(2).replace('.', ',')} €`;
}

export default function Gutscheine() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  const [label, setLabel] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [count, setCount] = useState('1');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch<Voucher[]>('/vouchers');
      setVouchers(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !discountValue) return;
    setGenerating(true);
    setGeneratedCodes([]);
    try {
      const res = await apiFetch<{ created: number; codes: string[] }>('/vouchers/generate', {
        method: 'POST',
        body: JSON.stringify({
          label,
          discount_type: discountType,
          discount_value: parseFloat(discountValue),
          count: parseInt(count) || 1,
          max_uses: maxUses ? parseInt(maxUses) : null,
          expires_at: expiresAt || null,
          notes: notes || null,
        }),
      });
      setGeneratedCodes(res.codes);
      await load();
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleActive = async (v: Voucher) => {
    try {
      await apiFetch(`/vouchers/${v.id}`, { method: 'PATCH', body: JSON.stringify({ active: !v.active }) });
      setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, active: !v.active } : x));
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    }
  };

  const handleDelete = async (v: Voucher) => {
    if (!window.confirm(`Gutschein "${v.code}" wirklich löschen?`)) return;
    try {
      await apiFetch(`/vouchers/${v.id}`, { method: 'DELETE' });
      setVouchers(prev => prev.filter(x => x.id !== v.id));
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    }
  };

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const link = document.createElement('a');
    link.href = `${API_BASE}/vouchers/export`;
    link.setAttribute('download', 'gutscheine.csv');
    // pass auth via URL trick: redirect then download
    fetch(`${API_BASE}/vouchers/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 2000);
      });
  };

  const filtered = vouchers.filter(v => {
    if (filterActive === 'active' && !v.active) return false;
    if (filterActive === 'inactive' && v.active) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!v.code.toLowerCase().includes(q) && !v.label.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const resetForm = () => {
    setLabel(''); setDiscountValue(''); setCount('1');
    setMaxUses(''); setExpiresAt(''); setNotes('');
    setDiscountType('percent'); setGeneratedCodes([]);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Gutscheine & Rabattcodes</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn-primary" style={{ padding: '0.4rem 1rem' }} onClick={() => { setShowForm(f => !f); setGeneratedCodes([]); }}>
            {showForm ? '✕ Schließen' : '+ Gutschein erstellen'}
          </button>
          <button
            style={{ padding: '0.4rem 1rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}
            onClick={handleExport}
          >
            CSV herunterladen
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Neuen Gutschein generieren</h3>
          <form onSubmit={handleGenerate}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <div className="form-row">
                <label>Bezeichnung *</label>
                <input value={label} onChange={e => setLabel(e.target.value)} placeholder="z.B. 5% Neukundenrabatt" required />
              </div>
              <div className="form-row">
                <label>Rabatttyp *</label>
                <select value={discountType} onChange={e => setDiscountType(e.target.value as 'percent' | 'fixed')}>
                  <option value="percent">Prozent (%)</option>
                  <option value="fixed">Festbetrag (€)</option>
                </select>
              </div>
              <div className="form-row">
                <label>Rabattwert *</label>
                <input type="number" min="0.01" step="0.01" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percent' ? '5' : '10.00'} required />
              </div>
              <div className="form-row">
                <label>Anzahl generieren</label>
                <input type="number" min="1" max="500" value={count} onChange={e => setCount(e.target.value)} />
              </div>
              <div className="form-row">
                <label>Max. Nutzungen (leer = unbegrenzt)</label>
                <input type="number" min="1" value={maxUses} onChange={e => setMaxUses(e.target.value)} placeholder="unbegrenzt" />
              </div>
              <div className="form-row">
                <label>Ablaufdatum</label>
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <label>Notizen</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Interne Notiz" />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn-primary" disabled={generating}>
                {generating ? 'Generiert…' : `${parseInt(count) > 1 ? `${count} Gutscheine` : 'Gutschein'} erstellen`}
              </button>
              <button type="button" onClick={resetForm} style={{ padding: '0.4rem 0.75rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
                Zurücksetzen
              </button>
            </div>
          </form>

          {generatedCodes.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
              <strong style={{ color: '#15803d' }}>✓ {generatedCodes.length} Code{generatedCodes.length > 1 ? 's' : ''} erstellt</strong>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: 200, overflowY: 'auto' }}>
                {generatedCodes.map(c => (
                  <code key={c} style={{ background: 'white', border: '1px solid #d1fae5', padding: '2px 8px', borderRadius: 4, fontSize: '0.85rem', fontFamily: 'monospace' }}>{c}</code>
                ))}
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#16a34a' }}>
                CSV herunterladen um alle Codes zu exportieren.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className="admin-search"
          style={{ marginBottom: 0 }}
          placeholder="Code oder Bezeichnung suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={filterActive}
          onChange={e => setFilterActive(e.target.value as any)}
          style={{ padding: '0.4rem 0.6rem', border: '1px solid #ced4da', borderRadius: 4, fontSize: '0.9rem' }}
        >
          <option value="all">Alle</option>
          <option value="active">Aktiv</option>
          <option value="inactive">Deaktiviert</option>
        </select>
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{filtered.length} Codes</span>
      </div>

      {loading ? (
        <p>Lädt…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#6b7280' }}>Keine Gutscheine gefunden.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Bezeichnung</th>
                <th>Rabatt</th>
                <th>Nutzungen</th>
                <th>Ablauf</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>
                    <code style={{ fontFamily: 'monospace', fontSize: '0.9rem', background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>
                      {v.code}
                    </code>
                  </td>
                  <td>{v.label}</td>
                  <td>{fmtDiscount(v)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {v.actual_uses}{v.max_uses ? ` / ${v.max_uses}` : ''}
                  </td>
                  <td>{fmtDate(v.expires_at)}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: v.active ? '#dcfce7' : '#fee2e2',
                      color: v.active ? '#15803d' : '#dc2626',
                    }}>
                      {v.active ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => handleToggleActive(v)}
                      style={{
                        padding: '3px 8px', fontSize: '0.78rem', border: 'none', borderRadius: 4, cursor: 'pointer',
                        background: v.active ? '#fef3c7' : '#d1fae5',
                        color: v.active ? '#92400e' : '#065f46',
                      }}
                    >
                      {v.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button className="btn-danger-sm" onClick={() => handleDelete(v)}>Löschen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
