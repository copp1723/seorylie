// Enhanced monitoring service for tracking application performance with OpenTelemetry
import * as api from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// Define common attributes type
export type Attributes = api.Attributes;

// Define metric instrument types for clarity
interface Counter extends api.Counter {}
interface UpDownCounter extends api.UpDownCounter {}
interface Histogram extends api.Histogram {}
interface ObservableGauge extends api.ObservableGauge {}
// interface ObservableCounter extends api.ObservableCounter {} // Not used yet
// interface ObservableUpDownCounter extends api.ObservableUpDownCounter {} // Not used yet

// Health status enum
export enum ComponentHealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export interface HealthCheckResult {
  status: ComponentHealthStatus;
  details?: Record<string, any>;
}

export type HealthCheckCallback = () => Promise<HealthCheckResult> | HealthCheckResult;

class MonitoringService {
  private meter: api.Meter;
  private resource: Resource;
  private commonAttributes: Attributes;
  private startTime: Date;

  private counters: Map<string, Counter> = new Map();
  private upDownCounters: Map<string, UpDownCounter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private observableGauges: Map<string, ObservableGauge> = new Map();
  
  // For the old getMetrics() compatibility and custom JSON endpoint
  private legacyRequestCounts: Map<string, number>;
  private legacyResponseTimes: Map<string, number[]>;
  private legacyErrorCounts: Map<string, Map<number, number>>;

  // Health checks
  private componentHealthChecks: Map<string, HealthCheckCallback> = new Map();

  constructor(serviceName: string = 'cleanrylie-service', serviceVersion: string = '1.0.0') {
    this.startTime = new Date();
    // It's crucial that the OpenTelemetry SDK (MeterProvider, Exporter) is initialized elsewhere,
    // typically at the application's entry point. This service just gets a Meter instance.
    this.meter = api.metrics.getMeter(serviceName, serviceVersion);
    
    this.resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
    });
    this.commonAttributes = this.resource.attributes;

    // Initialize legacy metrics for compatibility with existing getMetrics structure
    this.legacyRequestCounts = new Map();
    this.legacyResponseTimes = new Map();
    this.legacyErrorCounts = new Map();

    // Initialize core metrics
    this.registerCoreMetrics();
  }

  private registerCoreMetrics() {
    // HTTP Metrics
    this.registerCounter('http_requests_total', 'Total number of HTTP requests.');
    this.registerHistogram('http_request_duration_ms', 'Duration of HTTP requests in milliseconds.');
    
    // Error Metrics
    this.registerCounter('api_errors_total', 'Total number of API errors.');
    this.registerCounter('unhandled_errors_total', 'Total number of unhandled errors.');

    // DLQ Metrics
    this.registerCounter('dlq_records_total', 'Total number of records added to the Dead Letter Queue.');
    this.registerCounter('dlq_processing_attempts_total', 'Total attempts to process DLQ records.');
    this.registerCounter('dlq_processing_failures_total', 'Total failures to process DLQ records.');

    // WebSocket Metrics
    this.registerUpDownCounter('websocket_connections_active', 'Number of active WebSocket connections.'); // Gauge-like
    this.registerCounter('websocket_connections_total', 'Total WebSocket connections established.');
    this.registerCounter('websocket_disconnections_total', 'Total WebSocket disconnections.');
    this.registerCounter('websocket_reconnections_total', 'Total WebSocket reconnections.');
    this.registerCounter('websocket_messages_received_total', 'Total WebSocket messages received.');
    this.registerCounter('websocket_messages_sent_total', 'Total WebSocket messages sent.');
    this.registerCounter('websocket_errors_total', 'Total WebSocket errors.');
    this.registerHistogram('websocket_message_processing_time_ms', 'Time to process WebSocket messages in milliseconds.');
    this.registerUpDownCounter('websocket_pending_messages', 'Number of pending WebSocket messages.'); // Gauge-like
    this.registerCounter('websocket_dlq_total', 'Total WebSocket messages sent to DLQ.');
    this.registerObservableGauge('websocket_connections_by_state', 'Number of WebSocket connections by state.', (observerResult) => {
        // This would require the WebSocketService to expose its internal client state counts
        // For now, this is a placeholder for how it would be implemented.
        // Example: const states = WebSocketService.getClientStates();
        // states.forEach((count, state) => observerResult.observe(count, { state }));
    });


    // Database Metrics
    this.registerCounter('database_operations_total', 'Total number of database operations.');
    this.registerHistogram('database_operation_duration_ms', 'Duration of database operations in milliseconds.');
    this.registerCounter('database_errors_total', 'Total number of database errors.');
    this.registerCounter('database_retries_total', 'Total number of database retries.');
    this.registerObservableGauge('database_connection_pool_active_connections', 'Active database connections in the pool.');
    this.registerObservableGauge('database_connection_pool_idle_connections', 'Idle database connections in the pool.');
    this.registerObservableGauge('database_connection_pool_pending_requests', 'Pending requests for database connections.');
    this.registerObservableGauge('database_connection_pool_max_connections', 'Maximum configured database connections.');
    
    // ETL Metrics
    this.registerCounter('etl_operations_total', 'Total number of ETL operations.');
    this.registerHistogram('etl_operation_duration_ms', 'Duration of ETL operations in milliseconds.');
    this.registerCounter('etl_errors_total', 'Total number of ETL errors.');
    this.registerCounter('etl_retries_total', 'Total number of ETL retries.');

    // Chaos Testing Metrics
    this.registerCounter('chaos_testing_injections_total', 'Total number of chaos testing injections.');
    this.registerObservableGauge('chaos_testing_active', 'Indicates if chaos testing is active (0 or 1).', (observerResult) => {
        const isActive = process.env.ENABLE_CHAOS_TESTING === 'true' && process.env.NODE_ENV !== 'production' ? 1 : 0;
        observerResult.observe(isActive, this.commonAttributes);
    });

    // Health Status
    this.registerObservableGauge('service_health_status', 'Overall health status of the service (0=unhealthy, 1=degraded, 2=healthy).', async (observerResult) => {
      const health = await this.getOverallHealthStatus();
      let numericStatus = 0; // unhealthy
      if (health.status === ComponentHealthStatus.DEGRADED) numericStatus = 1;
      if (health.status === ComponentHealthStatus.HEALTHY) numericStatus = 2;
      observerResult.observe(numericStatus, { ...this.commonAttributes, component: 'overall' });
    });

    // System Metrics Examples
    if (typeof process !== 'undefined' && process.cpuUsage) {
        this.registerObservableGauge('process_cpu_usage_user_seconds', 'User CPU time of the process in seconds.', () => process.cpuUsage().user / 1_000_000);
        this.registerObservableGauge('process_cpu_usage_system_seconds', 'System CPU time of the process in seconds.', () => process.cpuUsage().system / 1_000_000);
    }
    if (typeof process !== 'undefined' && process.memoryUsage) {
        this.registerObservableGauge('process_memory_rss_bytes', 'Resident Set Size memory usage of the process in bytes.', () => process.memoryUsage().rss);
        this.registerObservableGauge('process_memory_heap_total_bytes', 'Total heap size allocated for the process in bytes.', () => process.memoryUsage().heapTotal);
        this.registerObservableGauge('process_memory_heap_used_bytes', 'Used heap size for the process in bytes.', () => process.memoryUsage().heapUsed);
    }
  }

  // --- Metric Registration ---
  registerCounter(name: string, description: string, unit?: string): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }
    const counter = this.meter.createCounter(name, { description, unit });
    this.counters.set(name, counter);
    return counter;
  }

  registerUpDownCounter(name: string, description: string, unit?: string): UpDownCounter {
    if (this.upDownCounters.has(name)) {
      return this.upDownCounters.get(name)!;
    }
    const upDownCounter = this.meter.createUpDownCounter(name, { description, unit });
    this.upDownCounters.set(name, upDownCounter);
    return upDownCounter;
  }

  registerHistogram(name: string, description: string, unit?: string, _boundaries?: number[]): Histogram {
    // Boundaries are typically configured via Views in the OTel SDK, not on instrument creation.
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }
    const histogram = this.meter.createHistogram(name, { description, unit });
    this.histograms.set(name, histogram);
    return histogram;
  }
  
  registerObservableGauge(name: string, description: string, callback?: (observerResult: api.ObservableResult) => void, unit?: string): ObservableGauge {
    if (this.observableGauges.has(name)) {
      return this.observableGauges.get(name)!;
    }
    const gauge = this.meter.createObservableGauge(name, { description, unit });
    if (callback) {
      gauge.addCallback(callback);
    }
    this.observableGauges.set(name, gauge);
    return gauge;
  }

  // --- Metric Recording ---
  incrementCounter(name: string, attributes?: Attributes, value: number = 1): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.add(value, { ...this.commonAttributes, ...attributes });
    } else {
      // Consider logging this only in dev or with a very low frequency to avoid log spam
      // console.warn(`Counter metric '${name}' not found for incrementing.`);
    }
  }
  
  // For UpDownCounters (used like gauges that can be incremented/decremented)
  recordUpDownCounterChange(name: string, changeValue: number, attributes?: Attributes): void {
    const upDownCounter = this.upDownCounters.get(name);
    if (upDownCounter) {
      upDownCounter.add(changeValue, { ...this.commonAttributes, ...attributes });
    } else {
      // console.warn(`UpDownCounter metric '${name}' not found.`);
    }
  }
  
  // Convenience for incrementing an UpDownCounter
  incrementUpDownCounter(name: string, attributes?: Attributes, value: number = 1): void {
    this.recordUpDownCounterChange(name, value, attributes);
  }

  // Convenience for decrementing an UpDownCounter
  decrementUpDownCounter(name: string, attributes?: Attributes, value: number = 1): void {
    this.recordUpDownCounterChange(name, -value, attributes);
  }

  // For setting an absolute value on a gauge (typically done via ObservableGauge callback)
  // This method is if you have a non-observable UpDownCounter you want to treat as a settable gauge.
  // Note: This is less common for UpDownCounters; ObservableGauges are preferred for polled values.
  setGauge(name: string, value: number, attributes?: Attributes): void {
    // This is tricky with UpDownCounter. OTel doesn't have a direct "set" for UpDownCounter.
    // One way is to use an ObservableGauge and have its callback return the current value.
    // If using UpDownCounter to *simulate* a settable gauge, you'd need to track the previous value.
    // For simplicity, we'll assume this is for an ObservableGauge or the user manages the delta.
    // This method might be better named if it's for UpDownCounters, e.g., `updateUpDownCounterToValue`.
    // console.warn(`setGauge for '${name}' using UpDownCounter is not standard. Consider ObservableGauge.`);
    // If an ObservableGauge is registered with this name, its callback will handle updates.
    // If an UpDownCounter is registered, this method is not directly applicable for "setting" a value.
    // Let's assume the user will use recordUpDownCounterChange for deltas.
    // This method is kept for conceptual alignment but might need rethinking based on OTel primitives.
    const gauge = this.observableGauges.get(name) || this.upDownCounters.get(name);
    if (!gauge) {
        // console.warn(`Gauge (Observable or UpDownCounter) metric '${name}' not found for setting value.`);
    }
    // For observable gauges, the callback handles setting the value.
    // For UpDownCounters, you add/subtract. A direct "set" isn't a primitive.
  }

  recordHistogram(name: string, value: number, attributes?: Attributes): void {
    const histogram = this.histograms.get(name);
    if (histogram) {
      histogram.record(value, { ...this.commonAttributes, ...attributes });
    } else {
      // console.warn(`Histogram metric '${name}' not found.`);
    }
  }

  // --- HTTP Request Tracking (Enhanced) ---
  trackRequest(
    path: string, 
    method: string, 
    statusCode: number, 
    duration: number, 
    additionalAttributes?: Attributes
  ): void {
    const normalizedPath = this.normalizePath(path);
    const attributes: Attributes = {
      ...this.commonAttributes, // Global attributes like service.name
      'http.method': method,
      'http.route': normalizedPath, // OTel semantic convention for parameterized path
      'http.status_code': statusCode,
      ...(additionalAttributes || {}), // e.g., traceId, requestId, custom business tags
    };

    this.incrementCounter('http_requests_total', attributes);
    this.recordHistogram('http_request_duration_ms', duration, attributes);

    // Update legacy metrics for getMetrics() compatibility
    const legacyPathKey = `${method} ${normalizedPath}`; // Keep existing key format
    const currentCount = this.legacyRequestCounts.get(legacyPathKey) || 0;
    this.legacyRequestCounts.set(legacyPathKey, currentCount + 1);

    const times = this.legacyResponseTimes.get(legacyPathKey) || [];
    times.push(duration);
    this.legacyResponseTimes.set(legacyPathKey, times);

    if (statusCode >= 400) {
      if (!this.legacyErrorCounts.has(legacyPathKey)) {
        this.legacyErrorCounts.set(legacyPathKey, new Map());
      }
      const errors = this.legacyErrorCounts.get(legacyPathKey)!;
      const errorCount = errors.get(statusCode) || 0;
      errors.set(statusCode, errorCount + 1);

      // Also record to the generic API errors counter
      this.incrementCounter('api_errors_total', {
        ...attributes, // Includes http.method, http.route, http.status_code
        'error.type': statusCode >= 500 ? 'server_error' : 'client_error',
        // 'error.severity' could be added here based on status code or error type
      });
    }
  }
  
  // --- Health Checks ---
  registerHealthCheck(componentName: string, callback: HealthCheckCallback): void {
    this.componentHealthChecks.set(componentName, callback);
    // Optionally, register an observable gauge for this component's health
    this.registerObservableGauge(`component_health_status_${componentName.toLowerCase().replace(/[^a-z0-9_]/gi, '_')}`, `Health status of ${componentName}`, async (observerResult) => {
        const health = await this.getComponentHealth(componentName);
        let numericStatus = 0; // unhealthy
        if (health.status === ComponentHealthStatus.DEGRADED) numericStatus = 1;
        if (health.status === ComponentHealthStatus.HEALTHY) numericStatus = 2;
        if (health.status === ComponentHealthStatus.UNKNOWN) numericStatus = 3; // Or another value
        observerResult.observe(numericStatus, { ...this.commonAttributes, component: componentName });
    });
  }

  async getComponentHealth(componentName: string): Promise<HealthCheckResult> {
    const callback = this.componentHealthChecks.get(componentName);
    if (!callback) {
      return { status: ComponentHealthStatus.UNKNOWN, details: { error: `No health check registered for ${componentName}` } };
    }
    try {
      const result = await callback();
      return result || { status: ComponentHealthStatus.UNKNOWN, details: { error: 'Health check callback returned undefined' }};
    } catch (error) {
      return { 
        status: ComponentHealthStatus.UNHEALTHY, 
        details: { 
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        } 
      };
    }
  }

  async getOverallHealthStatus(): Promise<{ status: ComponentHealthStatus; components: Record<string, HealthCheckResult> }> {
    let overallStatus = ComponentHealthStatus.HEALTHY;
    const componentResults: Record<string, HealthCheckResult> = {};

    if (this.componentHealthChecks.size === 0) {
        return { status: ComponentHealthStatus.UNKNOWN, components: {} }; // No components to check
    }

    for (const [name] of this.componentHealthChecks.entries()) {
      const result = await this.getComponentHealth(name);
      componentResults[name] = result;
      if (result.status === ComponentHealthStatus.UNHEALTHY) {
        overallStatus = ComponentHealthStatus.UNHEALTHY; // If any is unhealthy, overall is unhealthy
      } else if (result.status === ComponentHealthStatus.DEGRADED && overallStatus === ComponentHealthStatus.HEALTHY) {
        overallStatus = ComponentHealthStatus.DEGRADED; // If not unhealthy, but degraded, mark as degraded
      } else if (result.status === ComponentHealthStatus.UNKNOWN && overallStatus === ComponentHealthStatus.HEALTHY) {
        overallStatus = ComponentHealthStatus.UNKNOWN; // If healthy so far, but one is unknown
      }
    }
    
    return { status: overallStatus, components: componentResults };
  }


  // --- Utility Methods ---
  private normalizePath(path: string): string {
    const basePath = path.split('?')[0];
    // More robust normalization for IDs (UUIDs, numbers)
    return basePath
      .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(\/|$)/g, '/:uuid$1') // UUIDs
      .replace(/\/\d+(\/|$)/g, '/:id$1'); // Numeric IDs, ensuring it captures segments correctly
  }

  // --- Legacy getMetrics for JSON endpoint ---
  getMetrics(): any { // This provides a snapshot for a custom /api/metrics/json endpoint
    const metrics = {
      uptimeSeconds: Math.floor((new Date().getTime() - this.startTime.getTime()) / 1000),
      serviceInfo: this.commonAttributes,
      requestsPerRoute: {} as Record<string, any>,
      totalRequests: 0,
      totalErrors: 0,
    };

    this.legacyRequestCounts.forEach((count, pathKey) => {
      metrics.totalRequests += count;
      
      const times = this.legacyResponseTimes.get(pathKey) || [];
      const avgTime = times.length > 0 
        ? times.reduce((sum, time) => sum + time, 0) / times.length 
        : 0;
      
      const errorsMap = this.legacyErrorCounts.get(pathKey);
      let pathErrors = 0;
      const errorDetails: Record<string, number> = {};
      if (errorsMap) {
        errorsMap.forEach((errorCount, statusCode) => {
          pathErrors += errorCount;
          errorDetails[`${statusCode}`] = errorCount;
        });
      }
      metrics.totalErrors += pathErrors;
      
      metrics.requestsPerRoute[pathKey] = {
        count,
        avgResponseTimeMs: parseFloat(avgTime.toFixed(2)),
        errors: pathErrors,
        errorDetails
      };
    });

    return metrics;
  }

  resetMetrics(): void { // Primarily for legacy metrics if needed for testing
    this.legacyRequestCounts.clear();
    this.legacyResponseTimes.clear();
    this.legacyErrorCounts.clear();
    this.startTime = new Date();
    // Note: Resetting OTel metrics is not standard. They are cumulative.
    // For testing, a new MeterProvider instance is typically used, or test-specific metric names.
  }

  // --- Shutdown ---
  async shutdown(): Promise<void> {
    // The OpenTelemetry MeterProvider's shutdown (including flushing exporters)
    // should be handled globally at the application exit.
    // This service doesn't own the MeterProvider.
    // console.log('MonitoringService instance is being shut down. Global OTel SDK shutdown is separate.');
    // Clear local instrument caches if necessary, though OTel manages its instruments.
    this.counters.clear();
    this.upDownCounters.clear();
    this.histograms.clear();
    this.observableGauges.clear();
    this.componentHealthChecks.clear();
  }
}

// Export a singleton instance
// The service name and version should ideally come from environment variables or a config file.
export const monitoring = new MonitoringService(
  process.env.OTEL_SERVICE_NAME || 'cleanrylie-app',
  process.env.APP_VERSION || 'dev' // Assuming APP_VERSION might be set during build/deploy
);

// Re-export for convenience in other parts of the application
export { SemanticResourceAttributes };
