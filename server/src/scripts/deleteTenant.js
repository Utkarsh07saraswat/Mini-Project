const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const dotenv = require('dotenv');
const path = require('path');

// Load env from server root
dotenv.config({ path: path.join(__dirname, '../../.env') });

const deleteTenant = async () => {
    const tenantId = process.argv[2];

    if (!tenantId) {
        console.error('Usage: node deleteTenant.js <tenantId>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const result = await Tenant.deleteOne({ tenantId });

        if (result.deletedCount > 0) {
            console.log(`Tenant deleted successfully: ${tenantId}`);
        } else {
            console.log(`Tenant not found: ${tenantId}`);
        }
    } catch (error) {
        console.error('Error deleting tenant:', error.message);
    } finally {
        await mongoose.disconnect();
    }
};

deleteTenant();
