const { AuditLogger } = require('../utils/auditLogger');
const { TenantContext } = require('../utils/tenantContext');

/**
 * Middleware to automatically log all API requests
 */
const auditMiddleware = async (req, res, next) => {
    const startTime = Date.now();

    // Capture original end function
    const originalEnd = res.end;

    // Override res.end to log after response
    res.end = function (...args) {
        const duration = Date.now() - startTime;

        // Log the request asynchronously (don't block response)
        // Explicitly bind to current context to prevent leakage in complex async flows
        setImmediate(TenantContext.bind(async () => {
            try {
                const tenantId = TenantContext.getTenantId();
                // Reduce noise: don't log GET requests to audit-logs, health checks, or metrics
                if (req.method === 'GET' && (
                    req.path.includes('/audit-logs') ||
                    req.path.includes('/health') ||
                    req.path.includes('/metrics') ||
                    req.path.includes('/rate-limit')
                )) {
                    return;
                }

                // Determine action based on HTTP method
                const actionMap = {
                    GET: 'READ',
                    POST: 'CREATE',
                    PUT: 'UPDATE',
                    PATCH: 'UPDATE',
                    DELETE: 'DELETE',
                };

                const action = actionMap[req.method] || 'READ';
                const success = res.statusCode < 400;
                const severity = res.statusCode >= 500 ? 'ERROR' :
                    res.statusCode >= 400 ? 'WARNING' : 'INFO';

                await AuditLogger.log({
                    action,
                    resource: req.path.split('/')[2] || 'API', // Extract resource from path
                    userId: req.user?.id || req.tenantContext?.userId,
                    req,
                    severity,
                    success,
                    errorMessage: success ? null : res.statusMessage,
                    metadata: {
                        statusCode: res.statusCode,
                        duration,
                        query: req.query,
                        params: req.params,
                    },
                });
            } catch (error) {
                console.error('Audit middleware error:', error.message);
            }
        }));

        // Call original end
        originalEnd.apply(res, args);
    };

    next();
};

module.exports = { auditMiddleware };
