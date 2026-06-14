#!/bin/bash
# VPS Full Deploy Script — EIS-313
# Run after receiving SSH access: bash vps_deploy.sh <root-password>
# Or if SSH key is installed: bash vps_deploy.sh (no password arg)
set -e

VPS="85.190.98.5"
ROOT_PASS="${1:-}"
REPO_DIR="/opt/helferchen"

SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15"
SSHPASS_BIN="/home/linuxbrew/.linuxbrew/bin/sshpass"

if [ -n "$ROOT_PASS" ]; then
  SSH_CMD="$SSHPASS_BIN -p '$ROOT_PASS' ssh $SSH_OPTS root@$VPS"
  SCP_CMD="$SSHPASS_BIN -p '$ROOT_PASS' scp $SSH_OPTS"
else
  SSH_CMD="ssh $SSH_OPTS -i ~/.ssh/helferchen_vps root@$VPS"
  SCP_CMD="scp $SSH_OPTS -i ~/.ssh/helferchen_vps"
fi

echo "=== 1. Testing SSH connection ==="
eval "$SSH_CMD 'echo SSH OK'"

echo "=== 2. Installing MySQL if not present ==="
eval "$SSH_CMD 'which mysql || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server)'"

echo "=== 3. Setting up MySQL DB and user ==="
eval "$SSH_CMD << 'MYSQL_EOF'
mysql -u root -e \"
CREATE DATABASE IF NOT EXISTS helferchen;
CREATE USER IF NOT EXISTS 'helferchen'@'localhost' IDENTIFIED BY 'HelferDB2026!';
GRANT ALL ON helferchen.* TO 'helferchen'@'localhost';
FLUSH PRIVILEGES;
\"
MYSQL_EOF"

echo "=== 4. Transferring files to VPS ==="
# Ensure target directory exists
eval "$SSH_CMD 'mkdir -p $REPO_DIR'"

# Use rsync if available for better performance, else fallback to scp
if command -v rsync > /dev/null 2>&1; then
  rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.github' --exclude 'apps/*/dist' -e "ssh -i ~/.ssh/helferchen_vps" . root@$VPS:$REPO_DIR
else
  # Fallback to scp (slower and less precise with excludes)
  $SCP_CMD -r . root@$VPS:$REPO_DIR
fi

echo "=== 5. Installing/building backend ==="
eval "$SSH_CMD << 'BACKEND_EOF'
cd $REPO_DIR/apps/backend
npm ci --omit=dev 2>/dev/null || npm install
npm run build
BACKEND_EOF"

echo "=== 6. Writing backend .env ==="
eval "$SSH_CMD 'cat > $REPO_DIR/apps/backend/.env << ENV_EOF
PORT=3001
DATABASE_URL=mysql://helferchen:HelferDB2026!@localhost:3306/helferchen
DB_TYPE=mysql
DB_HOST=localhost
DB_PORT=3306
DB_USER=helferchen
DB_PASS=HelferDB2026!
DB_NAME=helferchen
JWT_SECRET=$(openssl rand -hex 32)
NODE_ENV=production
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@helferchen.info
ADMIN_EMAIL=info@helferchen.info
TELEGRAM_BOT_TOKEN=8652428094:AAFLv4DkINSWa3TBhYq50IQP1zTpqK_Aaac
ENV_EOF'"

echo "=== 7. Setting up PM2 ==="
eval "$SSH_CMD << 'PM2_EOF'
which pm2 || npm install -g pm2
pm2 describe helferchen-backend > /dev/null 2>&1 \
  && pm2 restart helferchen-backend --update-env \
  || pm2 start $REPO_DIR/apps/backend/dist/index.js --name helferchen-backend
pm2 save
PM2_EOF"

echo "=== 8. Uploading new website files ==="
DIST_DIR="/home/fabian/.paperclip/instances/default/projects/1a748860-f520-4bca-83a6-3bd4e7d1e831/694b9b83-22d9-4b83-bf82-5f1b8c2bfa56/_default/apps/website/dist"
eval "$SCP_CMD -r $DIST_DIR/* root@$VPS:/var/www/helferchen/"

echo "=== 9. Configuring nginx ==="
eval "$SSH_CMD 'cat > /etc/nginx/sites-available/helferchen << NGINX_EOF
server {
    listen 80;
    server_name helferchen.info www.helferchen.info;
    root /var/www/helferchen;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_EOF
ln -sf /etc/nginx/sites-available/helferchen /etc/nginx/sites-enabled/helferchen
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx'"

echo "=== 10. Securing SnappyMail — disable additional accounts ==="
eval "$SSH_CMD << 'SNAPPY_EOF'
SNAPPY_CFG_DIR=\$(find /var/www -name 'application.ini' -path '*snappymail*' 2>/dev/null | head -1 | xargs -I{} dirname {} 2>/dev/null)
if [ -n "\$SNAPPY_CFG_DIR" ] && [ -f "\$SNAPPY_CFG_DIR/application.ini" ]; then
  # Disable additional accounts so users can only access their own mailbox
  sed -i 's/^allow_additional_accounts\s*=.*/allow_additional_accounts = Off/' "\$SNAPPY_CFG_DIR/application.ini"
  sed -i 's/^allow_additional_identities\s*=.*/allow_additional_identities = Off/' "\$SNAPPY_CFG_DIR/application.ini"
  # Add settings if not present
  grep -q 'allow_additional_accounts' "\$SNAPPY_CFG_DIR/application.ini" || echo -e '\n[security]\nallow_additional_accounts = Off\nallow_additional_identities = Off' >> "\$SNAPPY_CFG_DIR/application.ini"
  echo "SnappyMail: additional accounts disabled"
else
  echo "SnappyMail config not found — skip (webmail may not be installed yet)"
fi
SNAPPY_EOF"

echo "=== 11. Securing Dovecot — ensure no shared mailbox namespace ==="
eval "$SSH_CMD << 'DOVECOT_EOF'
if [ -d /etc/dovecot ]; then
  # Remove any shared namespace config that would let users browse other mailboxes
  for f in /etc/dovecot/conf.d/*.conf; do
    if grep -q 'type = shared' "\$f" 2>/dev/null; then
      echo "WARNING: shared namespace found in \$f — commenting out"
      sed -i 's/^\(\s*type\s*=\s*shared\)/# EIS-352-disabled \1/' "\$f"
    fi
  done
  systemctl reload dovecot 2>/dev/null || true
  echo "Dovecot: shared namespace check complete"
else
  echo "Dovecot not installed — skip"
fi
DOVECOT_EOF"

echo "=== Deploy complete! ==="
echo "Test: curl http://helferchen.info/api/auth/login -X POST -H 'Content-Type: application/json' -d '{\"username\":\"admin\",\"password\":\"admin123\"}'"
echo "Mail accounts: curl -s http://helferchen.info/api/admin/mail-users -H 'Authorization: Bearer <token>'"
