# Tenant Configuration Tracking

This directory contains version-controlled tenant configurations.

## Structure
- `*.env` - Tenant database connection strings
- `*.conf` - Dedicated database configurations
- `uid-mapping.txt` - Unix UID to Tenant mapping
- `CHANGELOG.md` - Audit log of tenant provisioning

## Security
All sensitive values should be encrypted using git-crypt or similar in production.
