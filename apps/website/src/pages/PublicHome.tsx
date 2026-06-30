import { useState, useEffect, useRef } from 'react';
import '../index.css';

const API = '/api';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme: string }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

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
    street: '',
    house_number: '',
    zip: '',
    city: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (step !== 3 || !TURNSTILE_SITE_KEY || !turnstileRef.current) return;
    if (widgetIdRef.current) return;

    const renderWidget = () => {
      if (!turnstileRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
        theme: 'light',
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [step]);

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Bitte bestätigen Sie das CAPTCHA.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API}/booking-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || '');
      }
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Fehler beim Absenden. Bitte rufen Sie uns an.';
      setError(msg);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
        setTurnstileToken('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="booking-success" role="status" aria-live="polite">
        <div className="booking-success-icon" aria-hidden="true">✓</div>
        <h3>Anfrage eingegangen!</h3>
        <p>Wir melden uns innerhalb von 24 Stunden bei Ihnen.</p>
        <button className="btn-primary" onClick={() => { setSubmitted(false); setStep(1); setForm({ preferred_date: '', preferred_time: '', service_description: '', name: '', phone: '', email: '', street: '', house_number: '', zip: '', city: '' }); }}>
          Weitere Anfrage
        </button>
      </div>
    );
  }

  return (
    <form className="booking-form" onSubmit={handleSubmit}>
      <div className="booking-steps" role="list" aria-label="Buchungsschritte">
        {([1, 2, 3] as const).map(s => (
          <div
            key={s}
            className={`booking-step-item ${step === s ? 'active' : step > s ? 'done' : ''}`}
            role="listitem"
            aria-current={step === s ? 'step' : undefined}
          >
            <span className="step-dot" aria-hidden="true">{step > s ? '✓' : s}</span>
            <span>{s === 1 ? 'Termin' : s === 2 ? 'Leistung' : 'Kontakt'}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="booking-panel">
          <h3>Wann sollen wir kommen?</h3>
          <label htmlFor="bp-date">Datum wählen</label>
          <input id="bp-date" type="date" min={today} value={form.preferred_date} onChange={e => set('preferred_date', e.target.value)} required />
          <div role="group" aria-labelledby="uhrzeit-label">
            <p id="uhrzeit-label" className="booking-panel-label">Uhrzeit wählen</p>
            <div className="time-slot-grid">
              {timeSlots.map(t => (
                <button
                  type="button"
                  key={t}
                  className={`time-slot ${form.preferred_time === t ? 'selected' : ''}`}
                  aria-pressed={form.preferred_time === t}
                  onClick={() => set('preferred_time', t)}
                >
                  {t} Uhr
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn-primary btn-lg booking-next" disabled={!form.preferred_date || !form.preferred_time} onClick={() => setStep(2)}>
            Weiter →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="booking-panel">
          <h3>Was kann ich für Sie tun?</h3>
          <label htmlFor="bp-desc">Bitte beschreiben Sie Ihr Anliegen</label>
          <textarea
            id="bp-desc"
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
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="bp-name">Name *</label>
              <input id="bp-name" type="text" placeholder="Ihr vollständiger Name" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="bp-phone">Telefon *</label>
              <input id="bp-phone" type="tel" placeholder="Ihre Telefonnummer" value={form.phone} onChange={e => set('phone', e.target.value)} required />
            </div>
          </div>
          <div role="group" aria-labelledby="adresse-label">
            <p id="adresse-label" className="booking-panel-label">Adresse *</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 3 }}>
                <input aria-label="Straße" type="text" placeholder="Straße" value={form.street} onChange={e => set('street', e.target.value)} required />
              </div>
              <div style={{ flex: 1 }}>
                <input aria-label="Hausnummer" type="text" placeholder="Nr." value={form.house_number} onChange={e => set('house_number', e.target.value)} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <div style={{ flex: 1 }}>
                <input aria-label="Postleitzahl" type="text" placeholder="PLZ" value={form.zip} onChange={e => set('zip', e.target.value)} required pattern="[0-9]{5}" title="5-stellige Postleitzahl" maxLength={5} />
              </div>
              <div style={{ flex: 3 }}>
                <input aria-label="Ort" type="text" placeholder="Ort" value={form.city} onChange={e => set('city', e.target.value)} required />
              </div>
            </div>
          </div>
          <label htmlFor="bp-email" style={{ marginTop: '12px', display: 'block' }}>E-Mail (optional, für Bestätigungsmail)</label>
          <input id="bp-email" type="email" placeholder="ihre@email.de" value={form.email} onChange={e => set('email', e.target.value)} />
          <div className="booking-summary" aria-live="polite">
            <strong>Zusammenfassung:</strong>
            <span><span aria-hidden="true">📅</span> {form.preferred_date} um {form.preferred_time} Uhr</span>
            <span><span aria-hidden="true">📍</span> {form.street ? `${form.street} ${form.house_number}, ${form.zip} ${form.city}` : 'Keine Adresse angegeben'}</span>
            <span><span aria-hidden="true">📝</span> {form.service_description.slice(0, 60)}{form.service_description.length > 60 ? '…' : ''}</span>
          </div>
          {TURNSTILE_SITE_KEY && (
            <div ref={turnstileRef} style={{ marginTop: '16px' }} aria-label="CAPTCHA-Sicherheitscheck" />
          )}
          {error && <p className="booking-error" role="alert">{error}</p>}
          <div className="booking-nav">
            <button type="button" className="btn-secondary" onClick={() => setStep(2)}>← Zurück</button>
            <button type="submit" className="btn-primary" disabled={submitting || !form.name || !form.phone || !form.street || !form.zip || !form.city || (!!TURNSTILE_SITE_KEY && !turnstileToken)}>
              {submitting ? 'Wird gesendet…' : 'Anfrage absenden'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function PublicHome() {
  const phoneNumber = "0152 2207 4984";
  const phoneHref = "tel:015222074984";
  const [showBooking, setShowBooking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollToBooking = () => {
    setShowBooking(true);
    setTimeout(() => document.getElementById('buchen')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="app">
      <a href="#main-content" className="skip-to-main">Zum Hauptinhalt springen</a>

      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <img src="/logo.png" alt="Helferchen – Nachbarschaftshilfe Berlin" className="header-logo" />
          </div>
          <nav className={`nav-links${menuOpen ? ' nav-open' : ''}`} id="main-nav" aria-label="Hauptnavigation">
            <a href="#leistungen" onClick={() => setMenuOpen(false)}>Leistungen</a>
            <a href="#ueber-uns" onClick={() => setMenuOpen(false)}>Über uns</a>
            <a href="#buchen" onClick={() => setMenuOpen(false)}>Termin</a>
            <a href="#preise" onClick={() => setMenuOpen(false)}>Preise</a>
          </nav>
          <div className="header-actions">
            <button
              className="nav-toggle"
              aria-label={menuOpen ? 'Navigation schließen' : 'Navigation öffnen'}
              aria-expanded={menuOpen}
              aria-controls="main-nav"
              onClick={() => setMenuOpen(m => !m)}
            >
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            </button>
            <a href="/login" className="btn-blue header-cta">Mitarbeiter-Login</a>
            <button onClick={scrollToBooking} className="btn-primary header-cta">Jetzt buchen</button>
          </div>
        </div>
      </header>

      <main id="main-content">

      {/* HERO */}
      <div className="hero-wrapper">
        <section className="hero container">
          <div className="hero-content">
            <span className="badge">Ihr Helfer vor Ort in Berlin &amp; Brandenburg</span>
            <h1>Technik-Probleme?<br />Haushalt zu viel?</h1>
            <p className="hero-sub">
              Wir kommen zu Ihnen nach Hause — kompetent,
              geduldig und ohne Fachchinesisch.
            </p>
            <div className="hero-cta-row">
              <button className="btn-primary btn-lg" onClick={scrollToBooking}>Jetzt Termin buchen</button>
              <a href={phoneHref} className="btn-call btn-lg">
                <span className="btn-call-label">Anrufen</span>
                <span className="btn-call-number">{phoneNumber}</span>
              </a>
            </div>
            <p className="hero-hint">Mo–Fr · 9–17 Uhr</p>
          </div>
          <div className="hero-visual">
            <img src="/service-social.png" alt="Helfer beim Kunden zuhause" className="hero-img" />
            <div className="floating-card">
              <span aria-hidden="true">⭐</span>
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
            <div className="booking-cta-row">
              <button className="btn-primary btn-lg" onClick={() => setShowBooking(true)}>Termin anfragen</button>
              <a href={phoneHref} className="btn-call btn-lg">
                <span className="btn-call-label">Anrufen</span>
                <span className="btn-call-number">{phoneNumber}</span>
              </a>
            </div>
          ) : (
            <BookingPortal />
          )}
        </div>
      </section>

      {/* SERVICES — expanded */}
      <section className="section" id="leistungen">
        <div className="container">
          <span className="section-badge">Unsere Leistungen</span>
          <h2 className="section-heading">Was wir für Sie tun</h2>

          {/* Category cards */}
          <div className="services-grid">
            <div className="service-card">
              <img src="/hero-laptop.png" alt="Technik-Hilfe für Senioren und Einsteiger" className="service-img" />
              <div className="service-body">
                <h3>Technik-Hilfe</h3>
                <ul>
                  <li>Smartphone einrichten &amp; erklären</li>
                  <li>TV, Fernbedienung &amp; Sat-Anlage</li>
                  <li>WLAN-Probleme lösen</li>
                  <li>Computer &amp; Drucker einrichten</li>
                  <li>WhatsApp &amp; Videotelefonie</li>
                  <li>Sicher im Internet surfen</li>
                  <li>Streaming (Netflix, ARD Mediathek…)</li>
                  <li>Online-Banking einrichten</li>
                </ul>
              </div>
            </div>
            <div className="service-card">
              <img src="/service-repair.png" alt="Alltagshilfe und Besorgungen" className="service-img" />
              <div className="service-body">
                <h3>Alltagshilfe &amp; Besorgungen</h3>
                <ul>
                  <li>Einkaufen &amp; Lebensmitteleinkauf</li>
                  <li>Apothekenbesorgungen</li>
                  <li>Begleitung bei Arztbesuchen</li>
                  <li>Postabholen &amp; Bankgänge</li>
                  <li>Fahrdienste &amp; Terminbegleitung</li>
                  <li>Tierpflege &amp; Gassi gehen</li>
                  <li>Blumen gießen &amp; Pflanzen pflegen</li>
                </ul>
              </div>
            </div>
            <div className="service-card">
              <img src="/service-cleaning.png" alt="Haushalt und Reinigung" className="service-img" />
              <div className="service-body">
                <h3>Haushalt &amp; Reinigung</h3>
                <ul>
                  <li>Fenster putzen</li>
                  <li>Küche &amp; Bad auf Hochglanz</li>
                  <li>Staubsaugen &amp; Wischen</li>
                  <li>Kühlschrank &amp; Backofen reinigen</li>
                  <li>Gardinen ab- &amp; aufhängen</li>
                  <li>Leuchtmittel wechseln</li>
                  <li>Keller oder Dachboden aufräumen</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Additional service categories */}
          <div className="services-extra-grid">
            <div className="services-extra-card">
              <div className="services-extra-icon" aria-hidden="true">🔧</div>
              <h3>Reparaturen &amp; Handwerk</h3>
              <ul>
                <li>Kleine Reparaturen &amp; Montage</li>
                <li>Möbel aufbauen (IKEA &amp; Co.)</li>
                <li>Bilder &amp; Regale aufhängen</li>
                <li>Dichtungen wechseln</li>
                <li>Türen &amp; Fenster einstellen</li>
                <li>Rollläden &amp; Jalousien reparieren</li>
              </ul>
            </div>
            <div className="services-extra-card">
              <div className="services-extra-icon" aria-hidden="true">🌿</div>
              <h3>Garten &amp; Außenbereich</h3>
              <ul>
                <li>Rasen mähen &amp; trimmen</li>
                <li>Hecken schneiden</li>
                <li>Beete anlegen &amp; pflegen</li>
                <li>Laub harken</li>
                <li>Schnee räumen &amp; Streuen</li>
                <li>Terrasse &amp; Balkon reinigen</li>
              </ul>
            </div>
            <div className="services-extra-card">
              <div className="services-extra-icon" aria-hidden="true">📋</div>
              <h3>Behördengänge &amp; Formulare</h3>
              <ul>
                <li>Behördengänge begleiten</li>
                <li>Formulare ausfüllen (digital &amp; analog)</li>
                <li>Online-Anträge stellen</li>
                <li>Briefe verstehen &amp; beantworten</li>
                <li>Renten- &amp; Sozialleistungen</li>
                <li>Krankenkassen-Angelegenheiten</li>
              </ul>
            </div>
            <div className="services-extra-card">
              <div className="services-extra-icon" aria-hidden="true">🛍️</div>
              <h3>Seniorenhilfe &amp; Begleitung</h3>
              <ul>
                <li>Gesellschaft &amp; Gespräch</li>
                <li>Spazierengehen &amp; Begleitung</li>
                <li>Freizeitgestaltung &amp; Ausflüge</li>
                <li>Lesen vorlesen &amp; Vorlesen</li>
                <li>Gedächtnistraining &amp; Spiele</li>
                <li>Krankenhaus- &amp; Rehaklinik-Besuch</li>
              </ul>
            </div>
          </div>

          <div className="services-cta">
            <p>Sie haben eine andere Aufgabe? <strong>Kein Problem!</strong> Fragen Sie uns einfach — wir finden eine Lösung.</p>
            <button className="btn-primary btn-lg" onClick={scrollToBooking}>Jetzt anfragen</button>
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
              <span className="trust-icon" aria-hidden="true">🏘️</span>
              <div><h3>Nah bei Ihnen</h3><p>Alle Helfer kommen aus Ihrer Nachbarschaft.</p></div>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">🔒</span>
              <div><h3>Geprüft &amp; vertrauenswürdig</h3><p>Alle Helfer sind persönlich bekannt und sorgfältig ausgewählt.</p></div>
            </div>
            <div className="trust-item">
              <span className="trust-icon" aria-hidden="true">⚡</span>
              <div><h3>Flexibel &amp; schnell</h3><p>Oft noch am selben Tag — kein Papierkram, kein Warten.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ÜBER UNS */}
      <section className="section ueber-uns-section" id="ueber-uns">
        <div className="container">
          <span className="section-badge">Über uns</span>
          <h2 className="section-heading">Unsere Geschichte</h2>
          <div className="ueber-uns-content">
            <div className="ueber-uns-text">
              <p>
                Wir sind ein kleines Team aus Berlin und Brandenburg — Menschen mit
                unterschiedlichen Fähigkeiten, die eines gemeinsam haben: den Wunsch,
                anderen wirklich zu helfen.
              </p>
              <p>
                Die Idee zu Helferchen entstand aus dem Alltag heraus. Wir haben
                selbst erlebt, wie schwierig es für viele Menschen werden kann —
                ob jung oder älter — wenn die kleinen Dinge des Alltags plötzlich
                zur Herausforderung werden. Der neue Fernseher, den niemand einrichten
                kann. Die Behördenpost, die kaum jemand versteht. Das vollgestellte
                Zimmer, das seit Jahren wartet.
              </p>
              <p>
                Wir haben festgestellt: Es gibt zu viele Menschen, die eigentlich
                nur ein bisschen Unterstützung bräuchten — aber nicht wissen,
                an wen sie sich wenden sollen. Professionelle Dienste sind oft
                teuer, kompliziert oder schlicht übertrieben für das, was man
                wirklich braucht.
              </p>
              <p>
                Deshalb haben wir Helferchen gegründet. Eine unkomplizierte,
                persönliche Alltagshilfe direkt aus der Nachbarschaft. Kein
                Papierkram, keine langen Wartezeiten, keine versteckten Kosten.
                Einfach anrufen oder online buchen — und schon kommt jemand
                vorbei, der wirklich hilft.
              </p>
              <p>
                Unser Team besteht aus engagierten Helfern mit verschiedenen
                Stärken: von der Technik über den Haushalt bis hin zu Handwerk
                und Behördengängen. Was uns alle verbindet, ist Geduld,
                Zuverlässigkeit und echtes Interesse an den Menschen, denen
                wir helfen dürfen.
              </p>
            </div>
            <div className="ueber-uns-values">
              <div className="value-card">
                <span className="value-icon" aria-hidden="true">❤️</span>
                <h3>Mit Herz dabei</h3>
                <p>Für uns ist jeder Auftrag mehr als ein Job — wir nehmen uns die Zeit, die Sie brauchen.</p>
              </div>
              <div className="value-card">
                <span className="value-icon" aria-hidden="true">🤝</span>
                <h3>Vertrauen zuerst</h3>
                <p>Wir kommen in Ihr Zuhause — das ist Vertrauen. Wir nehmen das sehr ernst.</p>
              </div>
              <div className="value-card">
                <span className="value-icon" aria-hidden="true">🌍</span>
                <h3>Für alle Menschen</h3>
                <p>Jung oder alt, technikaffin oder nicht — wir helfen jedem, ohne zu urteilen.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner container">
          <img src="/logo.png" alt="Helferchen" className="footer-logo-img" />
          <div className="footer-links">
            <a href="/impressum">Impressum</a>
            <a href="/datenschutz">Datenschutz</a>
            <a href={phoneHref}>{phoneNumber}</a>
          </div>
          <p className="footer-copy">© 2026 Helferchen · Fabian Marquardt · noreply@helferchen.info</p>
        </div>
      </footer>

      {/* Mobile-only: Mitarbeiter-Login ganz unten */}
      <div className="mobile-login-bottom">
        <a href="/login" className="btn-blue">Mitarbeiter-Login</a>
      </div>

    </div>
  );
}

export default PublicHome;
