import { useState } from 'react';
import '../index.css';

const API = '/api';

function BookingPortal() {
  const today = new Date().toISOString().slice(0, 10);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    preferred_date: '',
    preferred_time: '',
    service_description: '',
    name: '',
    phone: '',
    email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/booking-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      setError('Fehler beim Absenden. Bitte rufen Sie uns an.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="booking-success">
        <div className="booking-success-icon">✓</div>
        <h3>Anfrage eingegangen!</h3>
        <p>Wir melden uns innerhalb von 24 Stunden bei Ihnen.</p>
        <button className="btn-primary" onClick={() => { setSubmitted(false); setStep(1); setForm({ preferred_date: '', preferred_time: '', service_description: '', name: '', phone: '', email: '' }); }}>
          Weitere Anfrage
        </button>
      </div>
    );
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <div className="booking-steps">
        {([1, 2, 3] as const).map(s => (
          <div key={s} className={`booking-step-item ${step === s ? 'active' : step > s ? 'done' : ''}`}>
            <span className="step-dot">{step > s ? '✓' : s}</span>
            <span>{s === 1 ? 'Termin' : s === 2 ? 'Leistung' : 'Kontakt'}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="booking-panel">
          <h3>Wann sollen wir kommen?</h3>
          <label>Datum wählen</label>
          <input type="date" min={today} value={form.preferred_date} onChange={e => set('preferred_date', e.target.value)} required />
          <label>Uhrzeit wählen</label>
          <div className="time-slot-grid">
            {timeSlots.map(t => (
              <button type="button" key={t} className={`time-slot ${form.preferred_time === t ? 'selected' : ''}`} onClick={() => set('preferred_time', t)}>
                {t} Uhr
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary btn-lg booking-next" disabled={!form.preferred_date || !form.preferred_time} onClick={() => setStep(2)}>
            Weiter →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="booking-panel">
          <h3>Was kann ich für Sie tun?</h3>
          <label>Bitte beschreiben Sie Ihr Anliegen</label>
          <textarea
            placeholder="z.B. Hilfe beim Einrichten des Smartphones, TV-Sender sortieren, Fenster putzen…"
            value={form.service_description}
            onChange={e => set('service_description', e.target.value)}
            rows={5}
            required
          />
          <div className="booking-nav">
            <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Zurück</button>
            <button type="button" className="btn-primary" disabled={!form.service_description.trim()} onClick={() => setStep(3)}>Weiter →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="booking-panel">
          <h3>Ihre Kontaktdaten</h3>
          <label>Name *</label>
          <input type="text" placeholder="Ihr vollständiger Name" value={form.name} onChange={e => set('name', e.target.value)} required />
          <label>Telefon *</label>
          <input type="tel" placeholder="Ihre Telefonnummer" value={form.phone} onChange={e => set('phone', e.target.value)} required />
          <label>E-Mail (optional)</label>
          <input type="email" placeholder="ihre@email.de" value={form.email} onChange={e => set('email', e.target.value)} />
          <div className="booking-summary">
            <strong>Zusammenfassung:</strong>
            <span>📅 {form.preferred_date} um {form.preferred_time} Uhr</span>
            <span>📝 {form.service_description.slice(0, 60)}{form.service_description.length > 60 ? '…' : ''}</span>
          </div>
          {error && <p className="booking-error">{error}</p>}
          <div className="booking-nav">
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>← Zurück</button>
            <button type="submit" className="btn-primary" disabled={submitting || !form.name || !form.phone}>
              {submitting ? 'Wird gesendet…' : 'Anfrage absenden'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function PublicHome() {
  const phoneNumber = "030 / 123 456 78";
  const phoneHref = "tel:03012345678";
  const [showBooking, setShowBooking] = useState(false);

  const scrollToBooking = () => {
    setShowBooking(true);
    setTimeout(() => document.getElementById('buchen')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <img src="/logo.png" alt="Helferchen" className="header-logo" />
          </div>
          <nav className="nav-links">
            <a href="#leistungen">Leistungen</a>
            <a href="#buchen">Termin</a>
            <a href="#preise">Preise</a>
            <a href="/login" className="btn-secondary">Mitarbeiter-Login</a>
          </nav>
          <button onClick={scrollToBooking} className="btn-primary header-cta">Jetzt buchen</button>
        </div>
      </header>

      {/* HERO */}
      <div className="hero-wrapper">
        <section className="hero container">
          <div className="hero-content">
            <span className="badge">Ihr Helfer vor Ort</span>
            <h1>Technik-Probleme?<br />Haushalt zu viel?</h1>
            <p className="hero-sub">
              Wir kommen zu Ihnen nach Hause — kompetent,
              geduldig und ohne Fachchinesisch.
            </p>
            <div className="hero-cta-row">
              <button className="btn-primary btn-lg" onClick={scrollToBooking}>Jetzt Termin buchen</button>
              <a href={phoneHref} className="btn-secondary btn-lg">{phoneNumber}</a>
            </div>
            <p className="hero-hint">Mo–Fr · 9–17 Uhr</p>
          </div>
          <div className="hero-visual">
            <div className="hero-img-placeholder">
              <span style={{ fontSize: '4rem' }}>🏘️</span>
              <p>Ihr Helfer aus der Nachbarschaft</p>
            </div>
            <div className="floating-card">
              <span>⭐</span>
              <div>
                <strong>Ihre Nachbarschaftshilfe</strong>
                <p>Persönlich &amp; zuverlässig</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* STATS */}
      <div className="stats-bar">
        <div className="stat"><strong>20 €</strong><span>erste 15 Minuten</span></div>
        <div className="stat"><strong>Heute</strong><span>noch verfügbar</span></div>
        <div className="stat"><strong>Kein</strong><span>Abo-Vertrag</span></div>
        <div className="stat"><strong>100 %</strong><span>aus der Nachbarschaft</span></div>
      </div>

      {/* BOOKING PORTAL */}
      <section className="section booking-section" id="buchen">
        <div className="container">
          <span className="section-badge">Termin vereinbaren</span>
          <h2 className="section-heading">Jetzt Termin buchen</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-mid)', marginBottom: 32 }}>
            Wählen Sie Ihren Wunschtermin — wir melden uns zur Bestätigung.
          </p>
          {!showBooking ? (
            <div style={{ textAlign: 'center' }}>
              <button className="btn-primary btn-xl" onClick={() => setShowBooking(true)}>Termin anfragen</button>
              <p style={{ marginTop: 16, color: 'var(--text-mid)' }}>Oder rufen Sie uns an: <a href={phoneHref}>{phoneNumber}</a></p>
            </div>
          ) : (
            <BookingPortal />
          )}
        </div>
      </section>

      {/* SERVICES */}
      <section className="section" id="leistungen">
        <div className="container">
          <span className="section-badge">Unsere Leistungen</span>
          <h2 className="section-heading">Was wir für Sie tun</h2>
          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon-wrap">🖥️</div>
              <div className="service-body">
                <h3>Technik-Hilfe</h3>
                <ul>
                  <li>TV, Fernbedienung &amp; WLAN einrichten</li>
                  <li>Handy, Tablet &amp; Computer</li>
                  <li>WhatsApp &amp; Videotelefonie</li>
                  <li>Sicher im Internet surfen</li>
                </ul>
              </div>
            </div>
            <div className="service-card">
              <div className="service-icon-wrap">🧹</div>
              <div className="service-body">
                <h3>Alltagshilfe</h3>
                <ul>
                  <li>Fensterputzen &amp; leichte Reinigung</li>
                  <li>Einkaufen &amp; Terminbegleitung</li>
                  <li>Gardinen &amp; Leuchtmittel wechseln</li>
                  <li>Gartenpflege &amp; kleine Reparaturen</li>
                </ul>
              </div>
            </div>
            <div className="service-card">
              <div className="service-icon-wrap">📋</div>
              <div className="service-body">
                <h3>Behörden &amp; Formulare</h3>
                <ul>
                  <li>Online-Anträge ausfüllen</li>
                  <li>Behördenpost verstehen</li>
                  <li>Bankgeschäfte online erledigen</li>
                  <li>Renten- &amp; Kassenformulare</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section how-section">
        <div className="container">
          <span className="section-badge">Einfach &amp; Unkompliziert</span>
          <h2 className="section-heading">So funktioniert's</h2>
          <div className="steps-row">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Termin buchen</h3>
              <p>Wählen Sie online Ihren Wunschtermin oder rufen Sie uns an.</p>
            </div>
            <div className="step-divider" />
            <div className="step">
              <div className="step-num">2</div>
              <h3>Helfer kommt</h3>
              <p>Ihr persönlicher Helfer aus der Nachbarschaft kommt pünktlich zu Ihnen.</p>
            </div>
            <div className="step-divider" />
            <div className="step">
              <div className="step-num">3</div>
              <h3>Problem gelöst</h3>
              <p>Sie zahlen nur für die tatsächlich benötigte Zeit — keine Überraschungen.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="section pricing-section" id="preise">
        <div className="container">
          <span className="section-badge">Transparente Preise</span>
          <h2 className="section-heading">Faire Abrechnung</h2>
          <div className="pricing-card">
            <div className="pricing-top">
              <div className="price-block">
                <span className="price-big">20 €</span>
                <span className="price-label">erste 15 Min.<br /><small>inkl. Anfahrt</small></span>
              </div>
              <span className="price-plus">+</span>
              <div className="price-block">
                <span className="price-big">15 €</span>
                <span className="price-label">je weitere<br />15 Min.</span>
              </div>
            </div>
            <ul className="price-features">
              <li>Keine Grundgebühr</li>
              <li>Keine Abo-Falle</li>
              <li>Barzahlung möglich</li>
              <li>Keine Mindestbuchung</li>
            </ul>
            <button className="btn-primary btn-lg" onClick={scrollToBooking}>Jetzt Termin buchen</button>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="trust-section">
        <div className="container" style={{ textAlign: 'center' }}>
          <span className="section-badge">Warum Helferchen?</span>
          <h2 style={{ marginBottom: 32 }}>Ihr Helfer aus der Nachbarschaft</h2>
          <div className="trust-list">
            <div className="trust-item">
              <span className="trust-icon">🏘️</span>
              <div><h3>Nah bei Ihnen</h3><p>Alle Helfer kommen aus Ihrer Nachbarschaft.</p></div>
            </div>
            <div className="trust-item">
              <span className="trust-icon">🔒</span>
              <div><h3>Geprüft &amp; vertrauenswürdig</h3><p>Alle Helfer sind persönlich bekannt und sorgfältig ausgewählt.</p></div>
            </div>
            <div className="trust-item">
              <span className="trust-icon">⚡</span>
              <div><h3>Flexibel &amp; schnell</h3><p>Oft noch am selben Tag — kein Papierkram, kein Warten.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner container">
          <img src="/logo.png" alt="Helferchen" className="footer-logo-img" />
          <div className="footer-links">
            <a href="#">Impressum</a>
            <a href="#">Datenschutz</a>
            <a href={phoneHref}>{phoneNumber}</a>
          </div>
          <p className="footer-copy">© 2026 Helferchen · noreply@helferchen.info</p>
        </div>
      </footer>

    </div>
  );
}

export default PublicHome;
