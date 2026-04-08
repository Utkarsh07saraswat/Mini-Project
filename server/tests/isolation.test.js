const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');

describe('Multi-Tenant Isolation', () => {
    const tenantA = { id: 'tenant-a', email: 'a@test.com' };
    const tenantB = { id: 'tenant-b', email: 'b@test.com' };

    const tokenA = jwt.sign({ tenantId: tenantA.id, userId: 'user1' }, process.env.JWT_SECRET || 'test-secret');
    const tokenB = jwt.sign({ tenantId: tenantB.id, userId: 'user2' }, process.env.JWT_SECRET || 'test-secret');

    const mongoose = require('mongoose');
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant_test';

    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(MONGODB_URI);
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Use raw collection to bypass tenant hooks during cleanup
        if (mongoose.connection.db) {
            await mongoose.connection.db.collection('projects').deleteMany({});
            await mongoose.connection.db.collection('auditlogs').deleteMany({});
        }
    });

    test('Tenant A cannot access Tenant B data', async () => {
        // Create data as Tenant A
        await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ name: 'Project A', description: 'Secret A' });

        // Try to access as Tenant B (using tokenB)
        const res = await request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.body.data).toHaveLength(0);  // Should see nothing from Tenant A
    });

    test('Missing tenant context blocks access', async () => {
        const res = await request(app).get('/api/projects');
        expect(res.status).toBe(401);
    });

    test('Cannot modify tenant_id in update', async () => {
        // This would require complex setup, but middleware should block
        const res = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ name: 'Test', tenant_id: 'tenant-b' });  // Try to inject wrong tenant

        // Should either fail or override with correct tenant
        expect(res.body.data.tenant_id).toBe('tenant-a');
    });
    test('REJECT: Route parameter spoofing attempt', async () => {
        // Attempt to access tenant-b's URL using tenant-a's token
        const res = await request(app)
            .get('/api/tenant-b/verify')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Isolation Breach');
    });

    test('ALLOW: Matching route parameter and token', async () => {
        const res = await request(app)
            .get('/api/tenant-a/verify')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.tenantId).toBe('tenant-a');
    });

    test('ENFORCE: AsyncLocalStorage context preservation in emitters', async () => {
        const { EventEmitter } = require('events');
        const { TenantContext } = require('../src/utils/tenantContext');
        const emitter = new EventEmitter();
        TenantContext.wrapEmitter(emitter);

        const capturedContexts = [];

        const simulateRequest = (id, delay) => {
            return TenantContext.run(id, () => {
                // Listener registered within tenant context A should be bound to A
                emitter.on('executed', () => {
                    capturedContexts.push(TenantContext.getTenantId());
                });

                return new Promise(resolve => {
                    setTimeout(() => {
                        emitter.emit('executed');
                        resolve();
                    }, delay);
                });
            });
        };

        // Run concurrent "requests"
        await Promise.all([
            simulateRequest('tenant-a', 20),
            simulateRequest('tenant-b', 10)
        ]);

        // Each listener should have executed exactly once with its correct context
        // Total 4 executions (2 listeners x 2 emits)
        expect(capturedContexts.filter(c => c === 'tenant-a')).toHaveLength(2);
        expect(capturedContexts.filter(c => c === 'tenant-b')).toHaveLength(2);
    });

    test('ENFORCE: Bulk/Multi-document operations restricted to tenant', async () => {
        const Project = require('../src/models/Project');
        const { TenantContext } = require('../src/utils/tenantContext');

        let projectBId;
        await TenantContext.run('tenant-b', async () => {
            const p = await Project.create({ name: 'B Project', description: 'Owned by B' });
            projectBId = p._id;
        });

        // Attempt to update ALL projects (including B's) as Tenant A
        await TenantContext.run('tenant-a', async () => {
            const updateResult = await Project.updateMany({}, { $set: { description: 'Hacked by A' } });
            const mods = updateResult.modifiedCount !== undefined ? updateResult.modifiedCount : updateResult.nModified;
            expect(mods).toBe(0);
        });

        // Verify B's project is still untouched
        const pB = await TenantContext.run('tenant-b', async () => {
            return await Project.findById(projectBId);
        });
        expect(pB).not.toBeNull();
        expect(pB.description).toBe('Owned by B');
    });
});
