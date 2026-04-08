const mongoose = require('mongoose');
const { createTenantSchema } = require('./baseTenantModel');

const projectSchema = createTenantSchema({
    name: { type: String, required: true },
    description: String,
    purpose: String,
    environment: {
        type: String,
        enum: ['development', 'staging', 'production'],
        default: 'development'
    },
    isolationTier: {
        type: String,
        enum: ['basic', 'professional', 'enterprise'],
        default: 'basic'
    },
    status: {
        type: String,
        enum: ['provisioning', 'active', 'degraded', 'suspended'],
        default: 'provisioning'
    },
    region: {
        type: String,
        enum: ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'],
        default: 'us-east-1'
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tags: [{ type: String }]
});

// Index for tenant-specific project queries
projectSchema.index({ tenant_id: 1, status: 1 });

module.exports = mongoose.model('Project', projectSchema);
