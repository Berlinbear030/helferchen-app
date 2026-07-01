# Passwort-Dokumentation – Helferchen Server (Stand 01.07.2026)

> **VERTRAULICH** – Dieses Dokument enthält alle Zugangsdaten für den Helferchen-Server.
> Bitte bewahren Sie diese Daten sicher auf (z.B. in einem Passwort-Manager wie KeePass oder Bitwarden) und löschen Sie dieses Dokument danach.

---

## 🖥️ VPS-Server (85.190.98.5 / helferchen.info)

| Dienst | Benutzername | Passwort | Hinweis |
|--------|-------------|---------|---------|
| SSH Root-Zugang | `root` | `38!UTVq!$dMhxi!DeSs1%990` | Nur über dogado-Panel oder Notfall; SSH-Schlüssel ist primäre Methode |
| Webmin Panel (https://localhost:10000) | `root` | `Wx9#mK2$pLqN7@vR4hT` | Nur über SSH-Tunnel erreichbar (Zugriff via `ssh -L 10000:localhost:10000 root@85.190.98.5`) |

---

## 📧 E-Mail-Konten (helferchen.info – Postfix/Dovecot)

| E-Mail-Adresse | Neues Passwort | Server | Port |
|----------------|---------------|--------|------|
| `info@helferchen.info` ⚠️ | `2!1!3#UQwdRf%UNA*PMJuhzm` | helferchen.info | 587 (STARTTLS) |
| `kundenservice@helferchen.info` | `T&3&i277iIN@BuEjn%3lpxMr` | helferchen.info | 587 (STARTTLS) |
| `no-reply@helferchen.info` | `jl2rz3#vhCXnVClEUW*Wge&J` | helferchen.info | 587 (STARTTLS) |
| `no-replay@helferchen.info` | `4vu0g6D^uD9K6%tYEoo2xc%f` | helferchen.info | 587 (STARTTLS) |
| `schroeder@helferchen.info` | `V6VZ1eT$r8@rOEY2alnjMBa*` | helferchen.info | 587 (STARTTLS) |
| `shop@helferchen.info` | `GVDY@HFiqzoUk#Z@l!lNJ6xN` | helferchen.info | 587 (STARTTLS) |
| `test@helferchen.info` | `59Su8oUaCZIBsy$z8zYq1trP` | helferchen.info | 587 (STARTTLS) |

> ⚠️ `info@helferchen.info` war das kompromittierte Konto (Phishing-Quelle).

---

## 🔐 Helferchen-Portal Benutzer (helferchen.info/portal)

| Benutzername | Rolle | Neues Passwort |
|-------------|-------|---------------|
| `admin` (Fabian Marquardt) | Admin | `jf#1Iz3E0ht@zcw@Yvx!6YNc` |
| `board` | Admin | `EGy$q7GTOXLGTO&kht3BJFRb` |
| `schroderf06` (Franzisca Schröder) | Admin | `V6VZ1eT$r8@rOEY2alnjMBa*` |
| `Justin` (Justin Schröder) | Admin | `V6VZ1eT$r8@rOEY2alnjMBa*` |
| `employee1` (Max Mustermann) | Mitarbeiter | `3sAJi#!u1%8zZmMI^xsuZtG1` |
| `Testmitarbeiter` | Mitarbeiter | `jf#1Iz3E0ht@zcw@Yvx!6YNc` |

---

## 🗄️ Datenbanken

### Helferchen MySQL (lokal auf Server)
| Parameter | Wert |
|-----------|------|
| Host | `localhost:3306` |
| Datenbank | `helferchen` |
| Benutzername | `helferchen` |
| **Passwort** | `LF!zb$V1&rcgLq065$&uDuM8` |

### Fahrschulpro PostgreSQL (Docker)
| Parameter | Wert |
|-----------|------|
| Host | `localhost:5434` (nur intern, 127.0.0.1) |
| Datenbank | `fahrschulpro` |
| Benutzername | `fahrschulpro` |
| **Passwort** | `kwYpL0B2kOSJs7MCgkxUDao5mw3f` |

### Fahrschulpro Backend (Docker)
| Variable | Wert |
|----------|------|
| `SECRET_KEY` | `e3e6daa4e29598d2c5a7e78c9f1ce9e0e44f11ffbca4484e1a9779804abd4bf2` |

---

## ⚙️ Backend-Umgebungsvariablen

### Helferchen Backend (.env auf Server: `/opt/helferchen/apps/backend/.env`)
| Variable | Wert |
|----------|------|
| `JWT_SECRET` | `d9e55fe867da66464d8a1a2a5a1b69e89e44a14d5ca978553967337b93c6f12c175e5429c82084981bcc4a5ac7aaf7c46dcb0019cc316f2700013dfb25b30d36` |
| `CRON_SECRET` | `W^qPbN&&cZ%tsOyA3ctEIGnrAQi42W48` |
| `TELEGRAM_BOT_TOKEN` | `8652428094:AAFLv4DkINSWa3TBhYq50IQP1zTpqK_Aaac` |
| `SMTP_USER` | `no-reply@helferchen.info` |
| `SMTP_PASS` | `jl2rz3#vhCXnVClEUW*Wge&J` |

### Fahrschulpro Backend (.env: `/opt/fahrschulpro/.env`)
| Variable | Wert |
|----------|------|
| `DB_PASSWORD` | `FahrSchulPro2026!` |
| `SECRET_KEY` | `fcbfc426653401d7e965ab0f3bb07747d2566e8f25a2899efdae1cf344f6ba11` |

---

## 🌐 Web-Tools (auf helferchen.info)

| Dienst | URL | Benutzername | Passwort |
|--------|-----|-------------|---------|
| n8n (Workflow-Automatisierung) | https://n8n.helferchen.info | `fabian` | `Kj8#mW4$pLqR9@xZ` |
| Webmail (SnappyMail) | https://helferchen.info/webmail | — | (E-Mail-Passwort) |
| Fahrschulpro | https://fahrschulpro.helferchen.info | — | (App-Login) |

---

## 🔑 Was noch manuell geändert werden muss

| System | Was zu tun ist |
|--------|---------------|
| **dogado.de Panel** | Login unter https://my.dogado.de – Passwort manuell ändern |
| **INWX DNS** | Login unter https://www.inwx.de – Passwort manuell ändern |
| **Fahrschulpro App-Passwörter** | Falls Nutzer in der App existieren, deren Passwörter ebenfalls ändern |
| **Telegram Bot** | Falls Token kompromittiert: neuen Bot bei @BotFather erstellen |

---

## 📋 Empfehlungen

1. **Passwort-Manager:** Alle Zugangsdaten sofort in KeePass, Bitwarden oder 1Password speichern
2. **2FA:** Für dogado-Panel und INWX 2-Faktor-Authentifizierung aktivieren
3. **Dieses Dokument löschen:** Nach dem Sichern der Passwörter dieses Dokument in Paperclip löschen
4. **Spamhaus Delisting:** IP-Rehabilitation beantragen unter https://www.spamhaus.org/lookup/
5. **dogado informieren:** Antwort auf Ticket [17866977] senden