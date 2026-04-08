const mongoose = require('mongoose');
const { TenantContext } = require('../src/utils/tenantContext');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const AuditLog = require('../src/models/AuditLog');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/multi_tenant';

async function testTenantIsolation() {
    console.log('========================================');
    console.log('Tenant Isolation Test');
    console.log('========================================\n');

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✓ Connected to MongoDB\n');

        // Cleanup previous test data
        console.log('Cleaning up existing test data...');
        // Use override to delete across all tenants
        await User.deleteMany({}).setOptions({ _overrideTenantCheck: true });
        await Project.deleteMany({}).setOptions({ _overrideTenantCheck: true });
        await AuditLog.deleteMany({}).setOptions({ _overrideTenantCheck: true });
        console.log('✓ Cleanup complete\n');

        // Test 1: Create data for Tenant A
        console.log('Test 1: Creating data for Tenant A');
        await TenantContext.run('tenant-a', async () => {
            // Create user
            const user = await User.create({
                username: 'alice',
                password: 'hashed-password',
                role: 'admin',
            });
            console.log(`  ✓ Created user: ${user.username} (ID: ${user._id})`);
            console.log(`    Tenant ID: ${user.tenant_id}`);

            // Create project
            const project = await Project.create({
                name: 'Tenant A Secret Project',
                description: 'Confidential project for Tenant A',
                status: 'active',
            });
            console.log(`  ✓ Created project: ${project.name} (ID: ${project._id})`);
            console.log(`    Tenant ID: ${project.tenant_id}\n`);
        });

        // Test 2: Create data for Tenant B
        console.log('Test 2: Creating data for Tenant B');
        await TenantContext.run('tenant-b', async () => {
            const user = await User.create({
                username: 'bob',
                password: 'hashed-password',
                role: 'user',
            });
            console.log(`  ✓ Created user: ${user.username} (ID: ${user._id})`);
            console.log(`    Tenant ID: ${user.tenant_id}`);

            const project = await Project.create({
                name: 'Tenant B Secret Project',
                description: 'Confidential project for Tenant B',
                status: 'active',
            });
            console.log(`  ✓ Created project: ${project.name} (ID: ${project._id})`);
            console.log(`    Tenant ID: ${project.tenant_id}\n`);
        });

        // Test 3: Verify Tenant A can only see their data
        console.log('Test 3: Verify Tenant A isolation');
        await TenantContext.run('tenant-a', async () => {
            const users = await User.find({});
            const projects = await Project.find({});

            console.log(`  Users found: ${users.length}`);
            users.forEach(u => console.log(`    - ${u.username} (tenant: ${u.tenant_id})`));

            console.log(`  Projects found: ${projects.length}`);
            projects.forEach(p => console.log(`    - ${p.name} (tenant: ${p.tenant_id})`));

            const allTenantA = users.every(u => u.tenant_id === 'tenant-a') &&
                projects.every(p => p.tenant_id === 'tenant-a');
            console.log(`  ✓ Isolation verified: ${allTenantA ? 'PASS' : 'FAIL'}\n`);
        });

        // Test 4: Verify Tenant B can only see their data
        console.log('Test 4: Verify Tenant B isolation');
        await TenantContext.run('tenant-b', async () => {
            const users = await User.find({});
            const projects = await Project.find({});

            console.log(`  Users found: ${users.length}`);
            users.forEach(u => console.log(`    - ${u.username} (tenant: ${u.tenant_id})`));

            console.log(`  Projects found: ${projects.length}`);
            projects.forEach(p => console.log(`    - ${p.name} (tenant: ${p.tenant_id})`));

            const allTenantB = users.every(u => u.tenant_id === 'tenant-b') &&
                projects.every(p => p.tenant_id === 'tenant-b');
            console.log(`  ✓ Isolation verified: ${allTenantB ? 'PASS' : 'FAIL'}\n`);
        });

        // Test 5: Verify cross-tenant access is blocked
        console.log('Test 5: Verify cross-tenant access prevention');
        await TenantContext.run('tenant-a', async () => {
            const tenantBUsers = await User.find({ tenant_id: 'tenant-b' });
            console.log(`  Tenant A trying to access Tenant B users: ${tenantBUsers.length}`);
            console.log(`  ✓ Cross-tenant query blocked: ${tenantBUsers.length === 0 ? 'PASS' : 'FAIL'}\n`);
        });

        // Test 6: Test without tenant context (should fail)
        console.log('Test 6: Query without tenant context');
        try {
            await User.find({});
            console.log('  ✗ FAIL: Query succeeded without tenant context\n');
        } catch (error) {
            console.log(`  ✓ PASS: Query blocked - ${error.message}\n`);
        }

        // Test 7: Verify audit logs are tenant-scoped
        console.log('Test 7: Verify audit logs are tenant-scoped');
        await TenantContext.run('tenant-a', async () => {
            await AuditLog.create({
                action: 'CREATE',
                resource: 'User',
                resourceId: 'test-123',
                userId: 'user-a',
                success: true,
            });

            const logs = await AuditLog.find({});
            console.log(`  Audit logs for Tenant A: ${logs.length}`);
            const allTenantA = logs.every(l => l.tenant_id === 'tenant-a');
            console.log(`  ✓ Audit isolation verified: ${allTenantA ? 'PASS' : 'FAIL'}\n`);
        });

        // Test 8: Count total documents (admin view)
        console.log('Test 8: Admin view - Total documents across all tenants');
        const totalUsers = await User.countDocuments({}).setOptions({ _overrideTenantCheck: true });
        const totalProjects = await Project.countDocuments({}).setOptions({ _overrideTenantCheck: true });
        console.log(`  Total users: ${totalUsers}`);
        console.log(`  Total projects: ${totalProjects}\n`);

        console.log('========================================');
        console.log('✓ All isolation tests completed!');
        console.log('========================================');

    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n✓ MongoDB connection closed');
    }
}

// Run tests
testTenantIsolation().catch(console.error);
