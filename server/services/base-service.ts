/**
 * Base Service Class
 *
 * Provides common patterns and functionality for all services in the application.
 * Implements standardized error handling, logging, health checks, and lifecycle management.
 */

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger";
import { CustomError } from "../utils/error-handler";

export interface ServiceConfig {
  name: string;
  version?: string;
  enabled?: boolean;
  dependencies?: string[];
  healthCheckInterval?: number;
  retryConfig?: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
}

export interface ServiceHealth {
  status: "healthy" | "unhealthy" | "degraded";
  lastCheck: Date;
  uptime: number;
  dependencies: Record<string, ServiceHealth>;
  metrics?: Record<string, any>;
  error?: string;
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastRequestTime?: Date;
  lastErrorTime?: Date;
}

export abstract class BaseService extends EventEmitter {
  protected readonly config: ServiceConfig;
  protected readonly serviceId: string;
  protected startTime: Date;
  protected isInitialized: boolean = false;
  protected isHealthy: boolean = false;
  protected metrics: ServiceMetrics;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: ServiceConfig) {
    super();
    this.config = {
      version: "1.0.0",
      enabled: true,
      healthCheckInterval: 30000, // 30 seconds
      retryConfig: {
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2,
      },
      ...config,
    };

    this.serviceId = uuidv4();
    this.startTime = new Date();
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
    };

    // Set up error handling
    this.on("error", this.handleServiceError.bind(this));
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn(`Service ${this.config.name} is already initialized`);
      return;
    }

    try {
      logger.info(`Initializing service: ${this.config.name}`, {
        serviceId: this.serviceId,
        version: this.config.version,
      });

      // Check if service is enabled
      if (!this.config.enabled) {
        logger.info(
          `Service ${this.config.name} is disabled, skipping initialization`,
        );
        return;
      }

      // Initialize dependencies first
      await this.initializeDependencies();

      // Run service-specific initialization
      await this.onInitialize();

      // Start health checks
      this.startHealthChecks();

      this.isInitialized = true;
      this.isHealthy = true;

      logger.info(`Service ${this.config.name} initialized successfully`, {
        serviceId: this.serviceId,
        uptime: this.getUptime(),
      });

      this.emit("initialized");
    } catch (error) {
      this.isHealthy = false;
      const serviceError = new CustomError(
        `Failed to initialize service ${this.config.name}`,
        500,
        {
          code: "SERVICE_INITIALIZATION_FAILED",
          context: { serviceId: this.serviceId, serviceName: this.config.name },
        },
      );

      logger.error(
        `Service initialization failed: ${this.config.name}`,
        serviceError,
        {
          serviceId: this.serviceId,
          originalError: error,
        },
      );

      this.emit("error", serviceError);
      throw serviceError;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    try {
      logger.info(`Shutting down service: ${this.config.name}`, {
        serviceId: this.serviceId,
        uptime: this.getUptime(),
      });

      // Stop health checks
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
      }

      // Run service-specific cleanup
      await this.onShutdown();

      this.isInitialized = false;
      this.isHealthy = false;

      logger.info(`Service ${this.config.name} shut down successfully`);
      this.emit("shutdown");
    } catch (error) {
      logger.error(
        `Error during service shutdown: ${this.config.name}`,
        error,
        {
          serviceId: this.serviceId,
        },
      );
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealth(): Promise<ServiceHealth> {
    const dependencyHealth: Record<string, ServiceHealth> = {};

    // Check dependency health if any
    if (this.config.dependencies) {
      for (const dep of this.config.dependencies) {
        try {
          dependencyHealth[dep] = await this.checkDependencyHealth(dep);
        } catch (error) {
          dependencyHealth[dep] = {
            status: "unhealthy",
            lastCheck: new Date(),
            uptime: 0,
            dependencies: {},
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    // Determine overall health
    const hasUnhealthyDependencies = Object.values(dependencyHealth).some(
      (health) => health.status === "unhealthy",
    );

    let status: "healthy" | "unhealthy" | "degraded" = "healthy";
    if (!this.isHealthy) {
      status = "unhealthy";
    } else if (hasUnhealthyDependencies) {
      status = "degraded";
    }

    return {
      status,
      lastCheck: new Date(),
      uptime: this.getUptime(),
      dependencies: dependencyHealth,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Get service metrics
   */
  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get service uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }

  /**
   * Execute operation with error handling and metrics
   */
  protected async executeWithMetrics<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.requestCount++;
    this.metrics.lastRequestTime = new Date();

    try {
      const result = await operation();

      // Update response time metrics
      const responseTime = Date.now() - startTime;
      this.updateAverageResponseTime(responseTime);

      logger.debug(`Operation completed: ${operationName}`, {
        serviceId: this.serviceId,
        serviceName: this.config.name,
        responseTime,
        operationName,
      });

      return result;
    } catch (error) {
      this.metrics.errorCount++;
      this.metrics.lastErrorTime = new Date();

      const serviceError =
        error instanceof CustomError
          ? error
          : new CustomError(`Operation failed: ${operationName}`, 500, {
              code: "SERVICE_OPERATION_FAILED",
              context: {
                serviceId: this.serviceId,
                serviceName: this.config.name,
                operationName,
              },
            });

      logger.error(`Service operation failed: ${operationName}`, serviceError, {
        serviceId: this.serviceId,
        serviceName: this.config.name,
        originalError: error,
      });

      throw serviceError;
    }
  }

  // Abstract methods to be implemented by concrete services
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract checkDependencyHealth(
    dependency: string,
  ): Promise<ServiceHealth>;

  // Private methods
  private startHealthChecks(): void {
    if (
      this.config.healthCheckInterval &&
      this.config.healthCheckInterval > 0
    ) {
      this.healthCheckTimer = setInterval(async () => {
        try {
          const health = await this.getHealth();
          this.isHealthy = health.status !== "unhealthy";

          if (health.status === "unhealthy") {
            this.emit("unhealthy", health);
          }
        } catch (error) {
          this.isHealthy = false;
          logger.error(
            `Health check failed for service: ${this.config.name}`,
            error,
          );
        }
      }, this.config.healthCheckInterval);
    }
  }

  private async initializeDependencies(): Promise<void> {
    if (!this.config.dependencies || this.config.dependencies.length === 0) {
      return;
    }

    logger.debug(`Checking dependencies for service: ${this.config.name}`, {
      dependencies: this.config.dependencies,
    });

    // This would integrate with the service registry to check dependencies
    // For now, we'll just log the dependencies
    for (const dependency of this.config.dependencies) {
      logger.debug(`Dependency check: ${dependency}`, {
        serviceName: this.config.name,
      });
    }
  }

  private handleServiceError(error: Error): void {
    logger.error(`Service error in ${this.config.name}`, error, {
      serviceId: this.serviceId,
    });
    this.isHealthy = false;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.requestCount;
    const currentAverage = this.metrics.averageResponseTime;

    // Calculate new average using incremental formula
    this.metrics.averageResponseTime =
      (currentAverage * (totalRequests - 1) + responseTime) / totalRequests;
  }
}
