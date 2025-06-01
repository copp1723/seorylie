import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import logger from '../utils/logger';

/**
 * Prometheus Metrics Service for ADF Lead Processing System
 * 
 * Implements comprehensive observability metrics for:
 * - ADF lead processing pipeline
 * - AI response generation
 * - Handover triggers and dossier generation (ADF-08)
 * - IMAP connectivity
 * - System performance
 */
class PrometheusMetricsService {
  private static instance: PrometheusMetricsService;
  
  // ADF Core Metrics
  public readonly adfLeadsProcessedTotal: Counter<string>;
  public readonly aiResponseLatency: Histogram<string>;
  public readonly handoverTriggerTotal: Counter<string>;
  public readonly adfImapDisconnectionsTotal: Counter<string>;

  // ADF-W03 Lead Ingestion Metrics (DEP-004/005)
  public readonly adfIngestSuccessTotal: Counter<string>;
  public readonly adfParseFailureTotal: Counter<string>;
  public readonly adfIngestDurationSeconds: Histogram<string>;
  public readonly adfRateLimitExceeded: Counter<string>;
  
  // ADF-08 Handover Dossier Metrics (NEW)
  public readonly handoverDossierGenerationMs: Histogram<string>;
  public readonly handoverEmailSentTotal: Counter<string>;
  
  // System Performance Metrics
  public readonly httpRequestDuration: Histogram<string>;
  public readonly httpRequestsTotal: Counter<string>;
  public readonly activeConnections: Gauge<string>;
  public readonly memoryUsage: Gauge<string>;
  public readonly cpuUsage: Gauge<string>;
  
  // Business Metrics
  public readonly emailDeliveryTotal: Counter<string>;
  public readonly smsDeliveryTotal: Counter<string>;
  public readonly conversationTotal: Counter<string>;
  public readonly errorTotal: Counter<string>;

  private constructor() {
    // Enable default metrics collection (CPU, memory, etc.) - only if not already collected
    try {
      collectDefaultMetrics({ register });
    } catch (error) {
      // Default metrics already registered, continue
      logger.debug('Default metrics already registered, skipping');
    }

    // ADF Lead Processing Metrics
    this.adfLeadsProcessedTotal = new Counter({
      name: 'adf_leads_processed_total',
      help: 'Total number of ADF leads processed',
      labelNames: ['dealership_id', 'source_provider', 'lead_type', 'status'],
      registers: [register]
    });

    this.aiResponseLatency = new Histogram({
      name: 'ai_response_latency_ms',
      help: 'AI response generation latency in milliseconds',
      labelNames: ['dealership_id', 'model', 'response_type'],
      buckets: [10, 50, 100, 500, 1000, 2000, 5000, 10000, 30000],
      registers: [register]
    });

    this.handoverTriggerTotal = new Counter({
      name: 'handover_trigger_total',
      help: 'Total number of handover triggers',
      labelNames: ['dealership_id', 'reason', 'status'],
      registers: [register]
    });

    this.adfImapDisconnectionsTotal = new Counter({
      name: 'adf_imap_disconnections_total',
      help: 'Total number of IMAP disconnections',
      labelNames: ['server', 'reason'],
      registers: [register]
    });

    // ADF-W03 Lead Ingestion Metrics (DEP-004/005)
    this.adfIngestSuccessTotal = new Counter({
      name: 'adf_ingest_success_total',
      help: 'Total number of successful ADF lead ingestions',
      labelNames: ['dealership_id', 'source_provider', 'parser_version'],
      registers: [register]
    });

    this.adfParseFailureTotal = new Counter({
      name: 'adf_parse_failure_total',
      help: 'Total number of ADF parsing failures',
      labelNames: ['dealership_id', 'error_type', 'parser_version'],
      registers: [register]
    });

    this.adfIngestDurationSeconds = new Histogram({
      name: 'adf_ingest_duration_seconds',
      help: 'ADF lead ingestion processing duration in seconds',
      labelNames: ['dealership_id', 'parser_version', 'status'],
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [register]
    });

    this.adfRateLimitExceeded = new Counter({
      name: 'adf_rate_limit_exceeded_total',
      help: 'Total number of ADF rate limit violations',
      labelNames: ['endpoint', 'ip'],
      registers: [register]
    });

    // ADF-08 Handover Dossier Metrics
    this.handoverDossierGenerationMs = new Histogram({
      name: 'handover_dossier_generation_ms',
      help: 'Handover dossier generation time in milliseconds',
      labelNames: ['dealership_id', 'status'],
      buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 15000, 20000, 30000],
      registers: [register]
    });

    this.handoverEmailSentTotal = new Counter({
      name: 'handover_email_sent_total',
      help: 'Total number of handover emails sent',
      labelNames: ['dealership_id', 'status', 'template'],
      registers: [register]
    });

    // HTTP Performance Metrics
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'HTTP request duration in milliseconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [1, 5, 15, 50, 100, 500, 1000, 5000],
      registers: [register]
    });

    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [register]
    });

    // System Resource Metrics
    this.activeConnections = new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type'],
      registers: [register]
    });

    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [register]
    });

    this.cpuUsage = new Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [register]
    });

    // Business Process Metrics
    this.emailDeliveryTotal = new Counter({
      name: 'email_delivery_total',
      help: 'Total number of email deliveries',
      labelNames: ['dealership_id', 'provider', 'status'],
      registers: [register]
    });

    this.smsDeliveryTotal = new Counter({
      name: 'sms_delivery_total',
      help: 'Total number of SMS deliveries',
      labelNames: ['dealership_id', 'provider', 'status'],
      registers: [register]
    });

    this.conversationTotal = new Counter({
      name: 'conversation_total',
      help: 'Total number of conversations',
      labelNames: ['dealership_id', 'channel', 'status'],
      registers: [register]
    });

    this.errorTotal = new Counter({
      name: 'error_total',
      help: 'Total number of errors',
      labelNames: ['service', 'error_type', 'severity'],
      registers: [register]
    });

    logger.info('Prometheus metrics service initialized with ADF-08 handover metrics');
  }

  public static getInstance(): PrometheusMetricsService {
    if (!PrometheusMetricsService.instance) {
      PrometheusMetricsService.instance = new PrometheusMetricsService();
    }
    return PrometheusMetricsService.instance;
  }

  /**
   * Record ADF lead processing event
   */
  public recordLeadProcessed(
    dealershipId: string,
    sourceProvider: string,
    leadType: string,
    status: 'success' | 'failed' | 'duplicate'
  ): void {
    this.adfLeadsProcessedTotal.inc({
      dealership_id: dealershipId,
      source_provider: sourceProvider,
      lead_type: leadType,
      status
    });
  }

  /**
   * Increment leads processed - alias for recordLeadProcessed
   */
  public incrementLeadsProcessed(labels: {
    dealership_id: string | number;
    source_provider?: string;
    lead_type?: string;
    status: string;
  }): void {
    this.adfLeadsProcessedTotal.inc({
      dealership_id: String(labels.dealership_id),
      source_provider: labels.source_provider || 'unknown',
      lead_type: labels.lead_type || 'email',
      status: labels.status
    });
  }

  /**
   * Record AI response latency
   */
  public recordAIResponseLatency(
    latencyMs: number,
    dealershipId: string,
    model: string = 'gpt-4',
    responseType: string = 'standard'
  ): void {
    this.aiResponseLatency.observe({
      dealership_id: dealershipId,
      model,
      response_type: responseType
    }, latencyMs);
  }

  /**
   * Record handover trigger event
   */
  public recordHandoverTrigger(
    dealershipId: string,
    reason: string,
    status: 'success' | 'failed'
  ): void {
    this.handoverTriggerTotal.inc({
      dealership_id: dealershipId,
      reason,
      status
    });
  }

  /**
   * Record IMAP disconnection
   */
  public recordImapDisconnection(
    server: string,
    reason: string = 'unknown'
  ): void {
    this.adfImapDisconnectionsTotal.inc({
      server,
      reason
    });
  }

  /**
   * ADF-08: Record handover dossier generation time
   */
  public recordDossierGenerationTime(
    timeMs: number,
    dealershipId: string,
    status: 'success' | 'failed' | 'partial'
  ): void {
    try {
      this.handoverDossierGenerationMs.observe({
        dealership_id: dealershipId,
        status
      }, timeMs);
    } catch (error) {
      logger.error('Error recording handover_dossier_generation_ms metric', {
        error: error instanceof Error ? error.message : String(error),
        timeMs,
        dealershipId,
        status
      });
    }
  }

  /**
   * ADF-08: Record handover email sent event
   */
  public recordHandoverEmailSent(
    dealershipId: string,
    status: 'sent' | 'failed' | 'queued',
    template: string = 'default'
  ): void {
    try {
      this.handoverEmailSentTotal.inc({
        dealership_id: dealershipId,
        status,
        template
      });
    } catch (error) {
      logger.error('Error recording handover_email_sent_total metric', {
        error: error instanceof Error ? error.message : String(error),
        dealershipId,
        status,
        template
      });
    }
  }

  /**
   * Increment handover email sent - alias for recordHandoverEmailSent
   */
  public incrementHandoverEmailSent(labels: {
    dealership_id: string | number;
    status: string;
    template?: string;
  }): void {
    this.recordHandoverEmailSent(
      String(labels.dealership_id),
      labels.status as 'sent' | 'failed' | 'queued',
      labels.template || 'default'
    );
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number
  ): void {
    const labels = {
      method: method.toUpperCase(),
      route: this.normalizeRoute(route),
      status_code: statusCode.toString()
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, durationMs);
  }

  /**
   * Record email delivery event
   */
  public recordEmailDelivery(
    dealershipId: string,
    provider: string,
    status: 'sent' | 'delivered' | 'failed' | 'bounced'
  ): void {
    this.emailDeliveryTotal.inc({
      dealership_id: dealershipId,
      provider,
      status
    });
  }

  /**
   * Record SMS delivery event
   */
  public recordSmsDelivery(
    dealershipId: string,
    provider: string,
    status: 'sent' | 'delivered' | 'failed'
  ): void {
    this.smsDeliveryTotal.inc({
      dealership_id: dealershipId,
      provider,
      status
    });
  }

  /**
   * Record error event
   */
  public recordError(
    service: string,
    errorType: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    this.errorTotal.inc({
      service,
      error_type: errorType,
      severity
    });
  }

  /**
   * Update system resource metrics
   */
  public updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    
    this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    this.memoryUsage.set({ type: 'external' }, memUsage.external);
    this.memoryUsage.set({ type: 'rss' }, memUsage.rss);

    // Update CPU usage (simplified - in production you'd want more accurate measurement)
    const cpuUsage = process.cpuUsage();
    const totalUsage = cpuUsage.user + cpuUsage.system;
    this.cpuUsage.set(totalUsage / 1000000); // Convert to seconds
  }

  /**
   * Get metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    // Update system metrics before returning
    this.updateSystemMetrics();
    
    return register.metrics();
  }

  /**
   * Get metrics registry for custom integrations
   */
  public getRegistry() {
    return register;
  }

  /**
   * Normalize route for consistent labeling
   */
  private normalizeRoute(route: string): string {
    // Replace dynamic segments with placeholders
    return route
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+/g, '/:email')
      .replace(/\?.*$/, ''); // Remove query parameters
  }

  /**
   * Reset all metrics (useful for testing)
   */
  public reset(): void {
    register.clear();
    logger.info('Prometheus metrics reset');
  }
}

// Export singleton instance
export const prometheusMetrics = PrometheusMetricsService.getInstance();
export const prometheusMetricsService = PrometheusMetricsService.getInstance();
export default prometheusMetrics;