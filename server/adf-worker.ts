/**
 * ADF Background Worker Entry Point
 *
 * This is a dedicated worker process for handling ADF (Auto Data Format)
 * email processing and lead ingestion in the background.
 *
 * Features:
 * - Email polling and processing
 * - Health check endpoint (/healthz)
 * - Periodic health logging for Render monitoring
 * - Graceful shutdown handling
 * - Metrics and monitoring integration
 */

import express from "express";
import { createServer } from "http";
import logger from "./utils/logger.js";
import { adfService } from "./services/adf-service.js";
import { adfEmailListener } from "./services/adf-email-listener.js";
import { checkDatabaseConnection } from "./db.js";
import { serviceRegistry } from "./services/service-registry.js";

// Environment configuration
const PORT = process.env.ADF_WORKER_PORT || 3001;
const HEALTH_LOG_INTERVAL = parseInt(
  process.env.HEALTH_LOG_INTERVAL || "300000",
); // 5 minutes
const WORKER_TYPE = process.env.WORKER_TYPE || "adf-email";

// Worker state
let isShuttingDown = false;
let healthLogInterval: NodeJS.Timeout;

/**
 * Create Express app for health checks
 */
function createHealthApp(): express.Application {
  const app = express();

  // Basic middleware
  app.use(express.json());

  // Health check endpoint for Render and monitoring
  app.get("/healthz", async (req, res) => {
    try {
      const startTime = Date.now();

      // Check database connection
      const dbHealth = await checkDatabaseConnection();

      // Check ADF service health
      const adfStats = adfService.getProcessingStats();

      // Check service registry health
      const servicesHealth = await serviceRegistry.getHealth();

      const responseTime = Date.now() - startTime;

      const healthStatus = {
        status:
          dbHealth.isHealthy && servicesHealth.status === "healthy"
            ? "healthy"
            : "unhealthy",
        timestamp: new Date().toISOString(),
        worker: {
          type: WORKER_TYPE,
          uptime: process.uptime(),
          pid: process.pid,
          memory: process.memoryUsage(),
          isShuttingDown,
        },
        database: {
          status: dbHealth.isHealthy ? "healthy" : "unhealthy",
          error: dbHealth.error,
        },
        adf: {
          isListening: adfStats.isListening,
          processingStats: adfStats,
          parserHealth: adfStats.parserHealth,
        },
        services: servicesHealth,
        responseTime: `${responseTime}ms`,
      };

      const statusCode = healthStatus.status === "healthy" ? 200 : 503;
      res.status(statusCode).json(healthStatus);

      // Log health check results
      if (healthStatus.status === "healthy") {
        logger.debug("ADF Worker health check passed", {
          responseTime: `${responseTime}ms`,
        });
      } else {
        logger.warn("ADF Worker health check failed", {
          healthStatus,
          responseTime: `${responseTime}ms`,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("ADF Worker health check error", { error: errorMessage });

      res.status(500).json({
        status: "error",
        timestamp: new Date().toISOString(),
        worker: {
          type: WORKER_TYPE,
          pid: process.pid,
          isShuttingDown,
        },
        error: errorMessage,
      });
    }
  });

  // Liveness probe (simpler check)
  app.get("/live", (req, res) => {
    res.status(200).json({
      status: "alive",
      timestamp: new Date().toISOString(),
      worker: {
        type: WORKER_TYPE,
        uptime: process.uptime(),
        pid: process.pid,
      },
    });
  });

  // Readiness probe
  app.get("/ready", async (req, res) => {
    try {
      const dbHealth = await checkDatabaseConnection();

      if (dbHealth.isHealthy && !isShuttingDown) {
        res.status(200).json({
          status: "ready",
          timestamp: new Date().toISOString(),
          worker: { type: WORKER_TYPE },
        });
      } else {
        res.status(503).json({
          status: "not ready",
          timestamp: new Date().toISOString(),
          worker: { type: WORKER_TYPE },
          reason: isShuttingDown ? "Shutting down" : "Database not available",
        });
      }
    } catch (error) {
      res.status(503).json({
        status: "not ready",
        timestamp: new Date().toISOString(),
        worker: { type: WORKER_TYPE },
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return app;
}

/**
 * Start periodic health logging to keep Render happy
 */
function startHealthLogging(): void {
  healthLogInterval = setInterval(async () => {
    try {
      const adfStats = adfService.getProcessingStats();
      const dbHealth = await checkDatabaseConnection();

      logger.info("ADF Worker periodic health log", {
        worker: {
          type: WORKER_TYPE,
          uptime: process.uptime(),
          pid: process.pid,
          memory: process.memoryUsage(),
        },
        database: {
          healthy: dbHealth.isHealthy,
        },
        adf: {
          isListening: adfStats.isListening,
          totalProcessed: adfStats.totalProcessed,
          totalErrors: adfStats.totalErrors,
          uptime: adfStats.uptime,
        },
      });
    } catch (error) {
      logger.error("Error in periodic health logging", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, HEALTH_LOG_INTERVAL);
}

/**
 * Initialize and start the ADF worker
 */
async function startAdfWorker(): Promise<void> {
  try {
    logger.info("Starting ADF Background Worker", {
      workerType: WORKER_TYPE,
      port: PORT,
      pid: process.pid,
    });

    // Initialize service registry
    await serviceRegistry.initialize();

    // Initialize and start ADF service
    await adfService.initialize();
    await adfService.start();

    // Start email listener if this is an email worker
    if (WORKER_TYPE === "adf-email") {
      try {
        await adfEmailListener.start();
        logger.info("ADF Email Listener started successfully");
      } catch (error) {
        logger.warn("ADF Email Listener failed to start (may be disabled)", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Create and start health check server
    const app = createHealthApp();
    const server = createServer(app);

    server.listen(PORT, () => {
      logger.info(`ADF Worker health server listening on port ${PORT}`);
    });

    // Start periodic health logging
    startHealthLogging();

    logger.info("ADF Background Worker started successfully", {
      workerType: WORKER_TYPE,
      healthEndpoint: `http://localhost:${PORT}/healthz`,
      pid: process.pid,
    });
  } catch (error) {
    logger.error("Failed to start ADF Background Worker", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  isShuttingDown = true;

  try {
    // Clear health logging interval
    if (healthLogInterval) {
      clearInterval(healthLogInterval);
    }

    // Stop ADF services
    if (WORKER_TYPE === "adf-email") {
      await adfEmailListener.stop();
    }
    await adfService.stop();

    // Shutdown service registry
    await serviceRegistry.shutdown();

    logger.info("ADF Background Worker shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception in ADF Worker", {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection in ADF Worker", {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: promise.toString(),
  });
  process.exit(1);
});

// Start the worker
startAdfWorker().catch((error) => {
  logger.error("Failed to start ADF Worker", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
