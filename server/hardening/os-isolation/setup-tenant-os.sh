#!/bin/bash
# OS-Level Isolation Provisioning Script
# This script sets up the necessary Unix users, directories, and permissions.

set -e

# Constraints: Fail hard on misconfiguration
if [ "$EUID" -ne 0 ]; then
  echo "CRITICAL: This script must be run as root."
  exit 1
fi

TENANTS=("tenant-a" "tenant-b" "premium-tenant-1")
APP_PATH="/opt/multi-tenant/current"
DATA_ROOT="/var/lib/multi-tenant"
LOG_ROOT="/var/log/multi-tenant"
CONFIG_ROOT="/etc/multi-tenant/tenants"

echo "Setting up filesystem layout..."
mkdir -p "$DATA_ROOT" "$LOG_ROOT" "$CONFIG_ROOT"
chmod 0755 "$DATA_ROOT" "$LOG_ROOT"

for i in "${!TENANTS[@]}"; do
  TENANT="${TENANTS[$i]}"
  echo "Provisioning tenant: $TENANT..."

  # 1. Create dedicated Unix User/Group
  if ! id "$TENANT" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin -m -d "/home/$TENANT" "$TENANT"
    echo "Created user $TENANT"
  fi

  # 2. Create isolated data directory
  mkdir -p "$DATA_ROOT/$TENANT"
  chown "$TENANT:$TENANT" "$DATA_ROOT/$TENANT"
  chmod 0700 "$DATA_ROOT/$TENANT" # Strictly owner-only

  # 3. Create isolated log directory
  mkdir -p "$LOG_ROOT/$TENANT"
  chown "$TENANT:$TENANT" "$LOG_ROOT/$TENANT"
  chmod 0700 "$LOG_ROOT/$TENANT" # Strictly owner-only

  # 4. Create environment configuration with unique port for isolation
  # PORT 3000, 3001, 3002...
  TENANT_PORT=$((3000 + i))
  cat > "$CONFIG_ROOT/$TENANT.env" <<EOF
NODE_ENV=production
TENANT_ID=$TENANT
DATA_DIR=$DATA_ROOT/$TENANT
LOG_DIR=$LOG_ROOT/$TENANT
MONGODB_URI=mongodb://localhost:27017/multi_tenant_$TENANT
PORT=$TENANT_PORT
EOF
  chown root:root "$CONFIG_ROOT/$TENANT.env"
  chmod 0600 "$CONFIG_ROOT/$TENANT.env" # Only root can read env files (contains secrets)

  echo "Tenant $TENANT provisioned successfully."
done

# 5. Set global app permissions (Readable by all tenants, writable only by root/deploy)
chown -R root:root "$APP_PATH"
find "$APP_PATH" -type d -exec chmod 0755 {} +
find "$APP_PATH" -type f -exec chmod 0644 {} +

echo "OS Hardening provisioning complete."
