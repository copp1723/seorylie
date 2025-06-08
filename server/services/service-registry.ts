/**
 * Service Registry
 *
 * Central registry for managing all services in the application.
 * Provides service discovery, dependency management, and lifecycle coordination.
 */

import { EventEmitter } from "events";
import logger from "../utils/logger";
import { BaseService, ServiceHealth } from "./base-service";
import { CustomError } from "../utils/error-handler";

export interface ServiceRegistration {
  name: string;
  instance: BaseService;
  dependencies: string[];
  registeredAt: Date;
  status: "registered" | "initializing" | "running" | "stopped" | "error";
}

export interface ServiceRegistryHealth {
  status: "healthy" | "degraded" | "unhealthy";
  totalServices: number;
  runningServices: number;
  failedServices: number;
  services: Record<string, ServiceHealth>;
  lastCheck: Date;
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceRegistration> = new Map();
  private initializationOrder: string[] = [];
  private isShuttingDown: boolean = false;

  /**
   * Register a service with the registry
   */
  register(service: BaseService, dependencies: string[] = []): void {
    const serviceName = service["config"].name;

    if (this.services.has(serviceName)) {
      throw new CustomError(
        `Service ${serviceName} is already registered`,
        400,
        { code: "SERVICE_ALREADY_REGISTERED" },
      );
    }

    const registration: ServiceRegistration = {
      name: serviceName,
      instance: service,
      dependencies,
      registeredAt: new Date(),
      status: "registered",
    };

    this.services.set(serviceName, registration);

    // Set up service event listeners
    service.on("initialized", () => {
      registration.status = "running";
      this.emit("serviceStarted", serviceName);
      logger.info(`Service started: ${serviceName}`);
    });

    service.on("shutdown", () => {
      registration.status = "stopped";
      this.emit("serviceStopped", serviceName);
      logger.info(`Service stopped: ${serviceName}`);
    });

    service.on("error", (error) => {
      registration.status = "error";
      this.emit("serviceError", serviceName, error);
      logger.error(`Service error: ${serviceName}`, error);
    });

    logger.info(`Service registered: ${serviceName}`, {
      dependencies,
      totalServices: this.services.size,
    });

    this.emit("serviceRegistered", serviceName);
  }

  /**
   * Unregister a service from the registry
   */
  async unregister(serviceName: string): Promise<void> {
    const registration = this.services.get(serviceName);
    if (!registration) {
      throw new CustomError(`Service ${serviceName} is not registered`, 404, {
        code: "SERVICE_NOT_FOUND",
      });
    }

    // Shutdown the service if it's running
    if (registration.status === "running") {
      await registration.instance.shutdown();
    }

    this.services.delete(serviceName);
    this.emit("serviceUnregistered", serviceName);

    logger.info(`Service unregistered: ${serviceName}`);
  }

  /**
   * Get a service instance by name
   */
  get<T extends BaseService>(serviceName: string): T | null {
    const registration = this.services.get(serviceName);
    return registration ? (registration.instance as T) : null;
  }

  /**
   * Check if a service is registered
   */
  has(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Get service registration info
   */
  getRegistration(serviceName: string): ServiceRegistration | null {
    return this.services.get(serviceName) || null;
  }

  /**
   * Initialize all registered services in dependency order
   */
  async initializeAll(): Promise<void> {
    if (this.isShuttingDown) {
      throw new CustomError("Cannot initialize services during shutdown", 400, {
        code: "SHUTDOWN_IN_PROGRESS",
      });
    }

    logger.info("Initializing all services...", {
      totalServices: this.services.size,
    });

    try {
      // Calculate initialization order based on dependencies
      this.initializationOrder = this.calculateInitializationOrder();

      logger.info("Service initialization order calculated", {
        order: this.initializationOrder,
      });

      // Initialize services in order
      for (const serviceName of this.initializationOrder) {
        const registration = this.services.get(serviceName);
        if (!registration) continue;

        if (registration.status === "running") {
          logger.info(`Service ${serviceName} is already running, skipping`);
          continue;
        }

        try {
          registration.status = "initializing";
          logger.info(`Initializing service: ${serviceName}`);

          await registration.instance.initialize();

          logger.info(`Service initialized successfully: ${serviceName}`);
        } catch (error) {
          registration.status = "error";
          logger.error(`Failed to initialize service: ${serviceName}`, error);

          // Decide whether to continue or stop based on service criticality
          // For now, we'll continue with other services
          this.emit("serviceInitializationFailed", serviceName, error);
        }
      }

      logger.info("Service initialization completed", {
        totalServices: this.services.size,
        runningServices: this.getRunningServices().length,
      });

      this.emit("allServicesInitialized");
    } catch (error) {
      logger.error("Service initialization failed", error);
      throw new CustomError("Failed to initialize services", 500, {
        code: "SERVICE_INITIALIZATION_FAILED",
        context: { error },
      });
    }
  }

  /**
   * Shutdown all services in reverse dependency order
   */
  async shutdownAll(): Promise<void> {
    this.isShuttingDown = true;

    logger.info("Shutting down all services...", {
      totalServices: this.services.size,
    });

    try {
      // Shutdown in reverse order
      const shutdownOrder = [...this.initializationOrder].reverse();

      for (const serviceName of shutdownOrder) {
        const registration = this.services.get(serviceName);
        if (!registration || registration.status !== "running") continue;

        try {
          logger.info(`Shutting down service: ${serviceName}`);
          await registration.instance.shutdown();
          logger.info(`Service shut down successfully: ${serviceName}`);
        } catch (error) {
          logger.error(`Failed to shutdown service: ${serviceName}`, error);
          // Continue with other services even if one fails
        }
      }

      logger.info("All services shut down");
      this.emit("allServicesShutdown");
    } catch (error) {
      logger.error("Service shutdown failed", error);
      throw error;
    } finally {
      this.isShuttingDown = false;
    }
  }

  /**
   * Get overall health status of all services
   */
  async getHealth(): Promise<ServiceRegistryHealth> {
    const serviceHealths: Record<string, ServiceHealth> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const [serviceName, registration] of this.services) {
      try {
        if (registration.status === "running") {
          const health = await registration.instance.getHealth();
          serviceHealths[serviceName] = health;

          switch (health.status) {
            case "healthy":
              healthyCount++;
              break;
            case "degraded":
              degradedCount++;
              break;
            case "unhealthy":
              unhealthyCount++;
              break;
          }
        } else {
          serviceHealths[serviceName] = {
            status: "unhealthy",
            lastCheck: new Date(),
            uptime: 0,
            dependencies: {},
            error: `Service status: ${registration.status}`,
          };
          unhealthyCount++;
        }
      } catch (error) {
        serviceHealths[serviceName] = {
          status: "unhealthy",
          lastCheck: new Date(),
          uptime: 0,
          dependencies: {},
          error: error instanceof Error ? error.message : String(error),
        };
        unhealthyCount++;
      }
    }

    // Determine overall status
    let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (unhealthyCount > 0) {
      overallStatus = unhealthyCount > healthyCount ? "unhealthy" : "degraded";
    } else if (degradedCount > 0) {
      overallStatus = "degraded";
    }

    return {
      status: overallStatus,
      totalServices: this.services.size,
      runningServices: this.getRunningServices().length,
      failedServices: unhealthyCount,
      services: serviceHealths,
      lastCheck: new Date(),
    };
  }

  /**
   * Get list of running services
   */
  private getRunningServices(): string[] {
    return Array.from(this.services.entries())
      .filter(([, registration]) => registration.status === "running")
      .map(([name]) => name);
  }

  /**
   * Calculate service initialization order based on dependencies
   */
  private calculateInitializationOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string): void => {
      if (visited.has(serviceName)) return;
      if (visiting.has(serviceName)) {
        throw new CustomError(
          `Circular dependency detected involving service: ${serviceName}`,
          400,
          { code: "CIRCULAR_DEPENDENCY" },
        );
      }

      visiting.add(serviceName);

      const registration = this.services.get(serviceName);
      if (registration) {
        // Visit dependencies first
        for (const dependency of registration.dependencies) {
          if (this.services.has(dependency)) {
            visit(dependency);
          } else {
            logger.warn(
              `Dependency ${dependency} not found for service ${serviceName}`,
            );
          }
        }
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    // Visit all services
    for (const serviceName of this.services.keys()) {
      visit(serviceName);
    }

    return order;
  }
}

// Export singleton instance
export const serviceRegistry = new ServiceRegistry();
