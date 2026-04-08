const mongoose = require('mongoose');
const { createTenantSchema } = require('./baseTenantModel');

const taskSchema = createTenantSchema({
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true },
    description: String,
    status: {
        type: String,
        enum: ['todo', 'in_progress', 'review', 'done'],
        default: 'todo'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dueDate: Date,
    tags: [{ type: String }]
});

// Index for project-specific queries
taskSchema.index({ tenant_id: 1, project_id: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
