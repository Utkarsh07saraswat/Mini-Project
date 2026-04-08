#!/bin/bash

# Multi-Tenant Backup Script
# Backs up tenant-specific data from MongoDB

set -e  # Exit on error

TENANT_ID=$1
BACKUP_DIR=${2:-"./backups"}
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MONGO_URI=${MONGODB_URI:-"mongodb://localhost:27017/multi_tenant"}

if [ -z "$TENANT_ID" ]; then
    echo "Usage: $0 <tenant_id> [backup_dir]"
    echo "Example: $0 tenant-a ./backups"
    exit 1
fi

echo "========================================="
echo "Multi-Tenant Backup Utility"
echo "========================================="
echo "Tenant ID: $TENANT_ID"
echo "Timestamp: $TIMESTAMP"
echo "Backup Directory: $BACKUP_DIR"
echo "========================================="

# Create backup directory structure
TENANT_BACKUP_DIR="${BACKUP_DIR}/${TENANT_ID}"
BACKUP_PATH="${TENANT_BACKUP_DIR}/${TIMESTAMP}"
mkdir -p "$BACKUP_PATH"

echo "✓ Created backup directory: $BACKUP_PATH"

# Extract database name from MongoDB URI
DB_NAME=$(echo "$MONGO_URI" | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "Backing up tenant data from database: $DB_NAME"

# Backup using mongodump with tenant filter
# This backs up all collections but only documents with matching tenant_id
mongodump \
    --uri="$MONGO_URI" \
    --out="$BACKUP_PATH" \
    --query="{\"tenant_id\": \"$TENANT_ID\"}" \
    --gzip

if [ $? -eq 0 ]; then
    echo "✓ MongoDB dump completed successfully"
else
    echo "✗ MongoDB dump failed"
    exit 1
fi

# Create metadata file
cat > "${BACKUP_PATH}/metadata.json" <<EOF
{
  "tenant_id": "$TENANT_ID",
  "timestamp": "$TIMESTAMP",
  "backup_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "database": "$DB_NAME",
  "mongo_uri": "${MONGO_URI%%\?*}",
  "backup_type": "tenant_specific",
  "compressed": true
}
EOF

echo "✓ Created metadata file"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
echo "Backup size: $BACKUP_SIZE"

# Create archive (optional - uncomment if needed)
# ARCHIVE_NAME="${TENANT_BACKUP_DIR}/${TENANT_ID}_${TIMESTAMP}.tar.gz"
# tar -czf "$ARCHIVE_NAME" -C "$BACKUP_PATH" .
# echo "✓ Created archive: $ARCHIVE_NAME"

# Encrypt backup (optional - requires openssl and BACKUP_ENCRYPTION_KEY env var)
if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
    echo "Encrypting backup..."
    ENCRYPTED_ARCHIVE="${BACKUP_PATH}.tar.gz.enc"
    tar -czf - -C "$BACKUP_PATH" . | \
        openssl enc -aes-256-cbc -salt -pbkdf2 -pass pass:"$BACKUP_ENCRYPTION_KEY" \
        -out "$ENCRYPTED_ARCHIVE"
    
    if [ $? -eq 0 ]; then
        echo "✓ Backup encrypted: $ENCRYPTED_ARCHIVE"
        # Optionally remove unencrypted backup
        # rm -rf "$BACKUP_PATH"
    else
        echo "✗ Encryption failed"
    fi
fi

# Keep only last N backups (default: 7)
RETENTION_COUNT=${BACKUP_RETENTION_COUNT:-7}
echo "Applying retention policy (keep last $RETENTION_COUNT backups)..."

cd "$TENANT_BACKUP_DIR"
ls -t | tail -n +$((RETENTION_COUNT + 1)) | xargs -r rm -rf
echo "✓ Retention policy applied"

# Upload to S3 (optional - requires AWS CLI)
if [ -n "$S3_BACKUP_BUCKET" ]; then
    echo "Uploading to S3..."
    aws s3 sync "$BACKUP_PATH" "s3://${S3_BACKUP_BUCKET}/${TENANT_ID}/${TIMESTAMP}/" \
        --storage-class STANDARD_IA
    
    if [ $? -eq 0 ]; then
        echo "✓ Backup uploaded to S3"
    else
        echo "✗ S3 upload failed (continuing anyway)"
    fi
fi

echo "========================================="
echo "✓ Backup completed successfully"
echo "Location: $BACKUP_PATH"
echo "Size: $BACKUP_SIZE"
echo "========================================="

# Log backup to audit trail
echo "{\"tenant_id\":\"$TENANT_ID\",\"action\":\"BACKUP\",\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"size\":\"$BACKUP_SIZE\",\"path\":\"$BACKUP_PATH\"}" >> "${TENANT_BACKUP_DIR}/backup_log.jsonl"

exit 0
