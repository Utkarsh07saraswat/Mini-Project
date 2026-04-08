const mongoose = require('mongoose');
const { createTenantSchema } = require('./baseTenantModel');

// Example of a generic tenant data model using the factory
// This ensures all data in this collection is isolated by tenant_id
const tenantDataSchema = createTenantSchema({
    dataType: {
        type: String,
        required: true,
        index: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    tags: [String]
});

module.exports = mongoose.model('TenantData', tenantDataSchema);
