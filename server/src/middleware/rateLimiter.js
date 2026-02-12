const { getRedisClient } = require('../config/redisClient');
const { TenantContext } = require('../utils/tenantContext');

// Rate limit tiers configuration
const RATE_LIMIT_TIERS = {
    free: {
        windowMs: 60 * 1000, // 1 minute
        max: 20, // 20 requests per minute
    },
    premium: {
        windowMs: 60 * 1000,
        max: 100, // 100 requests per minute
    },
    enterprise: {
        windowMs: 60 * 1000,
        max: 1000, // 1000 requests per minute
    },
    default: {
        windowMs: 60 * 1000,
        max: 50, // Default: 50 requests per minute
    },
};

/**
 * Get rate limit configuration for tenant
 * In production, this would query tenant metadata from database
 */
async function getTenantTier(tenantId) {
    // TODO: Query from database or cache
    // For now, return default tier
    return process.env[`TENANT_${tenantId.toUpperCase()}_TIER`] || 'default';
}

/**
 * Redis-based rate limiter middleware
 */
class TenantRateLimiter {
    /**
     * Create rate limiting middleware
     */
    static async middleware(req, res, next) {
        try {
            const tenantId = TenantContext.getTenantId();
            if (!tenantId) {
                return next(); // Skip if no tenant context
            }

            const redis = getRedisClient();
            const tier = await getTenantTier(tenantId);
            const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.default;

            // Create Redis key for this tenant
            const key = `ratelimit:${tenantId}`;
            const now = Date.now();
            const windowStart = now - config.windowMs;

            // Use Redis sorted set to track requests
            const multi = redis.multi();

            // Remove old entries outside the window
            multi.zremrangebyscore(key, 0, windowStart);

            // Add current request
            multi.zadd(key, now, `${now}-${Math.random()}`);

            // Count requests in current window
            multi.zcard(key);

            // Set expiry on the key
            multi.expire(key, Math.ceil(config.windowMs / 1000));

            const results = await multi.exec();
            const requestCount = results[2][1]; // Get count from zcard

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', config.max);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - requestCount));
            res.setHeader('X-RateLimit-Reset', new Date(now + config.windowMs).toISOString());
            res.setHeader('X-RateLimit-Tier', tier);

            // Check if limit exceeded
            if (requestCount > config.max) {
                const retryAfter = Math.ceil(config.windowMs / 1000);
                res.setHeader('Retry-After', retryAfter);

                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: `Too many requests. Limit: ${config.max} requests per ${config.windowMs / 1000}s`,
                    tenant: tenantId,
                    tier: tier,
                    retryAfter: retryAfter,
                });
            }

            next();
        } catch (error) {
            console.error('Rate limiter error:', error);
            // Fail open - don't block requests if Redis is down
            next();
        }
    }

    /**
     * Get current rate limit status for a tenant
     */
    static async getStatus(tenantId) {
        const tier = await getTenantTier(tenantId);
        const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.default;

        try {
            const redis = getRedisClient();
            const key = `ratelimit:${tenantId}`;
            const now = Date.now();
            const windowStart = now - config.windowMs;

            // Count requests in current window
            const count = await redis.zcount(key, windowStart, now);

            return {
                tenant: tenantId,
                tier: tier,
                limit: config.max,
                current: count,
                remaining: Math.max(0, config.max - count),
                windowMs: config.windowMs,
                active: true
            };
        } catch (error) {
            // Redis is down, return status with 0 current and active: false
            return {
                tenant: tenantId,
                tier: tier,
                limit: config.max,
                current: 0,
                remaining: config.max,
                windowMs: config.windowMs,
                active: false,
                error: 'Rate limiting temporarily unavailable'
            };
        }
    }

    /**
     * Reset rate limit for a tenant (admin function)
     */
    static async reset(tenantId) {
        try {
            const redis = getRedisClient();
            const key = `ratelimit:${tenantId}`;
            await redis.del(key);
            return { success: true, message: `Rate limit reset for tenant: ${tenantId}` };
        } catch (error) {
            throw new Error(`Failed to reset rate limit: ${error.message}`);
        }
    }
}

module.exports = { TenantRateLimiter, RATE_LIMIT_TIERS };
