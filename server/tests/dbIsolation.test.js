const mongoose = require('mongoose');
const { TenantContext } = require('../src/utils/tenantContext');
const TenantRegistry = require('../src/utils/tenantRegistry');
const ModelProvider = require('../src/utils/modelProvider');

describe('High-Value Tenant Database Isolation', () => {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant_test';
    const PREMIUM_DB = 'premium_test_db';

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        if (mongoose.connection.db) {
            await mongoose.connection.db.collection('projects').deleteMany({});
        }
        try {
            const dedicatedConn = await mongoose.createConnection(`${process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017'}/${PREMIUM_DB}`).asPromise();
            await dedicatedConn.db.collection('projects').deleteMany({});
            await dedicatedConn.close();
        } catch (e) {
            // Ignore if DB doesn't exist yet
        }
    });

    test('ENFORCE: Premium tenant writes to dedicated DB, not shared DB', async () => {
        const tenantId = 'premium-tenant-test';
        TenantRegistry.registerPremiumTenant(tenantId, PREMIUM_DB);

        // 1. Create data as Premium Tenant
        await TenantContext.run(tenantId, async () => {
            const ProjectModel = await ModelProvider.getModel('Project');
            await ProjectModel.create({ name: 'Premium Project', description: 'Top Secret' });
        });

        // 2. Verify it's NOT in the shared DB
        const sharedProjects = await mongoose.connection.db.collection('projects').find({ name: 'Premium Project' }).toArray();
        expect(sharedProjects).toHaveLength(0);

        // 3. Verify it IS in the dedicated DB
        const dedicatedConn = await mongoose.createConnection(`${process.env.MONGODB_URI_BASE || 'mongodb://localhost:27017'}/${PREMIUM_DB}`).asPromise();
        const premiumProjects = await dedicatedConn.db.collection('projects').find({ name: 'Premium Project' }).toArray();
        expect(premiumProjects).toHaveLength(1);
        expect(premiumProjects[0].tenant_id).toBe(tenantId);

        await dedicatedConn.close();
    });

    test('FAIL HARD: Premium tenant fails if dedicated DB is unavailable', async () => {
        const tenantId = 'broken-premium-tenant';
        const badConfig = { tier: 'premium', dbName: 'wont_work' };

        const originalGetConfig = TenantRegistry.getConfig;
        TenantRegistry.getConfig = (id) => id === tenantId ? badConfig : originalGetConfig.call(TenantRegistry, id);

        const originalEnv = process.env.MONGODB_URI_BASE;
        process.env.MONGODB_URI_BASE = 'mongodb://10.255.255.1:27017';

        try {
            await TenantContext.run(tenantId, async () => {
                await ModelProvider.getModel('Project');
            });
            throw new Error('Should have failed');
        } catch (error) {
            // Should contain the hardened error message
            expect(error.message).toContain('strictly forbidden');
        }

        TenantRegistry.getConfig = originalGetConfig;
        process.env.MONGODB_URI_BASE = originalEnv;
    }, 15000);
});
