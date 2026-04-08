#!/bin/bash

# OS-Level Isolation Setup
# Maps tenants to Unix UIDs for process isolation

TENANT_ID=$1
TENANT_UID_BASE=5000

if [ -z "$TENANT_ID" ]; then
    echo "Error: Tenant ID required"
    exit 1
fi

# Generate deterministic UID from tenant ID (hashed)
TENANT_HASH=$(echo -n "$TENANT_ID" | sha256sum | cut -d' ' -f1)
UID_OFFSET=$((0x${TENANT_HASH:0:4} % 1000))
TENANT_UID=$(($TENANT_UID_BASE + $UID_OFFSET))

# Create tenant-specific user (for process isolation)
USERNAME="tenant_${TENANT_ID}"

if ! id "$USERNAME" &>/dev/null; then
    sudo useradd -u "$TENANT_UID" -m -s /bin/false "$USERNAME"
    echo "Created user: $USERNAME (UID: $TENANT_UID)"
else
    echo "User $USERNAME already exists (UID: $TENANT_UID)"
fi

# Set up directory permissions
TENANT_DIR="/var/tenants/${TENANT_ID}"
sudo mkdir -p "$TENANT_DIR"
sudo chown "$USERNAME:$USERNAME" "$TENANT_DIR"
sudo chmod 700 "$TENANT_DIR"  # Only tenant user can access

# Save UID mapping
echo "${TENANT_ID}:${TENANT_UID}:${USERNAME}" >> ./tenant-configs/uid-mapping.txt

echo "OS-level isolation configured for tenant: $TENANT_ID (UID: $TENANT_UID)"
