import '../index.css';

function Impressum() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <a href="/">
              <img src="/logo.png" alt="Helferchen" className="header-logo" />
            </a>
          </div>
          <nav className="nav-links">
            <a href="/#leistungen">Leistungen</a>
            <a href="/#ueber-uns">Über uns</a>
            <a href="/#buchen">Termin</a>
            <a href="/#preise">Preise</a>
          </nav>
          <a href="/" className="btn-primary">Zurück zur Startseite</a>
        </div>
      </header>

      <main className="impressum-page">
        <div className="container">
          <h1>Impressum</h1>
          <p className="impressum-subtitle">Angaben gemäß § 5 TMG</p>

          <section className="impressum-section">
            <h2>Anbieter</h2>
            <p>
              Fabian Marquardt<br />
              Inhaber des Unternehmens Helferchen<br />
              <strong>[Straße und Hausnummer]</strong><br />
              <strong>[PLZ] [Stadt]</strong><br />
              Deutschland
            </p>
          </section>

          <section className="impressum-section">
            <h2>Kontakt</h2>
            <p>
              Telefon: <a href="tel:03071067627">030 71067627</a><br />
              E-Mail: <a href="mailto:info@helferchen.info">info@helferchen.info</a>
            </p>
          </section>

          <section className="impressum-section">
            <h2>Steuernummer</h2>
            <p>
              Steuernummer: 36/434/00685<br />
              Zuständiges Finanzamt: Finanzamt Berlin
            </p>
          </section>

          <section className="impressum-section">
            <h2>Umsatzsteuer</h2>
            <p>
              Gemäß § 19 UStG wird keine Umsatzsteuer erhoben
              (Kleinunternehmerregelung).
            </p>
          </section>

          <section className="impressum-section">
            <h2>Verantwortlicher für den Inhalt</h2>
            <p>
              Fabian Marquardt<br />
              (Anschrift wie oben)
            </p>
          </section>

          <section className="impressum-section">
            <h2>Haftungsausschluss</h2>
            <h3>Haftung für Inhalte</h3>
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
              auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
              Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
              verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
              überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
              Tätigkeit hinweisen.
            </p>
            <h3>Haftung für Links</h3>
            <p>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren
              Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
              fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
              verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
              der Seiten verantwortlich.
            </p>
            <h3>Urheberrecht</h3>
            <p>
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
              Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
              Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
              Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
              jeweiligen Autors bzw. Erstellers.
            </p>
          </section>

          <section className="impressum-section">
            <h2>Streitschlichtung</h2>
            <p>
              Die Europäische Kommission stellt eine Plattform zur
              Online-Streitbeilegung (OS) bereit:{' '}
              <a
                href="https://ec.europa.eu/consumers/odr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                https://ec.europa.eu/consumers/odr/
              </a>
              .<br />
              Unsere E-Mail-Adresse finden Sie oben im Impressum.<br /><br />
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
              vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <div className="impressum-back">
            <a href="/" className="btn-secondary">← Zurück zur Startseite</a>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="footer-inner container">
          <img src="/logo.png" alt="Helferchen" className="footer-logo-img" />
          <div className="footer-links">
            <a href="/impressum">Impressum</a>
            <a href="/datenschutz">Datenschutz</a>
            <a href="tel:03071067627">030 71067627</a>
          </div>
          <p className="footer-copy">© 2026 Helferchen · Fabian Marquardt</p>
        </div>
      </footer>
    </div>
  );
}

export default Impressum;
