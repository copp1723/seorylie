// Temporary stub for monitoring service to avoid OpenTelemetry import issues

export enum ComponentHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export class MonitoringService {
  private static instance: MonitoringService;

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Stub methods
  recordMetric() {}
  incrementCounter() {}
  recordDuration() {}
  updateGauge() {}
  getHealthStatus() { return ComponentHealthStatus.HEALTHY; }
  trackPerformance() {}
  trackError() {}
  trackDatabaseOperation() {}
  trackAPICall() {}
  recordKPI() {}
}

export const monitoringService = MonitoringService.getInstance();
export default monitoringService;