# CLI Tool Usage Guide

The `cli.js` tool provides command-line management for the multi-tenant system.

## Installation

```bash
# Make CLI executable (Linux/Mac)
chmod +x cli.js

# Or use with node
node cli.js --help
```

## Available Commands

### 1. Generate Secrets

Generate encryption and JWT secrets for production:

```bash
node cli.js generate-secrets
```

Output:
```
JWT_SECRET=a1b2c3d4e5f6...
ENCRYPTION_SECRET=YWJjZGVmZ2hpams...
BACKUP_ENCRYPTION_KEY=cGFzc3dvcmQxMjM...
```

### 2. Generate JWT Token

Create encrypted JWT tokens for testing:

```bash
# Encrypted token (default)
node cli.js generate-token tenant-a user123

# Unencrypted token
node cli.js generate-token tenant-a user123 --unencrypted
```

### 3. Backup Management

#### Manual Backup
```bash
# Basic backup
node cli.js backup tenant-a

# Backup to specific directory
node cli.js backup tenant-a --dir /backups/production

# Encrypted backup
node cli.js backup tenant-a --encrypt
```

#### Schedule Automated Backup
```bash
# Daily at 2 AM
node cli.js schedule-backup tenant-a "0 2 * * *"

# Every 6 hours (enterprise tier)
node cli.js schedule-backup tenant-enterprise "0 */6 * * *" --tier enterprise

# Weekly on Sunday
node cli.js schedule-backup tenant-free "0 2 * * 0" --tier free
```

#### List Scheduled Backups
```bash
node cli.js list-backups
```

### 4. Rate Limit Management

#### Check Rate Limit Status
```bash
node cli.js rate-limit-status tenant-a
```

Output:
```
Tenant: tenant-a
Tier: premium
Limit: 100 requests per 60s
Current: 45
Remaining: 55
```

#### Reset Rate Limit
```bash
node cli.js reset-rate-limit tenant-a
```

### 5. Encryption Tools

#### Encrypt Tenant ID
```bash
node cli.js encrypt tenant-a
```

#### Decrypt Tenant ID
```bash
node cli.js decrypt "base64-encrypted-string"
```

### 6. Health Check

Check system health (MongoDB, Redis):

```bash
node cli.js health
```

Output:
```
✓ MongoDB: Connected
✓ Redis: healthy
```

## Cron Schedule Examples

```bash
# Every minute
"* * * * *"

# Every hour
"0 * * * *"

# Every day at 2 AM
"0 2 * * *"

# Every 6 hours
"0 */6 * * *"

# Every Monday at 3 AM
"0 3 * * 1"

# First day of month at midnight
"0 0 1 * *"
```

## Common Workflows

### Setup New Tenant

```bash
# 1. Generate token for tenant
TOKEN=$(node cli.js generate-token new-tenant admin-user | grep -v "Generated" | grep -v "Use with")

# 2. Schedule backup
node cli.js schedule-backup new-tenant "0 2 * * *" --tier premium

# 3. Verify rate limit
node cli.js rate-limit-status new-tenant
```

### Emergency Operations

```bash
# Reset rate limit if tenant is blocked
node cli.js reset-rate-limit tenant-a

# Immediate backup before maintenance
node cli.js backup tenant-a --encrypt

# Check system health
node cli.js health
```

### Testing & Development

```bash
# Generate test tokens
node cli.js generate-token test-tenant-1 user1
node cli.js generate-token test-tenant-2 user2

# Test encryption
ENCRYPTED=$(node cli.js encrypt test-tenant)
node cli.js decrypt "$ENCRYPTED"
```

## Integration with Scripts

### Bash Script Example

```bash
#!/bin/bash

# Backup all tenants
TENANTS=("tenant-a" "tenant-b" "tenant-c")

for tenant in "${TENANTS[@]}"; do
  echo "Backing up $tenant..."
  node cli.js backup "$tenant" --encrypt
done
```

### Cron Job Example

```bash
# Add to crontab
# Daily backup at 2 AM
0 2 * * * cd /path/to/app && node cli.js backup tenant-a --encrypt >> /var/log/backups.log 2>&1
```

## Environment Variables

The CLI tool uses the same `.env` file as the main application:

```env
MONGODB_URI=mongodb://localhost:27017/multi_tenant
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
ENCRYPTION_SECRET=your-encryption-secret
BACKUP_ENCRYPTION_KEY=your-backup-key
BACKUP_DIR=./backups
```

## Error Handling

The CLI exits with code 1 on errors:

```bash
node cli.js backup non-existent-tenant
echo $?  # Returns 1 on failure
```

Use in scripts:

```bash
if node cli.js health; then
  echo "System healthy"
else
  echo "System unhealthy - alerting..."
  # Send alert
fi
```

## Tips

1. **Always test in development first**
   ```bash
   NODE_ENV=development node cli.js backup test-tenant
   ```

2. **Use encryption for production backups**
   ```bash
   node cli.js backup prod-tenant --encrypt
   ```

3. **Monitor scheduled backups**
   ```bash
   node cli.js list-backups
   ```

4. **Keep secrets secure**
   - Never commit `.env` file
   - Use environment-specific secrets
   - Rotate secrets regularly

5. **Automate with cron**
   - Schedule backups during low-traffic hours
   - Set up monitoring for backup failures
   - Test restore procedures regularly
