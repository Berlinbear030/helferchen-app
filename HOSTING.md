# Helferchen – Hosting-Anleitung

Schritt-für-Schritt-Anleitung zum Deployment der Helferchen-Plattform auf einem Webserver.

---

## Voraussetzungen

| Tool | Zweck |
|---|---|
| Node.js ≥ 20 (lokal) | Backend bauen, Frontend bauen |
| npm ≥ 10 | Paketmanager |
| FTP-Client (z.B. FileZilla) | Dateien hochladen |
| SSH-Client (optional) | Direktzugriff auf den Server |

> **Hinweis zu Shared-Hosting:** Die meisten günstigen Angebote (All-Inkl, Strato, IONOS Basic) unterstützen **kein Node.js**. Nur PHP-Anwendungen laufen dort nativ. Für diese App wird ein Server mit Node.js-Unterstützung benötigt.
>
> **Empfehlung:** Hetzner Cloud CX22 (2 vCPU, 4 GB RAM, 40 GB SSD) für **ca. 4–6 €/Monat** ist ideal. Alternativ: Railway, Render (kostenlose Tier möglich), oder ein Managed Node.js-Angebot wie All-Inkl Business.

---

## 1. Lokale Vorbereitung

```bash
# Repository klonen (falls noch nicht vorhanden)
git clone <repo-url> helferchen
cd helferchen

# Backend-Abhängigkeiten installieren & bauen
cd apps/backend
npm install
npm run build
cd ../..

# Frontend-Abhängigkeiten installieren & bauen
cd apps/website
npm install
npm run build
cd ../..
```

Das Frontend-Build liegt danach in `apps/website/dist/`.

---

## 2. Backend deployen

### Option A: VPS/Server mit SSH (empfohlen – z.B. Hetzner)

```bash
# Server-Setup (einmalig, als root)
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# PM2 installieren (Prozessmanager)
npm install -g pm2

# Projektverzeichnis anlegen
mkdir -p /var/www/helferchen
```

```bash
# Backend-Dateien hochladen (lokal ausführen)
scp -r apps/backend/dist/ user@IHRE-IP:/var/www/helferchen/backend/
scp apps/backend/package*.json user@IHRE-IP:/var/www/helferchen/backend/

# Auf dem Server: Abhängigkeiten installieren
ssh user@IHRE-IP
cd /var/www/helferchen/backend
npm install --production

# Umgebungsvariablen setzen (siehe Abschnitt 7)
cp .env.example .env
nano .env  # Werte anpassen

# Backend starten
pm2 start dist/index.js --name helferchen-api
pm2 save
pm2 startup  # Autostart bei Neustart aktivieren
```

### Option B: Shared-Hosting mit Node.js-Unterstützung (All-Inkl Business)

1. Im Hosting-Panel unter „Node.js" eine neue App anlegen
2. Einstiegspunkt: `dist/index.js`
3. Arbeitsverzeichnis: `/www/htdocs/USERNAME/backend`
4. Dateien per FTP hochladen (Ordner `apps/backend/dist/` + `package.json`)
5. Im Hosting-Panel `npm install --production` ausführen
6. `.env`-Datei per FTP hochladen (siehe Abschnitt 7)

---

## 3. Frontend/Webapp deployen

Das gebaute Frontend ist reines HTML/CSS/JS und läuft auf jedem Webserver.

```bash
# Per FTP in das Web-Verzeichnis hochladen
# Quelle:  apps/website/dist/
# Ziel:    /www/htdocs/USERNAME/  (Shared-Hosting)
#          /var/www/html/         (VPS mit Nginx/Apache)
```

### Nginx-Konfiguration (VPS)

```nginx
server {
    listen 80;
    server_name helferchen.info www.helferchen.info;
    root /var/www/html;
    index index.html;

    # API-Anfragen an Backend weiterleiten
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA: alle anderen Routen → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Nginx installieren und konfigurieren
apt install -y nginx
nano /etc/nginx/sites-available/helferchen
ln -s /etc/nginx/sites-available/helferchen /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 4. Datenbank (SQLite)

Die App verwendet SQLite – die Datenbank ist eine einzelne Datei.

- **Standard-Pfad:** `./helferchen.db` (im Backend-Verzeichnis)
- **Backup:** Datei einfach kopieren:

```bash
# Tägliches Backup per Cron (auf dem Server)
cp /var/www/helferchen/backend/helferchen.db /backups/helferchen-$(date +%Y%m%d).db

# Cron einrichten (crontab -e)
0 3 * * * cp /var/www/helferchen/backend/helferchen.db /backups/helferchen-$(date +\%Y\%m\%d).db
```

> **Hinweis:** Die aktuelle Implementierung nutzt ein In-Memory-Objekt statt einer persistenten SQLite-Datei. Für Produktion sollte `better-sqlite3` oder `node-sqlite3` ergänzt werden, damit Daten bei Neustart erhalten bleiben.

---

## 5. Domainkonfiguration

1. Domain `helferchen.info` bei einem Registrar (z.B. united-domains.de) registrieren
2. Im DNS-Verwaltungspanel des Registrars:

```
A     @          → IHRE-SERVER-IP
A     www        → IHRE-SERVER-IP
CNAME api        → IHRE-SERVER-IP
```

3. DNS-Propagierung abwarten (bis zu 24 Stunden, meist < 1 Stunde)
4. Testen: `ping helferchen.info`

---

## 6. HTTPS / SSL

### Mit Let's Encrypt (kostenlos, empfohlen)

```bash
# Certbot installieren
apt install -y certbot python3-certbot-nginx

# Zertifikat ausstellen
certbot --nginx -d helferchen.info -d www.helferchen.info

# Automatische Erneuerung testen
certbot renew --dry-run
```

Certbot aktualisiert die Nginx-Konfiguration automatisch. Danach:
- HTTP → wird auf HTTPS umgeleitet
- Zertifikat gilt 90 Tage, erneuert sich automatisch

### Shared-Hosting

Die meisten Hoster bieten im Panel unter „SSL/TLS" ein kostenloses Let's Encrypt-Zertifikat per Klick an.

---

## 7. Umgebungsvariablen setzen

Erstellen Sie auf dem Server die Datei `apps/backend/.env`:

```env
PORT=3000
JWT_SECRET=HIER-EINEN-LANGEN-ZUFAELLIGEN-STRING-EINGEBEN
SMTP_HOST=smtp.ihr-anbieter.de
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@helferchen.info
SMTP_PASS=IHR-E-MAIL-PASSWORT
SMTP_FROM=noreply@helferchen.info
```

**JWT_SECRET generieren:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

> Nie die `.env`-Datei ins Git-Repository einchecken!

---

## 8. E-Mail-Konfiguration

Für den E-Mail-Versand (PDF-Reports) wird ein SMTP-Postfach benötigt.

**Empfehlungen:**
- **All-Inkl, Strato, IONOS:** Im Hosting-Panel ein Postfach `noreply@helferchen.info` anlegen → SMTP-Zugangsdaten in `.env` eintragen
- **Transaktionale E-Mails:** Mailgun oder Brevo (ehemals Sendinblue) – kostenlose Tier für kleine Volumina ausreichend

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@helferchen.info
SMTP_PASS=IHR-MAILGUN-API-KEY
SMTP_FROM=noreply@helferchen.info
```

---

## 9. Erste Login-Daten

Nach dem Deployment können Sie sich sofort anmelden:

| Rolle | Benutzername | Passwort |
|---|---|---|
| Admin | `admin` | `admin123` |
| Mitarbeiter | `employee1` | `employee123` |

> **Wichtig:** Passwörter nach dem ersten Login sofort ändern! In der aktuellen Version im Backend-Code (`apps/backend/src/db/index.ts`) in der Seed-Datei anpassen und neu deployen.

---

## 10. Troubleshooting

### Backend startet nicht

```bash
# Logs prüfen
pm2 logs helferchen-api

# Häufige Ursache: Port bereits belegt
lsof -i :3000
```

### Frontend zeigt weiße Seite

- Prüfen ob `dist/index.html` im Web-Root liegt
- In Nginx: `try_files $uri /index.html;` muss gesetzt sein (SPA-Routing)
- Browser-Konsole (F12) auf JavaScript-Fehler prüfen

### API-Anfragen schlagen fehl (CORS / 502)

```bash
# Nginx-Konfiguration testen
nginx -t

# Backend erreichbar?
curl http://localhost:3000/
```

### SSL-Fehler

```bash
# Zertifikat-Status
certbot certificates

# Manuelle Erneuerung
certbot renew
```

### PM2-Prozess nach Neustart weg

```bash
# Startup-Skript einmalig einrichten
pm2 startup
pm2 save
```

---

## Schnellübersicht: Deployment-Checkliste

- [ ] Node.js 20 auf dem Server installiert
- [ ] `npm run build` lokal für Backend und Frontend ausgeführt
- [ ] Backend-Dateien hochgeladen und `npm install --production` ausgeführt
- [ ] `.env`-Datei mit echten Werten auf dem Server angelegt
- [ ] Frontend-`dist/`-Ordner ins Web-Root hochgeladen
- [ ] Nginx konfiguriert (API-Proxy + SPA-Routing)
- [ ] Domain auf Server-IP zeigt (DNS gesetzt)
- [ ] SSL-Zertifikat mit Let's Encrypt ausgestellt
- [ ] Backend mit PM2 gestartet und `pm2 save` ausgeführt
- [ ] Erste Anmeldung getestet
- [ ] Standard-Passwörter geändert
