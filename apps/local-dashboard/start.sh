#!/usr/bin/env bash
# Startet das lokale Dashboard auf Port 5555
# Läuft im Netzwerk erreichbar unter http://<DEINE-IP>:5555

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Paperclip-Umgebungsvariablen aus der lokalen Instanz laden
PAPERCLIP_ENV="/home/fabian/.paperclip/instances/default/.env"
if [ -f "$PAPERCLIP_ENV" ]; then
  export $(grep -v '^#' "$PAPERCLIP_ENV" | xargs) 2>/dev/null || true
fi

# Fallback auf bekannte Werte
export PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://127.0.0.1:3100}"
export PAPERCLIP_COMPANY_ID="${PAPERCLIP_COMPANY_ID:-1a748860-f520-4bca-83a6-3bd4e7d1e831}"
export PORT="${PORT:-5555}"

echo ""
echo "=============================="
echo "  🏠 Internes Dashboard"
echo "=============================="
echo ""

# IP-Adresse ermitteln
LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}')
echo "  Lokal:    http://localhost:$PORT"
echo "  Netzwerk: http://$LOCAL_IP:$PORT"
echo ""

node server.js
