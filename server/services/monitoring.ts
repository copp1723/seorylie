// Temporary stub for monitoring service to avoid OpenTelemetry import issues

export enum ComponentHealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

export class MonitoringService {
  private static instance: MonitoringService;
  private healthChecks: Map<string, Function> = new Map();

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Stub methods
  recordMetric() {}
  incrementCounter(name: string, labels?: Record<string, string>) {}
  recordDuration() {}
  updateGauge() {}
  getHealthStatus() {
    return ComponentHealthStatus.HEALTHY;
  }
  trackPerformance() {}
  trackError() {}
  trackDatabaseOperation() {}
  trackAPICall() {}
  recordKPI() {}

  // Enhanced methods for adf-email-listener compatibility
  registerCounter(name: string, description: string, labels?: string[]) {}
  registerHistogram(name: string, description: string, labels?: string[], buckets?: number[]) {}
  registerUpDownCounter(name: string, description: string) {}
  registerGauge(name: string, description: string, labels?: string[]) {}
  setGauge(name: string, value: number, labels: any[]) {}
  registerObservableGauge(
    name: string,
    description: string,
    callback?: Function,
  ) {}
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ) {}
  decrementUpDownCounter(name: string) {}
  incrementUpDownCounter(name: string) {}
  registerHealthCheck(name: string, checkFunction: Function) {
    this.healthChecks.set(name, checkFunction);
  }

  // Additional method for ADF SMS service compatibility
  registerMetric(name: string, type: string, description?: string) {
    // Stub implementation - just log the registration
    console.debug(`Registering metric: ${name} (${type})`);
  }

  async runHealthCheck(name: string) {
    const check = this.healthChecks.get(name);
    if (check) {
      try {
        return await check();
      } catch (error) {
        return {
          status: ComponentHealthStatus.UNHEALTHY,
          details: {
            error: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }
    return {
      status: ComponentHealthStatus.HEALTHY,
      details: { message: "No health check registered" },
    };
  }
}

export const monitoringService = MonitoringService.getInstance();
export const monitoring = monitoringService;
export default monitoringService;
