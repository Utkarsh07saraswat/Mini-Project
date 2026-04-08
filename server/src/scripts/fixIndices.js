const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function fixIndices() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant';
    console.log(`Connecting to ${uri}...`);

    try {
        await mongoose.connect(uri);
        console.log('✓ Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        const usersCollection = collections.find(c => c.name === 'users');

        if (usersCollection) {
            console.log('Checking indices for "users" collection...');
            const indices = await mongoose.connection.db.collection('users').indexes();
            console.log('Current indices:', indices.map(i => i.name));

            if (indices.find(i => i.name === 'email_1')) {
                console.log('Dropping stale "email_1" index...');
                await mongoose.connection.db.collection('users').dropIndex('email_1');
                console.log('✓ Successfully dropped "email_1" index');
            } else {
                console.log('Stale "email_1" index not found.');
            }

            // Also check for any other stale indices if needed
            // The new index should be username_1_tenant_id_1
        } else {
            console.log('Collection "users" not found.');
        }

    } catch (error) {
        console.error('Error fixing indices:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

fixIndices();
