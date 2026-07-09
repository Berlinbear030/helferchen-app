import { useEffect, useState } from 'react';
import '../index.css';

const API = '/api';

interface ShopArticle {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  active: boolean;
}

interface CartItem extends ShopArticle {
  quantity: number;
}

function ArticleCard({ article, onAdd }: { article: ShopArticle; onAdd: (a: ShopArticle) => void }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
      {article.image_url ? (
        <img src={article.image_url} alt={article.name} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '200px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem' }}>🛍</div>
      )}
      <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>{article.name}</h3>
        {article.description && <p style={{ margin: 0, fontSize: '0.875rem', color: '#6B7280', flex: 1 }}>{article.description}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#00454A' }}>{article.price.toFixed(2)} €</span>
          <button
            className="btn-primary btn-sm"
            onClick={() => onAdd(article)}
            disabled={article.stock === 0}
            style={{ padding: '6px 16px' }}
          >
            {article.stock === 0 ? 'Ausverkauft' : 'In den Warenkorb'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cart({ items, onRemove, onCheckout }: { items: CartItem[]; onRemove: (id: string) => void; onCheckout: () => void }) {
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  if (items.length === 0) return null;

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '16px', width: '300px', zIndex: 100 }}>
      <h4 style={{ margin: '0 0 12px', color: '#00454A' }}>Warenkorb ({items.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px', maxHeight: '200px', overflowY: 'auto' }}>
        {items.map(i => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
            <span>{i.name} × {i.quantity}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>{(i.price * i.quantity).toFixed(2)} €</span>
              <button onClick={() => onRemove(i.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '1rem' }}>×</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '12px' }}>
        <span>Gesamt</span>
        <span>{total.toFixed(2)} €</span>
      </div>
      <button className="btn-primary" style={{ width: '100%' }} onClick={onCheckout}>Jetzt bestellen</button>
    </div>
  );
}

function CheckoutModal({ items, onClose, onSuccess }: { items: CartItem[]; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/shop/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.name,
          customerEmail: form.email,
          items: items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
        }),
      });
      if (!res.ok) throw new Error();
      onSuccess();
    } catch {
      setError('Fehler beim Absenden. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '32px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 20px', color: '#00454A' }}>Bestellung abschließen</h3>
        <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
          {items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '4px' }}>
              <span>{i.name} × {i.quantity}</span>
              <span>{(i.price * i.quantity).toFixed(2)} €</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #E5E7EB', marginTop: '8px', paddingTop: '8px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>Gesamt</span>
            <span>{total.toFixed(2)} €</span>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.875rem' }}>Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '0.875rem' }}>E-Mail *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: '#EF4444', fontSize: '0.875rem', marginBottom: '12px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1 }}>Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 1 }}>{submitting ? 'Wird gesendet…' : 'Bestellung absenden'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Shop() {
  const [articles, setArticles] = useState<ShopArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [ordered, setOrdered] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API}/shop/articles`)
      .then(r => r.json())
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  const addToCart = (article: ShopArticle) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === article.id);
      if (existing) return prev.map(i => i.id === article.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...article, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(i => i.id !== id));

  if (ordered) {
    return (
      <div style={{ minHeight: '100vh', background: '#f4f6f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', background: '#fff', padding: '48px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>✅</div>
          <h2 style={{ color: '#00454A', margin: '0 0 12px' }}>Bestellung erfolgreich!</h2>
          <p style={{ color: '#6B7280', margin: '0 0 24px' }}>Ihre Bestellung wurde aufgenommen. Wir melden uns bei Ihnen.</p>
          <button className="btn-primary" onClick={() => { setOrdered(false); setCart([]); }}>Weiter einkaufen</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9' }}>
      {/* Header */}
      <header style={{ background: '#00454A', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/" style={{ color: '#a7d7d9', fontSize: '0.875rem', textDecoration: 'none' }}>← Zurück zur Startseite</a>
          <span style={{ color: '#a7d7d9' }}>|</span>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>Helferchen Werbeartikel</span>
        </div>
        {token && (
          <a href="/portal" style={{ color: '#a7d7d9', fontSize: '0.875rem', textDecoration: 'none' }}>Mitarbeiterportal →</a>
        )}
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ color: '#111827', marginBottom: '8px' }}>Werbeartikel-Shop</h1>
        <p style={{ color: '#6B7280', marginBottom: '32px' }}>Helferchen-Werbematerial für Mitarbeiter und Partner.</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>Artikel werden geladen…</div>
        ) : articles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9CA3AF' }}>
            <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🛍</div>
            <p>Noch keine Artikel verfügbar. Schauen Sie bald wieder vorbei!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
            {articles.map(a => (
              <ArticleCard key={a.id} article={a} onAdd={addToCart} />
            ))}
          </div>
        )}
      </div>

      <Cart items={cart} onRemove={removeFromCart} onCheckout={() => setShowCheckout(true)} />

      {showCheckout && (
        <CheckoutModal
          items={cart}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => { setShowCheckout(false); setOrdered(true); }}
        />
      )}
    </div>
  );
}
