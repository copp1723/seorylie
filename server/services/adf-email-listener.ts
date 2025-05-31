import { EventEmitter } from 'events';
import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import logger from '../utils/logger';
import db from '../db';
import { eq } from 'drizzle-orm';
import { dealerships, dealershipEmailConfigs } from '@shared/schema-resolver';
import { monitoring } from './monitoring';
import { addEmailJob } from './queue';

export interface AdfEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
  markSeen: boolean;
  searchCriteria: string[];
  pollingInterval: number;
}

export interface AdfEmailData {
  id: string;
  subject: string;
  from: string;
  to: string;
  date: Date;
  attachments: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
    size: number;
  }>;
  rawContent: string;
}

// Connection pool interface
interface ImapConnection {
  id: string;
  imap: Imap;
  config: any;
  isConnected: boolean;
  isInUse: boolean;
  lastUsed: Date;
  connectionAttempts: number;
  maxRetries: number;
}

// Dead Letter Queue entry
interface DLQEntry {
  id: string;
  type: 'email_processing' | 'imap_connection' | 'email_parsing';
  data: any;
  error: string;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  originalJobId?: string;
}

export class AdfEmailListener extends EventEmitter {
  // Legacy single connection (kept for backward compatibility)
  private imap: Imap | null = null;
  private isConnected: boolean = false;
  private isListening: boolean = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 30000; // 30 seconds

  // Enhanced connection pool
  private connectionPool: Map<string, ImapConnection> = new Map();
  private maxPoolSize: number = 5;
  private connectionTimeout: number = 30000;
  private idleTimeout: number = 300000; // 5 minutes
  private poolCleanupInterval: NodeJS.Timeout | null = null;

  // Dead Letter Queue
  private dlq: Map<string, DLQEntry> = new Map();
  private dlqProcessingInterval: NodeJS.Timeout | null = null;
  private dlqRetryInterval: number = 60000; // 1 minute
  private maxDlqAttempts: number = 3;

  // Exponential backoff configuration
  private baseRetryDelay: number = 1000; // 1 second
  private maxRetryDelay: number = 300000; // 5 minutes
  private retryMultiplier: number = 2;

  constructor() {
    super();
    this.setupErrorHandling();
    this.setupMetrics();
    this.setupHealthChecks();
    this.startPoolCleanup();
    this.startDlqProcessing();
  }

  /**
   * Start listening for ADF emails
   */
  async start(): Promise<void> {
    if (this.isListening) {
      logger.warn('ADF Email Listener is already running');
      return;
    }

    try {
      // Get email configurations from database
      const emailConfigs = await this.getEmailConfigurations();
      
      if (emailConfigs.length === 0) {
        logger.warn('No email configurations found for ADF listening');
        return;
      }

      // Start with the primary configuration
      const primaryConfig = emailConfigs.find(config => config.isPrimary) || emailConfigs[0];
      await this.connectToEmail(primaryConfig);
      
      this.isListening = true;
      logger.info('ADF Email Listener started successfully');
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to start ADF Email Listener', { error: err.message });
      throw err;
    }
  }

  /**
   * Stop listening for emails
   */
  async stop(): Promise<void> {
    if (!this.isListening) {
      return;
    }

    try {
      this.isListening = false;
      
      if (this.pollingTimer) {
        clearTimeout(this.pollingTimer);
        this.pollingTimer = null;
      }

      if (this.imap && this.isConnected) {
        this.imap.end();
      }

      logger.info('ADF Email Listener stopped');
      this.emit('stopped');
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error stopping ADF Email Listener', { error: err.message });
      throw err;
    }
  }

  /**
   * Get email configurations from database
   */
  private async getEmailConfigurations(): Promise<any[]> {
    try {
      const configs = await db.query.dealershipEmailConfigs.findMany({
        where: eq(dealershipEmailConfigs.status, 'active'),
        with: {
          dealership: true
        }
      });

      return configs.map(config => ({
        id: config.id,
        dealershipId: config.dealershipId,
        dealershipName: config.dealership?.name || 'Unknown',
        emailAddress: config.emailAddress,
        host: config.imapHost,
        port: config.imapPort,
        user: config.imapUser,
        password: this.decryptPassword(config.imapPassEncrypted),
        tls: config.imapUseSsl,
        isPrimary: config.isPrimary,
        pollingInterval: config.pollingIntervalMs || 300000 // 5 minutes default
      }));
    } catch (error) {
      logger.error('Failed to get email configurations', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  /**
   * Connect to email server
   */
  private async connectToEmail(config: any): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.imap = new Imap({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          tls: config.tls,
          tlsOptions: { rejectUnauthorized: false },
          authTimeout: 30000,
          connTimeout: 30000
        });

        this.imap.once('ready', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          logger.info('Connected to email server', { 
            host: config.host, 
            user: config.user,
            dealership: config.dealershipName 
          });
          
          this.emit('connected');
          this.startPolling(config.pollingInterval);
          resolve();
        });

        this.imap.once('error', (error) => {
          this.isConnected = false;
          logger.error('IMAP connection error', { 
            error: error.message,
            host: config.host,
            user: config.user 
          });
          
          this.emit('error', error);
          this.handleReconnection(config);
          reject(error);
        });

        this.imap.once('end', () => {
          this.isConnected = false;
          logger.info('IMAP connection ended');
          this.emit('disconnected');
          
          if (this.isListening) {
            this.handleReconnection(config);
          }
        });

        this.imap.connect();
        
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to create IMAP connection', { error: err.message });
        reject(err);
      }
    });
  }

  /**
   * Start polling for new emails
   */
  private startPolling(interval: number): void {
    if (!this.isListening || !this.imap || !this.isConnected) {
      return;
    }

    this.pollingTimer = setTimeout(async () => {
      try {
        await this.checkForNewEmails();
      } catch (error) {
        logger.error('Error during email polling', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
      
      // Schedule next poll
      if (this.isListening) {
        this.startPolling(interval);
      }
    }, interval);
  }

  /**
   * Check for new emails with ADF attachments
   */
  private async checkForNewEmails(): Promise<void> {
    if (!this.imap || !this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.imap!.openBox('INBOX', false, (error, box) => {
        if (error) {
          logger.error('Failed to open inbox', { error: error.message });
          reject(error);
          return;
        }

        // Search for unseen emails
        this.imap!.search(['UNSEEN'], (searchError, results) => {
          if (searchError) {
            logger.error('Email search failed', { error: searchError.message });
            reject(searchError);
            return;
          }

          if (!results || results.length === 0) {
            resolve();
            return;
          }

          logger.info(`Found ${results.length} new emails`);
          this.processEmails(results).then(resolve).catch(reject);
        });
      });
    });
  }

  /**
   * Process found emails
   */
  private async processEmails(emailIds: number[]): Promise<void> {
    if (!this.imap) {
      return;
    }

    const fetch = this.imap.fetch(emailIds, {
      bodies: '',
      markSeen: true,
      struct: true
    });

    fetch.on('message', (msg, seqno) => {
      let buffer = '';
      
      msg.on('body', (stream) => {
        stream.on('data', (chunk) => {
          buffer += chunk.toString('utf8');
        });
      });

      msg.once('end', async () => {
        try {
          const parsed = await simpleParser(buffer);
          await this.handleParsedEmail(parsed, seqno);
        } catch (error) {
          logger.error('Failed to parse email', { 
            error: error instanceof Error ? error.message : String(error),
            seqno 
          });
        }
      });
    });

    fetch.once('error', (error) => {
      logger.error('Email fetch error', { error: error.message });
    });

    fetch.once('end', () => {
      logger.debug('Email fetch completed');
    });
  }

  /**
   * Handle parsed email and check for ADF attachments
   */
  private async handleParsedEmail(parsed: ParsedMail, seqno: number): Promise<void> {
    const startTime = Date.now();

    try {
      // Check if email has XML attachments (potential ADF)
      const xmlAttachments = parsed.attachments?.filter(att =>
        att.filename?.toLowerCase().endsWith('.xml') ||
        att.contentType?.includes('application/xml') ||
        att.contentType?.includes('text/xml')
      ) || [];

      if (xmlAttachments.length === 0) {
        logger.debug('No XML attachments found', {
          subject: parsed.subject,
          from: parsed.from?.text
        });
        return;
      }

      // Process each XML attachment
      for (const attachment of xmlAttachments) {
        const emailData: AdfEmailData = {
          id: `${seqno}-${Date.now()}`,
          subject: parsed.subject || '',
          from: parsed.from?.text || '',
          to: parsed.to?.text || '',
          date: parsed.date || new Date(),
          attachments: [{
            filename: attachment.filename || 'unknown.xml',
            content: attachment.content,
            contentType: attachment.contentType || 'application/xml',
            size: attachment.size || attachment.content.length
          }],
          rawContent: parsed.html || parsed.text || ''
        };

        logger.info('Processing ADF email', {
          subject: emailData.subject,
          from: emailData.from,
          attachmentCount: emailData.attachments.length
        });

        // Track metrics
        monitoring.incrementCounter('imap_emails_processed_total', {
          has_attachments: 'true',
          attachment_count: xmlAttachments.length.toString()
        });

        this.emit('email', emailData);
      }

      // Record processing time
      const processingTime = Date.now() - startTime;
      monitoring.recordHistogram('imap_email_processing_duration_ms', processingTime, {
        attachment_count: xmlAttachments.length.toString()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Error handling parsed email', {
        error: errorMessage,
        seqno
      });

      // Track error metrics
      monitoring.incrementCounter('imap_emails_failed_total', {
        error_type: 'processing_error'
      });

      // Add to DLQ for retry
      this.addToDlq('email_processing', { parsed, seqno }, errorMessage);
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(config: any): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached, stopping email listener');
      this.stop();
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    
    logger.info(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (this.isListening) {
        this.connectToEmail(config).catch(error => {
          logger.error('Reconnection failed', { error: error.message });
        });
      }
    }, delay);
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      logger.error('ADF Email Listener error', { error: error.message });
      monitoring.incrementCounter('adf_email_listener_errors_total', {
        error_type: error.name || 'unknown'
      });
    });
  }

  /**
   * Setup metrics tracking
   */
  private setupMetrics(): void {
    // Register custom metrics for IMAP operations
    monitoring.registerCounter('imap_connections_total', 'Total IMAP connections created');
    monitoring.registerCounter('imap_connection_failures_total', 'Total IMAP connection failures');
    monitoring.registerCounter('imap_emails_processed_total', 'Total emails processed');
    monitoring.registerCounter('imap_emails_failed_total', 'Total email processing failures');
    monitoring.registerUpDownCounter('imap_active_connections', 'Number of active IMAP connections');
    monitoring.registerHistogram('imap_connection_duration_ms', 'IMAP connection establishment time');
    monitoring.registerHistogram('imap_email_processing_duration_ms', 'Email processing time');

    // DLQ metrics
    monitoring.registerCounter('dlq_entries_total', 'Total entries added to Dead Letter Queue');
    monitoring.registerCounter('dlq_retries_total', 'Total DLQ retry attempts');
    monitoring.registerCounter('dlq_successes_total', 'Total successful DLQ retries');
    monitoring.registerUpDownCounter('dlq_pending_entries', 'Number of pending DLQ entries');
  }

  /**
   * Setup health checks
   */
  private setupHealthChecks(): void {
    monitoring.registerHealthCheck('adf_email_listener', async () => {
      try {
        const poolStats = this.getConnectionPoolStats();
        const dlqStats = this.getDlqStats();

        // Check if we have healthy connections
        const healthyConnections = poolStats.connected;
        const totalConnections = poolStats.total;

        if (totalConnections === 0) {
          return {
            status: monitoring.ComponentHealthStatus.DEGRADED,
            details: {
              message: 'No IMAP connections configured',
              poolStats,
              dlqStats
            }
          };
        }

        if (healthyConnections === 0) {
          return {
            status: monitoring.ComponentHealthStatus.UNHEALTHY,
            details: {
              message: 'No healthy IMAP connections available',
              poolStats,
              dlqStats
            }
          };
        }

        // Check DLQ health
        if (dlqStats.pending > 100) {
          return {
            status: monitoring.ComponentHealthStatus.DEGRADED,
            details: {
              message: 'High number of pending DLQ entries',
              poolStats,
              dlqStats
            }
          };
        }

        return {
          status: monitoring.ComponentHealthStatus.HEALTHY,
          details: {
            poolStats,
            dlqStats,
            isListening: this.isListening
          }
        };
      } catch (error) {
        return {
          status: monitoring.ComponentHealthStatus.UNHEALTHY,
          details: {
            error: error instanceof Error ? error.message : String(error)
          }
        };
      }
    });
  }

  /**
   * Start connection pool cleanup
   */
  private startPoolCleanup(): void {
    this.poolCleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Clean up every minute
  }

  /**
   * Start DLQ processing
   */
  private startDlqProcessing(): void {
    this.dlqProcessingInterval = setInterval(() => {
      this.processDlqEntries();
    }, this.dlqRetryInterval);
  }

  /**
   * Get connection pool statistics
   */
  private getConnectionPoolStats() {
    const stats = {
      total: this.connectionPool.size,
      connected: 0,
      inUse: 0,
      idle: 0,
      failed: 0
    };

    this.connectionPool.forEach(conn => {
      if (conn.isConnected) {
        stats.connected++;
        if (conn.isInUse) {
          stats.inUse++;
        } else {
          stats.idle++;
        }
      } else {
        stats.failed++;
      }
    });

    return stats;
  }

  /**
   * Get DLQ statistics
   */
  private getDlqStats() {
    const now = new Date();
    const stats = {
      total: this.dlq.size,
      pending: 0,
      retryable: 0,
      expired: 0
    };

    this.dlq.forEach(entry => {
      if (entry.attempts >= entry.maxAttempts) {
        stats.expired++;
      } else if (entry.nextRetryAt <= now) {
        stats.retryable++;
      } else {
        stats.pending++;
      }
    });

    return stats;
  }

  /**
   * Clean up idle connections
   */
  private cleanupIdleConnections(): void {
    const now = new Date();
    const connectionsToRemove: string[] = [];

    this.connectionPool.forEach((conn, id) => {
      const idleTime = now.getTime() - conn.lastUsed.getTime();

      if (!conn.isInUse && idleTime > this.idleTimeout) {
        connectionsToRemove.push(id);

        if (conn.isConnected) {
          try {
            conn.imap.end();
          } catch (error) {
            logger.warn('Error closing idle IMAP connection', {
              connectionId: id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        monitoring.decrementUpDownCounter('imap_active_connections');
      }
    });

    connectionsToRemove.forEach(id => {
      this.connectionPool.delete(id);
      logger.debug('Removed idle IMAP connection', { connectionId: id });
    });
  }

  /**
   * Process DLQ entries
   */
  private async processDlqEntries(): Promise<void> {
    const now = new Date();
    const retryableEntries = Array.from(this.dlq.values())
      .filter(entry => entry.nextRetryAt <= now && entry.attempts < entry.maxAttempts);

    for (const entry of retryableEntries) {
      try {
        monitoring.incrementCounter('dlq_retries_total', {
          type: entry.type,
          attempt: entry.attempts.toString()
        });

        await this.retryDlqEntry(entry);

        // Remove from DLQ on success
        this.dlq.delete(entry.id);
        monitoring.decrementUpDownCounter('dlq_pending_entries');
        monitoring.incrementCounter('dlq_successes_total', { type: entry.type });

        logger.info('Successfully processed DLQ entry', {
          entryId: entry.id,
          type: entry.type,
          attempts: entry.attempts
        });

      } catch (error) {
        entry.attempts++;
        entry.nextRetryAt = new Date(now.getTime() + this.calculateBackoffDelay(entry.attempts));

        logger.warn('DLQ entry retry failed', {
          entryId: entry.id,
          type: entry.type,
          attempts: entry.attempts,
          maxAttempts: entry.maxAttempts,
          error: error instanceof Error ? error.message : String(error)
        });

        if (entry.attempts >= entry.maxAttempts) {
          logger.error('DLQ entry exceeded max attempts, marking as expired', {
            entryId: entry.id,
            type: entry.type,
            attempts: entry.attempts
          });
        }
      }
    }
  }

  /**
   * Retry a DLQ entry
   */
  private async retryDlqEntry(entry: DLQEntry): Promise<void> {
    switch (entry.type) {
      case 'email_processing':
        await this.handleParsedEmail(entry.data.parsed, entry.data.seqno);
        break;
      case 'imap_connection':
        await this.connectToEmail(entry.data.config);
        break;
      case 'email_parsing':
        const parsed = await simpleParser(entry.data.buffer);
        await this.handleParsedEmail(parsed, entry.data.seqno);
        break;
      default:
        throw new Error(`Unknown DLQ entry type: ${entry.type}`);
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(attempts: number): number {
    const delay = this.baseRetryDelay * Math.pow(this.retryMultiplier, attempts - 1);
    return Math.min(delay, this.maxRetryDelay);
  }

  /**
   * Add entry to Dead Letter Queue
   */
  private addToDlq(type: DLQEntry['type'], data: any, error: string, originalJobId?: string): void {
    const id = `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const entry: DLQEntry = {
      id,
      type,
      data,
      error,
      timestamp: new Date(),
      attempts: 0,
      maxAttempts: this.maxDlqAttempts,
      nextRetryAt: new Date(Date.now() + this.baseRetryDelay),
      originalJobId
    };

    this.dlq.set(id, entry);
    monitoring.incrementUpDownCounter('dlq_pending_entries');
    monitoring.incrementCounter('dlq_entries_total', { type });

    logger.warn('Added entry to Dead Letter Queue', {
      entryId: id,
      type,
      error,
      originalJobId
    });
  }

  /**
   * Decrypt password (simplified - in production use proper encryption)
   */
  private decryptPassword(encryptedPassword: string): string {
    // This is a simplified decryption - in production, use proper encryption
    if (encryptedPassword.startsWith('encrypted:')) {
      return encryptedPassword.replace('encrypted:', '');
    }
    return encryptedPassword;
  }

  /**
   * Enhanced stop method with cleanup
   */
  async stopEnhanced(): Promise<void> {
    await this.stop();

    // Clean up intervals
    if (this.poolCleanupInterval) {
      clearInterval(this.poolCleanupInterval);
      this.poolCleanupInterval = null;
    }

    if (this.dlqProcessingInterval) {
      clearInterval(this.dlqProcessingInterval);
      this.dlqProcessingInterval = null;
    }

    // Close all pooled connections
    for (const [id, conn] of this.connectionPool.entries()) {
      if (conn.isConnected) {
        try {
          conn.imap.end();
        } catch (error) {
          logger.warn('Error closing pooled connection during shutdown', {
            connectionId: id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    this.connectionPool.clear();

    logger.info('Enhanced ADF Email Listener stopped with full cleanup');
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus() {
    return {
      isListening: this.isListening,
      connectionPool: this.getConnectionPoolStats(),
      dlq: this.getDlqStats(),
      uptime: Date.now() - this.startTime
    };
  }

  private startTime: number = Date.now();
}

// Export singleton instance
export const adfEmailListener = new AdfEmailListener();
