const mongoose = require('mongoose');

class ConnectionManager {
    constructor() {
        this.connections = new Map();
        this.models = new Map(); // Store compiled models per connection
    }

    /**
     * Get or create a connection for a tenant
     * @param {string} tenantId 
     * @param {object} config - Configuration for dedicated DB
     * @returns {Promise<mongoose.Connection>}
     */
    async getConnection(tenantId, config = null) {
        // If not a premium tenant with dedicated config, return shared connection
        if (!config || !config.dbName) {
            return mongoose.connection;
        }

        if (this.connections.has(tenantId)) {
            const conn = this.connections.get(tenantId);
            if (conn.readyState === 1 || conn.readyState === 2) {
                return conn;
            }
            // If connection is dead/broken, remove it to try reconnecting
            this.connections.delete(tenantId);
        }

        // Dedicated database - MUST NOT share pool with shared DB
        const baseUri = process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017';
        const uri = `${baseUri}/${config.dbName}`;

        console.log(`[ConnectionManager] Creating dedicated connection for tenant ${tenantId} to ${config.dbName}`);

        try {
            const connection = await mongoose.createConnection(uri, {
                // Ensure strict isolation and no pool sharing
                maxPoolSize: 10,
                minPoolSize: 2,
                serverSelectionTimeoutMS: 2000, // Fail fast if DB is unreachable
            }).asPromise();

            this.connections.set(tenantId, connection);
            return connection;
        } catch (error) {
            console.error(`[ConnectionManager] FAILED to connect dedicated DB for tenant ${tenantId}:`, error.message);
            // FAIL HARD: No fallback allowed
            throw new Error(`CRITICAL: Dedicated database for tenant ${tenantId} is unavailable. Writing to shared DB is strictly forbidden.`);
        }
    }

    /**
     * Get a model bound to the correct tenant connection
     * @param {string} tenantId 
     * @param {string} modelName 
     * @param {mongoose.Schema} schema 
     * @param {object} config 
     */
    async getModel(tenantId, modelName, schema, config) {
        const connection = await this.getConnection(tenantId, config);

        const modelKey = `${connection.id || connection.name}_${modelName}`;
        if (this.models.has(modelKey)) {
            return this.models.get(modelKey);
        }

        const model = connection.model(modelName, schema);
        this.models.set(modelKey, model);
        return model;
    }
}

module.exports = new ConnectionManager();
