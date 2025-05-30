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
  
  // ADF-011 AI Cost Control Metrics
  private openaiTokensTotal: Counter;
  private aiResponsesGeneratedTotal: Counter;
  private aiCacheEventsTotal: Counter;
  private aiRateLimitEventsTotal: Counter;
  
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
    
    // Initialize ADF-011 AI Cost Control Metrics
    this.openaiTokensTotal = new Counter({
      name: 'openai_tokens_total',
      help: 'Total number of OpenAI tokens used',
      labelNames: ['dealership_id', 'model', 'token_type'],
      registers: [this.registry]
    });
    
    this.aiResponsesGeneratedTotal = new Counter({
      name: 'ai_responses_generated_total',
      help: 'Total number of AI responses generated',
      labelNames: ['dealership_id', 'source', 'intent'],
      registers: [this.registry]
    });
    
    this.aiCacheEventsTotal = new Counter({
      name: 'ai_cache_events_total',
      help: 'Total number of AI cache events',
      labelNames: ['event_type', 'source'],
      registers: [this.registry]
    });
    
    this.aiRateLimitEventsTotal = new Counter({
      name: 'ai_rate_limit_events_total',
      help: 'Total number of AI rate limit events',
      labelNames: ['dealership_id', 'event_type'],
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
  
  /**
   * Track OpenAI tokens used
   */
  trackOpenAiTokensUsed(labels: {
    dealership_id: string | number;
    model: string;
    tokens: number;
    token_type: 'prompt' | 'completion' | 'total';
  }): void {
    try {
      this.openaiTokensTotal.inc(
        {
          dealership_id: String(labels.dealership_id),
          model: labels.model,
          token_type: labels.token_type
        },
        labels.tokens
      );
    } catch (error) {
      logger.error('Error tracking openai_tokens_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
  
  /**
   * Increment AI responses generated counter
   */
  incrementAiResponsesGenerated(labels: {
    dealership_id: string | number;
    source: 'openai' | 'template' | 'cache' | 'error';
    intent: string;
  }): void {
    try {
      this.aiResponsesGeneratedTotal.inc({
        dealership_id: String(labels.dealership_id),
        source: labels.source,
        intent: labels.intent
      });
    } catch (error) {
      logger.error('Error incrementing ai_responses_generated_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
  
  /**
   * Increment AI cache events counter
   */
  incrementAiCacheEvents(labels: {
    event_type: 'hit' | 'miss' | 'store' | 'error';
    source: 'template' | 'ai' | 'personalized' | 'unknown';
  }): void {
    try {
      this.aiCacheEventsTotal.inc({
        event_type: labels.event_type,
        source: labels.source
      });
    } catch (error) {
      logger.error('Error incrementing ai_cache_events_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
  
  /**
   * Increment AI rate limit events counter
   */
  incrementAiRateLimitEvents(labels: {
    dealership_id: string | number;
    event_type: 'depleted' | 'dropped' | 'exceeded';
  }): void {
    try {
      this.aiRateLimitEventsTotal.inc({
        dealership_id: String(labels.dealership_id),
        event_type: labels.event_type
      });
    } catch (error) {
      logger.error('Error incrementing ai_rate_limit_events_total metric', {
        error: error instanceof Error ? error.message : String(error),
        labels
      });
    }
  }
}

// Export singleton instance
export const prometheusMetrics = new PrometheusMetrics();
export default prometheusMetrics;
