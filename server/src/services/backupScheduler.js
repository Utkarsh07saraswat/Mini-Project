const cron = require('node-cron');
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

const execAsync = promisify(exec);

class BackupScheduler {
    constructor() {
        this.jobs = new Map();
        this.backupScript = path.join(__dirname, '../scripts/backupTenant.sh');
    }

    /**
     * Schedule automatic backups for a tenant
     * @param {string} tenantId - Tenant identifier
     * @param {string} schedule - Cron expression (default: daily at 2 AM)
     * @param {object} options - Backup options
     */
    scheduleBackup(tenantId, schedule = '0 2 * * *', options = {}) {
        // Stop existing job if any
        this.stopBackup(tenantId);

        const job = cron.schedule(schedule, async () => {
            console.log(`[${new Date().toISOString()}] Starting scheduled backup for tenant: ${tenantId}`);

            try {
                await this.performBackup(tenantId, options);
                console.log(`✓ Scheduled backup completed for tenant: ${tenantId}`);
            } catch (error) {
                console.error(`✗ Scheduled backup failed for tenant: ${tenantId}`, error.message);
            }
        }, {
            scheduled: true,
            timezone: options.timezone || 'UTC',
        });

        this.jobs.set(tenantId, {
            job,
            schedule,
            options,
            createdAt: new Date(),
        });

        console.log(`✓ Backup scheduled for tenant ${tenantId}: ${schedule}`);
        return { success: true, tenantId, schedule };
    }

    /**
     * Perform backup for a tenant
     */
    async performBackup(tenantId, options = {}) {
        const backupDir = options.backupDir || process.env.BACKUP_DIR || './backups';

        try {
            // Ensure backup directory exists
            await fs.mkdir(backupDir, { recursive: true });

            // Build command
            const cmd = `bash "${this.backupScript}" "${tenantId}" "${backupDir}"`;

            console.log(`Executing backup: ${cmd}`);
            const { stdout, stderr } = await execAsync(cmd, {
                env: {
                    ...process.env,
                    MONGODB_URI: options.mongoUri || process.env.MONGODB_URI,
                    BACKUP_ENCRYPTION_KEY: options.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY,
                    S3_BACKUP_BUCKET: options.s3Bucket || process.env.S3_BACKUP_BUCKET,
                    BACKUP_RETENTION_COUNT: options.retentionCount || process.env.BACKUP_RETENTION_COUNT || '7',
                },
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });

            if (stderr && !stderr.includes('writing')) {
                console.warn('Backup warnings:', stderr);
            }

            return {
                success: true,
                tenantId,
                timestamp: new Date().toISOString(),
                output: stdout,
            };
        } catch (error) {
            throw new Error(`Backup failed for tenant ${tenantId}: ${error.message}`);
        }
    }

    /**
     * Stop scheduled backup for a tenant
     */
    stopBackup(tenantId) {
        const jobInfo = this.jobs.get(tenantId);
        if (jobInfo) {
            jobInfo.job.stop();
            this.jobs.delete(tenantId);
            console.log(`✓ Backup schedule stopped for tenant: ${tenantId}`);
            return { success: true, tenantId };
        }
        return { success: false, message: 'No scheduled backup found' };
    }

    /**
     * Get all scheduled backups
     */
    getScheduledBackups() {
        const schedules = [];
        for (const [tenantId, info] of this.jobs.entries()) {
            schedules.push({
                tenantId,
                schedule: info.schedule,
                options: info.options,
                createdAt: info.createdAt,
                isRunning: info.job.getStatus() === 'scheduled',
            });
        }
        return schedules;
    }

    /**
     * Schedule backups for multiple tenants with different tiers
     */
    scheduleByTier(tenants) {
        const tierSchedules = {
            enterprise: '0 */6 * * *',  // Every 6 hours
            premium: '0 2 * * *',        // Daily at 2 AM
            free: '0 2 * * 0',           // Weekly on Sunday at 2 AM
        };

        for (const tenant of tenants) {
            const schedule = tierSchedules[tenant.tier] || tierSchedules.free;
            this.scheduleBackup(tenant.id, schedule, tenant.backupOptions || {});
        }

        console.log(`✓ Scheduled backups for ${tenants.length} tenants`);
    }

    /**
     * Stop all scheduled backups
     */
    stopAll() {
        for (const tenantId of this.jobs.keys()) {
            this.stopBackup(tenantId);
        }
        console.log('✓ All backup schedules stopped');
    }

    /**
     * Perform immediate backup for all tenants
     */
    async backupAll(tenantIds, options = {}) {
        const results = [];

        for (const tenantId of tenantIds) {
            try {
                const result = await this.performBackup(tenantId, options);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    tenantId,
                    error: error.message,
                });
            }
        }

        return results;
    }
}

// Singleton instance
const backupScheduler = new BackupScheduler();

module.exports = { BackupScheduler, backupScheduler };
