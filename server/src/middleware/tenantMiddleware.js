const { TenantResolver, enforceTenantIsolation } = require('./tenantResolver');

module.exports = {
    tenantMiddleware: TenantResolver.fromJWT, // The middleware to resolve tenant
    enforceTenantIsolation // The middleware to enforce isolation
};
