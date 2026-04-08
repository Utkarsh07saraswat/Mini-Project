const mongoose = require('mongoose');
const { AuditLogger } = require('../utils/auditLogger');
const { TenantContext } = require('../utils/tenantContext');
require('dotenv').config();

async function testAuditLog() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant');
        console.log('Connected.');

        const tenantId = 'tenant-test-audit';

        await TenantContext.run(tenantId, async () => {
            console.log(`Running in context: ${tenantId}`);

            // 1. Create Log
            console.log('Creating audit log...');
            await AuditLogger.log({
                action: 'CREATE',
                resource: 'TestResource',
                resourceId: '123',
                userId: 'test-admin',
                severity: 'INFO',
                details: 'This is a test log'
            });
            console.log('Log creation called.');

            // 2. Query Log
            console.log('Query called.');

            // DEBUG: Check all logs in DB without filter
            const allLogs = await mongoose.model('AuditLog').find({}).setOptions({ _overrideTenantCheck: true });
            console.log('RAW DB CONTENT (All tenants):', allLogs.length, 'records');
            if (allLogs.length > 0) {
                console.log('First log tenant_id:', allLogs[0].tenant_id);
            }

            const result = await AuditLogger.query({
                action: 'CREATE'
            });

            console.log('Query result:', JSON.stringify(result, null, 2));

            if (result.logs.length > 0) {
                console.log('SUCCESS: Audit log found.');
            } else {
                console.log('FAILURE: No logs found.');
            }
        });

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.connection.close();
    }
}

testAuditLog();
