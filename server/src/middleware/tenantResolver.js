const { TenantContext } = require('../utils/tenantContext');
const { EncryptionUtils } = require('../utils/encryptionUtils');
const jwt = require('jsonwebtoken');

class TenantResolver {
    // Strategy 1: JWT Token-based with encrypted tenant_id
    static fromJWT(req, res, next) {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'No token provided' });

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded.tenantId) {
                return res.status(400).json({ error: 'Invalid tenant context' });
            }

            // Decrypt tenant_id if it's encrypted
            let tenantId = decoded.tenantId;
            if (decoded.encrypted === true) {
                try {
                    tenantId = EncryptionUtils.decryptTenantId(decoded.tenantId);
                } catch (decryptError) {
                    return res.status(401).json({
                        error: 'Invalid encrypted tenant context',
                        message: decryptError.message
                    });
                }
            }

            // Run request in tenant context
            TenantContext.run(tenantId, () => {
                req.tenantId = tenantId;
                req.tenantContext = { ...decoded, tenantId }; // Use decrypted tenant_id
                next();
            });
        } catch (error) {
            res.status(401).json({ error: 'Invalid token', message: error.message });
        }
    }

    /**
     * Helper to create encrypted JWT token
     * @param {object} payload - Token payload
     * @param {boolean} encryptTenantId - Whether to encrypt tenant_id
     * @returns {string} - Signed JWT token
     */
    static createToken(payload, encryptTenantId = true) {
        const tokenPayload = { ...payload };

        if (encryptTenantId && payload.tenantId) {
            tokenPayload.tenantId = EncryptionUtils.encryptTenantId(payload.tenantId);
            tokenPayload.encrypted = true;
        }

        return jwt.sign(tokenPayload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRY || '24h',
        });
    }

    // Strategy 2: Subdomain-based
    static fromSubdomain(req, res, next) {
        const host = req.headers.host || '';
        const subdomain = host.split('.')[0];

        if (!subdomain || subdomain === 'www') {
            return res.status(400).json({ error: 'Tenant subdomain required' });
        }

        TenantContext.run(subdomain, () => {
            req.tenantId = subdomain;
            next();
        });
    }

    // Strategy 3: Header-based (for APIs)
    static fromHeader(headerName = 'X-Tenant-ID') {
        return (req, res, next) => {
            const tenantId = req.headers[headerName.toLowerCase()];
            if (!tenantId) {
                return res.status(400).json({ error: `${headerName} header required` });
            }

            TenantContext.run(tenantId, () => {
                req.tenantId = tenantId;
                next();
            });
        };
    }
}

// Middleware to enforce tenant isolation on all routes
const enforceTenantIsolation = (req, res, next) => {
    try {
        // Verify tenant context exists
        const tenantId = TenantContext.getTenantId();

        // Add tenant ID to response headers for debugging
        res.setHeader('X-Tenant-Context', tenantId);

        // Log tenant access for audit
        console.log(`[${new Date().toISOString()}] Tenant ${tenantId} accessed ${req.path}`);

        next();
    } catch (error) {
        res.status(403).json({
            error: 'Tenant isolation violation',
            message: error.message
        });
    }
};

// Middleware to prevent Route Parameter Spoofing
const enforceRouteIsolation = (req, res, next) => {
    if (req.params.tenantId && req.params.tenantId !== req.tenantId) {
        return res.status(403).json({
            error: "Isolation Breach: Route parameter does not match authenticated identity."
        });
    }
    next();
};

module.exports = { TenantResolver, enforceTenantIsolation, enforceRouteIsolation };
