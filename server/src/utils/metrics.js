const { MetricsCollector } = require('./metricsCollector');

// Re-export or extend MetricsCollector
module.exports = {
    metrics: MetricsCollector,
    // Add compatible API if needed
    recordRequest: MetricsCollector.recordHttpRequest,
    recordError: MetricsCollector.recordError
};
