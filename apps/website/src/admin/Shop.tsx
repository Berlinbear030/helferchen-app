import { useEffect, useState, useCallback } from 'react';
import { adminApi, ShopArticle, ShopOrder } from './api';

function fmtDate(dt: string) {
  return new Date(dt).toLocaleString('de-DE');
}

function fmtPrice(v: number) {
  return `${Number(v).toFixed(2).replace('.', ',')} €`;
}

const emptyForm = { name: '', description: '', price: '', image_url: '', stock: '0' };

function ArticlesTab() {
  const [articles, setArticles] = useState<ShopArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setArticles(await adminApi.getShopArticles());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (a: ShopArticle) => {
    setEditingId(a.id);
    setForm({ name: a.name, description: a.description, price: String(a.price), image_url: a.image_url, stock: String(a.stock) });
    setShowForm(true);
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name: form.name, description: form.description, price: parseFloat(form.price) || 0, image_url: form.image_url, stock: parseInt(form.stock) || 0 };
      if (editingId) {
        await adminApi.updateShopArticle(editingId, payload);
      } else {
        await adminApi.createShopArticle(payload);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (a: ShopArticle) => {
    try {
      await adminApi.updateShopArticle(a.id, { active: !a.active });
      setArticles(prev => prev.map(x => x.id === a.id ? { ...x, active: !x.active } : x));
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    }
  };

  const remove = async (a: ShopArticle) => {
    if (!window.confirm(`Artikel "${a.name}" wirklich löschen?`)) return;
    try {
      await adminApi.deleteShopArticle(a.id);
      setArticles(prev => prev.filter(x => x.id !== a.id));
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>Artikel im Werbeartikel-Shop (öffentlich unter /werbeartikel sichtbar, wenn aktiv).</p>
        <button className="btn-primary" style={{ padding: '0.4rem 1rem' }} onClick={() => showForm ? setShowForm(false) : startCreate()}>
          {showForm ? '✕ Schließen' : '+ Neuer Artikel'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="admin-form" style={{ maxWidth: 600 }}>
          <h3>{editingId ? 'Artikel bearbeiten' : 'Neuen Artikel anlegen'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-row">
              <label>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="form-row">
              <label>Preis (€) *</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <label>Beschreibung</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-row">
              <label>Bild-URL</label>
              <input type="url" value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="form-row">
              <label>Lagerbestand</label>
              <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Speichern…' : 'Artikel speichern'}</button>
        </form>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Lädt…</p>
      ) : articles.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '1rem 0' }}>Noch keine Artikel vorhanden. Legen Sie den ersten an.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Preis</th>
                <th>Bestand</th>
                <th>Bild</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {articles.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td>{fmtPrice(a.price)}</td>
                  <td>{a.stock}</td>
                  <td>{a.image_url ? '✓' : <span style={{ color: '#dc2626' }}>fehlt</span>}</td>
                  <td>
                    <span className={`badge ${a.active ? 'badge--success' : 'badge--neutral'}`}>{a.active ? 'Aktiv' : 'Inaktiv'}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => startEdit(a)}
                      style={{ padding: '3px 8px', fontSize: '0.78rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', background: '#fff' }}
                    >
                      Bearbeiten
                    </button>
                    <button
                      onClick={() => toggleActive(a)}
                      style={{ padding: '3px 8px', fontSize: '0.78rem', border: 'none', borderRadius: 4, cursor: 'pointer', background: a.active ? '#fef3c7' : '#d1fae5', color: a.active ? '#92400e' : '#065f46' }}
                    >
                      {a.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button className="btn-danger-sm" onClick={() => remove(a)}>Löschen</button>
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

function OrdersTab() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'new' | 'done'>('new');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOrders(await adminApi.getShopOrders());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markDone = async (o: ShopOrder) => {
    try {
      const updated = await adminApi.updateShopOrderStatus(o.id, o.status === 'new' ? 'done' : 'new');
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: updated.status } : x));
    } catch (e: any) {
      alert('Fehler: ' + e.message);
    }
  };

  const newOrders = orders.filter(o => o.status === 'new');
  const doneOrders = orders.filter(o => o.status === 'done');
  const list = tab === 'new' ? newOrders : doneOrders;

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        {[
          { key: 'new', label: `Neu (${newOrders.length})`, color: '#d97706' },
          { key: 'done', label: `Erledigt (${doneOrders.length})`, color: '#15803d' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'new' | 'done')}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? `3px solid ${t.color}` : '3px solid transparent',
              color: tab === t.key ? t.color : '#6b7280',
              fontWeight: tab === t.key ? 700 : 400,
              fontSize: '0.9rem',
              cursor: 'pointer',
              marginBottom: '-2px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Lädt…</p>
      ) : list.length === 0 ? (
        <p style={{ color: '#6b7280', padding: '1rem 0' }}>
          {tab === 'new' ? 'Keine neuen Bestellungen.' : 'Noch keine erledigten Bestellungen.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {list.map(o => (
            <div key={o.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <strong>{o.customer_name}</strong>
                  <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>{o.customer_email}</div>
                  <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{fmtDate(o.created_at)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{fmtPrice(o.total)}</div>
                  <button
                    onClick={() => markDone(o)}
                    style={{ marginTop: '0.4rem', padding: '3px 10px', fontSize: '0.78rem', border: 'none', borderRadius: 4, cursor: 'pointer', background: o.status === 'new' ? '#d1fae5' : '#f3f4f6', color: o.status === 'new' ? '#065f46' : '#6b7280' }}
                  >
                    {o.status === 'new' ? '✓ Als erledigt markieren' : '↺ Als neu markieren'}
                  </button>
                </div>
              </div>
              <table className="admin-table" style={{ boxShadow: 'none' }}>
                <thead>
                  <tr><th>Artikel</th><th>Menge</th><th>Preis</th></tr>
                </thead>
                <tbody>
                  {o.items.map((i, idx) => (
                    <tr key={idx}>
                      <td>{i.name}</td>
                      <td>{i.quantity}</td>
                      <td>{fmtPrice(i.price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Shop() {
  const [tab, setTab] = useState<'orders' | 'articles'>('orders');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Werbeartikel-Shop</h2>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={tab === 'orders' ? 'btn-primary' : ''}
          style={tab === 'orders' ? { padding: '0.4rem 1rem' } : { padding: '0.4rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          onClick={() => setTab('orders')}
        >
          Bestellungen
        </button>
        <button
          className={tab === 'articles' ? 'btn-primary' : ''}
          style={tab === 'articles' ? { padding: '0.4rem 1rem' } : { padding: '0.4rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
          onClick={() => setTab('articles')}
        >
          Artikel verwalten
        </button>
      </div>
      {tab === 'orders' ? <OrdersTab /> : <ArticlesTab />}
    </div>
  );
}
