import { EventEmitter } from 'events';
import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';
import { twilioSMSService, SMSMessage } from './twilio-sms-service';
import { messageDeliveryService } from './message-delivery-service';
import { AdfLead } from '../../shared/adf-schema';
import { monitoringService } from './monitoring.ts';

// Constants
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const OPT_OUT_FOOTER = " Reply STOP to opt out.";
const DELIVERY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Metrics
const SMS_METRICS = {
  sentCount: 0,
  deliveredCount: 0,
  failedCount: 0,
  retryCount: 0,
  optOutCount: 0,
  avgDeliveryTimeMs: 0,
  totalDeliveryTimeMs: 0,
  lastDeliveryTimeMs: 0
};

export interface AdfSmsDeliveryEvent {
  leadId: number;
  messageSid: string;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
  retryCount?: number;
}

export interface AdfSmsResponse {
  leadId: number;
  dealershipId: number;
  phoneNumber: string;
  message: string;
  messageSid?: string;
  status: string;
  createdAt: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  retryCount: number;
  isOptOut: boolean;
}

/**
 * Service for sending SMS responses to ADF leads
 * Listens for lead.response.ready events and sends SMS via Twilio
 */
export class AdfSmsResponseSender extends EventEmitter {
  private retryTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private deliveryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;
  
  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Initialize the service and set up event listeners
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing ADF SMS Response Sender');
      
      // Register metrics with monitoring service
      monitoringService.registerMetric('adf_sms_sent_total', 'counter');
      monitoringService.registerMetric('adf_sms_delivered_total', 'counter');
      monitoringService.registerMetric('adf_sms_failed_total', 'counter');
      monitoringService.registerMetric('adf_sms_retry_total', 'counter');
      monitoringService.registerMetric('adf_sms_optout_total', 'counter');
      monitoringService.registerMetric('adf_sms_delivery_time_ms', 'histogram');
      
      // Schedule retry check for undelivered messages
      this.scheduleUndeliveredCheck();
      
      this.isInitialized = true;
      logger.info('ADF SMS Response Sender initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to initialize ADF SMS Response Sender', { error: err.message });
      throw err;
    }
  }

  /**
   * Set up event listeners for lead.response.ready events
   */
  private setupEventListeners(): void {
    // Listen for lead.response.ready events from the orchestrator
    this.on('lead.response.ready', this.handleLeadResponse.bind(this));
    
    // Listen for SMS delivery status updates
    this.on('sms.delivery.update', this.handleDeliveryUpdate.bind(this));
    
    // Listen for opt-out events
    this.on('sms.optout', this.handleOptOut.bind(this));
  }

  /**
   * Handle lead response ready event
   */
  private async handleLeadResponse(data: { 
    leadId: number;
    response: string;
    dealershipId: number;
    lead: AdfLead;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const { leadId, response, dealershipId, lead } = data;
      
      // Check if customer has a valid phone number
      const phoneNumber = this.extractPhoneNumber(lead);
      if (!phoneNumber) {
        logger.warn('No valid phone number found for lead', { leadId });
        this.emit('sms.send.failed', { 
          leadId, 
          error: 'No valid phone number found',
          dealershipId
        });
        return;
      }
      
      // Check if customer has opted out
      const isOptedOut = await twilioSMSService.checkOptOutStatus(dealershipId, phoneNumber);
      if (isOptedOut) {
        logger.info('Customer has opted out of SMS communications', { 
          leadId, 
          dealershipId,
          phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
        });
        
        await this.updateLeadSmsStatus(leadId, 'opted_out');
        this.emit('sms.optout.detected', { leadId, dealershipId, phoneNumber });
        return;
      }
      
      // Format message with opt-out footer
      const message = this.formatMessage(response, lead);
      
      // Send SMS
      await this.sendSms(leadId, dealershipId, phoneNumber, message);
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle lead response', { 
        error: err.message,
        leadId: data.leadId
      });
      
      // Update lead status
      await this.updateLeadSmsStatus(data.leadId, 'failed', err.message);
      
      // Emit failure event
      this.emit('sms.send.failed', { 
        leadId: data.leadId, 
        error: err.message,
        dealershipId: data.dealershipId
      });
    }
  }

  /**
   * Send SMS to lead
   */
  private async sendSms(
    leadId: number, 
    dealershipId: number, 
    phoneNumber: string, 
    message: string
  ): Promise<void> {
    try {
      logger.info('Sending SMS response to lead', { 
        leadId, 
        dealershipId,
        phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
      });
      
      // Prepare SMS message
      const smsMessage: SMSMessage = {
        dealershipId,
        toPhone: phoneNumber,
        message,
        metadata: {
          leadId,
          source: 'adf',
          isAdfResponse: true
        }
      };
      
      // Record attempt in database
      await this.recordSmsAttempt(leadId, dealershipId, phoneNumber, message);
      
      // Send SMS via Twilio service
      const result = await twilioSMSService.sendSMS(smsMessage);
      
      if (result.success && result.messageSid) {
        // Update metrics
        SMS_METRICS.sentCount++;
        monitoringService.incrementMetric('adf_sms_sent_total');
        
        // Update database with SID
        await this.updateSmsWithSid(leadId, result.messageSid);
        
        // Set delivery timeout
        this.setDeliveryTimeout(leadId, result.messageSid);
        
        logger.info('SMS sent successfully', { 
          leadId, 
          messageSid: result.messageSid,
          dealershipId
        });
        
        // Emit success event
        this.emit('sms.send.success', { 
          leadId, 
          messageSid: result.messageSid,
          dealershipId
        });
      } else {
        // Handle failure
        SMS_METRICS.failedCount++;
        monitoringService.incrementMetric('adf_sms_failed_total');
        
        logger.error('Failed to send SMS', { 
          error: result.error || 'Unknown error',
          leadId,
          dealershipId
        });
        
        // Update database
        await this.updateLeadSmsStatus(leadId, 'failed', result.error);
        
        // Schedule retry
        this.scheduleRetry(leadId);
        
        // Emit failure event
        this.emit('sms.send.failed', { 
          leadId, 
          error: result.error,
          dealershipId
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error in sendSms method', { 
        error: err.message,
        leadId
      });
      
      // Update database
      await this.updateLeadSmsStatus(leadId, 'failed', err.message);
      
      // Schedule retry
      this.scheduleRetry(leadId);
      
      throw err;
    }
  }

  /**
   * Handle delivery status update from webhook
   */
  public async handleDeliveryUpdate(event: AdfSmsDeliveryEvent): Promise<void> {
    try {
      const { leadId, messageSid, status, errorCode, errorMessage, timestamp } = event;
      
      logger.info('Received SMS delivery update', { 
        leadId, 
        messageSid, 
        status,
        timestamp: timestamp.toISOString()
      });
      
      // Update database with status
      await db.execute(sql`
        UPDATE adf_sms_responses
        SET 
          status = ${status},
          error_code = ${errorCode || null},
          error_message = ${errorMessage || null},
          updated_at = NOW(),
          ${status === 'delivered' ? sql`delivered_at = ${timestamp}` : sql`delivered_at = delivered_at`}
        WHERE 
          message_sid = ${messageSid}
      `);
      
      // Update lead status
      await this.updateLeadSmsStatus(leadId, status, errorMessage);
      
      // Handle specific statuses
      if (status === 'delivered') {
        // Clear delivery timeout
        this.clearDeliveryTimeout(messageSid);
        
        // Update metrics
        SMS_METRICS.deliveredCount++;
        monitoringService.incrementMetric('adf_sms_delivered_total');
        
        // Calculate delivery time
        const smsResponse = await this.getSmsResponseByMessageSid(messageSid);
        if (smsResponse && smsResponse.sentAt) {
          const deliveryTimeMs = timestamp.getTime() - smsResponse.sentAt.getTime();
          
          SMS_METRICS.lastDeliveryTimeMs = deliveryTimeMs;
          SMS_METRICS.totalDeliveryTimeMs += deliveryTimeMs;
          SMS_METRICS.avgDeliveryTimeMs = SMS_METRICS.totalDeliveryTimeMs / SMS_METRICS.deliveredCount;
          
          monitoringService.recordMetric('adf_sms_delivery_time_ms', deliveryTimeMs);
          
          logger.info('SMS delivered successfully', { 
            leadId, 
            messageSid,
            deliveryTimeMs
          });
        }
        
        // Emit delivered event
        this.emit('sms.delivered', { leadId, messageSid, timestamp });
      } else if (status === 'failed' || status === 'undelivered') {
        // Update metrics
        SMS_METRICS.failedCount++;
        monitoringService.incrementMetric('adf_sms_failed_total');
        
        // Schedule retry
        this.scheduleRetry(leadId);
        
        // Emit failed event
        this.emit('sms.delivery.failed', { 
          leadId, 
          messageSid, 
          errorCode, 
          errorMessage 
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle delivery update', { 
        error: err.message,
        messageSid: event.messageSid,
        leadId: event.leadId
      });
    }
  }

  /**
   * Handle opt-out request
   */
  public async handleOptOut(data: { 
    phoneNumber: string; 
    dealershipId: number;
    reason?: string;
  }): Promise<void> {
    try {
      const { phoneNumber, dealershipId, reason = 'user_request' } = data;
      
      // Process opt-out in Twilio service
      await twilioSMSService.handleOptOut(dealershipId, phoneNumber, reason);
      
      // Find leads associated with this phone number
      const leads = await this.findLeadsByPhoneNumber(phoneNumber, dealershipId);
      
      // Update all leads with opt-out status
      for (const lead of leads) {
        await this.updateLeadSmsStatus(lead.id, 'opted_out');
        
        logger.info('Lead marked as opted out', { 
          leadId: lead.id, 
          dealershipId,
          phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
        });
      }
      
      // Update metrics
      SMS_METRICS.optOutCount++;
      monitoringService.incrementMetric('adf_sms_optout_total');
      
      logger.info('Opt-out processed successfully', { 
        dealershipId,
        phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber),
        leadsUpdated: leads.length
      });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to handle opt-out', { 
        error: err.message,
        phoneNumber: twilioSMSService.maskPhoneNumber(data.phoneNumber),
        dealershipId: data.dealershipId
      });
    }
  }

  /**
   * Schedule retry for failed SMS
   */
  private scheduleRetry(leadId: number): void {
    // Clear existing timeout if any
    if (this.retryTimeouts.has(leadId)) {
      clearTimeout(this.retryTimeouts.get(leadId)!);
    }
    
    // Schedule new retry
    const timeout = setTimeout(async () => {
      try {
        // Get SMS response from database
        const smsResponse = await this.getSmsResponseByLeadId(leadId);
        if (!smsResponse) {
          logger.warn('No SMS response found for retry', { leadId });
          return;
        }
        
        // Check if already delivered or max retries reached
        if (smsResponse.status === 'delivered' || smsResponse.retryCount >= MAX_RETRIES) {
          logger.info('Skipping retry - already delivered or max retries reached', { 
            leadId, 
            status: smsResponse.status,
            retryCount: smsResponse.retryCount
          });
          return;
        }
        
        // Increment retry count
        const newRetryCount = smsResponse.retryCount + 1;
        await db.execute(sql`
          UPDATE adf_sms_responses
          SET retry_count = ${newRetryCount}, updated_at = NOW()
          WHERE lead_id = ${leadId}
        `);
        
        // Update metrics
        SMS_METRICS.retryCount++;
        monitoringService.incrementMetric('adf_sms_retry_total');
        
        logger.info('Retrying SMS send', { 
          leadId, 
          retryCount: newRetryCount,
          dealershipId: smsResponse.dealershipId
        });
        
        // Resend SMS
        await this.sendSms(
          leadId, 
          smsResponse.dealershipId, 
          smsResponse.phoneNumber, 
          smsResponse.message
        );
        
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to retry SMS send', { 
          error: err.message,
          leadId
        });
      } finally {
        // Remove from tracking map
        this.retryTimeouts.delete(leadId);
      }
    }, RETRY_DELAY_MS);
    
    // Store timeout reference
    this.retryTimeouts.set(leadId, timeout);
    
    logger.info('Scheduled SMS retry', { 
      leadId, 
      retryInMs: RETRY_DELAY_MS
    });
  }

  /**
   * Set delivery timeout to detect undelivered messages
   */
  private setDeliveryTimeout(leadId: number, messageSid: string): void {
    const timeout = setTimeout(async () => {
      try {
        // Check current status
        const smsResponse = await this.getSmsResponseByMessageSid(messageSid);
        if (!smsResponse) {
          logger.warn('No SMS response found for delivery timeout check', { 
            leadId, 
            messageSid 
          });
          return;
        }
        
        // If not delivered, mark as undelivered and schedule retry
        if (smsResponse.status !== 'delivered') {
          logger.warn('SMS delivery timeout reached', { 
            leadId, 
            messageSid,
            currentStatus: smsResponse.status
          });
          
          // Update status to undelivered
          await db.execute(sql`
            UPDATE adf_sms_responses
            SET status = 'undelivered', updated_at = NOW()
            WHERE message_sid = ${messageSid}
          `);
          
          // Update lead status
          await this.updateLeadSmsStatus(leadId, 'undelivered');
          
          // Schedule retry
          this.scheduleRetry(leadId);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Error in delivery timeout handler', { 
          error: err.message,
          leadId,
          messageSid
        });
      } finally {
        // Remove from tracking map
        this.deliveryTimeouts.delete(messageSid);
      }
    }, DELIVERY_TIMEOUT_MS);
    
    // Store timeout reference
    this.deliveryTimeouts.set(messageSid, timeout);
  }

  /**
   * Clear delivery timeout
   */
  private clearDeliveryTimeout(messageSid: string): void {
    if (this.deliveryTimeouts.has(messageSid)) {
      clearTimeout(this.deliveryTimeouts.get(messageSid)!);
      this.deliveryTimeouts.delete(messageSid);
    }
  }

  /**
   * Schedule check for undelivered messages (runs periodically)
   */
  private scheduleUndeliveredCheck(): void {
    // Run every 15 minutes
    setInterval(async () => {
      try {
        // Check if table exists first
        const tableExists = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'adf_sms_responses'
          );
        `);
        
        if (!tableExists.rows[0]?.exists) {
          logger.warn('adf_sms_responses table does not exist, skipping undelivered check');
          return;
        }

        // Find undelivered messages older than retry delay
        const retryDelayInterval = `${Math.floor(RETRY_DELAY_MS / 1000)} seconds`;
        const undeliveredMessages = await db.execute(sql`
          SELECT 
            lead_id, message_sid, dealership_id, phone_number, message, retry_count
          FROM adf_sms_responses
          WHERE 
            status IN ('failed', 'undelivered')
            AND retry_count < ${MAX_RETRIES}
            AND updated_at < NOW() - INTERVAL ${retryDelayInterval}
            AND created_at > NOW() - INTERVAL '24 hours'
          ORDER BY updated_at ASC
          LIMIT 50
        `);
        
        if (undeliveredMessages.rows && undeliveredMessages.rows.length > 0) {
          logger.info('Found undelivered messages to retry', { 
            count: undeliveredMessages.rows.length 
          });
          
          // Schedule retries
          for (const msg of undeliveredMessages.rows) {
            this.scheduleRetry(msg.lead_id);
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to check for undelivered messages', { 
          error: err.message,
          stack: err.stack 
        });
      }
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * Extract phone number from lead data
   */
  private extractPhoneNumber(lead: AdfLead): string | null {
    try {
      // Try to get phone from customer data
      if (lead.customer) {
        // Check for structured phone
        if (lead.customer.phone && typeof lead.customer.phone === 'object') {
          return lead.customer.phone.number || null;
        }
        
        // Check for string phone
        if (lead.customer.phone && typeof lead.customer.phone === 'string') {
          return lead.customer.phone;
        }
        
        // Check for mobile phone specifically
        if (lead.customer.phones) {
          const mobilePhone = lead.customer.phones.find(p => 
            p.type?.toLowerCase() === 'mobile' || 
            p.type?.toLowerCase() === 'cell'
          );
          
          if (mobilePhone) {
            return typeof mobilePhone.number === 'string' 
              ? mobilePhone.number 
              : null;
          }
          
          // If no mobile, use first available
          if (lead.customer.phones.length > 0 && lead.customer.phones[0].number) {
            return typeof lead.customer.phones[0].number === 'string'
              ? lead.customer.phones[0].number
              : null;
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error extracting phone number from lead', { 
        error: error instanceof Error ? error.message : String(error),
        leadId: lead.id
      });
      return null;
    }
  }

  /**
   * Format message with opt-out footer and customizations
   */
  private formatMessage(response: string, lead: AdfLead): string {
    try {
      // Get customer name for personalization
      let customerName = '';
      if (lead.customer && lead.customer.name) {
        if (typeof lead.customer.name === 'string') {
          customerName = lead.customer.name.split(' ')[0]; // First name only
        } else if (lead.customer.name.first) {
          customerName = lead.customer.name.first;
        }
      }
      
      // Trim response if too long (SMS limit is 160 chars, leave room for footer)
      const maxLength = 160 - OPT_OUT_FOOTER.length - 10; // 10 chars buffer
      let trimmedResponse = response;
      
      if (response.length > maxLength) {
        trimmedResponse = response.substring(0, maxLength - 3) + '...';
      }
      
      // Add personalization if name available
      let formattedMessage = customerName 
        ? `Hi ${customerName}, ${trimmedResponse}` 
        : trimmedResponse;
      
      // Add opt-out footer
      formattedMessage += OPT_OUT_FOOTER;
      
      return formattedMessage;
    } catch (error) {
      logger.error('Error formatting message', { 
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to original message with footer
      return `${response}${OPT_OUT_FOOTER}`;
    }
  }

  /**
   * Record SMS attempt in database
   */
  private async recordSmsAttempt(
    leadId: number, 
    dealershipId: number, 
    phoneNumber: string, 
    message: string
  ): Promise<void> {
    try {
      // Check if entry already exists
      const existing = await db.execute(sql`
        SELECT id FROM adf_sms_responses WHERE lead_id = ${leadId}
      `);
      
      if (existing.length > 0) {
        // Update existing record
        await db.execute(sql`
          UPDATE adf_sms_responses
          SET 
            message = ${message},
            status = 'pending',
            updated_at = NOW()
          WHERE lead_id = ${leadId}
        `);
      } else {
        // Create new record
        await db.execute(sql`
          INSERT INTO adf_sms_responses (
            lead_id, 
            dealership_id, 
            phone_number,
            phone_number_masked,
            message, 
            status, 
            retry_count,
            created_at,
            updated_at
          )
          VALUES (
            ${leadId},
            ${dealershipId},
            ${phoneNumber},
            ${twilioSMSService.maskPhoneNumber(phoneNumber)},
            ${message},
            'pending',
            0,
            NOW(),
            NOW()
          )
        `);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to record SMS attempt', { 
        error: err.message,
        leadId
      });
      throw err;
    }
  }

  /**
   * Update SMS record with Twilio SID
   */
  private async updateSmsWithSid(leadId: number, messageSid: string): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE adf_sms_responses
        SET 
          message_sid = ${messageSid},
          status = 'sent',
          sent_at = NOW(),
          updated_at = NOW()
        WHERE lead_id = ${leadId}
      `);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update SMS with SID', { 
        error: err.message,
        leadId,
        messageSid
      });
      throw err;
    }
  }

  /**
   * Update lead SMS status
   */
  private async updateLeadSmsStatus(
    leadId: number, 
    status: string, 
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE adf_leads
        SET 
          sms_status = ${status},
          sms_error = ${errorMessage || null},
          updated_at = NOW()
        WHERE id = ${leadId}
      `);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update lead SMS status', { 
        error: err.message,
        leadId,
        status
      });
    }
  }

  /**
   * Get SMS response by lead ID
   */
  private async getSmsResponseByLeadId(leadId: number): Promise<AdfSmsResponse | null> {
    try {
      const results = await db.execute(sql`
        SELECT 
          lead_id, dealership_id, phone_number, message, message_sid,
          status, created_at, sent_at, delivered_at, retry_count, is_opt_out
        FROM adf_sms_responses
        WHERE lead_id = ${leadId}
      `);
      
      if (results.length === 0) {
        return null;
      }
      
      return results[0] as AdfSmsResponse;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get SMS response by lead ID', { 
        error: err.message,
        leadId
      });
      return null;
    }
  }

  /**
   * Get SMS response by message SID
   */
  private async getSmsResponseByMessageSid(messageSid: string): Promise<AdfSmsResponse | null> {
    try {
      const results = await db.execute(sql`
        SELECT 
          lead_id, dealership_id, phone_number, message, message_sid,
          status, created_at, sent_at, delivered_at, retry_count, is_opt_out
        FROM adf_sms_responses
        WHERE message_sid = ${messageSid}
      `);
      
      if (results.length === 0) {
        return null;
      }
      
      return results[0] as AdfSmsResponse;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get SMS response by message SID', { 
        error: err.message,
        messageSid
      });
      return null;
    }
  }

  /**
   * Find leads by phone number
   */
  private async findLeadsByPhoneNumber(
    phoneNumber: string, 
    dealershipId: number
  ): Promise<{ id: number }[]> {
    try {
      // Normalize phone for matching
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const lastDigits = normalizedPhone.slice(-10);
      
      const results = await db.execute(sql`
        SELECT DISTINCT l.id
        FROM adf_leads l
        JOIN adf_customers c ON l.id = c.lead_id
        WHERE 
          l.dealership_id = ${dealershipId}
          AND (
            c.phone LIKE ${'%' + lastDigits}
            OR c.mobile_phone LIKE ${'%' + lastDigits}
            OR c.home_phone LIKE ${'%' + lastDigits}
            OR c.work_phone LIKE ${'%' + lastDigits}
          )
        ORDER BY l.created_at DESC
      `);
      
      return results as { id: number }[];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to find leads by phone number', { 
        error: err.message,
        phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber),
        dealershipId
      });
      return [];
    }
  }

  /**
   * Process Twilio webhook for SMS status updates
   * Called from webhook route
   */
  public async processWebhook(webhookData: any): Promise<void> {
    try {
      const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, To } = webhookData;
      
      // Find lead ID from message SID
      const smsResponse = await this.getSmsResponseByMessageSid(MessageSid);
      
      if (!smsResponse) {
        logger.warn('Received webhook for unknown message SID', { 
          messageSid: MessageSid, 
          status: MessageStatus 
        });
        return;
      }
      
      // Process delivery update
      await this.handleDeliveryUpdate({
        leadId: smsResponse.leadId,
        messageSid: MessageSid,
        status: MessageStatus as any,
        errorCode: ErrorCode,
        errorMessage: ErrorMessage,
        timestamp: new Date()
      });
      
      logger.info('Processed webhook for SMS status update', { 
        messageSid: MessageSid, 
        status: MessageStatus,
        leadId: smsResponse.leadId
      });
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to process webhook', { 
        error: err.message,
        webhookData
      });
    }
  }

  /**
   * Process inbound SMS for opt-out requests
   * Called from webhook route
   */
  public async processInboundSms(webhookData: any): Promise<void> {
    try {
      const { Body, From, To } = webhookData;
      
      // Check for opt-out keywords
      const body = Body.toLowerCase().trim();
      const optOutKeywords = ['stop', 'stopall', 'unsubscribe', 'quit', 'cancel', 'end'];
      
      if (optOutKeywords.some(keyword => body === keyword)) {
        // Find dealership ID from the "To" number
        const dealershipId = await this.findDealershipByPhoneNumber(To);
        
        if (dealershipId) {
          // Handle opt-out
          await this.handleOptOut({
            phoneNumber: From,
            dealershipId,
            reason: 'user_request'
          });
          
          logger.info('Processed opt-out from inbound SMS', { 
            from: twilioSMSService.maskPhoneNumber(From),
            to: To,
            dealershipId
          });
        } else {
          logger.warn('Could not determine dealership for opt-out request', { 
            from: twilioSMSService.maskPhoneNumber(From),
            to: To
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to process inbound SMS', { 
        error: err.message,
        webhookData
      });
    }
  }

  /**
   * Find dealership by phone number
   */
  private async findDealershipByPhoneNumber(phoneNumber: string): Promise<number | null> {
    try {
      // Normalize phone for matching
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      
      const results = await db.execute(sql`
        SELECT dealership_id
        FROM dealership_phone_numbers
        WHERE phone_number LIKE ${'%' + normalizedPhone.slice(-10)}
        LIMIT 1
      `);
      
      if (results.length === 0) {
        return 1; // Default dealership as fallback
      }
      
      return results[0].dealership_id;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to find dealership by phone number', { 
        error: err.message,
        phoneNumber
      });
      return 1; // Default dealership as fallback
    }
  }

  /**
   * Get metrics for monitoring
   */
  public getMetrics(): typeof SMS_METRICS {
    return { ...SMS_METRICS };
  }

  /**
   * Test method to send SMS to a test lead
   * For development and testing only
   */
  public async testSendSms(
    phoneNumber: string, 
    message: string, 
    dealershipId: number = 1
  ): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    try {
      // Create test lead
      const leadId = await this.createTestLead(dealershipId, phoneNumber);
      
      // Format message with opt-out footer
      const formattedMessage = message + OPT_OUT_FOOTER;
      
      // Record attempt
      await this.recordSmsAttempt(leadId, dealershipId, phoneNumber, formattedMessage);
      
      // Send SMS
      const result = await twilioSMSService.sendSMS({
        dealershipId,
        toPhone: phoneNumber,
        message: formattedMessage,
        metadata: {
          leadId,
          isTest: true
        }
      });
      
      if (result.success && result.messageSid) {
        // Update with SID
        await this.updateSmsWithSid(leadId, result.messageSid);
        
        logger.info('Test SMS sent successfully', { 
          leadId, 
          messageSid: result.messageSid,
          phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
        });
        
        return { 
          success: true, 
          messageSid: result.messageSid 
        };
      } else {
        logger.error('Failed to send test SMS', { 
          error: result.error,
          phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
        });
        
        return { 
          success: false, 
          error: result.error 
        };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error in testSendSms', { 
        error: err.message,
        phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
      });
      
      return { 
        success: false, 
        error: err.message 
      };
    }
  }

  /**
   * Create a test lead for SMS testing
   */
  private async createTestLead(
    dealershipId: number, 
    phoneNumber: string
  ): Promise<number> {
    try {
      // Check if test lead already exists for this phone number
      const existingLeads = await this.findLeadsByPhoneNumber(phoneNumber, dealershipId);
      
      if (existingLeads.length > 0) {
        return existingLeads[0].id;
      }
      
      // Create new test lead
      const results = await db.execute(sql`
        INSERT INTO adf_leads (
          dealership_id, 
          provider, 
          request_date, 
          lead_type,
          status,
          is_test,
          created_at,
          updated_at
        )
        VALUES (
          ${dealershipId},
          'test',
          NOW(),
          'test',
          'new',
          true,
          NOW(),
          NOW()
        )
        RETURNING id
      `);
      
      const leadId = results[0].id;
      
      // Create customer record with phone
      await db.execute(sql`
        INSERT INTO adf_customers (
          lead_id,
          name,
          phone,
          email,
          created_at,
          updated_at
        )
        VALUES (
          ${leadId},
          'Test Customer',
          ${phoneNumber},
          'test@example.com',
          NOW(),
          NOW()
        )
      `);
      
      return leadId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create test lead', { 
        error: err.message,
        dealershipId,
        phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber)
      });
      throw err;
    }
  }
}

// Export singleton instance
export const adfSmsResponseSender = new AdfSmsResponseSender();
