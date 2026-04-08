/**
 * Simple In-memory registry for tenant configurations.
 * In a real app, this would be fetched from a central Admin/Global DB or Cache.
 */
class TenantRegistry {
    constructor() {
        // High-Value / Premium tenants with dedicated databases
        this.tenants = new Map([
            ['premium-tenant-1', { tier: 'premium', dbName: 'dedicated_db_1' }],
            ['premium-tenant-2', { tier: 'premium', dbName: 'dedicated_db_2' }]
        ]);
    }

    /**
     * Get configuration for a specific tenant
     * @param {string} tenantId 
     * @returns {object|null}
     */
    getConfig(tenantId) {
        return this.tenants.get(tenantId) || { tier: 'standard', dbName: null };
    }

    /**
     * Register or update a high-value tenant (at runtime/test)
     */
    registerPremiumTenant(tenantId, dbName) {
        this.tenants.set(tenantId, { tier: 'premium', dbName });
    }
}

module.exports = new TenantRegistry();
