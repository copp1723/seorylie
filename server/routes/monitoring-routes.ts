import { Router } from "express";
import { monitoring } from "../services/monitoring";
import { dlqService } from "../services/dead-letter-queue";
import { adfEmailListener } from "../services/adf-email-listener";
import { getQueueStats } from "../services/queue";
import logger from "../utils/logger";
import { prometheusMetrics } from "../services/prometheus-metrics";

const router = Router();

// Enhanced health check endpoint with component health
router.get("/health", async (req, res) => {
  try {
    const overallHealth = await monitoring.getOverallHealthStatus();
    const timestamp = new Date().toISOString();

    const healthResponse = {
      status: overallHealth.status,
      timestamp,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      components: overallHealth.components,
      summary: {
        healthy: Object.values(overallHealth.components).filter(
          (c) => c.status === "healthy",
        ).length,
        degraded: Object.values(overallHealth.components).filter(
          (c) => c.status === "degraded",
        ).length,
        unhealthy: Object.values(overallHealth.components).filter(
          (c) => c.status === "unhealthy",
        ).length,
        unknown: Object.values(overallHealth.components).filter(
          (c) => c.status === "unknown",
        ).length,
      },
    };

    // Set appropriate HTTP status code based on health
    const statusCode =
      overallHealth.status === "healthy"
        ? 200
        : overallHealth.status === "degraded"
          ? 200
          : overallHealth.status === "unhealthy"
            ? 503
            : 500;

    res.status(statusCode).json(healthResponse);
  } catch (error) {
    logger.error("Health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: "Health check system failure",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }
});

// Detailed health check for specific component
router.get("/health/:component", async (req, res) => {
  try {
    const { component } = req.params;
    const health = await monitoring.getComponentHealth(component);

    const statusCode =
      health.status === "healthy"
        ? 200
        : health.status === "degraded"
          ? 200
          : health.status === "unhealthy"
            ? 503
            : 404;

    res.status(statusCode).json({
      component,
      ...health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      component: req.params.component,
      status: "unknown",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// Legacy metrics endpoint (enhanced)
router.get("/metrics", async (req, res) => {
  try {
    const queueStats = await getQueueStats();
    const dlqStats = dlqService.getStats();
    const emailListenerHealth = adfEmailListener.getHealthStatus();
    const prometheusMetricsData = await prometheusMetrics.getMetrics();

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      queues: queueStats,
      deadLetterQueue: dlqStats,
      emailListener: emailListenerHealth,
      legacy: monitoring.getMetrics(), // Existing metrics format
      prometheusMetrics: prometheusMetricsData, // Add Prometheus metrics
    });
  } catch (error) {
    logger.error("Metrics collection failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: "Metrics collection failed",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }
});

// Dead Letter Queue monitoring endpoints
router.get("/dlq/stats", (req, res) => {
  try {
    const stats = dlqService.getStats();
    res.json({
      timestamp: new Date().toISOString(),
      ...stats,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

router.get("/dlq/entries", (req, res) => {
  try {
    const { type, priority, limit = 100 } = req.query;
    const stats = dlqService.getStats();

    // Note: In a production system, you'd want to implement proper pagination
    // and not expose all DLQ entries directly for security reasons
    res.json({
      timestamp: new Date().toISOString(),
      summary: stats,
      note: "Entry details not exposed for security. Use specific entry ID endpoint if needed.",
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// IMAP connection pool status
router.get("/imap/status", (req, res) => {
  try {
    const status = adfEmailListener.getHealthStatus();
    res.json({
      timestamp: new Date().toISOString(),
      ...status,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});

// Prometheus-compatible metrics endpoint
router.get("/metrics/prometheus", async (req, res) => {
  try {
    // Get actual metrics from the Prometheus metrics service
    const metrics = await prometheusMetrics.getMetrics();

    // Set proper content type for Prometheus metrics
    res.set("Content-Type", "text/plain");
    res.send(metrics);
  } catch (error) {
    logger.error("Prometheus metrics collection failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).send("# Error collecting metrics\n");
  }
});

export default router;
