#!/usr/bin/env node

/**
 * Tenant Management CLI Tool
 * Manage tenants, backups, and system operations
 */

const { program } = require('commander');
const { backupScheduler } = require('../src/services/backupScheduler');
const { TenantRateLimiter } = require('../src/middleware/rateLimiter');
const { EncryptionUtils } = require('../src/utils/encryptionUtils');
const { TenantResolver } = require('../src/middleware/tenantResolver');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

program
    .name('tenant-cli')
    .description('Multi-tenant system management CLI')
    .version('1.0.0');

// Generate secrets
program
    .command('generate-secrets')
    .description('Generate encryption and JWT secrets')
    .action(() => {
        const crypto = require('crypto');
        console.log('\n🔐 Generated Secrets (add to .env file):\n');
        console.log(`JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`);
        console.log(`ENCRYPTION_SECRET=${crypto.randomBytes(32).toString('base64')}`);
        console.log(`BACKUP_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('base64')}`);
        console.log('');
    });

// Generate JWT token
program
    .command('generate-token <tenantId> <userId>')
    .description('Generate an encrypted JWT token')
    .option('-u, --unencrypted', 'Generate unencrypted token')
    .action((tenantId, userId, options) => {
        require('dotenv').config();

        const token = TenantResolver.createToken(
            { tenantId, userId },
            !options.unencrypted
        );

        console.log('\n🎫 Generated JWT Token:\n');
        console.log(token);
        console.log('\nUse with: Authorization: Bearer <token>');
        console.log('');
    });

// Backup tenant
program
    .command('backup <tenantId>')
    .description('Backup tenant data')
    .option('-d, --dir <directory>', 'Backup directory', './backups')
    .option('-e, --encrypt', 'Encrypt backup')
    .action(async (tenantId, options) => {
        require('dotenv').config();

        console.log(`\n💾 Backing up tenant: ${tenantId}...`);

        try {
            const result = await backupScheduler.performBackup(tenantId, {
                backupDir: options.dir,
                encryptionKey: options.encrypt ? process.env.BACKUP_ENCRYPTION_KEY : null,
            });

            console.log('✓ Backup completed successfully');
            console.log(`Timestamp: ${result.timestamp}`);
            console.log('');
        } catch (error) {
            console.error('✗ Backup failed:', error.message);
            process.exit(1);
        }
    });

// Schedule backup
program
    .command('schedule-backup <tenantId> <schedule>')
    .description('Schedule automated backup (cron format)')
    .option('-t, --tier <tier>', 'Tenant tier (free, premium, enterprise)')
    .action((tenantId, schedule, options) => {
        require('dotenv').config();

        console.log(`\n⏰ Scheduling backup for tenant: ${tenantId}`);
        console.log(`Schedule: ${schedule}`);

        const result = backupScheduler.scheduleBackup(tenantId, schedule, {
            tier: options.tier,
        });

        console.log('✓ Backup scheduled successfully');
        console.log('');
    });

// List scheduled backups
program
    .command('list-backups')
    .description('List all scheduled backups')
    .action(() => {
        const schedules = backupScheduler.getScheduledBackups();

        console.log('\n📋 Scheduled Backups:\n');
        if (schedules.length === 0) {
            console.log('No scheduled backups');
        } else {
            schedules.forEach(s => {
                console.log(`Tenant: ${s.tenantId}`);
                console.log(`  Schedule: ${s.schedule}`);
                console.log(`  Status: ${s.isRunning ? 'Running' : 'Stopped'}`);
                console.log(`  Created: ${s.createdAt}`);
                console.log('');
            });
        }
    });

// Reset rate limit
program
    .command('reset-rate-limit <tenantId>')
    .description('Reset rate limit for a tenant')
    .action(async (tenantId) => {
        require('dotenv').config();
        require('../src/config/redisClient').createRedisClient();

        console.log(`\n⚡ Resetting rate limit for tenant: ${tenantId}...`);

        try {
            const result = await TenantRateLimiter.reset(tenantId);
            console.log('✓', result.message);
            console.log('');
        } catch (error) {
            console.error('✗ Failed:', error.message);
            process.exit(1);
        }
    });

// Check rate limit status
program
    .command('rate-limit-status <tenantId>')
    .description('Check rate limit status for a tenant')
    .action(async (tenantId) => {
        require('dotenv').config();
        require('../src/config/redisClient').createRedisClient();

        try {
            const status = await TenantRateLimiter.getStatus(tenantId);

            console.log('\n⚡ Rate Limit Status:\n');
            console.log(`Tenant: ${status.tenant}`);
            console.log(`Tier: ${status.tier}`);
            console.log(`Limit: ${status.limit} requests per ${status.windowMs / 1000}s`);
            console.log(`Current: ${status.current}`);
            console.log(`Remaining: ${status.remaining}`);
            console.log('');
        } catch (error) {
            console.error('✗ Failed:', error.message);
            process.exit(1);
        }
    });

// Encrypt/decrypt tenant ID
program
    .command('encrypt <tenantId>')
    .description('Encrypt a tenant ID')
    .action((tenantId) => {
        require('dotenv').config();

        const encrypted = EncryptionUtils.encryptTenantId(tenantId);
        console.log('\n🔒 Encrypted Tenant ID:\n');
        console.log(encrypted);
        console.log('');
    });

program
    .command('decrypt <encryptedTenantId>')
    .description('Decrypt a tenant ID')
    .action((encryptedTenantId) => {
        require('dotenv').config();

        try {
            const decrypted = EncryptionUtils.decryptTenantId(encryptedTenantId);
            console.log('\n🔓 Decrypted Tenant ID:\n');
            console.log(decrypted);
            console.log('');
        } catch (error) {
            console.error('✗ Decryption failed:', error.message);
            process.exit(1);
        }
    });

// Health check
program
    .command('health')
    .description('Check system health')
    .action(async () => {
        console.log('\n🏥 System Health Check:\n');

        // Check MongoDB
        try {
            const mongoose = require('mongoose');
            await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant');
            console.log('✓ MongoDB: Connected');
            await mongoose.connection.close();
        } catch (error) {
            console.log('✗ MongoDB:', error.message);
        }

        // Check Redis
        try {
            const { checkRedisHealth } = require('../src/config/redisClient');
            require('../src/config/redisClient').createRedisClient();
            const health = await checkRedisHealth();
            console.log(`✓ Redis: ${health.status}`);
        } catch (error) {
            console.log('✗ Redis:', error.message);
        }

        console.log('');
    });

program.parse();
