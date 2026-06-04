import '../index.css';

function PublicHome() {
  const phoneNumber = "030 / 123 456 78";
  const phoneHref = "tel:03012345678";

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="logo-text">Helferchen</span>
            <span className="brand-sub">Berlin & Brandenburg</span>
          </div>
          <nav className="nav-links">
            <a href="#leistungen">Leistungen</a>
            <a href="#preise">Preise</a>
            <a href="/login" className="btn-secondary">Mitarbeiter-Login</a>
          </nav>
          <a href={phoneHref} className="btn-primary header-cta">Jetzt anrufen</a>
        </div>
      </header>

      {/* HERO */}
      <div className="hero-wrapper">
        <section className="hero container">
          <div className="hero-content">
            <span className="badge">In Berlin & Brandenburg</span>
            <h1>Technik-Probleme?<br />Haushalt zu viel?</h1>
            <p className="hero-sub">
              Wir kommen zu Ihnen nach Hause — kompetent,
              geduldig und ohne Fachchinesisch.
            </p>
            <div className="hero-cta-row">
              <a href={phoneHref} className="btn-primary btn-lg">{phoneNumber}</a>
              <span className="hero-hint">Mo–Fr · 9–17 Uhr</span>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src="https://images.unsplash.com/photo-bSXk1lOp8T0?w=640&q=80&auto=format&fit=crop"
              alt="Betreuerin hilft älterem Paar am Tisch"
              className="hero-img"
            />
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

      {/* SERVICES */}
      <section className="section" id="leistungen">
        <div className="container">
          <span className="section-badge">Unsere Leistungen</span>
          <h2 className="section-heading">Was wir für Sie tun</h2>
          <div className="services-grid">

            <div className="service-card">
              <div className="service-img-wrap">
                <img
                  src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=480&q=80&auto=format&fit=crop"
                  alt="Technik-Hilfe"
                />
              </div>
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
              <div className="service-img-wrap">
                <img
                  src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=480&q=80&auto=format&fit=crop"
                  alt="Alltagshilfe"
                />
              </div>
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
              <div className="service-img-wrap">
                <img
                  src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=480&q=80&auto=format&fit=crop"
                  alt="Behörden und Formulare"
                />
              </div>
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
              <h3>Anrufen</h3>
              <p>Schildern Sie kurz Ihr Anliegen. Wir vereinbaren sofort einen Termin.</p>
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
            <a href={phoneHref} className="btn-primary btn-lg">Termin vereinbaren</a>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="trust-section">
        <div className="trust-img-col">
          <img
            src="https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&q=80&auto=format&fit=crop"
            alt="Vertrauen und Sicherheit"
          />
        </div>
        <div className="trust-content-col">
          <span className="section-badge">Warum Helferchen?</span>
          <h2>Ihr Helfer aus der Nachbarschaft</h2>
          <div className="trust-list">
            <div className="trust-item">
              <span className="trust-icon">🏘️</span>
              <div>
                <h3>Nah bei Ihnen</h3>
                <p>Alle Helfer kommen aus Berlin und Brandenburg und kennen die Gegend.</p>
              </div>
            </div>
            <div className="trust-item">
              <span className="trust-icon">🔒</span>
              <div>
                <h3>Geprüft &amp; vertrauenswürdig</h3>
                <p>Alle Helfer sind persönlich bekannt und sorgfältig ausgewählt.</p>
              </div>
            </div>
            <div className="trust-item">
              <span className="trust-icon">⚡</span>
              <div>
                <h3>Flexibel &amp; schnell</h3>
                <p>Oft noch am selben Tag — kein Papierkram, kein Warten.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNERS */}
      <section className="partners-section">
        <div className="container">
          <h3 className="section-heading">Bekannt aus &amp; Partner</h3>
          <div className="partners-grid">
            <div className="partner-placeholder">Logo 1</div>
            <div className="partner-placeholder">Logo 2</div>
            <div className="partner-placeholder">Logo 3</div>
            <div className="partner-placeholder">Logo 4</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="cta-wrapper">
        <section className="cta-section container">
          <h2>Bereit für Ihre erste Hilfe?</h2>
          <p>Rufen Sie uns an — wir helfen sofort.</p>
          <a href={phoneHref} className="btn-primary btn-xl">{phoneNumber}</a>
          <p className="cta-sub">Mo–Fr 9–17 Uhr · Berlin & Brandenburg</p>
        </section>
      </div>

      {/* CALLBACK FORM */}
      <section className="section callback-section" id="kontakt">
        <div className="container">
          <div className="callback-card">
            <span className="section-badge">Rückruf anfordern</span>
            <h2 className="section-heading">Wir melden uns bei Ihnen</h2>
            <p className="callback-hint">Hinterlassen Sie Ihre Nummer, wir rufen zeitnah zurück.</p>
            <form className="callback-form">
              <input type="text" placeholder="Ihr Name" required />
              <input type="tel" placeholder="Ihre Telefonnummer" required />
              <button type="submit" className="btn-primary">Jetzt Rückruf anfordern</button>
            </form>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner container">
          <span className="logo-text footer-logo">Helferchen</span>
          <div className="footer-links">
            <a href="#">Impressum</a>
            <a href="#">Datenschutz</a>
          </div>
          <p className="footer-copy">© 2026 Helferchen · Berlin & Brandenburg</p>
        </div>
      </footer>

    </div>
  );
}

export default PublicHome;
