const mongoose = require('mongoose');
const { createTenantSchema } = require('./baseTenantModel');

const auditLogSchema = createTenantSchema({
    action: {
        type: String,
        required: true,
        index: true,
        enum: [
            'CREATE', 'READ', 'UPDATE', 'DELETE',
            'LOGIN', 'LOGOUT', 'AUTH_FAILURE',
            'RATE_LIMIT', 'ACCESS_DENIED',
            'EXPORT', 'IMPORT', 'BACKUP', 'RESTORE'
        ]
    },
    resource: {
        type: String,
        required: true,
        index: true, // e.g., 'User', 'Project', 'Settings'
    },
    resourceId: {
        type: String, // ID of the affected resource
        index: true,
    },
    userId: {
        type: String,
        index: true,
    },
    ipAddress: String,
    userAgent: String,
    method: String, // HTTP method
    path: String, // Request path
    statusCode: Number,
    duration: Number, // Request duration in ms
    changes: {
        type: mongoose.Schema.Types.Mixed, // Before/after for updates
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed, // Additional context
    },
    severity: {
        type: String,
        enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        default: 'INFO',
        index: true,
    },
    success: {
        type: Boolean,
        default: true,
        index: true,
    },
    errorMessage: String,
});

// Compound indexes for common queries
auditLogSchema.index({ tenant_id: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ tenant_id: 1, userId: 1, createdAt: -1 });
auditLogSchema.index({ tenant_id: 1, resource: 1, createdAt: -1 });

// TTL index for automatic log retention (optional)
// Uncomment to auto-delete logs older than 90 days
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
