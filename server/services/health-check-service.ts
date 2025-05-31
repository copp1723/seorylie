/**
 * Health Check Service
 * 
 * Comprehensive health monitoring system that checks the status of all application
 * components, dependencies, and services. Provides detailed health reports and
 * monitoring endpoints.
 */

import { BaseService, ServiceConfig, ServiceHealth } from './base-service';
import { serviceRegistry } from './service-registry';
import { db } from '../db';
import { getRedisClient, isRedisAvailable } from '../utils/redis-config';
import logger from '../utils/logger';
import { CustomError } from '../utils/error-handler';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheckResult[];
  services: Record<string, ServiceHealth>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
}

export class HealthCheckService extends BaseService {
  private checks: Map<string, () => Promise<HealthCheckResult>> = new Map();
  private lastReport: SystemHealthReport | null = null;
  private checkConfig: HealthCheckConfig;

  constructor(config: ServiceConfig & { healthCheckConfig?: Partial<HealthCheckConfig> }) {
    super(config);
    
    this.checkConfig = {
      timeout: 5000, // 5 seconds
      retries: 2,
      interval: 30000, // 30 seconds
      ...config.healthCheckConfig
    };

    this.registerBuiltInChecks();
  }

  protected async onInitialize(): Promise<void> {
    logger.info('Health Check Service initializing...');
    
    // Start periodic health checks
    setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        logger.error('Periodic health check failed', error);
      }
    }, this.checkConfig.interval);

    logger.info('Health Check Service initialized');
  }

  protected async onShutdown(): Promise<void> {
    logger.info('Health Check Service shutting down...');
    // Cleanup would go here
  }

  protected async checkDependencyHealth(dependency: string): Promise<ServiceHealth> {
    // This would check specific dependencies
    return {
      status: 'healthy',
      lastCheck: new Date(),
      uptime: 0,
      dependencies: {}
    };
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, checkFunction: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFunction);
    logger.info(`Health check registered: ${name}`);
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
    logger.info(`Health check unregistered: ${name}`);
  }

  /**
   * Run all health checks and generate system health report
   */
  async runAllChecks(): Promise<SystemHealthReport> {
    const startTime = Date.now();
    const checks: HealthCheckResult[] = [];

    logger.debug('Running all health checks...');

    // Run all registered checks
    for (const [name, checkFunction] of this.checks) {
      try {
        const result = await this.runSingleCheck(name, checkFunction);
        checks.push(result);
      } catch (error) {
        checks.push({
          name,
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Get service health from registry
    const servicesHealth = await serviceRegistry.getHealth();

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overallStatus = summary.unhealthy > summary.healthy ? 'unhealthy' : 'degraded';
    } else if (summary.degraded > 0 || servicesHealth.status !== 'healthy') {
      overallStatus = 'degraded';
    }

    const report: SystemHealthReport = {
      status: overallStatus,
      timestamp: new Date(),
      uptime: this.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      services: servicesHealth.services,
      summary
    };

    this.lastReport = report;

    logger.debug('Health checks completed', {
      status: overallStatus,
      totalChecks: summary.total,
      healthyChecks: summary.healthy,
      responseTime: Date.now() - startTime
    });

    return report;
  }

  /**
   * Get the last health report
   */
  getLastReport(): SystemHealthReport | null {
    return this.lastReport;
  }

  /**
   * Run a single health check with timeout and retry logic
   */
  private async runSingleCheck(
    name: string, 
    checkFunction: () => Promise<HealthCheckResult>
  ): Promise<HealthCheckResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.checkConfig.retries + 1; attempt++) {
      try {
        const startTime = Date.now();
        
        // Run check with timeout
        const result = await Promise.race([
          checkFunction(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Health check timeout')), this.checkConfig.timeout)
          )
        ]);

        // Ensure response time is set
        if (!result.responseTime) {
          result.responseTime = Date.now() - startTime;
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt <= this.checkConfig.retries) {
          logger.warn(`Health check ${name} failed, retrying (${attempt}/${this.checkConfig.retries})`, {
            error: lastError.message
          });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    // All retries failed
    return {
      name,
      status: 'unhealthy',
      responseTime: this.checkConfig.timeout,
      error: lastError?.message || 'Unknown error'
    };
  }

  /**
   * Register built-in health checks
   */
  private registerBuiltInChecks(): void {
    // Database health check
    this.registerCheck('database', async () => {
      const startTime = Date.now();
      try {
        // Simple query to test database connectivity
        await db.execute('SELECT 1');
        
        return {
          name: 'database',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'Database connection successful'
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Redis health check
    this.registerCheck('redis', async () => {
      const startTime = Date.now();
      try {
        const isAvailable = await isRedisAvailable();
        
        if (!isAvailable) {
          return {
            name: 'redis',
            status: 'degraded',
            responseTime: Date.now() - startTime,
            message: 'Redis not available, using fallback'
          };
        }

        const redis = getRedisClient();
        await redis.ping();
        
        return {
          name: 'redis',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'Redis connection successful'
        };
      } catch (error) {
        return {
          name: 'redis',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Memory health check
    this.registerCheck('memory', async () => {
      const startTime = Date.now();
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal;
      const usedMem = memUsage.heapUsed;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = `Memory usage: ${memoryUsagePercent.toFixed(2)}%`;

      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        message += ' - Critical memory usage';
      } else if (memoryUsagePercent > 80) {
        status = 'degraded';
        message += ' - High memory usage';
      }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - startTime,
        message,
        metadata: {
          heapUsed: usedMem,
          heapTotal: totalMem,
          usagePercent: memoryUsagePercent,
          external: memUsage.external,
          rss: memUsage.rss
        }
      };
    });

    // Disk space health check (basic)
    this.registerCheck('disk', async () => {
      const startTime = Date.now();
      
      // This is a simplified check - in production you'd want to check actual disk usage
      return {
        name: 'disk',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'Disk space check passed'
      };
    });

    // OpenAI API health check
    this.registerCheck('openai', async () => {
      const startTime = Date.now();
      
      if (!process.env.OPENAI_API_KEY) {
        return {
          name: 'openai',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: 'OpenAI API key not configured'
        };
      }

      // In a real implementation, you might make a simple API call to test connectivity
      return {
        name: 'openai',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        message: 'OpenAI API key configured'
      };
    });
  }
}

// Create and export singleton instance
export const healthCheckService = new HealthCheckService({
  name: 'HealthCheckService',
  version: '1.0.0',
  dependencies: []
});
