/**
 * Metrics Collection Service for Conversation Orchestrator
 * 
 * Handles comprehensive metrics collection, aggregation, and reporting for
 * conversation orchestration performance monitoring and observability.
 */

import { EventEmitter } from 'events';
import client from 'prom-client';
import db from '../db';
import { sql } from 'drizzle-orm';
import logger from '../utils/logger';
import type { HealthStatus } from './conversation-orchestrator';

// Prometheus metrics
const conversationTurnsTotal = new client.Counter({
  name: 'conversation_turns_total',
  help: 'Total number of conversation turns processed',
  labelNames: ['dealership_id', 'turn_number', 'outcome', 'ai_model']
});

const conversationTurnDuration = new client.Histogram({
  name: 'conversation_turn_duration_seconds',
  help: 'Duration of conversation turn processing',
  labelNames: ['dealership_id', 'turn_number', 'ai_model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const conversationQueueDepth = new client.Gauge({
  name: 'conversation_queue_depth',
  help: 'Number of conversations in processing queue',
  labelNames: ['queue_type']
});

const aiServiceRequests = new client.Counter({
  name: 'ai_service_requests_total',
  help: 'Total AI service requests',
  labelNames: ['model', 'status']
});

const aiServiceDuration = new client.Histogram({
  name: 'ai_service_duration_seconds',
  help: 'AI service request duration',
  labelNames: ['model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60]
});

const aiTokensUsed = new client.Counter({
  name: 'ai_tokens_used_total',
  help: 'Total AI tokens consumed',
  labelNames: ['model', 'type']
});

const aiCostTotal = new client.Counter({
  name: 'ai_cost_total_usd',
  help: 'Total AI cost in USD',
  labelNames: ['model', 'dealership_id']
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
  labelNames: ['service']
});

const conversationOutcomes = new client.Counter({
  name: 'conversation_outcomes_total',
  help: 'Total conversation outcomes',
  labelNames: ['dealership_id', 'outcome', 'source']
});

const promptTemplateUsage = new client.Counter({
  name: 'prompt_template_usage_total',
  help: 'Prompt template usage count',
  labelNames: ['template_id', 'template_name', 'dealership_id']
});

// Performance tracking interfaces
export interface TurnMetrics {
  conversationId: string;
  turnNumber: number;
  processingTime: number;
  outcome: string;
  aiModel?: string;
  tokensUsed?: number;
  cost?: number;
  dealershipId?: number;
}

export interface ConversationMetrics {
  conversationId: string;
  dealershipId: number;
  turnNumber: number;
  nextAction: string;
  processingTime: number;
  aiModel?: string;
  tokensUsed?: number;
  cost?: number;
  promptTemplate?: string;
  intent?: string;
  sentiment?: number;
}

export interface AIServiceMetrics {
  model: string;
  duration: number;
  tokensUsed: number;
  cost: number;
  status: 'success' | 'error';
  errorType?: string;
}

/**
 * Comprehensive metrics collection and aggregation service
 */
export class MetricsCollector extends EventEmitter {
  private componentName: string;
  private metricsBuffer: any[] = [];
  private bufferSize = 100;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;
  private dailyAggregates = new Map<string, any>();

  constructor(componentName: string) {
    super();
    this.componentName = componentName;
    this.startPeriodicFlush();
  }

  /**
   * Record conversation turn processing metrics
   */
  recordTurnProcessed(metrics: TurnMetrics): void {
    try {
      // Update Prometheus metrics
      conversationTurnsTotal.inc({
        dealership_id: metrics.dealershipId?.toString() || 'unknown',
        turn_number: metrics.turnNumber.toString(),
        outcome: metrics.outcome,
        ai_model: metrics.aiModel || 'unknown'
      });

      conversationTurnDuration.observe(
        {
          dealership_id: metrics.dealershipId?.toString() || 'unknown',
          turn_number: metrics.turnNumber.toString(),
          ai_model: metrics.aiModel || 'unknown'
        },
        metrics.processingTime / 1000 // Convert to seconds
      );

      // Buffer for database storage
      this.bufferMetric({
        type: 'turn_processed',
        timestamp: new Date(),
        data: metrics
      });

      logger.debug('Turn metrics recorded', {
        conversationId: metrics.conversationId,
        turnNumber: metrics.turnNumber,
        processingTime: metrics.processingTime,
        outcome: metrics.outcome
      });

    } catch (error) {
      logger.error('Failed to record turn metrics', {
        error: error instanceof Error ? error.message : String(error),
        metrics
      });
    }
  }

  /**
   * Record conversation turn failure
   */
  recordTurnFailed(failure: { conversationId: string; error: string }): void {
    try {
      conversationTurnsTotal.inc({
        dealership_id: 'unknown',
        turn_number: 'unknown',
        outcome: 'failed',
        ai_model: 'unknown'
      });

      this.bufferMetric({
        type: 'turn_failed',
        timestamp: new Date(),
        data: failure
      });

      logger.debug('Turn failure recorded', failure);

    } catch (error) {
      logger.error('Failed to record turn failure', {
        error: error instanceof Error ? error.message : String(error),
        failure
      });
    }
  }

  /**
   * Record comprehensive conversation metrics
   */
  recordConversationMetrics(metrics: ConversationMetrics): void {
    try {
      // Update Prometheus metrics
      if (metrics.tokensUsed) {
        aiTokensUsed.inc({
          model: metrics.aiModel || 'unknown',
          type: 'completion'
        }, metrics.tokensUsed);
      }

      if (metrics.cost) {
        aiCostTotal.inc({
          model: metrics.aiModel || 'unknown',
          dealership_id: metrics.dealershipId.toString()
        }, metrics.cost);
      }

      if (metrics.promptTemplate) {
        promptTemplateUsage.inc({
          template_id: metrics.promptTemplate,
          template_name: metrics.promptTemplate,
          dealership_id: metrics.dealershipId.toString()
        });
      }

      // Record conversation outcome
      conversationOutcomes.inc({
        dealership_id: metrics.dealershipId.toString(),
        outcome: metrics.nextAction,
        source: 'orchestrator'
      });

      // Buffer for detailed database storage
      this.bufferMetric({
        type: 'conversation_metrics',
        timestamp: new Date(),
        data: metrics
      });

      // Update daily aggregates
      this.updateDailyAggregates(metrics);

      logger.debug('Conversation metrics recorded', {
        conversationId: metrics.conversationId,
        turnNumber: metrics.turnNumber,
        nextAction: metrics.nextAction
      });

    } catch (error) {
      logger.error('Failed to record conversation metrics', {
        error: error instanceof Error ? error.message : String(error),
        metrics
      });
    }
  }

  /**
   * Record AI service performance metrics
   */
  recordAIServiceMetrics(metrics: AIServiceMetrics): void {
    try {
      aiServiceRequests.inc({
        model: metrics.model,
        status: metrics.status
      });

      aiServiceDuration.observe(
        { model: metrics.model },
        metrics.duration / 1000 // Convert to seconds
      );

      if (metrics.tokensUsed > 0) {
        aiTokensUsed.inc({
          model: metrics.model,
          type: 'total'
        }, metrics.tokensUsed);
      }

      this.bufferMetric({
        type: 'ai_service_metrics',
        timestamp: new Date(),
        data: metrics
      });

      logger.debug('AI service metrics recorded', {
        model: metrics.model,
        duration: metrics.duration,
        status: metrics.status
      });

    } catch (error) {
      logger.error('Failed to record AI service metrics', {
        error: error instanceof Error ? error.message : String(error),
        metrics
      });
    }
  }

  /**
   * Record circuit breaker state
   */
  recordCircuitBreakerState(service: string, state: 'closed' | 'half-open' | 'open'): void {
    try {
      const stateValue = state === 'closed' ? 0 : state === 'half-open' ? 1 : 2;
      circuitBreakerState.set({ service }, stateValue);

      this.bufferMetric({
        type: 'circuit_breaker_state',
        timestamp: new Date(),
        data: { service, state }
      });

      logger.debug('Circuit breaker state recorded', { service, state });

    } catch (error) {
      logger.error('Failed to record circuit breaker state', {
        error: error instanceof Error ? error.message : String(error),
        service,
        state
      });
    }
  }

  /**
   * Record queue depth metrics
   */
  recordQueueMetrics(queueCounts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }): void {
    try {
      conversationQueueDepth.set({ queue_type: 'waiting' }, queueCounts.waiting);
      conversationQueueDepth.set({ queue_type: 'active' }, queueCounts.active);
      conversationQueueDepth.set({ queue_type: 'completed' }, queueCounts.completed);
      conversationQueueDepth.set({ queue_type: 'failed' }, queueCounts.failed);

      this.bufferMetric({
        type: 'queue_metrics',
        timestamp: new Date(),
        data: queueCounts
      });

    } catch (error) {
      logger.error('Failed to record queue metrics', {
        error: error instanceof Error ? error.message : String(error),
        queueCounts
      });
    }
  }

  /**
   * Record health metrics
   */
  recordHealthMetrics(health: HealthStatus): void {
    try {
      // Update queue metrics
      this.recordQueueMetrics(health.queue);

      // Update circuit breaker state
      this.recordCircuitBreakerState('ai-service', health.circuitBreaker.state as any);

      // Buffer health status
      this.bufferMetric({
        type: 'health_status',
        timestamp: new Date(),
        data: health
      });

    } catch (error) {
      logger.error('Failed to record health metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Buffer a metric for batch processing
   */
  private bufferMetric(metric: any): void {
    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics();
    }
  }

  /**
   * Start periodic metric flushing
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  /**
   * Flush buffered metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      // Batch insert metrics to database
      for (const metric of metricsToFlush) {
        await this.storeMetricInDatabase(metric);
      }

      logger.debug('Metrics flushed to database', {
        count: metricsToFlush.length,
        component: this.componentName
      });

    } catch (error) {
      logger.error('Failed to flush metrics to database', {
        error: error instanceof Error ? error.message : String(error),
        count: metricsToFlush.length
      });

      // Re-add failed metrics to buffer for retry
      this.metricsBuffer.unshift(...metricsToFlush);
    }
  }

  /**
   * Store individual metric in database
   */
  private async storeMetricInDatabase(metric: any): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO conversation_orchestration_metrics (
          conversation_id, dealership_id, metric_name, metric_value,
          metric_type, timestamp, metadata
        ) VALUES (
          ${metric.data.conversationId || null},
          ${metric.data.dealershipId || null},
          ${metric.type},
          ${this.extractNumericValue(metric.data)},
          'counter',
          ${metric.timestamp},
          ${JSON.stringify(metric.data)}
        )
      `);
    } catch (error) {
      // Log but don't throw to avoid breaking the flush process
      logger.error('Failed to store individual metric', {
        error: error instanceof Error ? error.message : String(error),
        metricType: metric.type
      });
    }
  }

  /**
   * Extract numeric value from metric data for database storage
   */
  private extractNumericValue(data: any): number {
    if (data.processingTime) return data.processingTime;
    if (data.cost) return data.cost;
    if (data.tokensUsed) return data.tokensUsed;
    if (data.duration) return data.duration;
    if (data.sentiment) return data.sentiment;
    return 1; // Default count value
  }

  /**
   * Update daily aggregates for reporting
   */
  private updateDailyAggregates(metrics: ConversationMetrics): void {
    const today = new Date().toISOString().split('T')[0];
    const key = `${today}:${metrics.dealershipId}`;

    if (!this.dailyAggregates.has(key)) {
      this.dailyAggregates.set(key, {
        date: today,
        dealershipId: metrics.dealershipId,
        totalConversations: 0,
        totalTurns: 0,
        totalCost: 0,
        totalTokens: 0,
        avgProcessingTime: 0,
        outcomes: {
          completed: 0,
          escalated: 0,
          failed: 0
        }
      });
    }

    const aggregate = this.dailyAggregates.get(key);
    
    // Update counters
    if (metrics.turnNumber === 1) {
      aggregate.totalConversations++;
    }
    aggregate.totalTurns++;
    
    if (metrics.cost) {
      aggregate.totalCost += metrics.cost;
    }
    
    if (metrics.tokensUsed) {
      aggregate.totalTokens += metrics.tokensUsed;
    }

    // Update processing time average
    const totalProcessingTime = aggregate.avgProcessingTime * (aggregate.totalTurns - 1) + metrics.processingTime;
    aggregate.avgProcessingTime = totalProcessingTime / aggregate.totalTurns;

    // Update outcomes
    if (metrics.nextAction in aggregate.outcomes) {
      aggregate.outcomes[metrics.nextAction]++;
    }
  }

  /**
   * Get daily aggregates for reporting
   */
  getDailyAggregates(date?: string): any[] {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const results = [];

    for (const [key, aggregate] of this.dailyAggregates.entries()) {
      if (aggregate.date === targetDate) {
        results.push(aggregate);
      }
    }

    return results;
  }

  /**
   * Get Prometheus metrics for export
   */
  async getPrometheusMetrics(): Promise<string> {
    return client.register.metrics();
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(dealershipId?: number, hours = 24): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total_turns,
          AVG(metric_value) as avg_processing_time,
          COUNT(DISTINCT conversation_id) as total_conversations,
          SUM(CASE WHEN JSON_EXTRACT(metadata, '$.nextAction') = 'completed' THEN 1 ELSE 0 END) as completed_conversations,
          SUM(CASE WHEN JSON_EXTRACT(metadata, '$.nextAction') = 'escalated' THEN 1 ELSE 0 END) as escalated_conversations,
          SUM(CASE WHEN JSON_EXTRACT(metadata, '$.cost') IS NOT NULL 
              THEN CAST(JSON_EXTRACT(metadata, '$.cost') AS DECIMAL(10,6)) ELSE 0 END) as total_cost,
          SUM(CASE WHEN JSON_EXTRACT(metadata, '$.tokensUsed') IS NOT NULL 
              THEN CAST(JSON_EXTRACT(metadata, '$.tokensUsed') AS INTEGER) ELSE 0 END) as total_tokens
        FROM conversation_orchestration_metrics
        WHERE timestamp > NOW() - INTERVAL '${hours} hours'
        ${dealershipId ? sql`AND dealership_id = ${dealershipId}` : sql``}
      `);

      const row = result.rows[0] as any;
      
      return {
        period: `${hours} hours`,
        dealershipId,
        totalTurns: parseInt(row.total_turns) || 0,
        totalConversations: parseInt(row.total_conversations) || 0,
        avgProcessingTime: parseFloat(row.avg_processing_time) || 0,
        completedConversations: parseInt(row.completed_conversations) || 0,
        escalatedConversations: parseInt(row.escalated_conversations) || 0,
        totalCost: parseFloat(row.total_cost) || 0,
        totalTokens: parseInt(row.total_tokens) || 0,
        completionRate: row.total_conversations > 0 ? 
          (row.completed_conversations / row.total_conversations * 100).toFixed(2) + '%' : '0%',
        escalationRate: row.total_conversations > 0 ? 
          (row.escalated_conversations / row.total_conversations * 100).toFixed(2) + '%' : '0%'
      };

    } catch (error) {
      logger.error('Failed to get performance summary', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        period: `${hours} hours`,
        dealershipId,
        error: 'Failed to retrieve metrics'
      };
    }
  }

  /**
   * Cleanup old metrics
   */
  async cleanupOldMetrics(daysToKeep = 30): Promise<void> {
    try {
      const result = await db.execute(sql`
        DELETE FROM conversation_orchestration_metrics
        WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
      `);

      logger.info('Old metrics cleaned up', {
        daysToKeep,
        deletedRows: result.rowCount
      });

    } catch (error) {
      logger.error('Failed to cleanup old metrics', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Shutdown metrics collector
   */
  shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    // Final flush
    this.flushMetrics();

    logger.info('MetricsCollector shutdown complete');
  }
}

export default MetricsCollector;