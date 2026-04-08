const express = require('express');
const mongoose = require('mongoose');
const { checkRedisHealth } = require('../config/redisClient');
const { MetricsCollector } = require('../utils/metricsCollector');

const router = express.Router();

/**
 * Basic health check
 */
router.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
    };

    res.json(health);
});

/**
 * Detailed health check with dependencies
 */
router.get('/health/detailed', async (req, res) => {
    const checks = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        dependencies: {},
    };

    // Check MongoDB
    try {
        const mongoState = mongoose.connection.readyState;
        const stateMap = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };

        checks.dependencies.mongodb = {
            status: mongoState === 1 ? 'healthy' : 'unhealthy',
            state: stateMap[mongoState],
            host: mongoose.connection.host,
            name: mongoose.connection.name,
        };

        if (mongoState === 1) {
            const adminDb = mongoose.connection.db.admin();

            // Add timeout for serverStatus
            const statusPromise = adminDb.serverStatus();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('MongoDB serverStatus timeout')), 2000)
            );

            const serverStatus = await Promise.race([statusPromise, timeoutPromise]);
            checks.dependencies.mongodb.version = serverStatus.version;
            checks.dependencies.mongodb.connections = serverStatus.connections;
        }
    } catch (error) {
        checks.dependencies.mongodb = {
            status: 'unhealthy',
            error: error.message,
        };
    }

    // Check Redis
    try {
        const redisHealth = await checkRedisHealth();
        if (redisHealth.status === 'healthy') {
            redisHealth.status = 'connected';
        }
        checks.dependencies.redis = redisHealth;
    } catch (error) {
        checks.dependencies.redis = {
            status: 'unhealthy',
            error: error.message,
        };
    }

    // Overall status
    const allHealthy = Object.values(checks.dependencies).every(
        dep => dep.status === 'healthy' || dep.status === 'connected'
    );
    checks.status = allHealthy ? 'healthy' : 'degraded';

    // Always return 200 for detailed health check so frontend can display component status
    // The 'status' field in the body indicates the actual health
    res.status(200).json(checks);
});

/**
 * Readiness probe (for Kubernetes)
 */
router.get('/health/ready', async (req, res) => {
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            return res.status(503).json({ ready: false, reason: 'MongoDB not connected' });
        }

        // Check if Redis is available
        const redisHealth = await checkRedisHealth();
        if (redisHealth.status !== 'healthy') {
            return res.status(503).json({ ready: false, reason: 'Redis not available' });
        }

        res.json({ ready: true });
    } catch (error) {
        res.status(503).json({ ready: false, error: error.message });
    }
});

/**
 * Liveness probe (for Kubernetes)
 */
router.get('/health/live', (req, res) => {
    res.json({ alive: true });
});

/**
 * Metrics endpoint (Prometheus format)
 */
router.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        const metrics = await MetricsCollector.getMetrics();
        res.send(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Metrics endpoint (JSON format)
 */
router.get('/metrics/json', async (req, res) => {
    try {
        const metrics = await MetricsCollector.getMetricsJSON();
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
