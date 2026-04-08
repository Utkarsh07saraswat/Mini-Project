const promClient = require('prom-client');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics for multi-tenant system

// HTTP request counter
const httpRequestCounter = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status', 'tenant_id'],
    registers: [register],
});

// HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_ms',
    help: 'Duration of HTTP requests in milliseconds',
    labelNames: ['method', 'path', 'status', 'tenant_id'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    registers: [register],
});

// Database query counter
const dbQueryCounter = new promClient.Counter({
    name: 'db_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'collection', 'tenant_id'],
    registers: [register],
});

// Database query duration histogram
const dbQueryDuration = new promClient.Histogram({
    name: 'db_query_duration_ms',
    help: 'Duration of database queries in milliseconds',
    labelNames: ['operation', 'collection', 'tenant_id'],
    buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
    registers: [register],
});

// Tenant-specific metrics
const tenantActiveUsers = new promClient.Gauge({
    name: 'tenant_active_users',
    help: 'Number of active users per tenant',
    labelNames: ['tenant_id'],
    registers: [register],
});

const tenantDataSize = new promClient.Gauge({
    name: 'tenant_data_size_bytes',
    help: 'Total data size per tenant in bytes',
    labelNames: ['tenant_id', 'collection'],
    registers: [register],
});

const tenantRequestRate = new promClient.Gauge({
    name: 'tenant_request_rate',
    help: 'Current request rate per tenant (requests/minute)',
    labelNames: ['tenant_id'],
    registers: [register],
});

// Rate limit metrics
const rateLimitHits = new promClient.Counter({
    name: 'rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['tenant_id', 'tier'],
    registers: [register],
});

// Error counter
const errorCounter = new promClient.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'tenant_id'],
    registers: [register],
});

// Audit log counter
const auditLogCounter = new promClient.Counter({
    name: 'audit_logs_total',
    help: 'Total number of audit logs created',
    labelNames: ['action', 'resource', 'tenant_id', 'success'],
    registers: [register],
});

class MetricsCollector {
    /**
     * Record HTTP request metrics
     */
    static recordHttpRequest(method, path, status, tenantId, duration) {
        httpRequestCounter.inc({ method, path, status, tenant_id: tenantId || 'none' });
        httpRequestDuration.observe(
            { method, path, status, tenant_id: tenantId || 'none' },
            duration
        );
    }

    /**
     * Record database query metrics
     */
    static recordDbQuery(operation, collection, tenantId, duration) {
        dbQueryCounter.inc({ operation, collection, tenant_id: tenantId || 'none' });
        dbQueryDuration.observe(
            { operation, collection, tenant_id: tenantId || 'none' },
            duration
        );
    }

    /**
     * Update tenant active users
     */
    static setTenantActiveUsers(tenantId, count) {
        tenantActiveUsers.set({ tenant_id: tenantId }, count);
    }

    /**
     * Update tenant data size
     */
    static setTenantDataSize(tenantId, collection, sizeBytes) {
        tenantDataSize.set({ tenant_id: tenantId, collection }, sizeBytes);
    }

    /**
     * Update tenant request rate
     */
    static setTenantRequestRate(tenantId, rate) {
        tenantRequestRate.set({ tenant_id: tenantId }, rate);
    }

    /**
     * Record rate limit hit
     */
    static recordRateLimitHit(tenantId, tier) {
        rateLimitHits.inc({ tenant_id: tenantId, tier });
    }

    /**
     * Record error
     */
    static recordError(type, tenantId) {
        errorCounter.inc({ type, tenant_id: tenantId || 'none' });
    }

    /**
     * Record audit log
     */
    static recordAuditLog(action, resource, tenantId, success) {
        auditLogCounter.inc({
            action,
            resource,
            tenant_id: tenantId,
            success: success.toString(),
        });
    }

    /**
     * Get metrics in Prometheus format
     */
    static async getMetrics() {
        return await register.metrics();
    }

    /**
     * Get metrics as JSON
     */
    static async getMetricsJSON() {
        return await register.getMetricsAsJSON();
    }

    /**
     * Reset all metrics (for testing)
     */
    static reset() {
        register.resetMetrics();
    }
}

module.exports = { MetricsCollector, register };
