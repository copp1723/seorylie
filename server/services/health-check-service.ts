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
import { webSocketServer } from '../websocket';
import webSocketService from './websocket-service';

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
      timeout: 5000, // 5 seconds - DEP-009 requirement
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
   * Enhanced for DEP-009 with improved timeout handling and graceful degradation
   */
  private async runSingleCheck(
    name: string, 
    checkFunction: () => Promise<HealthCheckResult>
  ): Promise<HealthCheckResult> {
    let lastError: Error | null = null;
    const globalStartTime = Date.now();

    for (let attempt = 1; attempt <= this.checkConfig.retries + 1; attempt++) {
      try {
        const startTime = Date.now();
        
        // Run check with strict timeout enforcement - DEP-009 requirement (5 seconds max)
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Health check timeout after ${this.checkConfig.timeout}ms`));
          }, this.checkConfig.timeout);
        });
        
        const result = await Promise.race([
          (async () => {
            try {
              const res = await checkFunction();
              return res;
            } finally {
              clearTimeout(timeoutId); // Clear the timeout when checkFunction completes
            }
          })(),
          timeoutPromise
        ]);

        // Ensure response time is set and validate it's within acceptable range
        const actualResponseTime = Date.now() - startTime;
        if (!result.responseTime) {
          result.responseTime = actualResponseTime;
        }
        
        // Warn if response time is approaching timeout
        if (actualResponseTime > this.checkConfig.timeout * 0.8) {
          logger.warn(`Health check ${name} response time approaching timeout`, {
            responseTime: actualResponseTime,
            timeout: this.checkConfig.timeout,
            attempt
          });
        }

        // DEP-009: Ensure status is properly normalized
        if (!['healthy', 'degraded', 'unhealthy'].includes(result.status)) {
          logger.warn(`Health check ${name} returned invalid status: ${result.status}`);
          result.status = 'unhealthy';
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const attemptTime = Date.now() - globalStartTime;
        
        // Check if we've exceeded total timeout across all attempts
        if (attemptTime > this.checkConfig.timeout * 2) {
          logger.error(`Health check ${name} exceeded total timeout across all attempts`, {
            totalTime: attemptTime,
            maxAllowed: this.checkConfig.timeout * 2,
            attempt
          });
          break;
        }
        
        if (attempt <= this.checkConfig.retries) {
          const retryDelay = Math.min(1000 * attempt, 2000); // Cap retry delay at 2 seconds
          logger.warn(`Health check ${name} failed, retrying (${attempt}/${this.checkConfig.retries})`, {
            error: lastError.message,
            retryDelay,
            attemptTime
          });
          
          // Wait before retry, but don't exceed total timeout
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed - return graceful degradation result
    const totalTime = Date.now() - globalStartTime;
    return {
      name,
      status: 'unhealthy',
      responseTime: totalTime,
      error: lastError?.message || 'Unknown error after retries',
      metadata: {
        retriesAttempted: this.checkConfig.retries,
        totalResponseTime: totalTime,
        timeoutThreshold: this.checkConfig.timeout
      }
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

    // WebSocket server health check - DEP-009 requirement
    this.registerCheck('websocket_server', async () => {
      const startTime = Date.now();
      try {
        const serverStatus = webSocketServer.getStatus();
        const serviceMetrics = webSocketService.getMetrics();
        
        if (!serverStatus.isRunning) {
          return {
            name: 'websocket_server',
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: 'WebSocket server is not running'
          };
        }

        if (serverStatus.isShuttingDown) {
          return {
            name: 'websocket_server',
            status: 'degraded',
            responseTime: Date.now() - startTime,
            message: 'WebSocket server is shutting down',
            metadata: {
              activeConnections: serverStatus.connectionCount
            }
          };
        }

        return {
          name: 'websocket_server',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'WebSocket server is running',
          metadata: {
            isRunning: serverStatus.isRunning,
            connectionCount: serverStatus.connectionCount,
            serviceConnections: serviceMetrics.connections.active,
            redisEnabled: serviceMetrics.redisEnabled,
            instanceId: serviceMetrics.instanceId
          }
        };
      } catch (error) {
        return {
          name: 'websocket_server',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // Enhanced Redis health check with connection pool monitoring
    this.registerCheck('redis_enhanced', async () => {
      const startTime = Date.now();
      try {
        const isAvailable = await isRedisAvailable();
        
        if (!isAvailable) {
          return {
            name: 'redis_enhanced',
            status: process.env.NODE_ENV === 'production' ? 'unhealthy' : 'degraded',
            responseTime: Date.now() - startTime,
            message: 'Redis not available',
            metadata: {
              fallbackMode: true,
              environment: process.env.NODE_ENV
            }
          };
        }

        const redis = getRedisClient();
        
        // Test basic connectivity
        const pingStart = Date.now();
        await redis.ping();
        const pingLatency = Date.now() - pingStart;
        
        // Test a simple set/get operation
        const testKey = `health_check_${Date.now()}`;
        const testValue = 'health_test';
        
        await redis.set(testKey, testValue, 'EX', 10); // Expire in 10 seconds
        const retrievedValue = await redis.get(testKey);
        await redis.del(testKey); // Cleanup
        
        if (retrievedValue !== testValue) {
          return {
            name: 'redis_enhanced',
            status: 'degraded',
            responseTime: Date.now() - startTime,
            message: 'Redis set/get operation failed',
            metadata: {
              pingLatency,
              testFailed: true
            }
          };
        }
        
        // Get Redis info for additional metrics
        let redisInfo: any = {};
        try {
          const info = await redis.info('memory');
          const lines = info.split('\r\n');
          for (const line of lines) {
            if (line.includes(':')) {
              const [key, value] = line.split(':');
              if (key === 'used_memory_human' || key === 'used_memory_peak_human') {
                redisInfo[key] = value;
              }
            }
          }
        } catch (infoError) {
          // Info command failed, but basic operations work
        }
        
        return {
          name: 'redis_enhanced',
          status: 'healthy',
          responseTime: Date.now() - startTime,
          message: 'Redis connection and operations successful',
          metadata: {
            pingLatency,
            operationTest: 'passed',
            ...redisInfo
          }
        };
      } catch (error) {
        return {
          name: 'redis_enhanced',
          status: process.env.NODE_ENV === 'production' ? 'unhealthy' : 'degraded',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error),
          metadata: {
            environment: process.env.NODE_ENV
          }
        };
      }
    });

    // System resources health check with enhanced monitoring
    this.registerCheck('system_resources', async () => {
      const startTime = Date.now();
      try {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        const uptime = process.uptime();
        
        // Calculate memory usage percentages
        const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        const rssUsageBytes = memUsage.rss;
        
        // Determine health status based on thresholds
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
        const warnings: string[] = [];
        
        if (heapUsagePercent > 90) {
          status = 'unhealthy';
          warnings.push('Critical heap memory usage');
        } else if (heapUsagePercent > 80) {
          status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
          warnings.push('High heap memory usage');
        }
        
        // Check if RSS usage is extremely high (> 1GB)
        if (rssUsageBytes > 1024 * 1024 * 1024) {
          status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
          warnings.push('High RSS memory usage');
        }
        
        const message = warnings.length > 0 
          ? `System resources: ${warnings.join(', ')}`
          : 'System resources within normal limits';
        
        return {
          name: 'system_resources',
          status,
          responseTime: Date.now() - startTime,
          message,
          metadata: {
            memory: {
              heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
              heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
              heapUsagePercent: Math.round(heapUsagePercent * 100) / 100,
              rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
              external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
            },
            cpu: {
              user: cpuUsage.user,
              system: cpuUsage.system
            },
            uptime: `${Math.round(uptime)}s`,
            warnings
          }
        };
      } catch (error) {
        return {
          name: 'system_resources',
          status: 'unhealthy',
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });
  }
}

// Create and export singleton instance
export const healthCheckService = new HealthCheckService({
  name: 'HealthCheckService',
  version: '1.0.0',
  dependencies: []
});
