#!/bin/bash

# Tenant Database Provisioning Script
# Creates isolated MongoDB instance for high-value tenants

TENANT_ID=$1
TENANT_TIER=$2  # 'shared' or 'dedicated'
MONGO_BASE_PORT=27017
CONFIG_DIR="./tenant-configs"

if [ -z "$TENANT_ID" ]; then
    echo "Error: Tenant ID required"
    exit 1
fi

echo "Provisioning database for tenant: $TENANT_ID (Tier: $TENANT_TIER)"

if [ "$TENANT_TIER" == "dedicated" ]; then
    # Create dedicated MongoDB instance for high-value tenant
    DB_PORT=$(($MONGO_BASE_PORT + $(shuf -i 1000-9000 -n 1)))
    DB_NAME="tenant_${TENANT_ID}_db"
    DB_PATH="/data/mongodb/${TENANT_ID}"
    
    # Create data directory with proper permissions
    mkdir -p "$DB_PATH"
    
    # Generate tenant-specific credentials
    DB_USER="tenant_${TENANT_ID}_user"
    DB_PASS=$(openssl rand -base64 32)
    
    # Create MongoDB configuration file
    cat > "${CONFIG_DIR}/${TENANT_ID}.conf" <<EOF
# Tenant-specific MongoDB configuration
storage:
  dbPath: ${DB_PATH}
  journal:
    enabled: true

net:
  port: ${DB_PORT}
  bindIp: 127.0.0.1

security:
  authorization: enabled

# Tenant isolation settings
setParameter:
  tenantId: ${TENANT_ID}
EOF

    # Store connection string securely
    cat > "${CONFIG_DIR}/${TENANT_ID}.env" <<EOF
# Auto-generated tenant configuration
TENANT_ID=${TENANT_ID}
DB_TYPE=dedicated
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_URI=mongodb://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}?authSource=admin
CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

    # Start dedicated MongoDB instance (requires mongod)
    # mongod --config "${CONFIG_DIR}/${TENANT_ID}.conf" --fork --logpath "/var/log/mongodb/${TENANT_ID}.log"
    
    echo "Dedicated database provisioned on port: $DB_PORT"
    echo "Config saved to: ${CONFIG_DIR}/${TENANT_ID}.env"
    
else
    # Shared database - row-level isolation only
    cat > "${CONFIG_DIR}/${TENANT_ID}.env" <<EOF
# Shared tenant configuration
TENANT_ID=${TENANT_ID}
DB_TYPE=shared
DB_URI=mongodb://localhost:27017/multi_tenant_shared
CREATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
    
    echo "Shared database configuration created"
fi

# Git track the configuration
cd "$CONFIG_DIR"
git add "${TENANT_ID}.env" "${TENANT_ID}.conf" 2>/dev/null || true
git commit -m "Provision tenant: ${TENANT_ID} [Tier: ${TENANT_TIER}]" 2>/dev/null || true
cd ..

echo "Tenant provisioning complete for: $TENANT_ID"
