const TenantConnectionProvider = require('./tenantConnectionProvider');

// Cache schema references to avoid circular dependencies
const schemas = {
    User: require('../models/User').schema,
    Project: require('../models/Project').schema,
    AuditLog: require('../models/AuditLog').schema,
    // Add others as needed
};

/**
 * Provides tenant-isolated Mongoose models.
 * Ensures that models are always bound to the correct tier-specific connection.
 */
class ModelProvider {
    /**
     * Get a model for the current tenant's connection.
     * @param {string} modelName - The name of the model to retrieve
     * @returns {Promise<mongoose.Model>}
     */
    async getModel(modelName) {
        if (!schemas[modelName]) {
            // Lazy load if not in pre-defined list (handles dynamic cases)
            try {
                const modelModule = require(`../models/${modelName}`);
                schemas[modelName] = modelModule.schema || modelModule.model?.schema;
            } catch (err) {
                throw new Error(`Model ${modelName} not found in registry or models directory`);
            }
        }

        const connection = await TenantConnectionProvider.resolveConnection();
        return connection.model(modelName, schemas[modelName]);
    }
}

module.exports = new ModelProvider();
