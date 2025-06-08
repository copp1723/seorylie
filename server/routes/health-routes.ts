/**
 * Health Check Routes
 *
 * Comprehensive health check endpoints for monitoring system status,
 * service health, and performance metrics.
 * Enhanced for DEP-009 with proper status codes, timeout handling, and response formatting.
 */

import { Router, Request, Response } from "express";
import { healthCheckService } from "../services/health-check-service";
import { serviceRegistry } from "../services/service-registry";
import { configManager } from "../config/config-manager";
import logger from "../utils/logger";
import { CustomError } from "../utils/error-handler";

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 * Enhanced for DEP-009 with proper status codes and response formatting
 */
router.get("/", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Set a timeout for the entire health check operation
    const healthCheckPromise = healthCheckService.runAllChecks();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Health check timeout")), 5000); // 5 second timeout
    });

    const report = await Promise.race([healthCheckPromise, timeoutPromise]);
    const responseTime = Date.now() - startTime;

    // DEP-009: Ensure proper HTTP status codes
    // 200 for healthy or degraded, 503 for unhealthy
    const statusCode = report.status === "unhealthy" ? 503 : 200;

    // DEP-009: Standardized response format with 'status': 'ok' for healthy systems
    const responseStatus = report.status === "healthy" ? "ok" : report.status;

    res.status(statusCode).json({
      status: responseStatus, // DEP-009: Primary status field
      success: statusCode === 200,
      timestamp: report.timestamp,
      uptime: report.uptime,
      version: report.version,
      environment: report.environment,
      responseTime: `${responseTime}ms`,
      checks: {
        total: report.summary.total,
        healthy: report.summary.healthy,
        degraded: report.summary.degraded,
        unhealthy: report.summary.unhealthy,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Health check failed", error);

    res.status(503).json({
      status: "unhealthy", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
      checks: {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 1,
      },
    });
  }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 * Enhanced for DEP-009 with comprehensive subsystem status and timeout handling
 */
router.get("/detailed", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Enforce 5-second timeout for detailed checks
    const healthCheckPromise = healthCheckService.runAllChecks();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Detailed health check timeout")),
        5000,
      );
    });

    const report = await Promise.race([healthCheckPromise, timeoutPromise]);
    const responseTime = Date.now() - startTime;

    // DEP-009: Proper HTTP status codes
    const statusCode = report.status === "unhealthy" ? 503 : 200;

    // DEP-009: Transform check results to show 'status': 'ok' for healthy subsystems
    const subsystems = report.checks.reduce(
      (acc, check) => {
        acc[check.name] = {
          status: check.status === "healthy" ? "ok" : check.status,
          responseTime: `${check.responseTime}ms`,
          message:
            check.message ||
            (check.status === "healthy"
              ? "Operating normally"
              : "See error details"),
          ...(check.error && { error: check.error }),
          ...(check.metadata && { metadata: check.metadata }),
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    res.status(statusCode).json({
      status: report.status === "healthy" ? "ok" : report.status, // DEP-009: Primary status
      success: statusCode === 200,
      timestamp: report.timestamp,
      uptime: report.uptime,
      version: report.version,
      environment: report.environment,
      responseTime: `${responseTime}ms`,
      summary: {
        total: report.summary.total,
        healthy: report.summary.healthy,
        degraded: report.summary.degraded,
        unhealthy: report.summary.unhealthy,
      },
      subsystems,
      services: report.services,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Detailed health check failed", error);

    res.status(503).json({
      status: "unhealthy", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
      summary: {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 1,
      },
      subsystems: {},
      services: {},
    });
  }
});

/**
 * Service registry health endpoint
 * GET /health/services
 * Enhanced for DEP-009 with proper status normalization and timeout handling
 */
router.get("/services", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Apply timeout to service health checks
    const servicesHealthPromise = serviceRegistry.getHealth();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Services health check timeout")),
        5000,
      );
    });

    const servicesHealth = await Promise.race([
      servicesHealthPromise,
      timeoutPromise,
    ]);
    const responseTime = Date.now() - startTime;

    // DEP-009: Proper HTTP status codes
    const statusCode = servicesHealth.status === "unhealthy" ? 503 : 200;

    // DEP-009: Normalize service statuses to show 'ok' for healthy services
    const normalizedServices = Object.entries(servicesHealth.services).reduce(
      (acc, [serviceName, serviceHealth]) => {
        acc[serviceName] = {
          ...serviceHealth,
          status:
            serviceHealth.status === "healthy" ? "ok" : serviceHealth.status,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

    res.status(statusCode).json({
      status:
        servicesHealth.status === "healthy" ? "ok" : servicesHealth.status, // DEP-009: Primary status
      success: statusCode === 200,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      services: normalizedServices,
      summary: {
        total: Object.keys(servicesHealth.services).length,
        healthy: Object.values(servicesHealth.services).filter(
          (s) => s.status === "healthy",
        ).length,
        degraded: Object.values(servicesHealth.services).filter(
          (s) => s.status === "degraded",
        ).length,
        unhealthy: Object.values(servicesHealth.services).filter(
          (s) => s.status === "unhealthy",
        ).length,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Services health check failed", error);

    res.status(503).json({
      status: "unhealthy", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
      services: {},
      summary: {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 1,
      },
    });
  }
});

/**
 * Individual service health endpoint
 * GET /health/services/:serviceName
 * Enhanced for DEP-009 with timeout handling and proper status normalization
 */
router.get("/services/:serviceName", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { serviceName } = req.params;

  try {
    // DEP-009: Apply timeout to individual service health checks
    const serviceCheckPromise = (async () => {
      const service = serviceRegistry.get(serviceName);

      if (!service) {
        return { found: false, error: `Service '${serviceName}' not found` };
      }

      const health = await service.getHealth();
      return { found: true, health };
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Service health check timeout")), 5000);
    });

    const result = (await Promise.race([
      serviceCheckPromise,
      timeoutPromise,
    ])) as any;
    const responseTime = Date.now() - startTime;

    if (!result.found) {
      return res.status(404).json({
        status: "not_found", // DEP-009: Consistent status field
        success: false,
        timestamp: new Date(),
        responseTime: `${responseTime}ms`,
        service: serviceName,
        error: result.error,
      });
    }

    // DEP-009: Proper HTTP status codes
    const statusCode = result.health.status === "unhealthy" ? 503 : 200;
    const normalizedStatus =
      result.health.status === "healthy" ? "ok" : result.health.status;

    res.status(statusCode).json({
      status: normalizedStatus, // DEP-009: Primary status field
      success: statusCode === 200,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      service: {
        name: serviceName,
        status: normalizedStatus,
        lastCheck: result.health.lastCheck,
        uptime: result.health.uptime,
        dependencies: result.health.dependencies,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(`Service health check failed for ${serviceName}`, error);

    res.status(503).json({
      status: "error", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      service: serviceName,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * System metrics endpoint
 * GET /health/metrics
 * Enhanced for DEP-009 with health status assessment and timeout handling
 */
router.get("/metrics", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Apply timeout to metrics collection
    const metricsPromise = new Promise((resolve) => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      // Assess system health based on metrics
      let systemStatus = "ok";
      const warnings = [];

      if (heapUsagePercent > 90) {
        systemStatus = "critical";
        warnings.push("Critical memory usage");
      } else if (heapUsagePercent > 80) {
        systemStatus = "warning";
        warnings.push("High memory usage");
      }

      if (memUsage.rss > 1024 * 1024 * 1024) {
        // > 1GB RSS
        if (systemStatus === "ok") systemStatus = "warning";
        warnings.push("High RSS memory usage");
      }

      resolve({
        status: systemStatus,
        warnings,
        metrics: {
          timestamp: new Date(),
          uptime: `${Math.round(process.uptime())}s`,
          memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
            arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)}MB`,
            heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
          },
          cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system,
          },
          process: {
            pid: process.pid,
            version: process.version,
            platform: process.platform,
            arch: process.arch,
          },
          environment: process.env.NODE_ENV || "development",
          version: process.env.npm_package_version || "1.0.0",
        },
      });
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Metrics collection timeout")), 3000);
    });

    const result = (await Promise.race([
      metricsPromise,
      timeoutPromise,
    ])) as any;
    const responseTime = Date.now() - startTime;

    // DEP-009: Return appropriate status code based on system health
    const statusCode = result.status === "critical" ? 503 : 200;

    res.status(statusCode).json({
      status: result.status, // DEP-009: Primary status field
      success: statusCode === 200,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      ...(result.warnings.length > 0 && { warnings: result.warnings }),
      metrics: result.metrics,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Metrics collection failed", error);

    res.status(500).json({
      status: "error", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Configuration status endpoint
 * GET /health/config
 * Enhanced for DEP-009 with timeout handling and proper status codes
 */
router.get("/config", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Apply timeout to configuration checks
    const configCheckPromise = new Promise((resolve, reject) => {
      try {
        if (!configManager.isLoaded()) {
          return resolve({ loaded: false, error: "Configuration not loaded" });
        }

        const config = configManager.get();

        // Return safe configuration info (no secrets)
        const safeConfig = {
          server: {
            environment: config.server.environment,
            port: config.server.port,
            corsOrigins: config.server.corsOrigins.length,
          },
          database: {
            ssl: config.database.ssl,
            maxConnections: config.database.maxConnections,
          },
          redis: {
            enabled: config.redis.enabled,
            host: config.redis.host,
            port: config.redis.port,
            tls: config.redis.tls,
          },
          features: config.features,
          monitoring: {
            enabled: config.monitoring.enabled,
            prometheusEnabled: config.monitoring.prometheusEnabled,
            tracingEnabled: config.monitoring.tracingEnabled,
          },
        };

        resolve({
          loaded: true,
          environment: config.server.environment,
          config: safeConfig,
        });
      } catch (error) {
        reject(error);
      }
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Configuration check timeout")), 2000);
    });

    const result = (await Promise.race([
      configCheckPromise,
      timeoutPromise,
    ])) as any;
    const responseTime = Date.now() - startTime;

    if (!result.loaded) {
      return res.status(503).json({
        status: "not_loaded", // DEP-009: Consistent status field
        success: false,
        timestamp: new Date(),
        responseTime: `${responseTime}ms`,
        error: result.error || "Configuration not loaded",
      });
    }

    res.json({
      status: "ok", // DEP-009: Primary status field
      success: true,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      configuration: {
        loaded: result.loaded,
        environment: result.environment,
        config: result.config,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Configuration status check failed", error);

    res.status(500).json({
      status: "error", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Readiness probe endpoint (for Kubernetes)
 * GET /health/ready
 * Enhanced for DEP-009 with comprehensive readiness validation and timeout handling
 */
router.get("/ready", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Apply timeout to readiness checks
    const readinessCheckPromise = (async () => {
      // Check if all critical services are ready
      const servicesHealth = await serviceRegistry.getHealth();
      const criticalServices = ["AuthService", "HealthCheckService"];

      const criticalServicesStatus = criticalServices.map((serviceName) => {
        const serviceHealth = servicesHealth.services[serviceName];
        return {
          name: serviceName,
          ready: serviceHealth && serviceHealth.status !== "unhealthy",
          status: serviceHealth?.status || "unknown",
        };
      });

      const allCriticalReady = criticalServicesStatus.every((s) => s.ready);

      return {
        ready: allCriticalReady,
        criticalServices: criticalServicesStatus,
        servicesHealth,
      };
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Readiness check timeout")), 5000);
    });

    const { ready, criticalServices, servicesHealth } = await Promise.race([
      readinessCheckPromise,
      timeoutPromise,
    ]);
    const responseTime = Date.now() - startTime;

    // DEP-009: Proper status codes - 200 for ready, 503 for not ready
    const statusCode = ready ? 200 : 503;
    const status = ready ? "ok" : "not_ready";

    res.status(statusCode).json({
      status, // DEP-009: Primary status field
      success: ready,
      ready,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      message: ready ? "Application is ready" : "Critical services not ready",
      criticalServices,
      checks: {
        total: criticalServices.length,
        ready: criticalServices.filter((s) => s.ready).length,
        notReady: criticalServices.filter((s) => !s.ready).length,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Readiness check failed", error);

    res.status(503).json({
      status: "not_ready", // DEP-009: Consistent status field
      success: false,
      ready: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
      criticalServices: [],
      checks: {
        total: 0,
        ready: 0,
        notReady: 1,
      },
    });
  }
});

/**
 * Liveness probe endpoint (for Kubernetes)
 * GET /health/live
 * Enhanced for DEP-009 with proper status formatting
 */
router.get("/live", (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Simple liveness check - if we can respond, we're alive
    const responseTime = Date.now() - startTime;

    res.json({
      status: "ok", // DEP-009: Primary status field
      success: true,
      alive: true,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      uptime: `${Math.round(process.uptime())}s`,
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
      },
    });
  } catch (error) {
    // This should rarely happen, but included for completeness
    res.status(503).json({
      status: "unhealthy",
      success: false,
      alive: false,
      timestamp: new Date(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Startup probe endpoint (for Kubernetes)
 * GET /health/startup
 * Enhanced for DEP-009 with timeout handling and comprehensive startup validation
 */
router.get("/startup", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Apply timeout to startup checks
    const startupCheckPromise = (async () => {
      const checks = [];

      // Check if configuration is loaded
      const configLoaded = configManager.isLoaded();
      checks.push({
        name: "configuration",
        status: configLoaded ? "ok" : "failed",
        ready: configLoaded,
      });

      if (!configLoaded) {
        return { started: false, checks };
      }

      // Check if service registry has services
      const serviceNames = serviceRegistry.getServiceNames();
      const servicesRegistered = serviceNames.length > 0;
      checks.push({
        name: "service_registry",
        status: servicesRegistered ? "ok" : "failed",
        ready: servicesRegistered,
        count: serviceNames.length,
      });

      if (!servicesRegistered) {
        return { started: false, checks };
      }

      // Additional startup checks can be added here
      const allReady = checks.every((check) => check.ready);

      return { started: allReady, checks };
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Startup check timeout")), 5000);
    });

    const { started, checks } = await Promise.race([
      startupCheckPromise,
      timeoutPromise,
    ]);
    const responseTime = Date.now() - startTime;

    // DEP-009: Proper status codes
    const statusCode = started ? 200 : 503;
    const status = started ? "ok" : "not_started";

    res.status(statusCode).json({
      status, // DEP-009: Primary status field
      success: started,
      started,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      message: started
        ? "Application has started successfully"
        : "Application startup incomplete",
      checks,
      summary: {
        total: checks.length,
        ready: checks.filter((c) => c.ready).length,
        failed: checks.filter((c) => !c.ready).length,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Startup check failed", error);

    res.status(503).json({
      status: "not_started", // DEP-009: Consistent status field
      success: false,
      started: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
      checks: [],
      summary: {
        total: 0,
        ready: 0,
        failed: 1,
      },
    });
  }
});

/**
 * Health check history endpoint
 * GET /health/history
 * Enhanced for DEP-009 with proper status normalization and timeout handling
 */
router.get("/history", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // DEP-009: Apply timeout to history retrieval
    const historyPromise = new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const lastReport = healthCheckService.getLastReport();
          resolve(lastReport);
        } catch (error) {
          reject(error);
        }
      }, 0);
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("History retrieval timeout")), 2000); // Shorter timeout for history
    });

    const lastReport = (await Promise.race([
      historyPromise,
      timeoutPromise,
    ])) as any;
    const responseTime = Date.now() - startTime;

    if (!lastReport) {
      return res.status(404).json({
        status: "not_found", // DEP-009: Consistent status field
        success: false,
        timestamp: new Date(),
        responseTime: `${responseTime}ms`,
        message: "No health check history available",
      });
    }

    // DEP-009: Normalize check statuses in history
    const normalizedChecks = lastReport.checks.map((check: any) => ({
      name: check.name,
      status: check.status === "healthy" ? "ok" : check.status,
      responseTime: `${check.responseTime}ms`,
      message: check.message,
      ...(check.error && { error: check.error }),
    }));

    res.json({
      status: "ok", // DEP-009: Primary status field
      success: true,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      history: {
        lastCheck: lastReport.timestamp,
        status: lastReport.status === "healthy" ? "ok" : lastReport.status,
        summary: lastReport.summary,
        checks: normalizedChecks,
      },
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error("Health history check failed", error);

    res.status(500).json({
      status: "error", // DEP-009: Consistent status field
      success: false,
      timestamp: new Date(),
      responseTime: `${responseTime}ms`,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
