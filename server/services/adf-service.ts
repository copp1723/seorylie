import { EventEmitter } from 'events';
import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';
import { adfEmailListener } from './adf-email-listener';
import { adfLeadProcessor } from './adf-lead-processor';
import { adfResponseOrchestrator } from './adf-response-orchestrator';
import { adfSmsResponseSender } from './adf-sms-response-sender';
import { twilioSMSService } from './twilio-sms-service';
import { dlqService } from './dead-letter-queue';

export interface AdfServiceConfig {
  enabled?: boolean;
  emailPollingEnabled?: boolean;
  emailPollingInterval?: number;
  maxConcurrentProcessing?: number;
}

export class AdfService extends EventEmitter {
  private isListening: boolean = false;
  private processingStats = {
    emailsReceived: 0,
    leadsProcessed: 0,
    duplicatesSkipped: 0,
    processingErrors: 0,
    lastEmailReceived: null as Date | null,
    lastLeadProcessed: null as Date | null,
    lastError: null as Error | null,
    startTime: new Date(),
    aiResponses: {
      generated: 0,
      failed: 0,
      avgLatency: 0
    }
  };

  constructor(private config: AdfServiceConfig = {}) {
    super();
    
    // Default configuration
    this.config = {
      enabled: process.env.ADF_ENABLED === 'true',
      emailPollingEnabled: process.env.ADF_EMAIL_POLLING_ENABLED === 'true',
      emailPollingInterval: parseInt(process.env.ADF_EMAIL_POLLING_INTERVAL || '300000', 10),
      maxConcurrentProcessing: parseInt(process.env.ADF_MAX_CONCURRENT_PROCESSING || '5', 10),
      ...config
    };
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup orchestrator integration
    this.setupOrchestratorIntegration();
    
    // Setup DLQ retry handlers
    this.setupDlqRetryHandlers();
    
    // Initialize SMS response sender
    adfSmsResponseSender.initialize().catch(error => {
      logger.error('Failed to initialize ADF SMS Response Sender', error);
    });
    
    logger.info('ADF Service initialized', {
      enabled: this.config.enabled,
      emailPollingEnabled: this.config.emailPollingEnabled,
      emailPollingInterval: this.config.emailPollingInterval
    });
  }
  
  /**
   * Start the ADF service
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('ADF Service is disabled, not starting');
      return;
    }
    
    try {
      logger.info('Starting ADF Service');
      
      // Start email listener if enabled
      if (this.config.emailPollingEnabled) {
        await adfEmailListener.start();
        this.isListening = true;
        logger.info('ADF Email Listener started successfully');
      } else {
        logger.info('ADF Email Polling is disabled');
      }
      
      this.emit('started');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to start ADF Service', { error: err.message });
      this.lastError = err;
      this.emit('error', err);
      throw err;
    }
  }
  
  /**
   * Stop the ADF service
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping ADF Service');
      
      // Stop email listener if it was started
      if (this.isListening) {
        await adfEmailListener.stop();
        this.isListening = false;
        logger.info('ADF Email Listener stopped successfully');
      }
      
      this.emit('stopped');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to stop ADF Service', { error: err.message });
      this.lastError = err;
      this.emit('error', err);
      throw err;
    }
  }
  
  /**
   * Process a raw ADF XML string
   */
  async processAdfXml(xml: string, source: string = 'manual'): Promise<any> {
    try {
      logger.info('Processing ADF XML', { source, xmlLength: xml.length });
      
      const result = await adfLeadProcessor.processAdfXml(xml, source);
      
      if (result.success) {
        this.processingStats.leadsProcessed++;
        this.processingStats.lastLeadProcessed = new Date();
        
        if (result.isDuplicate) {
          this.processingStats.duplicatesSkipped++;
          logger.info('Duplicate ADF lead detected', { leadId: result.leadId, source });
        } else {
          logger.info('ADF lead processed successfully', { leadId: result.leadId, source });
          this.emit('leadProcessed', { leadId: result.leadId, source });
        }
      } else {
        this.processingStats.processingErrors++;
        this.lastError = new Error(result.error || 'Unknown processing error');
        logger.error('Failed to process ADF XML', { error: result.error, source });
        
        // Add to DLQ for retry
        dlqService.addEntry('adf_xml_processing', {
          xml,
          source,
          xmlLength: xml.length
        }, result.error || 'Unknown processing error', {
          priority: 'high',
          metadata: { source, xmlLength: xml.length }
        });
      }
      
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.processingStats.processingErrors++;
      this.lastError = err;
      logger.error('Error in processAdfXml', { error: err.message, source });
      throw err;
    }
  }
  
  /**
   * Get processing statistics
   */
  getProcessingStats(): any {
    return {
      ...this.processingStats,
      uptime: Date.now() - this.processingStats.startTime.getTime(),
      isListening: this.isListening,
      config: this.config,
      smsMetrics: adfSmsResponseSender.getMetrics(),
    };
  }
  
  /**
   * Setup event listeners for email and lead processing
   */
  private setupEventListeners(): void {
    // Listen for new emails
    adfEmailListener.on('email', async (email) => {
      try {
        this.processingStats.emailsReceived++;
        this.processingStats.lastEmailReceived = new Date();
        
        logger.info('ADF email received', { 
          subject: email.subject,
          from: email.from,
          date: email.date
        });
        
        // Check if email has ADF XML attachment
        const adfAttachment = email.attachments.find(att => 
          att.filename.toLowerCase().endsWith('.xml') || 
          att.contentType.includes('application/xml') ||
          att.contentType.includes('text/xml')
        );
        
        if (adfAttachment && adfAttachment.content) {
          // Process the XML
          const xml = adfAttachment.content.toString('utf8');
          await this.processAdfXml(xml, 'email');
        } else {
          logger.warn('No ADF XML attachment found in email', { 
            subject: email.subject,
            attachments: email.attachments.map(a => a.filename).join(', ')
          });
        }
        
        this.emit('emailProcessed', { emailId: email.id });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.processingStats.processingErrors++;
        this.lastError = err;
        logger.error('Failed to process ADF email', { error: err.message });
        
        // Add to DLQ for retry
        dlqService.addEntry('adf_email_processing', {
          email,
          originalJobId: `email_${email.id}`
        }, err.message, {
          priority: 'high',
          metadata: { emailSubject: email.subject, emailFrom: email.from }
        });
        
        this.emit('error', err);
      }
    });
    
    // Listen for email listener errors
    adfEmailListener.on('error', (error) => {
      this.processingStats.processingErrors++;
      this.lastError = error;
      logger.error('ADF Email Listener error', { error: error.message });
      
      // Add to DLQ for retry
      dlqService.addEntry('adf_email_listener_error', {
        errorType: 'listener_error',
        timestamp: new Date()
      }, error.message, {
        priority: 'critical',
        metadata: { errorName: error.name }
      });
      
      this.emit('error', error);
    });
    
    // Listen for connection events
    adfEmailListener.on('connected', () => {
      logger.info('ADF Email Listener connected');
      this.emit('emailListenerConnected');
    });
    
    adfEmailListener.on('disconnected', () => {
      logger.warn('ADF Email Listener disconnected');
      this.emit('emailListenerDisconnected');
    });
  }
  
  /**
   * Setup integration with the ADF Response Orchestrator
   */
  private setupOrchestratorIntegration(): void {
    // Forward lead processed events to orchestrator
    this.on('leadProcessed', async (data) => {
      try {
        await adfResponseOrchestrator.processLead(data.leadId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to forward lead to orchestrator', { 
          error: err.message,
          leadId: data.leadId
        });
        
        // Add to DLQ for retry
        dlqService.addEntry('adf_orchestrator_processing', {
          leadId: data.leadId,
          source: data.source
        }, err.message, {
          priority: 'high',
          metadata: { leadId: data.leadId, source: data.source }
        });
      }
    });
    
    // Listen for AI response events
    adfResponseOrchestrator.on('aiResponseGenerated', (result) => {
      this.processingStats.aiResponses.generated++;
      this.processingStats.aiResponses.avgLatency = 
        (this.processingStats.aiResponses.avgLatency * (this.processingStats.aiResponses.generated - 1) + 
         result.latencyMs) / this.processingStats.aiResponses.generated;
      
      logger.info('AI response generated', { 
        leadId: result.leadId, 
        latencyMs: result.latencyMs 
      });
      
      // Forward the event
      this.emit('aiResponseGenerated', result);
    });
    
    adfResponseOrchestrator.on('aiResponseFailed', (result) => {
      this.processingStats.aiResponses.failed++;
      logger.error('AI response generation failed', { 
        leadId: result.leadId, 
        error: result.error 
      });
      
      // Add to DLQ for retry
      dlqService.addEntry('adf_ai_response_failed', {
        leadId: result.leadId,
        latencyMs: result.latencyMs
      }, result.error, {
        priority: 'medium',
        metadata: { leadId: result.leadId }
      });
      
      // Forward the event
      this.emit('aiResponseFailed', result);
    });
    
    // Setup SMS response sender integration  
    this.on('lead.response.ready', async (result) => {
      try {
        // Get lead data for SMS delivery
        const leadData = await this.getLeadData(result.leadId);
        if (!leadData) {
          logger.warn('No lead data found for SMS delivery', { leadId: result.leadId });
          return;
        }
        
        // Emit to SMS response sender
        adfSmsResponseSender.emit('lead.response.ready', {
          leadId: result.leadId,
          response: result.responseText,
          dealershipId: leadData.dealershipId,
          lead: leadData,
          metadata: result.metadata
        });
        
        logger.info('Lead response forwarded to SMS sender', {
          leadId: result.leadId,
          dealershipId: leadData.dealershipId
        });
        
      } catch (error) {
        logger.error('Failed to forward lead response to SMS sender', {
          leadId: result.leadId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
    
    // Listen for SMS delivery events
    adfSmsResponseSender.on('sms.send.success', (event) => {
      logger.info('ADF SMS sent successfully', event);
      this.emit('adf.sms.sent', event);
    });
    
    adfSmsResponseSender.on('sms.delivered', (event) => {
      logger.info('ADF SMS delivered successfully', event);
      this.emit('adf.sms.delivered', event);
    });
    
    adfSmsResponseSender.on('sms.send.failed', (event) => {
      logger.warn('ADF SMS send failed', event);
      this.emit('adf.sms.failed', event);
    });
  }
  
  /**
   * Get lead data by ID for SMS delivery
   */
  private async getLeadData(leadId: number): Promise<any | null> {
    try {
      const results = await db.execute(sql`
        SELECT 
          l.id,
          l.dealership_id,
          l.provider,
          l.request_date,
          l.lead_type,
          l.status,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          v.make as vehicle_make,
          v.model as vehicle_model,
          v.year as vehicle_year
        FROM adf_leads l
        LEFT JOIN adf_customers c ON l.id = c.lead_id
        LEFT JOIN adf_vehicles v ON l.id = v.lead_id
        WHERE l.id = ${leadId}
      `);
      
      if (results.length === 0) {
        return null;
      }
      
      const lead = results[0];
      
      // Transform to expected format
      return {
        id: lead.id,
        dealershipId: lead.dealership_id,
        provider: lead.provider,
        requestDate: lead.request_date,
        leadType: lead.lead_type,
        status: lead.status,
        customer: {
          name: lead.customer_name,
          phone: lead.customer_phone,
          email: lead.customer_email
        },
        vehicle: {
          make: lead.vehicle_make,
          model: lead.vehicle_model,
          year: lead.vehicle_year
        }
      };
    } catch (error) {
      logger.error('Failed to get lead data', {
        error: error instanceof Error ? error.message : String(error),
        leadId
      });
      return null;
    }
  }
  
  /**
   * Test SMS response sending
   */
  async testSmsResponse(phoneNumber: string, message: string, dealershipId: number = 1): Promise<any> {
    try {
      logger.info('Testing SMS response', { phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber) });
      return await adfSmsResponseSender.testSendSms(phoneNumber, message, dealershipId);
    } catch (error) {
      logger.error('Failed to test SMS response', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Setup Dead Letter Queue retry handlers for ADF operations
   */
  private setupDlqRetryHandlers(): void {
    // XML processing retry handler
    dlqService.registerRetryHandler('adf_xml_processing', async (entry) => {
      const { xml, source } = entry.data;
      logger.info('Retrying ADF XML processing from DLQ', { 
        entryId: entry.id, 
        source,
        xmlLength: xml.length
      });
      
      const result = await adfLeadProcessor.processAdfXml(xml, `${source}-retry`);
      if (!result.success) {
        throw new Error(result.error || 'XML processing failed during retry');
      }
    });

    // Email processing retry handler
    dlqService.registerRetryHandler('adf_email_processing', async (entry) => {
      const { email } = entry.data;
      logger.info('Retrying ADF email processing from DLQ', { 
        entryId: entry.id, 
        emailSubject: email.subject 
      });
      
      // Find ADF XML attachment
      const adfAttachment = email.attachments.find((att: any) => 
        att.filename.toLowerCase().endsWith('.xml') || 
        att.contentType.includes('application/xml') ||
        att.contentType.includes('text/xml')
      );
      
      if (adfAttachment && adfAttachment.content) {
        const xml = adfAttachment.content.toString('utf8');
        await this.processAdfXml(xml, 'email-retry');
      } else {
        throw new Error('No ADF XML attachment found during retry');
      }
    });

    // Orchestrator processing retry handler
    dlqService.registerRetryHandler('adf_orchestrator_processing', async (entry) => {
      const { leadId, source } = entry.data;
      logger.info('Retrying ADF orchestrator processing from DLQ', { 
        entryId: entry.id, 
        leadId 
      });
      
      await adfResponseOrchestrator.processLead(leadId);
    });

    // AI response failure retry handler
    dlqService.registerRetryHandler('adf_ai_response_failed', async (entry) => {
      const { leadId } = entry.data;
      logger.info('Retrying AI response generation from DLQ', { 
        entryId: entry.id, 
        leadId 
      });
      
      await adfResponseOrchestrator.processLead(leadId);
    });

    // Email listener error retry handler
    dlqService.registerRetryHandler('adf_email_listener_error', async (entry) => {
      logger.info('Retrying email listener connection from DLQ', { 
        entryId: entry.id 
      });
      
      if (!this.isListening && this.config.emailPollingEnabled) {
        await adfEmailListener.start();
        this.isListening = true;
      }
    });

    logger.info('ADF DLQ retry handlers registered');
  }
}

// Export singleton instance
export const adfService = new AdfService();
