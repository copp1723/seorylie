import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import logger from '../utils/logger';

/**
 * PrometheusMetrics - Centralized metrics collection for ADF Lead Processing
 */
export class PrometheusMetrics {
  private registry: Registry;
  
  // ADF Lead Processing Metrics
  private adfLeadsProcessedTotal: Counter;
  private aiResponseLatencyMs: Histogram;
  private handoverTriggerTotal: Counter;
  private adfImapDisconnectionsTotal: Counter;
  
  // ADF-08 Handover Metrics
  private handoverDossierGenerationMs: Histogram;
  private handoverEmailSentTotal: Counter;
  
  constructor() {
    this.registry = new Registry();
    
    // Initialize ADF Lead Processing Metrics
    this.adfLeadsProcessedTotal = new Counter({
      name: 'adf_leads_processed_total',
      help: 'Total number of ADF leads processed',
      labelNames: ['dealership_id', 'source_provider', 'lead_type', 'status'],
      registers: [this.registry]
    });
    
    this.aiResponseLatencyMs = new Histogram({
      name: 'ai_response_latency_ms',
      help: 'AI response generation latency in milliseconds',
      labelNames: ['dealership_id', 'source_provider', 'model', 'prompt_type'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
      registers: [this.registry]
    });
    
    this.handoverTriggerTotal = new Counter({
      name: 'handover_trigger_total',
      help: 'Total number of handover triggers',
      labelNames: ['dealership_id', 'source_provider', 'reason', 'status'],
      registers: [this.registry]
    });
    
    this.adfImapDisconnectionsTotal = new Counter({
      name: 'adf_imap_disconnections_total',
      help: 'Total number of IMAP disconnections',
      labelNames: ['dealership_id', 'email_provider'],
      registers: [this.registry]
    });
    
    // Initialize ADF-08 Handover Metrics
    this.handoverDossierGenerationMs = new Histogram({
      name: 'handover_dossier_generation_ms',
      help: 'Handover dossier generation time in milliseconds',
      labelNames: ['dealership_id', 'status'],
      buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 15000, 20000, 30000],
      registers: [this.registry]
    });
    
    this.handoverEmailSentTotal = new Counter({
      name: 'handover_email_sent_total',
      help: 'Total number of handover emails sent',
      labelNames: ['dealership_id', 'status', 'template'],
      registers: [this.registry]
    });
    
    logger.info('Prometheus metrics initialized');
  }
  
  /**
   * Get the Prometheus registry
   */
  getRegistry(): Registry {
    return this.registry;
  }
  
  /**
   * Increment the ADF leads processed counter
   */
  incrementLeadsProcessed(labels: {
    dealership_id: string | number;
    source_provider: string;
    lead_type: string;
    status: string;
  }): void {
    try {
      this.adfLeadsProcessedTotal.inc({
        dealership_id: String(labels.dealership_id),
        source_provider: labels.source_provider,
        lead_type: labels.lead_type,
        status: labels.status
      });
    } catch (error) {
      logger.error('Error incrementing adf_leads_processed_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
  
  /**
   * Record AI response latency
   */
  recordAiResponseLatency(latencyMs: number, labels: {
    dealership_id: string | number;
    source_provider: string;
    model: string;
    prompt_type: string;
  }): void {
    try {
      this.aiResponseLatencyMs.observe(
        {
          dealership_id: String(labels.dealership_id),
          source_provider: labels.source_provider,
          model: labels.model,
          prompt_type: labels.prompt_type
        },
        latencyMs
      );
    } catch (error) {
      logger.error('Error recording ai_response_latency_ms metric', {
        error: error instanceof Error ? error.message : String(error),
        latencyMs,
        labels
      });
    }
  }
  
  /**
   * Increment handover triggers counter
   */
  incrementHandoverTriggers(labels: {
    dealership_id: string | number;
    source_provider: string;
    reason: string;
    status: string;
  }): void {
    try {
      this.handoverTriggerTotal.inc({
        dealership_id: String(labels.dealership_id),
        source_provider: labels.source_provider,
        reason: labels.reason,
        status: labels.status
      });
    } catch (error) {
      logger.error('Error incrementing handover_trigger_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
  
  /**
   * Increment IMAP disconnections counter
   */
  incrementImapDisconnections(labels: {
    dealership_id: string | number;
    email_provider: string;
  }): void {
    try {
      this.adfImapDisconnectionsTotal.inc({
        dealership_id: String(labels.dealership_id),
        email_provider: labels.email_provider
      });
    } catch (error) {
      logger.error('Error incrementing adf_imap_disconnections_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
  
  /**
   * Record handover dossier generation time
   */
  recordDossierGenerationTime(timeMs: number, labels: {
    dealership_id: string | number;
    status: string;
  }): void {
    try {
      this.handoverDossierGenerationMs.observe(
        {
          dealership_id: String(labels.dealership_id),
          status: labels.status
        },
        timeMs
      );
    } catch (error) {
      logger.error('Error recording handover_dossier_generation_ms metric', {
        error: error instanceof Error ? error.message : String(error),
        timeMs,
        labels
      });
    }
  }
  
  /**
   * Increment handover email sent counter
   */
  incrementHandoverEmailSent(labels: {
    dealership_id: string | number;
    status: string;
    template?: string;
  }): void {
    try {
      this.handoverEmailSentTotal.inc({
        dealership_id: String(labels.dealership_id),
        status: labels.status,
        template: labels.template || 'default'
      });
    } catch (error) {
      logger.error('Error incrementing handover_email_sent_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
}

// Export singleton instance
export const prometheusMetrics = new PrometheusMetrics();
export default prometheusMetrics;
