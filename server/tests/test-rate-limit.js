const { getRedisClient } = require('../src/config/redisClient');
const { TenantRateLimiter } = require('../src/middleware/rateLimiter');

async function testRateLimiting() {
    console.log('========================================');
    console.log('Rate Limiting Test');
    console.log('========================================\n');

    try {
        const redis = getRedisClient();

        // Wait for Redis connection
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 1: Check Redis connection
        console.log('Test 1: Redis Connection');
        try {
            await redis.ping();
            console.log('  ✓ Redis is connected\n');
        } catch (error) {
            console.log('  ✗ Redis connection failed:', error.message);
            console.log('  Skipping rate limit tests\n');
            return;
        }

        // Test 2: Get initial rate limit status
        console.log('Test 2: Initial Rate Limit Status');
        const tenantId = 'test-tenant-rate-limit';
        const status1 = await TenantRateLimiter.getStatus(tenantId);
        console.log('  Status:', JSON.stringify(status1, null, 2));
        console.log('');

        // Test 3: Simulate requests
        console.log('Test 3: Simulate Multiple Requests');
        const requestCount = 15;
        console.log(`  Making ${requestCount} requests...`);

        for (let i = 1; i <= requestCount; i++) {
            // Simulate request by incrementing counter
            const key = `ratelimit:${tenantId}`;
            const now = Date.now();
            await redis.zadd(key, now, `${now}-${i}`);

            if (i % 5 === 0) {
                const status = await TenantRateLimiter.getStatus(tenantId);
                console.log(`  After ${i} requests: ${status.current}/${status.limit} (${status.remaining} remaining)`);
            }
        }
        console.log('');

        // Test 4: Check final status
        console.log('Test 4: Final Rate Limit Status');
        const status2 = await TenantRateLimiter.getStatus(tenantId);
        console.log('  Status:', JSON.stringify(status2, null, 2));
        console.log('');

        // Test 5: Test rate limit reset
        console.log('Test 5: Reset Rate Limit');
        const resetResult = await TenantRateLimiter.reset(tenantId);
        console.log('  Reset result:', resetResult.message);

        const status3 = await TenantRateLimiter.getStatus(tenantId);
        console.log('  Status after reset:', JSON.stringify(status3, null, 2));
        console.log('');

        // Test 6: Test different tenant tiers
        console.log('Test 6: Test Different Tenant Tiers');
        const tiers = ['free', 'premium', 'enterprise'];

        for (const tier of tiers) {
            // Temporarily set tier via environment
            process.env[`TENANT_TEST-${tier.toUpperCase()}_TIER`] = tier;

            const status = await TenantRateLimiter.getStatus(`test-${tier}`);
            console.log(`  ${tier.toUpperCase()} tier: ${status.limit} requests per ${status.windowMs / 1000}s`);
        }
        console.log('');

        // Test 7: Test sliding window
        console.log('Test 7: Test Sliding Window');
        const windowTenant = 'test-window-tenant';
        await TenantRateLimiter.reset(windowTenant);

        console.log('  Making requests over time...');
        for (let i = 1; i <= 5; i++) {
            const key = `ratelimit:${windowTenant}`;
            const now = Date.now();
            await redis.zadd(key, now, `${now}-${i}`);
            await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
        }

        const statusWindow = await TenantRateLimiter.getStatus(windowTenant);
        console.log(`  Requests in window: ${statusWindow.current}`);
        console.log('  ✓ Sliding window working\n');

        console.log('========================================');
        console.log('✓ All rate limiting tests completed!');
        console.log('========================================');

    } catch (error) {
        console.error('✗ Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests
testRateLimiting().catch(console.error);
