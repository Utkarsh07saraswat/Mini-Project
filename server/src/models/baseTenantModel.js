const mongoose = require('mongoose');
const { TenantContext } = require('../utils/tenantContext');

// Base schema factory that enforces tenant_id
function createTenantSchema(definition, options = {}) {
    const schema = new mongoose.Schema({
        tenant_id: {
            type: String,
            index: true,  // Index every collection by tenant_id
            immutable: true  // Prevent tenant_id modification
        },
        ...definition
    }, {
        timestamps: true,
        ...options
    });

    // Compound index for faster tenant-specific queries
    schema.index({ tenant_id: 1, createdAt: -1 });

    // Pre-save middleware to auto-inject tenant_id
    schema.pre('save', async function () {
        if (!this.tenant_id) {
            try {
                this.tenant_id = TenantContext.getTenantId();
            } catch (error) {
                throw new Error('Cannot save document without tenant context');
            }
        }
    });

    // Query middleware to auto-filter by tenant (Covers find, update, delete)
    schema.pre(['find', 'findOne', 'count', 'countDocuments', 'updateMany', 'deleteOne', 'deleteMany', 'findOneAndUpdate', 'findOneAndDelete'], function () {
        try {
            const tenantId = TenantContext.getTenantId();
            // Use $and to ensure the tenant_id is strictly matched, even if the user tried to query another tenant
            this.and([{ tenant_id: tenantId }]);
        } catch (error) {
            // If no context, block query (unless it's admin operation)
            const query = this.getQuery() || {};
            const options = this.getOptions() || {};
            if (!query._overrideTenantCheck && !options._overrideTenantCheck) {
                throw new Error('Tenant isolation enforced: Context required');
            }
        }
    });

    // Enforce tenant filter on Aggreration Pipelines
    schema.pre('aggregate', function () {
        try {
            const tenantId = TenantContext.getTenantId();
            // Force $match as the first stage to prevent cross-tenant leak
            this.pipeline().unshift({ $match: { tenant_id: tenantId } });
        } catch (error) {
            throw new Error('Aggregation isolation enforced: Context required');
        }
    });

    // Harden bulkWrite - Static middleware
    schema.pre('bulkWrite', function (next, ops) {
        try {
            const tenantId = TenantContext.getTenantId();
            ops.forEach(op => {
                const type = Object.keys(op)[0];
                const action = op[type];
                if (type === 'insertOne') {
                    action.document.tenant_id = tenantId;
                } else if (action.filter) {
                    action.filter.tenant_id = tenantId;
                }
            });
            next();
        } catch (error) {
            next(new Error(`BulkWrite isolation failed: ${error.message}`));
        }
    });

    // Harden insertMany
    schema.pre('insertMany', function (next, docs) {
        try {
            const tenantId = TenantContext.getTenantId();
            if (Array.isArray(docs)) {
                docs.forEach(doc => {
                    doc.tenant_id = tenantId;
                });
            } else {
                docs.tenant_id = tenantId;
            }
            next();
        } catch (error) {
            next(new Error(`InsertMany isolation failed: ${error.message}`));
        }
    });

    // Prevent updating tenant_id
    schema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], async function () {
        const update = this.getUpdate();
        if (update) {
            // Check for tenant_id in the update object (both direct and $set)
            const hasTenantId = update.tenant_id ||
                (update.$set && update.$set.tenant_id) ||
                (update.$setOnInsert && update.$setOnInsert.tenant_id);
            if (hasTenantId) {
                throw new Error('Cannot modify tenant_id field');
            }
        }
    });

    return schema;
}

module.exports = { createTenantSchema };
