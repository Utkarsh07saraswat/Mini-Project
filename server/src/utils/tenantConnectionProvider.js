const ConnectionManager = require('./connectionManager');
const TenantRegistry = require('./tenantRegistry');
const { TenantContext } = require('./tenantContext');

/**
 * CORE LOGIC: Connection Selection & Isolation
 * 
 * This provider determines WHICH database connection to use for the current request.
 * It enforces strict isolation:
 * 1. Dedicated DBs for Premium tenants.
 * 2. Shared DB for Standard tenants.
 * 3. NO fallback to shared if dedicated fails.
 * 4. NO pool sharing between tiers.
 */
class TenantConnectionProvider {
    /**
     * Resolves the correct connection for the current tenant context.
     * @returns {Promise<mongoose.Connection>}
     */
    async resolveConnection() {
        const tenantId = TenantContext.getTenantId();
        const config = TenantRegistry.getConfig(tenantId);

        // ConnectionManager handles the 'no fallback' and 'pool isolation' requirements
        return ConnectionManager.getConnection(tenantId, config);
    }
}

module.exports = new TenantConnectionProvider();
