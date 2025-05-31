/**
 * Health Check Routes
 * 
 * Comprehensive health check endpoints for monitoring system status,
 * service health, and performance metrics.
 */

import { Router, Request, Response } from 'express';
import { healthCheckService } from '../services/health-check-service';
import { serviceRegistry } from '../services/service-registry';
import { configManager } from '../config/config-manager';
import logger from '../utils/logger';
import { CustomError } from '../utils/error-handler';

const router = Router();

/**
 * Basic health check endpoint
 * GET /health
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const report = await healthCheckService.runAllChecks();
    
    const statusCode = report.status === 'healthy' ? 200 : 
                      report.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      status: report.status,
      timestamp: report.timestamp,
      uptime: report.uptime,
      version: report.version,
      environment: report.environment
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Detailed health check endpoint
 * GET /health/detailed
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const report = await healthCheckService.runAllChecks();
    
    const statusCode = report.status === 'healthy' ? 200 : 
                      report.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Detailed health check failed', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Service registry health endpoint
 * GET /health/services
 */
router.get('/services', async (req: Request, res: Response) => {
  try {
    const servicesHealth = await serviceRegistry.getHealth();
    
    const statusCode = servicesHealth.status === 'healthy' ? 200 : 
                      servicesHealth.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: servicesHealth
    });
  } catch (error) {
    logger.error('Services health check failed', error);
    res.status(503).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Individual service health endpoint
 * GET /health/services/:serviceName
 */
router.get('/services/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const service = serviceRegistry.get(serviceName);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: `Service '${serviceName}' not found`
      });
    }

    const health = await service.getHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: {
        service: serviceName,
        ...health
      }
    });
  } catch (error) {
    logger.error(`Service health check failed for ${req.params.serviceName}`, error);
    res.status(503).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * System metrics endpoint
 * GET /health/metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers,
        heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Metrics collection failed', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Configuration status endpoint
 * GET /health/config
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    if (!configManager.isLoaded()) {
      return res.status(503).json({
        success: false,
        error: 'Configuration not loaded'
      });
    }

    const config = configManager.get();
    
    // Return safe configuration info (no secrets)
    const safeConfig = {
      server: {
        environment: config.server.environment,
        port: config.server.port,
        corsOrigins: config.server.corsOrigins.length
      },
      database: {
        ssl: config.database.ssl,
        maxConnections: config.database.maxConnections
      },
      redis: {
        enabled: config.redis.enabled,
        host: config.redis.host,
        port: config.redis.port,
        tls: config.redis.tls
      },
      features: config.features,
      monitoring: {
        enabled: config.monitoring.enabled,
        prometheusEnabled: config.monitoring.prometheusEnabled,
        tracingEnabled: config.monitoring.tracingEnabled
      }
    };

    res.json({
      success: true,
      data: {
        loaded: true,
        environment: config.server.environment,
        config: safeConfig
      }
    });
  } catch (error) {
    logger.error('Configuration status check failed', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Readiness probe endpoint (for Kubernetes)
 * GET /health/ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if all critical services are ready
    const servicesHealth = await serviceRegistry.getHealth();
    const criticalServices = ['AuthService', 'HealthCheckService'];
    
    const criticalServicesHealthy = criticalServices.every(serviceName => {
      const serviceHealth = servicesHealth.services[serviceName];
      return serviceHealth && serviceHealth.status !== 'unhealthy';
    });

    if (!criticalServicesHealthy) {
      return res.status(503).json({
        success: false,
        ready: false,
        message: 'Critical services not ready'
      });
    }

    res.json({
      success: true,
      ready: true,
      message: 'Application is ready'
    });
  } catch (error) {
    logger.error('Readiness check failed', error);
    res.status(503).json({
      success: false,
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Liveness probe endpoint (for Kubernetes)
 * GET /health/live
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    success: true,
    alive: true,
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

/**
 * Startup probe endpoint (for Kubernetes)
 * GET /health/startup
 */
router.get('/startup', async (req: Request, res: Response) => {
  try {
    // Check if configuration is loaded
    if (!configManager.isLoaded()) {
      return res.status(503).json({
        success: false,
        started: false,
        message: 'Configuration not loaded'
      });
    }

    // Check if service registry has services
    const serviceNames = serviceRegistry.getServiceNames();
    if (serviceNames.length === 0) {
      return res.status(503).json({
        success: false,
        started: false,
        message: 'No services registered'
      });
    }

    res.json({
      success: true,
      started: true,
      message: 'Application has started successfully',
      services: serviceNames.length
    });
  } catch (error) {
    logger.error('Startup check failed', error);
    res.status(503).json({
      success: false,
      started: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check history endpoint
 * GET /health/history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const lastReport = healthCheckService.getLastReport();
    
    if (!lastReport) {
      return res.status(404).json({
        success: false,
        message: 'No health check history available'
      });
    }

    res.json({
      success: true,
      data: {
        lastCheck: lastReport.timestamp,
        status: lastReport.status,
        summary: lastReport.summary,
        checks: lastReport.checks.map(check => ({
          name: check.name,
          status: check.status,
          responseTime: check.responseTime,
          message: check.message
        }))
      }
    });
  } catch (error) {
    logger.error('Health history check failed', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
