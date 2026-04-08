const { TenantContext } = require('../utils/tenantContext');
const TenantConnectionProvider = require('../utils/tenantConnectionProvider');

// Base service class that enforces tenant isolation and handles DB switching
class TenantAwareService {
    constructor(model) {
        // We store the base model to extract name and schema for dynamic switching
        this.modelName = model.modelName;
        this.schema = model.schema;
    }

    /**
     * Resolves the model bound to the correct tenant connection.
     * This is called on every operation to ensure dynamic DB switching.
     */
    async getModel() {
        const connection = await TenantConnectionProvider.resolveConnection();
        // Return model bound to this specific connection
        return connection.model(this.modelName, this.schema);
    }

    // All operations automatically filtered by tenant context
    async findAll(query = {}) {
        const tenantId = TenantContext.requireTenant();
        const model = await this.getModel();
        return model.find({ ...query, tenant_id: tenantId });
    }

    async findById(id) {
        const tenantId = TenantContext.requireTenant();
        const model = await this.getModel();
        const doc = await model.findOne({ _id: id, tenant_id: tenantId });
        if (!doc) throw new Error('Document not found or access denied');
        return doc;
    }

    async create(data) {
        const tenantId = TenantContext.requireTenant();
        const model = await this.getModel();
        const doc = new model({
            ...data,
            tenant_id: tenantId
        });
        await doc.save();
        return doc;
    }

    async update(id, data) {
        const tenantId = TenantContext.requireTenant();
        const model = await this.getModel();

        // Prevent cross-tenant updates
        const existing = await this.findById(id);
        if (existing.tenant_id !== tenantId) {
            throw new Error('Cross-tenant modification blocked');
        }

        // Remove tenant_id from update data if present
        delete data.tenant_id;

        return model.findOneAndUpdate(
            { _id: id, tenant_id: tenantId },
            data,
            { new: true }
        );
    }

    async delete(id) {
        const tenantId = TenantContext.requireTenant();
        const model = await this.getModel();
        const result = await model.deleteOne({ _id: id, tenant_id: tenantId });
        if (result.deletedCount === 0) {
            throw new Error('Document not found or access denied');
        }
        return result;
    }

    // Count only tenant-specific documents
    async count(query = {}) {
        const tenantId = TenantContext.requireTenant();
        const model = await this.getModel();
        return model.countDocuments({ ...query, tenant_id: tenantId });
    }
}

module.exports = { TenantAwareService };
