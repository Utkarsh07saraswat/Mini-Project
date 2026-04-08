#!/bin/bash

# Multi-Tenant Restore Script
# Restores tenant-specific data to MongoDB

set -e  # Exit on error

TENANT_ID=$1
BACKUP_PATH=$2
MONGO_URI=${MONGODB_URI:-"mongodb://localhost:27017/multi_tenant"}
DRY_RUN=${3:-false}

if [ -z "$TENANT_ID" ] || [ -z "$BACKUP_PATH" ]; then
    echo "Usage: $0 <tenant_id> <backup_path> [dry_run]"
    echo "Example: $0 tenant-a ./backups/tenant-a/20260203_012345"
    echo "         $0 tenant-a ./backups/tenant-a/20260203_012345 true  # Dry run"
    exit 1
fi

echo "========================================="
echo "Multi-Tenant Restore Utility"
echo "========================================="
echo "Tenant ID: $TENANT_ID"
echo "Backup Path: $BACKUP_PATH"
echo "Dry Run: $DRY_RUN"
echo "========================================="

# Verify backup path exists
if [ ! -d "$BACKUP_PATH" ]; then
    echo "✗ Backup path does not exist: $BACKUP_PATH"
    exit 1
fi

# Check for metadata file
METADATA_FILE="${BACKUP_PATH}/metadata.json"
if [ -f "$METADATA_FILE" ]; then
    echo "Backup metadata:"
    cat "$METADATA_FILE"
    echo ""
    
    # Verify tenant ID matches
    BACKUP_TENANT=$(grep -oP '"tenant_id":\s*"\K[^"]+' "$METADATA_FILE")
    if [ "$BACKUP_TENANT" != "$TENANT_ID" ]; then
        echo "✗ WARNING: Backup tenant ID ($BACKUP_TENANT) does not match requested tenant ($TENANT_ID)"
        read -p "Continue anyway? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo "Restore cancelled"
            exit 1
        fi
    fi
else
    echo "⚠ Warning: No metadata file found"
fi

# Decrypt if needed
if [ -f "${BACKUP_PATH}.tar.gz.enc" ]; then
    if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
        echo "✗ Backup is encrypted but BACKUP_ENCRYPTION_KEY not set"
        exit 1
    fi
    
    echo "Decrypting backup..."
    TEMP_DIR=$(mktemp -d)
    openssl enc -aes-256-cbc -d -pbkdf2 -pass pass:"$BACKUP_ENCRYPTION_KEY" \
        -in "${BACKUP_PATH}.tar.gz.enc" | tar -xzf - -C "$TEMP_DIR"
    
    BACKUP_PATH="$TEMP_DIR"
    echo "✓ Backup decrypted to: $TEMP_DIR"
fi

# Extract database name
DB_NAME=$(echo "$MONGO_URI" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_BACKUP_PATH="${BACKUP_PATH}/${DB_NAME}"

if [ ! -d "$DB_BACKUP_PATH" ]; then
    echo "✗ Database backup directory not found: $DB_BACKUP_PATH"
    exit 1
fi

echo "Database: $DB_NAME"
echo "Restore from: $DB_BACKUP_PATH"

# Dry run - just show what would be restored
if [ "$DRY_RUN" = "true" ]; then
    echo ""
    echo "DRY RUN - No changes will be made"
    echo "Collections to restore:"
    ls -1 "$DB_BACKUP_PATH"
    echo ""
    echo "To perform actual restore, run without dry_run flag"
    exit 0
fi

# Confirm restore
echo ""
echo "⚠ WARNING: This will restore data for tenant: $TENANT_ID"
echo "⚠ Existing data may be overwritten!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled"
    exit 0
fi

# Create pre-restore backup
echo "Creating pre-restore backup..."
PRE_RESTORE_DIR="./backups/${TENANT_ID}/pre_restore_$(date +"%Y%m%d_%H%M%S")"
mkdir -p "$PRE_RESTORE_DIR"

mongodump \
    --uri="$MONGO_URI" \
    --out="$PRE_RESTORE_DIR" \
    --query="{\"tenant_id\": \"$TENANT_ID\"}" \
    --gzip \
    2>&1 | grep -v "writing"

echo "✓ Pre-restore backup created: $PRE_RESTORE_DIR"

# Perform restore
echo "Restoring tenant data..."

mongorestore \
    --uri="$MONGO_URI" \
    --dir="$DB_BACKUP_PATH" \
    --gzip \
    --drop \
    --nsInclude="${DB_NAME}.*" \
    2>&1 | grep -v "continuing through error"

if [ $? -eq 0 ]; then
    echo "✓ Restore completed successfully"
else
    echo "✗ Restore failed"
    echo "Pre-restore backup available at: $PRE_RESTORE_DIR"
    exit 1
fi

# Verify restore
echo "Verifying restore..."
MONGO_HOST=$(echo "$MONGO_URI" | sed -n 's/mongodb:\/\/\([^\/]*\).*/\1/p')

# Count documents for tenant
DOC_COUNT=$(mongosh "$MONGO_URI" --quiet --eval "
    db.getSiblingDB('$DB_NAME').getCollectionNames().map(coll => {
        return db.getSiblingDB('$DB_NAME')[coll].countDocuments({tenant_id: '$TENANT_ID'})
    }).reduce((a,b) => a+b, 0)
")

echo "✓ Verified: $DOC_COUNT documents restored for tenant $TENANT_ID"

# Cleanup temp directory if decrypted
if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
    echo "✓ Cleaned up temporary files"
fi

echo "========================================="
echo "✓ Restore completed successfully"
echo "Documents restored: $DOC_COUNT"
echo "Pre-restore backup: $PRE_RESTORE_DIR"
echo "========================================="

# Log restore to audit trail
BACKUP_DIR=$(dirname "$BACKUP_PATH")
echo "{\"tenant_id\":\"$TENANT_ID\",\"action\":\"RESTORE\",\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",\"source\":\"$BACKUP_PATH\",\"documents\":$DOC_COUNT}" >> "${BACKUP_DIR}/restore_log.jsonl"

exit 0
