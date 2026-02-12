/**
 * Input validation utilities
 */
const validators = {
    isValidTenantId: (tenantId) => {
        return typeof tenantId === 'string' && /^[a-z0-9-]+$/.test(tenantId);
    },

    isValidEmail: (email) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    isValidProjectName: (name) => {
        return typeof name === 'string' && name.length >= 3 && name.length <= 50;
    }
};

module.exports = validators;
