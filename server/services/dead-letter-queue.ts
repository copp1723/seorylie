/**
 * Dead Letter Queue Service
 * Provides centralized DLQ functionality for failed operations across the platform
 */

import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { monitoring } from './monitoring';
import { addEmailJob } from './queue';

export interface DLQEntry {
  id: string;
  type: string;
  data: any;
  error: string;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  originalJobId?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface DLQConfig {
  maxAttempts: number;
  baseRetryDelay: number;
  maxRetryDelay: number;
  retryMultiplier: number;
  processingInterval: number;
  enablePersistence: boolean;
}

export class DeadLetterQueueService extends EventEmitter {
  private dlq: Map<string, DLQEntry> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private config: DLQConfig;
  private retryHandlers: Map<string, (entry: DLQEntry) => Promise<void>> = new Map();

  constructor(config: Partial<DLQConfig> = {}) {
    super();
    
    this.config = {
      maxAttempts: 3,
      baseRetryDelay: 1000, // 1 second
      maxRetryDelay: 300000, // 5 minutes
      retryMultiplier: 2,
      processingInterval: 60000, // 1 minute
      enablePersistence: false,
      ...config
    };

    this.setupMetrics();
    this.setupHealthChecks();
    this.startProcessing();
  }

  /**
   * Setup metrics for DLQ operations
   */
  private setupMetrics(): void {
    monitoring.registerCounter('dlq_entries_added_total', 'Total entries added to DLQ');
    monitoring.registerCounter('dlq_retries_attempted_total', 'Total retry attempts');
    monitoring.registerCounter('dlq_retries_successful_total', 'Total successful retries');
    monitoring.registerCounter('dlq_retries_failed_total', 'Total failed retries');
    monitoring.registerUpDownCounter('dlq_pending_entries_count', 'Number of pending DLQ entries');
    monitoring.registerHistogram('dlq_retry_duration_ms', 'Time taken for DLQ retry operations');
    monitoring.registerObservableGauge('dlq_oldest_entry_age_seconds', 'Age of oldest DLQ entry in seconds', (observerResult) => {
      const oldestEntry = this.getOldestEntry();
      if (oldestEntry) {
        const ageSeconds = (Date.now() - oldestEntry.timestamp.getTime()) / 1000;
        observerResult.observe(ageSeconds, { type: oldestEntry.type });
      }
    });
  }

  /**
   * Setup health checks
   */
  private setupHealthChecks(): void {
    monitoring.registerHealthCheck('dead_letter_queue', async () => {
      const stats = this.getStats();
      
      if (stats.total === 0) {
        return {
          status: monitoring.ComponentHealthStatus.HEALTHY,
          details: { message: 'No DLQ entries', stats }
        };
      }
      
      if (stats.expired > stats.total * 0.5) {
        return {
          status: monitoring.ComponentHealthStatus.DEGRADED,
          details: { message: 'High number of expired DLQ entries', stats }
        };
      }
      
      if (stats.pending > 1000) {
        return {
          status: monitoring.ComponentHealthStatus.DEGRADED,
          details: { message: 'High number of pending DLQ entries', stats }
        };
      }
      
      return {
        status: monitoring.ComponentHealthStatus.HEALTHY,
        details: { stats }
      };
    });
  }

  /**
   * Add entry to Dead Letter Queue
   */
  addEntry(
    type: string,
    data: any,
    error: string,
    options: {
      priority?: DLQEntry['priority'];
      maxAttempts?: number;
      originalJobId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const id = `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const entry: DLQEntry = {
      id,
      type,
      data,
      error,
      timestamp: now,
      attempts: 0,
      maxAttempts: options.maxAttempts || this.config.maxAttempts,
      nextRetryAt: new Date(now.getTime() + this.config.baseRetryDelay),
      priority: options.priority || 'medium',
      originalJobId: options.originalJobId,
      metadata: options.metadata
    };

    this.dlq.set(id, entry);
    
    // Update metrics
    monitoring.incrementUpDownCounter('dlq_pending_entries_count');
    monitoring.incrementCounter('dlq_entries_added_total', {
      type,
      priority: entry.priority
    });

    logger.warn('Entry added to Dead Letter Queue', {
      entryId: id,
      type,
      priority: entry.priority,
      error,
      originalJobId: options.originalJobId
    });

    this.emit('entryAdded', entry);
    return id;
  }

  /**
   * Register retry handler for a specific type
   */
  registerRetryHandler(type: string, handler: (entry: DLQEntry) => Promise<void>): void {
    this.retryHandlers.set(type, handler);
    logger.info('DLQ retry handler registered', { type });
  }

  /**
   * Start processing DLQ entries
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processEntries().catch(error => {
        logger.error('Error processing DLQ entries', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.config.processingInterval);
  }

  /**
   * Process retryable DLQ entries
   */
  private async processEntries(): Promise<void> {
    const now = new Date();
    const retryableEntries = Array.from(this.dlq.values())
      .filter(entry => entry.nextRetryAt <= now && entry.attempts < entry.maxAttempts)
      .sort((a, b) => {
        // Sort by priority and then by timestamp
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp.getTime() - b.timestamp.getTime();
      });

    for (const entry of retryableEntries) {
      await this.processEntry(entry);
    }
  }

  /**
   * Process a single DLQ entry
   */
  private async processEntry(entry: DLQEntry): Promise<void> {
    const startTime = Date.now();
    
    try {
      monitoring.incrementCounter('dlq_retries_attempted_total', {
        type: entry.type,
        attempt: entry.attempts.toString(),
        priority: entry.priority
      });

      const handler = this.retryHandlers.get(entry.type);
      if (!handler) {
        throw new Error(`No retry handler registered for type: ${entry.type}`);
      }

      await handler(entry);
      
      // Success - remove from DLQ
      this.dlq.delete(entry.id);
      monitoring.decrementUpDownCounter('dlq_pending_entries_count');
      monitoring.incrementCounter('dlq_retries_successful_total', {
        type: entry.type,
        priority: entry.priority
      });

      const duration = Date.now() - startTime;
      monitoring.recordHistogram('dlq_retry_duration_ms', duration, {
        type: entry.type,
        result: 'success'
      });

      logger.info('DLQ entry processed successfully', {
        entryId: entry.id,
        type: entry.type,
        attempts: entry.attempts + 1,
        duration
      });

      this.emit('entryProcessed', entry);
      
    } catch (error) {
      entry.attempts++;
      entry.nextRetryAt = new Date(Date.now() + this.calculateBackoffDelay(entry.attempts));
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      monitoring.incrementCounter('dlq_retries_failed_total', {
        type: entry.type,
        attempt: entry.attempts.toString(),
        priority: entry.priority
      });

      const duration = Date.now() - startTime;
      monitoring.recordHistogram('dlq_retry_duration_ms', duration, {
        type: entry.type,
        result: 'failure'
      });

      logger.warn('DLQ entry retry failed', {
        entryId: entry.id,
        type: entry.type,
        attempts: entry.attempts,
        maxAttempts: entry.maxAttempts,
        error: errorMessage,
        nextRetryAt: entry.nextRetryAt
      });

      if (entry.attempts >= entry.maxAttempts) {
        logger.error('DLQ entry exceeded max attempts', {
          entryId: entry.id,
          type: entry.type,
          attempts: entry.attempts,
          originalError: entry.error,
          finalError: errorMessage
        });
        
        this.emit('entryExpired', entry);
      } else {
        this.emit('entryRetryFailed', entry, error);
      }
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempts: number): number {
    const delay = this.config.baseRetryDelay * Math.pow(this.config.retryMultiplier, attempts - 1);
    return Math.min(delay, this.config.maxRetryDelay);
  }

  /**
   * Get DLQ statistics
   */
  getStats() {
    const now = new Date();
    const stats = {
      total: this.dlq.size,
      pending: 0,
      retryable: 0,
      expired: 0,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>
    };

    this.dlq.forEach(entry => {
      // Count by status
      if (entry.attempts >= entry.maxAttempts) {
        stats.expired++;
      } else if (entry.nextRetryAt <= now) {
        stats.retryable++;
      } else {
        stats.pending++;
      }
      
      // Count by type
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
      
      // Count by priority
      stats.byPriority[entry.priority] = (stats.byPriority[entry.priority] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get oldest entry
   */
  private getOldestEntry(): DLQEntry | null {
    if (this.dlq.size === 0) return null;
    
    return Array.from(this.dlq.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
  }

  /**
   * Get entry by ID
   */
  getEntry(id: string): DLQEntry | null {
    return this.dlq.get(id) || null;
  }

  /**
   * Remove entry by ID
   */
  removeEntry(id: string): boolean {
    const removed = this.dlq.delete(id);
    if (removed) {
      monitoring.decrementUpDownCounter('dlq_pending_entries_count');
    }
    return removed;
  }

  /**
   * Clear all expired entries
   */
  clearExpiredEntries(): number {
    const expiredIds: string[] = [];
    
    this.dlq.forEach((entry, id) => {
      if (entry.attempts >= entry.maxAttempts) {
        expiredIds.push(id);
      }
    });
    
    expiredIds.forEach(id => {
      this.dlq.delete(id);
      monitoring.decrementUpDownCounter('dlq_pending_entries_count');
    });
    
    if (expiredIds.length > 0) {
      logger.info('Cleared expired DLQ entries', { count: expiredIds.length });
    }
    
    return expiredIds.length;
  }

  /**
   * Shutdown the DLQ service
   */
  async shutdown(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    logger.info('Dead Letter Queue service shut down', {
      remainingEntries: this.dlq.size
    });
  }
}

// Export singleton instance
export const dlqService = new DeadLetterQueueService();
