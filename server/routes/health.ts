import { Router, Request, Response } from 'express';
import { checkDatabaseConnection, getDatabasePoolStats } from '../db';
import logger from '../utils/logger';

const router = Router();

/**
 * General health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check database health
    const dbHealth = await checkDatabaseConnection();
    
    // Get system information
    const systemHealth = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };

    const responseTime = Date.now() - startTime;

    const healthStatus = {
      status: dbHealth.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: {
          status: dbHealth.isHealthy ? 'up' : 'down',
          version: dbHealth.version,
          database: dbHealth.database,
          user: dbHealth.user,
          latency: `${dbHealth.latency}ms`,
          connectionCount: dbHealth.connectionCount,
          error: dbHealth.error
        },
        application: {
          status: 'up',
          uptime: `${Math.floor(systemHealth.uptime)}s`,
          memory: {
            used: `${Math.round(systemHealth.memory.heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(systemHealth.memory.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(systemHealth.memory.external / 1024 / 1024)}MB`
          },
          nodeVersion: systemHealth.nodeVersion,
          platform: systemHealth.platform,
          pid: systemHealth.pid
        }
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || 'unknown'
      }
    };

    // Set appropriate HTTP status code
    const statusCode = dbHealth.isHealthy ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
    
    // Log health check results
    if (dbHealth.isHealthy) {
      logger.info('Health check passed', { responseTime: `${responseTime}ms` });
    } else {
      logger.warn('Health check failed', { 
        error: dbHealth.error,
        responseTime: `${responseTime}ms`
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Health check endpoint error', { error: errorMessage });
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      services: {
        database: { status: 'unknown' },
        application: { status: 'error' }
      }
    });
  }
});

/**
 * Database-specific health check endpoint
 */
router.get('/db', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Perform comprehensive database health check
    const dbHealth = await checkDatabaseConnection();
    const poolStats = getDatabasePoolStats();
    
    // Test a simple query to verify read/write access
    let queryTest = { success: false, latency: 0 };
    try {
      const queryStart = Date.now();
      await import('../db').then(({ client }) => client`SELECT 1 as test`);
      queryTest = { success: true, latency: Date.now() - queryStart };
    } catch (queryError) {
      queryTest = { 
        success: false, 
        latency: Date.now() - startTime,
        error: queryError instanceof Error ? queryError.message : String(queryError)
      };
    }

    const responseTime = Date.now() - startTime;

    const dbHealthStatus = {
      status: dbHealth.isHealthy && queryTest.success ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      database: {
        connected: dbHealth.isHealthy,
        version: dbHealth.version,
        database: dbHealth.database,
        user: dbHealth.user,
        connectionCount: dbHealth.connectionCount,
        connectionLatency: `${dbHealth.latency}ms`,
        queryTest: {
          success: queryTest.success,
          latency: `${queryTest.latency}ms`,
          error: (queryTest as any).error
        },
        pool: {
          maxConnections: poolStats.maxConnections,
          idleTimeout: `${poolStats.idleTimeout}s`,
          connectTimeout: `${poolStats.connectTimeout}s`,
          maxLifetime: `${poolStats.maxLifetime}s`
        },
        error: dbHealth.error
      }
    };

    // Set appropriate HTTP status code
    const statusCode = dbHealth.isHealthy && queryTest.success ? 200 : 503;
    
    res.status(statusCode).json(dbHealthStatus);
    
    // Log database health check results
    if (dbHealth.isHealthy && queryTest.success) {
      logger.info('Database health check passed', { 
        responseTime: `${responseTime}ms`,
        connectionLatency: `${dbHealth.latency}ms`,
        queryLatency: `${queryTest.latency}ms`
      });
    } else {
      logger.warn('Database health check failed', { 
        dbConnected: dbHealth.isHealthy,
        querySuccess: queryTest.success,
        dbError: dbHealth.error,
        queryError: (queryTest as any).error,
        responseTime: `${responseTime}ms`
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('Database health check endpoint error', { error: errorMessage });
    
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: errorMessage,
      database: {
        connected: false,
        error: errorMessage
      }
    });
  }
});

/**
 * Readiness check endpoint (for Kubernetes/container orchestration)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if application is ready to serve traffic
    const dbHealth = await checkDatabaseConnection();
    
    if (dbHealth.isHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not available'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Liveness check endpoint (for Kubernetes/container orchestration)
 */
router.get('/live', (req: Request, res: Response) => {
  // Simple liveness check - just verify the process is running
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  });
});

export default router;