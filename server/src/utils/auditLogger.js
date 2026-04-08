const ModelProvider = require('./modelProvider');
const { TenantContext } = require('./tenantContext');
const { EncryptionUtils } = require('./encryptionUtils');

// Sensitive fields to mask in logs
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];

class AuditLogger {
    /**
     * Log an action to the audit trail
     */
    static async log({
        action,
        resource,
        resourceId = null,
        userId = null,
        changes = null,
        metadata = null,
        severity = 'INFO',
        success = true,
        errorMessage = null,
        req = null,
    }) {
        try {
            const logEntry = {
                action,
                resource,
                resourceId,
                userId,
                severity,
                success,
                errorMessage,
            };

            // Extract request metadata if provided
            if (req) {
                logEntry.ipAddress = req.ip || req.connection.remoteAddress;
                logEntry.userAgent = req.get('user-agent');
                logEntry.method = req.method;
                logEntry.path = req.path;
            }

            // Mask sensitive data in changes
            if (changes) {
                logEntry.changes = this.maskSensitiveData(changes);
            }

            // Add metadata
            if (metadata) {
                logEntry.metadata = this.maskSensitiveData(metadata);
            }

            // Create audit log entry
            const Model = await ModelProvider.getModel('AuditLog');
            await Model.create(logEntry);
        } catch (error) {
            // Don't throw - logging should never break the application
            console.error('Failed to create audit log:', error.message);
        }
    }

    /**
     * Mask sensitive fields in data
     */
    static maskSensitiveData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const masked = Array.isArray(data) ? [...data] : { ...data };

        for (const key in masked) {
            if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
                masked[key] = '***REDACTED***';
            } else if (typeof masked[key] === 'object' && masked[key] !== null) {
                masked[key] = this.maskSensitiveData(masked[key]);
            }
        }

        return masked;
    }

    /**
     * Query audit logs for a tenant
     */
    static async query({
        action = null,
        resource = null,
        userId = null,
        startDate = null,
        endDate = null,
        severity = null,
        success = null,
        limit = 100,
        skip = 0,
    }) {
        try {
            const tenantId = TenantContext.getTenantId();
            const query = { tenant_id: tenantId };

            if (action) query.action = action;
            if (resource) query.resource = resource;
            if (userId) query.userId = userId;
            if (severity) query.severity = severity;
            if (success !== null) query.success = success;

            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const Model = await ModelProvider.getModel('AuditLog');
            const logs = await Model.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip)
                .lean();

            const total = await Model.countDocuments(query);

            return {
                logs,
                total,
                limit,
                skip,
                hasMore: total > skip + limit,
            };
        } catch (error) {
            throw new Error(`Failed to query audit logs: ${error.message}`);
        }
    }

    /**
     * Get audit statistics for a tenant
     */
    static async getStats({ startDate = null, endDate = null } = {}) {
        try {
            const tenantId = TenantContext.getTenantId();
            const matchQuery = { tenant_id: tenantId };

            if (startDate || endDate) {
                matchQuery.createdAt = {};
                if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
                if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
            }

            const Model = await ModelProvider.getModel('AuditLog');
            const stats = await Model.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: null,
                        totalLogs: { $sum: 1 },
                        successCount: {
                            $sum: { $cond: ['$success', 1, 0] }
                        },
                        failureCount: {
                            $sum: { $cond: ['$success', 0, 1] }
                        },
                        actionBreakdown: {
                            $push: '$action'
                        },
                        severityBreakdown: {
                            $push: '$severity'
                        },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalLogs: 1,
                        successCount: 1,
                        failureCount: 1,
                        successRate: {
                            $multiply: [
                                { $divide: ['$successCount', '$totalLogs'] },
                                100
                            ]
                        },
                    }
                }
            ]);

            return stats[0] || {
                totalLogs: 0,
                successCount: 0,
                failureCount: 0,
                successRate: 0,
            };
        } catch (error) {
            throw new Error(`Failed to get audit stats: ${error.message}`);
        }
    }

    /**
     * Export audit logs (for compliance)
     */
    static async export({ format = 'json', ...queryParams } = {}) {
        try {
            const result = await this.query({ ...queryParams, limit: 10000 });

            if (format === 'csv') {
                // Convert to CSV format
                return this.convertToCSV(result.logs);
            }

            return result.logs;
        } catch (error) {
            throw new Error(`Failed to export audit logs: ${error.message}`);
        }
    }

    /**
     * Convert logs to CSV format
     */
    static convertToCSV(logs) {
        if (logs.length === 0) return '';

        const headers = ['timestamp', 'action', 'resource', 'userId', 'success', 'ipAddress', 'method', 'path'];
        const rows = logs.map(log => [
            log.createdAt,
            log.action,
            log.resource,
            log.userId || '',
            log.success,
            log.ipAddress || '',
            log.method || '',
            log.path || '',
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
}

module.exports = { AuditLogger };
