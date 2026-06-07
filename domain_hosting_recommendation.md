# Domain & Hosting: Helferchen

Stand: 2026-06-04 (aktualisiert: Domain ist **helferchen.info**, nicht helferchen.info)

---

## 1. Empfehlung: Registrar & Hosting

### Registrar: INWX (inwx.de)
**Empfehlung: INWX** — günstigster seriöser deutscher Registrar für .de-Domains.
- .de-Domain: ca. **0,79 €/Jahr** (Erstjahr oft noch günstiger)
- Einfaches DNS-Management
- Deutsches Unternehmen, DSGVO-konform
- API verfügbar (gut für spätere Automatisierung)

Alternativen:
| Registrar | .de Preis/Jahr | Bemerkung |
|-----------|---------------|-----------|
| INWX | ~0,79 € | **Empfehlung** – günstigste seriöse Option |
| Hetzner | ~0,96 € | Gut, wenn ihr sowieso Hetzner-Server nutzt |
| Strato | ~0,99 € | Bekannt, etwas teurer |

### Hosting: Netlify (kostenlos)
**Empfehlung: Netlify Free Tier** — perfekt für eine statische React/Vite-Website.
- **Kostenlos** für kleine Websites (100 GB Bandwidth/Monat)
- Automatisches HTTPS / SSL-Zertifikat (Let's Encrypt)
- CI/CD: Automatisches Deploy bei Git-Push
- Custom Domain einfach konfigurierbar

---

## 2. Schritt-für-Schritt: Domain registrieren (Fabian macht dies manuell)

### Schritt 1: Account bei INWX erstellen
1. Gehe zu **https://www.inwx.de**
2. Klicke auf „Registrieren" (oben rechts)
3. Fülle das Formular mit echten Kontaktdaten aus (Pflicht für .de-Domains – erscheinen nicht öffentlich da INWX WHOIS-Privacy anbietet)
4. E-Mail bestätigen

### Schritt 2: Domain
**Domain: `helferchen.info`** (bereits registriert bei INWX)

---

## 3. Schritt-für-Schritt: Website deployen auf Netlify

Die Website ist eine Vite/React App in `apps/website/`.

### Schritt 1: Netlify Account
1. Gehe zu **https://netlify.com**
2. „Sign up" → „Sign up with GitHub"
3. Du landest im Netlify Dashboard

### Schritt 2: Neues Projekt aus GitHub deployen
1. Klicke „Add new site" → „Import an existing project"
2. Wähle „Deploy with GitHub"
3. Autorisiere Netlify für das Repository
4. Wähle das Helferchen-Repository
5. Konfiguration:
   - **Base directory:** `apps/website`
   - **Build command:** `npm run build`
   - **Publish directory:** `apps/website/dist`
6. Klicke „Deploy site"

Nach 1-2 Minuten ist die Site live unter einer temporären URL wie `https://amazing-xyz-123.netlify.app`.

### Schritt 3: Custom Domain in Netlify hinzufügen
1. Im Netlify-Projekt: „Domain management" → „Add custom domain"
2. Eingabe: `helferchen.info`
3. Netlify zeigt die benötigten DNS-Einträge an

---

## 4. DNS konfigurieren bei INWX

Nachdem Netlify dir die DNS-Werte zeigt:

1. Bei INWX einloggen → „Domains" → `helferchen.info` → „DNS"
2. Folgende Einträge setzen (genaue Werte kommen von Netlify):

| Typ | Name | Wert | TTL |
|-----|------|------|-----|
| A | @ | `75.2.60.5` (Netlify Load Balancer IP) | 3600 |
| CNAME | www | `[dein-site-name].netlify.app` | 3600 |

> Netlify zeigt dir die exakten Werte im Dashboard – diese Werte verwenden!

3. DNS-Propagation dauert 15 Minuten bis 48 Stunden (meist unter 1 Stunde)
4. Netlify aktiviert automatisch SSL sobald DNS propagiert ist

---

## 5. Impressum & Datenschutz (vor Go-Live Pflicht!)

Die Website hat Platzhalter-Links für Impressum und Datenschutz. **Vor dem Go-Live:**
- Deutsches Impressum ist **Pflicht** (§ 5 TMG)
- Datenschutzerklärung nach DSGVO nötig
- Empfehlung: Generator unter https://www.e-recht24.de (kostenlose Basisversion)

---

## Zusammenfassung der Kosten

| Posten | Kosten |
|--------|--------|
| helferchen.info (INWX, 1 Jahr) | ~0,79 €/Jahr |
| helferchen.com optional | ~10 €/Jahr |
| Netlify Hosting | **Kostenlos** |
| SSL-Zertifikat | **Kostenlos** |
| **Gesamt Jahr 1** | **< 1 €** (nur Domain .de) |

---

## Nächste Schritte für Fabian

1. [ ] Domain `helferchen.info` bei INWX registrieren
2. [ ] Netlify-Account mit GitHub verbinden
3. [ ] Website deployen (Build-Einstellungen wie oben)
4. [ ] DNS-Einträge bei INWX setzen
5. [ ] Impressum & Datenschutz einpflegen

Nach Schritt 2 kann die Website bereits unter der temporären Netlify-URL gezeigt werden. Die eigene Domain kommt nach Schritt 4.
