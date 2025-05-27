import { EventEmitter } from 'events';
import { AdfEmailListener, type EmailListenerConfig } from './adf-email-listener';
import { AdfLeadProcessor } from './adf-lead-processor';
import { AdfParser } from './adf-parser';
import logger from '../utils/logger';
import db from '../db';
import { eq, desc, and, gte } from 'drizzle-orm';
import { adfLeads, adfEmailQueue, adfProcessingLogs } from '@shared/adf-schema';

export interface AdfServiceConfig {
  email: EmailListenerConfig;
  notifications: {
    onLeadProcessed?: (leadId: number) => void;
    onProcessingError?: (error: string, context: any) => void;
    onDuplicateDetected?: (leadId: number, duplicateHash: string) => void;
  };
}

export class AdfService extends EventEmitter {
  private emailListener: AdfEmailListener;
  private leadProcessor: AdfLeadProcessor;
  private adfParser: AdfParser;
  private config: AdfServiceConfig;
  private isInitialized: boolean = false;

  constructor(config: AdfServiceConfig) {
    super();
    this.config = config;
    this.emailListener = new AdfEmailListener(config.email);
    this.leadProcessor = new AdfLeadProcessor();
    this.adfParser = new AdfParser();

    this.setupEventHandlers();
  }

  /**
   * Initialize the ADF service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('ADF Service is already initialized');
      return;
    }

    try {
      logger.info('Initializing ADF Service');

      // Start email listener
      await this.emailListener.start();

      this.isInitialized = true;
      logger.info('ADF Service initialized successfully');

      this.emit('initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize ADF Service', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Shutdown the ADF service
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Shutting down ADF Service');

      await this.emailListener.stop();

      this.isInitialized = false;
      logger.info('ADF Service shut down successfully');

      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during ADF Service shutdown', { error });
    }
  }

  /**
   * Setup event handlers for email listener
   */
  private setupEventHandlers(): void {
    this.emailListener.on('leadProcessed', (processedEmail) => {
      logger.info('Lead processed via email listener', {
        messageId: processedEmail.messageId,
        leadId: processedEmail.processingResult?.leadId
      });

      if (processedEmail.processingResult?.leadId && this.config.notifications.onLeadProcessed) {
        this.config.notifications.onLeadProcessed(processedEmail.processingResult.leadId);
      }

      this.emit('leadProcessed', processedEmail);
    });

    this.emailListener.on('processingError', (processedEmail) => {
      logger.error('Error processing email via listener', {
        messageId: processedEmail.messageId,
        errors: processedEmail.processingResult?.errors
      });

      if (this.config.notifications.onProcessingError) {
        this.config.notifications.onProcessingError(
          processedEmail.processingResult?.errors?.join(', ') || 'Unknown error',
          { messageId: processedEmail.messageId }
        );
      }

      this.emit('processingError', processedEmail);
    });

    this.emailListener.on('noAdfContent', (processedEmail) => {
      logger.debug('No ADF content found in email', {
        messageId: processedEmail.messageId,
        subject: processedEmail.subject
      });

      this.emit('noAdfContent', processedEmail);
    });

    this.emailListener.on('connected', () => {
      logger.info('Email listener connected');
      this.emit('emailConnected');
    });

    this.emailListener.on('disconnected', () => {
      logger.warn('Email listener disconnected');
      this.emit('emailDisconnected');
    });

    this.emailListener.on('error', (error) => {
      logger.error('Email listener error', { error: error.message });
      this.emit('emailError', error);
    });
  }

  /**
   * Manually process ADF XML content (for testing or manual import)
   */
  async processAdfXml(xmlContent: string, metadata?: {
    source?: string;
    emailFrom?: string;
    subject?: string;
  }): Promise<{
    success: boolean;
    leadId?: number;
    errors: string[];
    warnings: string[];
  }> {
    try {
      // Parse the XML
      const parseResult = await this.adfParser.parseAdfXml(xmlContent);
      
      if (!parseResult.success || !parseResult.mappedLead) {
        return {
          success: false,
          errors: parseResult.errors,
          warnings: parseResult.warnings
        };
      }

      // Add metadata if provided
      if (metadata) {
        if (metadata.emailFrom) parseResult.mappedLead.sourceEmailFrom = metadata.emailFrom;
        if (metadata.subject) parseResult.mappedLead.sourceEmailSubject = metadata.subject;
        if (metadata.source) parseResult.mappedLead.sourceEmailId = `manual-${Date.now()}-${metadata.source}`;
      }

      // Check for duplicates
      const duplicateCheck = await this.leadProcessor.checkForDuplicates(parseResult.mappedLead);
      
      if (duplicateCheck.isDuplicate) {
        return {
          success: true,
          leadId: duplicateCheck.existingLeadId,
          errors: [],
          warnings: [`Duplicate lead detected. Existing lead ID: ${duplicateCheck.existingLeadId}`]
        };
      }

      // Store the lead
      const leadId = await this.leadProcessor.storeLead(parseResult.mappedLead);

      logger.info('Manual ADF processing completed', {
        leadId,
        customerName: parseResult.mappedLead.customerFullName,
        source: metadata?.source || 'manual'
      });

      return {
        success: true,
        leadId,
        errors: [],
        warnings: parseResult.warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error in manual ADF processing', { error: errorMessage });
      
      return {
        success: false,
        errors: [errorMessage],
        warnings: []
      };
    }
  }

  /**
   * Get recent leads with optional filtering
   */
  async getRecentLeads(options: {
    limit?: number;
    dealershipId?: number;
    status?: string;
    since?: Date;
  } = {}): Promise<any[]> {
    const { limit = 50, dealershipId, status, since } = options;

    let whereConditions = [];
    
    if (dealershipId) {
      whereConditions.push(eq(adfLeads.dealershipId, dealershipId));
    }
    
    if (status) {
      whereConditions.push(eq(adfLeads.leadStatus, status as any));
    }
    
    if (since) {
      whereConditions.push(gte(adfLeads.createdAt, since));
    }

    const leads = await db.query.adfLeads.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(adfLeads.createdAt)],
      limit,
      with: {
        dealership: {
          columns: { id: true, name: true }
        },
        processingLogs: {
          orderBy: [desc(adfProcessingLogs.createdAt)],
          limit: 5
        }
      }
    });

    return leads;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    totalLeads: number;
    processedLeads: number;
    failedLeads: number;
    duplicateLeads: number;
    emailsInQueue: number;
    averageProcessingTime: number;
    topDealerships: Array<{ dealershipId: number; name: string; count: number }>;
    recentErrors: string[];
  }> {
    const now = new Date();
    let startDate = new Date();

    switch (timeframe) {
      case 'hour':
        startDate.setHours(now.getHours() - 1);
        break;
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
    }

    // Get total leads in timeframe
    const totalLeads = await db.select({ count: db.count() })
      .from(adfLeads)
      .where(gte(adfLeads.createdAt, startDate));

    // Get processed leads
    const processedLeads = await db.select({ count: db.count() })
      .from(adfLeads)
      .where(and(
        eq(adfLeads.processingStatus, 'processed'),
        gte(adfLeads.createdAt, startDate)
      ));

    // Get failed leads
    const failedLeads = await db.select({ count: db.count() })
      .from(adfLeads)
      .where(and(
        eq(adfLeads.processingStatus, 'failed'),
        gte(adfLeads.createdAt, startDate)
      ));

    // Get emails in queue
    const emailsInQueue = await db.select({ count: db.count() })
      .from(adfEmailQueue)
      .where(eq(adfEmailQueue.processingStatus, 'pending'));

    // Get recent errors (simplified)
    const errorLogs = await db.query.adfProcessingLogs.findMany({
      where: and(
        eq(adfProcessingLogs.status, 'error'),
        gte(adfProcessingLogs.createdAt, startDate)
      ),
      orderBy: [desc(adfProcessingLogs.createdAt)],
      limit: 10,
      columns: { message: true }
    });

    return {
      totalLeads: totalLeads[0]?.count || 0,
      processedLeads: processedLeads[0]?.count || 0,
      failedLeads: failedLeads[0]?.count || 0,
      duplicateLeads: 0, // Would need additional query
      emailsInQueue: emailsInQueue[0]?.count || 0,
      averageProcessingTime: 0, // Would need additional calculation
      topDealerships: [], // Would need additional query
      recentErrors: errorLogs.map(log => log.message).filter(Boolean) as string[]
    };
  }

  /**
   * Get service status
   */
  getStatus(): {
    isInitialized: boolean;
    emailListenerStatus: any;
    lastProcessedLead?: Date;
    totalLeadsProcessed: number;
  } {
    return {
      isInitialized: this.isInitialized,
      emailListenerStatus: this.emailListener.getStatus(),
      lastProcessedLead: undefined, // Would need to query database
      totalLeadsProcessed: 0 // Would need to query database
    };
  }

  /**
   * Retry failed email processing
   */
  async retryFailedProcessing(queueId: number): Promise<any> {
    return this.leadProcessor.retryFailedProcessing(queueId);
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: number, status: string, notes?: string): Promise<void> {
    await db.update(adfLeads)
      .set({ 
        leadStatus: status as any,
        updatedAt: new Date()
      })
      .where(eq(adfLeads.id, leadId));

    // Log the status change
    if (notes) {
      await db.insert(adfProcessingLogs).values({
        adfLeadId: leadId,
        processStep: 'status_update',
        status: 'success',
        message: `Status updated to: ${status}`,
        errorDetails: { notes }
      });
    }

    logger.info('Lead status updated', { leadId, status, notes });
  }
}

export default AdfService;