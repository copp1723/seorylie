// Simple monitoring service for tracking application performance

class MonitoringService {
  private requestCounts: Map<string, number>;
  private responseTimes: Map<string, number[]>;
  private errorCounts: Map<string, Map<number, number>>;
  private startTime: Date;

  constructor() {
    this.requestCounts = new Map();
    this.responseTimes = new Map();
    this.errorCounts = new Map();
    this.startTime = new Date();
  }

  trackRequest(path: string, duration: number, statusCode: number): void {
    // Normalize the path to group similar requests
    const normalizedPath = this.normalizePath(path);
    
    // Track request count
    const currentCount = this.requestCounts.get(normalizedPath) || 0;
    this.requestCounts.set(normalizedPath, currentCount + 1);
    
    // Track response time
    const times = this.responseTimes.get(normalizedPath) || [];
    times.push(duration);
    this.responseTimes.set(normalizedPath, times);
    
    // Track errors
    if (statusCode >= 400) {
      if (!this.errorCounts.has(normalizedPath)) {
        this.errorCounts.set(normalizedPath, new Map());
      }
      const errors = this.errorCounts.get(normalizedPath)!;
      const errorCount = errors.get(statusCode) || 0;
      errors.set(statusCode, errorCount + 1);
    }
  }

  getMetrics(): any {
    const metrics = {
      uptime: Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000),
      requests: {} as Record<string, any>,
      totalRequests: 0,
      totalErrors: 0,
    };

    // Calculate metrics for each path
    this.requestCounts.forEach((count, path) => {
      metrics.totalRequests += count;
      
      const times = this.responseTimes.get(path) || [];
      const avgTime = times.length > 0 
        ? times.reduce((sum, time) => sum + time, 0) / times.length 
        : 0;
      
      const errors = this.errorCounts.get(path);
      let pathErrors = 0;
      
      const errorDetails = {} as Record<string, number>;
      if (errors) {
        errors.forEach((errorCount, statusCode) => {
          pathErrors += errorCount;
          errorDetails[`${statusCode}`] = errorCount;
        });
      }
      
      metrics.totalErrors += pathErrors;
      
      metrics.requests[path] = {
        count,
        avgResponseTime: avgTime.toFixed(2),
        errors: pathErrors,
        errorDetails
      };
    });

    return metrics;
  }

  private normalizePath(path: string): string {
    // Remove query parameters
    const basePath = path.split('?')[0];
    
    // Replace numeric IDs with placeholders
    return basePath.replace(/\/\d+/g, '/:id');
  }

  resetMetrics(): void {
    this.requestCounts.clear();
    this.responseTimes.clear();
    this.errorCounts.clear();
    this.startTime = new Date();
  }
}

export const monitoring = new MonitoringService();