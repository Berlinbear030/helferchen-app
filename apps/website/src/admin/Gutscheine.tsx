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

function isAvailable(v: Voucher): boolean {
  if (!v.active) return false;
  if (v.max_uses != null && v.used_count >= v.max_uses) return false;
  if (v.expires_at && new Date(v.expires_at) < new Date()) return false;
  return true;
}

function isUsed(v: Voucher): boolean {
  return Number(v.actual_uses) > 0 || !v.active;
}

export default function Gutscheine() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'verfuegbar' | 'verwendet'>('verfuegbar');
  const [search, setSearch] = useState('');

  const [label, setLabel] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [count, setCount] = useState('1');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');

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
      setActiveTab('verfuegbar');
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

  const handleExport = (availableOnly: boolean) => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE}/vouchers/export${availableOnly ? '?available=1' : ''}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = availableOnly ? 'gutscheine-verfuegbar.csv' : 'gutscheine-alle.csv';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(link.href); }, 2000);
      });
  };

  const resetForm = () => {
    setLabel(''); setDiscountValue(''); setCount('1');
    setMaxUses(''); setExpiresAt(''); setNotes('');
    setDiscountType('percent'); setGeneratedCodes([]);
  };

  const verfuegbar = vouchers.filter(v => isAvailable(v) && !isUsed(v));
  const verwendet = vouchers.filter(v => isUsed(v));

  const currentList = (activeTab === 'verfuegbar' ? verfuegbar : verwendet)
    .filter(v => !search || v.code.toLowerCase().includes(search.toLowerCase()) || v.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Gutscheine & Rabattcodes</h2>
        <button className="btn-primary" style={{ padding: '0.4rem 1rem' }} onClick={() => { setShowForm(f => !f); setGeneratedCodes([]); }}>
          {showForm ? '✕ Schließen' : '+ Gutschein erstellen'}
        </button>
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
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => handleExport(true)}
                  style={{ padding: '0.35rem 0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Verfügbare Codes als CSV
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        {[
          { key: 'verfuegbar', label: `Verfügbar (${verfuegbar.length})`, color: '#15803d' },
          { key: 'verwendet', label: `Eingelöst / Deaktiviert (${verwendet.length})`, color: '#dc2626' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? `3px solid ${tab.color}` : '3px solid transparent',
              color: activeTab === tab.key ? tab.color : '#6b7280',
              fontWeight: activeTab === tab.key ? 700 : 400,
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center', paddingBottom: '0.4rem' }}>
          {activeTab === 'verfuegbar' && (
            <button
              onClick={() => handleExport(true)}
              style={{ padding: '0.3rem 0.75rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
            >
              CSV (verfügbar)
            </button>
          )}
          <button
            onClick={() => handleExport(false)}
            style={{ padding: '0.3rem 0.75rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.82rem' }}
          >
            CSV (alle)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          className="admin-search"
          style={{ marginBottom: 0 }}
          placeholder="Code oder Bezeichnung suchen…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{currentList.length} Codes</span>
      </div>

      {loading ? (
        <p>Lädt…</p>
      ) : currentList.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '1rem 0' }}>
          {activeTab === 'verfuegbar' ? 'Keine verfügbaren Gutscheine.' : 'Noch keine eingelösten Gutscheine.'}
        </p>
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
              {currentList.map(v => {
                const avail = isAvailable(v);
                const used = Number(v.actual_uses) > 0;
                let statusLabel = avail ? 'Verfügbar' : (used ? 'Eingelöst' : 'Deaktiviert');
                let statusBg = avail ? '#dcfce7' : (used ? '#fee2e2' : '#f3f4f6');
                let statusColor = avail ? '#15803d' : (used ? '#dc2626' : '#6b7280');

                return (
                  <tr key={v.id}>
                    <td>
                      <code style={{ fontFamily: 'monospace', fontSize: '0.9rem', background: '#f3f4f6', padding: '2px 6px', borderRadius: 3 }}>
                        {v.code}
                      </code>
                    </td>
                    <td>{v.label}</td>
                    <td>{fmtDiscount(v)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {Number(v.actual_uses)}{v.max_uses ? ` / ${v.max_uses}` : ''}
                      {Number(v.actual_uses) > 0 && <span style={{ marginLeft: 4, fontSize: '0.75rem', color: '#dc2626' }}>✓ verwendet</span>}
                    </td>
                    <td>{fmtDate(v.expires_at)}</td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600, background: statusBg, color: statusColor }}>
                        {statusLabel}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
