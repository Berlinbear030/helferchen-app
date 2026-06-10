# Server-Zugriff für Helferchen (Eisenhutweg)

Hier sind die Anweisungen, wie Sie von Ihrem PC auf den Server zugreifen können, um Dateien hochzuladen oder herunterzuladen.

## 1. Programm installieren (SFTP)
Um Dateien wie in einem Windows-Ordner zu verschieben, benötigen Sie ein SFTP-Programm.
- **Empfehlung:** [FileZilla](https://filezilla-project.org/) (kostenlos) oder [Cyberduck](https://cyberduck.io/).

## 2. Zugangsdaten
Verwenden Sie im SFTP-Programm folgende Daten:

| Feld | Wert |
|---|---|
| **Protokoll** | SFTP (SSH File Transfer Protocol) |
| **Server / Host** | `85.190.98.5` (oder `helferchen.info`) |
| **Port** | `22` (Standard für SSH/SFTP) |
| **Benutzername** | `root` |
| **Passwort** | *Das Passwort für den Server-Root-Zugriff* |

## 3. Wichtige Pfade auf dem Server
- **Webseite (Frontend):** `/var/www/html/`
- **Backend (Logik/API):** `/var/www/helferchen/backend/`
- **Logs (Fehlersuche):** `/var/www/helferchen/backend/logs/` (falls konfiguriert)

## 4. Dateien hochladen / herunterladen
1. Verbinden Sie sich mit dem SFTP-Programm.
2. Auf der **linken Seite** sehen Sie Ihren PC.
3. Auf der **rechten Seite** sehen Sie den Server.
4. Sie können Dateien einfach per Drag & Drop von links nach rechts (Upload) oder von rechts nach links (Download) ziehen.

## 5. Vorsichtsmaßnahmen
- Ändern Sie keine Dateien im Systemverzeichnis (`/etc`, `/bin`, etc.), da der Server sonst stoppen könnte.
- Wenn Sie das Frontend aktualisieren möchten, laden Sie die neuen Dateien in den Ordner `/var/www/html/` hoch.
