const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Attempting to connect to:', process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ MongoDB connected successfully!');
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('✗ MongoDB connection error:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

testConnection();
