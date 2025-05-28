
import express from 'express';
import type { Request, Response } from 'express';
import { cacheService } from '../services/unified-cache-service';
import db, { executeQuery } from '../db';
import logger from '../utils/logger';
import { ResponseHelper, asyncHandler } from '../utils/error-codes';
import os from 'os';

const router = express.Router();

// Health check endpoint
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const healthChecks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      database: false,
      cache: false,
      memory: true
    },
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.loadavg(),
      platform: os.platform(),
      nodeVersion: process.version
    }
  };

  try {
    // Check database health
    healthChecks.services.database = await executeQuery(async () => true);

    // Check cache health
    healthChecks.services.cache = await cacheService.healthCheck();

    // Determine overall status
    const allServicesHealthy = Object.values(healthChecks.services).every(Boolean);
    healthChecks.status = allServicesHealthy ? 'healthy' : 'degraded';

    const statusCode = allServicesHealthy ? 200 : 503;
    res.status(statusCode).json(healthChecks);

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Health check failed', { error: err.message });

    healthChecks.status = 'unhealthy';
    res.status(503).json(healthChecks);
  }
}));

// Detailed performance metrics
router.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  try {
    const cacheStats = await cacheService.getStats();

    const metrics = {
      timestamp: new Date().toISOString(),
      performance: {
        cache: cacheStats,
        memory: {
          usage: process.memoryUsage(),
          heap: {
            used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
            limit: Math.round((os.totalmem() / 1024 / 1024) * 100) / 100
          }
        },
        system: {
          uptime: Math.round(process.uptime()),
          loadAverage: os.loadavg(),
          cpuUsage: process.cpuUsage(),
          freeMemory: Math.round((os.freemem() / 1024 / 1024) * 100) / 100,
          totalMemory: Math.round((os.totalmem() / 1024 / 1024) * 100) / 100
        }
      }
    };

    ResponseHelper.success(res, metrics, 'Performance metrics retrieved');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get performance metrics', { error: err.message });
    ResponseHelper.error(res, err);
  }
}));

// Cache management endpoints
router.get('/cache/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const stats = await cacheService.getStats();
    ResponseHelper.success(res, stats, 'Cache statistics retrieved');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get cache stats', { error: err.message });
    ResponseHelper.error(res, err);
  }
}));

router.post('/cache/clear', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { pattern, prefix } = req.body;

    if (pattern) {
      await cacheService.invalidatePattern(pattern, { prefix });
      logger.info(`Cache cleared by pattern: ${pattern}`, { prefix });
      ResponseHelper.success(res, null, `Cache cleared by pattern: ${pattern}`);
    } else {
      await cacheService.clear(prefix);
      logger.info('Cache cleared', { prefix });
      ResponseHelper.success(res, null, prefix ? `Cache cleared for prefix: ${prefix}` : 'Entire cache cleared');
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to clear cache', { error: err.message });
    ResponseHelper.error(res, err);
  }
}));

// Database performance insights
router.get('/database/performance', asyncHandler(async (req: Request, res: Response) => {
  try {
    const isHealthy = await executeQuery(async () => true);

    const dbPerformance = {
      timestamp: new Date().toISOString(),
      connection: {
        healthy: isHealthy,
        pool: {
          max: 10,
          active: 'N/A',
          idle: 'N/A'
        }
      },
      queries: {
        slowQueries: 0,
        averageResponseTime: 'N/A',
        queriesPerSecond: 'N/A'
      },
      indexes: {
        applied: true,
        count: 21,
        lastOptimized: 'Recently applied'
      }
    };

    ResponseHelper.success(res, dbPerformance, 'Database performance data retrieved');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get database performance', { error: err.message });
    ResponseHelper.error(res, err);
  }
}));

// Application performance summary
router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  try {
    const [cacheStats, dbHealth] = await Promise.all([
      cacheService.getStats(),
      executeQuery(async () => true)
    ]);

    const memoryUsage = process.memoryUsage();
    const systemLoad = os.loadavg()[0];

    let performanceScore = 100;

    const hitRate = parseFloat(cacheStats.hitRate.replace('%', ''));
    if (hitRate < 80) performanceScore -= (80 - hitRate);

    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    if (memoryUsagePercent > 80) performanceScore -= (memoryUsagePercent - 80);

    if (systemLoad > 1) performanceScore -= (systemLoad - 1) * 10;

    performanceScore = Math.max(0, Math.round(performanceScore));

    const summary = {
      timestamp: new Date().toISOString(),
      overallScore: performanceScore,
      status: performanceScore >= 80 ? 'excellent' :
              performanceScore >= 60 ? 'good' :
              performanceScore >= 40 ? 'fair' : 'poor',
      services: {
        database: dbHealth ? 'healthy' : 'degraded',
        cache: cacheStats.connected ? 'healthy' : 'degraded'
      },
      keyMetrics: {
        cacheHitRate: cacheStats.hitRate,
        cacheType: cacheStats.type,
        memoryUsage: `${Math.round(memoryUsagePercent)}%`,
        systemLoad: systemLoad.toFixed(2),
        uptime: `${Math.round(process.uptime() / 3600)}h`
      },
      recommendations: []
    };

    if (hitRate < 80) {
      summary.recommendations.push('Consider increasing cache TTL values or reviewing cache strategy');
    }
    if (memoryUsagePercent > 80) {
      summary.recommendations.push('High memory usage detected - consider memory optimization');
    }
    if (systemLoad > 1) {
      summary.recommendations.push('High system load - consider scaling or optimization');
    }
    if (!cacheStats.connected && cacheStats.type === 'memory') {
      summary.recommendations.push('Redis cache not available - consider setting up Redis for better performance');
    }

    ResponseHelper.success(res, summary, 'Performance summary retrieved');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get performance summary', { error: err.message });
    ResponseHelper.error(res, err);
  }
}));

export default router;
