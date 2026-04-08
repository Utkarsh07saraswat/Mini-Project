const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const dotenv = require('dotenv');
const path = require('path');

// Load env from server root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const createTenant = async () => {
    const tenantId = process.argv[2];
    const name = process.argv[3];

    if (!tenantId || !name) {
        console.error('Usage: node createTenant.js <tenantId> <name>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const tenant = new Tenant({
            tenantId,
            name,
            status: 'active'
        });

        await tenant.save();
        console.log(`Tenant created successfully: ${tenantId}`);
    } catch (error) {
        console.error('Error creating tenant:', error.message);
    } finally {
        await mongoose.disconnect();
    }
};

createTenant();
