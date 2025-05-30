import { EventEmitter } from 'events';
import logger from '../utils/logger';
import { db } from '../db';
import { adfLeads } from '@shared/adf-schema';
import { eq } from 'drizzle-orm';
import { EmailService } from './email-service';
import { prometheusMetrics } from './prometheus-metrics';

export interface HandoverOptions {
  emailService?: EmailService;
  notificationEmails?: string[];
  defaultSubject?: string;
  defaultTemplate?: string;
  enableSms?: boolean;
}

export interface HandoverData {
  leadId: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  dealershipId: number;
  dealershipName?: string;
  sourceProvider?: string;
  vehicleInfo?: string;
  comments?: string;
  reason: HandoverReason;
  escalationLevel?: 'normal' | 'urgent' | 'critical';
  additionalData?: Record<string, any>;
}

export type HandoverReason = 
  | 'explicit_request' 
  | 'complex_question' 
  | 'pricing_negotiation' 
  | 'financing_request'
  | 'test_drive_request'
  | 'trade_in_appraisal'
  | 'negative_sentiment'
  | 'high_value_opportunity'
  | 'multiple_failed_responses'
  | 'scheduled_followup'
  | 'manual_trigger'
  | 'other';

export interface HandoverResult {
  success: boolean;
  handoverId?: string;
  notificationSent?: boolean;
  errors?: string[];
  recipientEmails?: string[];
}

/**
 * Handover Service - Manages lead handovers to human agents
 */
export class HandoverService extends EventEmitter {
  private emailService: EmailService;
  private notificationEmails: string[];
  private defaultSubject: string;
  private defaultTemplate: string;
  private enableSms: boolean;
  
  constructor(options: HandoverOptions = {}) {
    super();
    
    this.emailService = options.emailService || new EmailService();
    this.notificationEmails = options.notificationEmails || [];
    this.defaultSubject = options.defaultSubject || 'Lead Handover Notification';
    this.defaultTemplate = options.defaultTemplate || 'default-handover';
    this.enableSms = options.enableSms || false;
    
    logger.info('Handover Service initialized', {
      notificationEmailsConfigured: this.notificationEmails.length > 0,
      enableSms: this.enableSms
    });
  }
  
  /**
   * Trigger a lead handover
   */
  async triggerHandover(data: HandoverData): Promise<HandoverResult> {
    const startTime = Date.now();
    const handoverId = `ho_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    logger.info('Handover triggered', {
      handoverId,
      leadId: data.leadId,
      customerName: data.customerName,
      reason: data.reason,
      dealershipId: data.dealershipId
    });
    
    try {
      // Record handover initiation in metrics
      prometheusMetrics.incrementHandoverTriggers({
        dealership_id: data.dealershipId,
        source_provider: data.sourceProvider || 'unknown',
        reason: data.reason,
        status: 'initiated'
      });
      
      // Update lead status in database
      await this.updateLeadStatus(data.leadId, 'handover_initiated');
      
      // Emit handover event
      this.emit('handover:initiated', {
        handoverId,
        leadId: data.leadId,
        reason: data.reason,
        timestamp: new Date()
      });
      
      // Get recipient emails (fallback to default if none configured for dealership)
      const recipientEmails = await this.getRecipientEmails(data.dealershipId);
      
      if (recipientEmails.length === 0) {
        const error = 'No recipient emails configured for handover';
        logger.warn(error, { handoverId, dealershipId: data.dealershipId });
        
        // Record failed handover in metrics
        prometheusMetrics.incrementHandoverTriggers({
          dealership_id: data.dealershipId,
          source_provider: data.sourceProvider || 'unknown',
          reason: data.reason,
          status: 'failed'
        });
        
        return {
          success: false,
          handoverId,
          errors: [error]
        };
      }
      
      // Send handover notification
      const notificationResult = await this.sendHandoverNotification(handoverId, data, recipientEmails);
      
      if (!notificationResult.success) {
        // Record failed handover in metrics
        prometheusMetrics.incrementHandoverTriggers({
          dealership_id: data.dealershipId,
          source_provider: data.sourceProvider || 'unknown',
          reason: data.reason,
          status: 'failed'
        });
        
        return {
          success: false,
          handoverId,
          notificationSent: false,
          errors: notificationResult.errors
        };
      }
      
      // Send SMS notification if enabled and phone number available
      if (this.enableSms && data.customerPhone) {
        await this.sendSmsNotification(data);
      }
      
      // Update lead status to handover_completed
      await this.updateLeadStatus(data.leadId, 'handover_completed');
      
      // Record successful handover completion in metrics
      prometheusMetrics.incrementHandoverTriggers({
        dealership_id: data.dealershipId,
        source_provider: data.sourceProvider || 'unknown',
        reason: data.reason,
        status: 'completed'
      });
      
      // Emit handover completed event
      this.emit('handover:completed', {
        handoverId,
        leadId: data.leadId,
        reason: data.reason,
        recipientEmails,
        processingTime: Date.now() - startTime
      });
      
      logger.info('Handover completed successfully', {
        handoverId,
        leadId: data.leadId,
        recipientCount: recipientEmails.length,
        processingTime: Date.now() - startTime
      });
      
      return {
        success: true,
        handoverId,
        notificationSent: true,
        recipientEmails
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Handover failed', {
        handoverId,
        leadId: data.leadId,
        error: errorMessage
      });
      
      // Record failed handover in metrics
      prometheusMetrics.incrementHandoverTriggers({
        dealership_id: data.dealershipId,
        source_provider: data.sourceProvider || 'unknown',
        reason: data.reason,
        status: 'failed'
      });
      
      // Emit handover failed event
      this.emit('handover:failed', {
        handoverId,
        leadId: data.leadId,
        reason: data.reason,
        error: errorMessage
      });
      
      return {
        success: false,
        handoverId,
        errors: [errorMessage]
      };
    }
  }
  
  /**
   * Get recipient emails for a dealership
   */
  private async getRecipientEmails(dealershipId: number): Promise<string[]> {
    try {
      // TODO: Implement dealership-specific email fetching from database
      // For now, return the default notification emails
      
      if (this.notificationEmails.length > 0) {
        return this.notificationEmails;
      }
      
      // Fallback to admin email if configured
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        return [adminEmail];
      }
      
      return [];
    } catch (error) {
      logger.error('Error getting recipient emails', {
        dealershipId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }
  
  /**
   * Send handover notification email
   */
  private async sendHandoverNotification(
    handoverId: string,
    data: HandoverData,
    recipientEmails: string[]
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // Prepare email subject based on reason and escalation level
      let subject = this.defaultSubject;
      
      if (data.escalationLevel === 'urgent') {
        subject = `URGENT: ${subject}`;
      } else if (data.escalationLevel === 'critical') {
        subject = `CRITICAL: ${subject}`;
      }
      
      // Add customer name and reason to subject
      subject = `${subject} - ${data.customerName} - ${this.formatHandoverReason(data.reason)}`;
      
      // Prepare email template data
      const templateData = {
        handoverId,
        customerName: data.customerName,
        customerEmail: data.customerEmail || 'Not provided',
        customerPhone: data.customerPhone || 'Not provided',
        dealershipName: data.dealershipName || `Dealership ID: ${data.dealershipId}`,
        reason: this.formatHandoverReason(data.reason),
        vehicleInfo: data.vehicleInfo || 'Not specified',
        comments: data.comments || 'No additional comments',
        escalationLevel: data.escalationLevel || 'normal',
        timestamp: new Date().toLocaleString(),
        sourceProvider: data.sourceProvider || 'Unknown source',
        ...data.additionalData
      };
      
      // Send email
      const emailResult = await this.emailService.sendTemplateEmail({
        to: recipientEmails,
        subject,
        template: this.defaultTemplate,
        data: templateData
      });
      
      if (!emailResult.success) {
        return {
          success: false,
          errors: emailResult.errors || ['Unknown email sending error']
        };
      }
      
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error sending handover notification', {
        handoverId,
        leadId: data.leadId,
        error: errorMessage
      });
      
      return {
        success: false,
        errors: [errorMessage]
      };
    }
  }
  
  /**
   * Send SMS notification for handover
   */
  private async sendSmsNotification(data: HandoverData): Promise<void> {
    // This is a placeholder for SMS notification functionality
    // Will be implemented when Twilio integration is complete
    logger.info('SMS notification would be sent (not implemented)', {
      customerPhone: data.customerPhone,
      reason: data.reason
    });
  }
  
  /**
   * Update lead status in database
   */
  private async updateLeadStatus(leadId: number, status: string): Promise<void> {
    try {
      await db.update(adfLeads)
        .set({
          leadStatus: status as any,
          updatedAt: new Date()
        })
        .where(eq(adfLeads.id, leadId));
      
      logger.debug('Lead status updated', { leadId, status });
    } catch (error) {
      logger.error('Failed to update lead status', {
        leadId,
        status,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw the error, just log it
    }
  }
  
  /**
   * Format handover reason for human readability
   */
  private formatHandoverReason(reason: HandoverReason): string {
    const reasonMap: Record<HandoverReason, string> = {
      'explicit_request': 'Customer Requested Agent',
      'complex_question': 'Complex Question',
      'pricing_negotiation': 'Pricing Negotiation',
      'financing_request': 'Financing Request',
      'test_drive_request': 'Test Drive Request',
      'trade_in_appraisal': 'Trade-in Appraisal',
      'negative_sentiment': 'Negative Sentiment Detected',
      'high_value_opportunity': 'High Value Opportunity',
      'multiple_failed_responses': 'Multiple Failed Responses',
      'scheduled_followup': 'Scheduled Follow-up',
      'manual_trigger': 'Manually Triggered',
      'other': 'Other Reason'
    };
    
    return reasonMap[reason] || String(reason);
  }
  
  /**
   * Check if a lead should be handed over based on intent and content
   */
  async shouldHandover(
    leadId: number,
    dealershipId: number,
    content: string,
    intents?: string[]
  ): Promise<{ shouldHandover: boolean; reason?: HandoverReason }> {
    // Check for explicit handover intents
    if (intents && intents.length > 0) {
      if (intents.includes('request_human') || intents.includes('talk_to_agent')) {
        return { shouldHandover: true, reason: 'explicit_request' };
      }
      
      if (intents.includes('test_drive')) {
        return { shouldHandover: true, reason: 'test_drive_request' };
      }
      
      if (intents.includes('financing') || intents.includes('loan')) {
        return { shouldHandover: true, reason: 'financing_request' };
      }
      
      if (intents.includes('trade_in') || intents.includes('appraisal')) {
        return { shouldHandover: true, reason: 'trade_in_appraisal' };
      }
      
      if (intents.includes('negotiate') || intents.includes('discount')) {
        return { shouldHandover: true, reason: 'pricing_negotiation' };
      }
    }
    
    // Check content for keywords suggesting handover
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('speak to a human') || 
        lowerContent.includes('talk to a person') || 
        lowerContent.includes('real person')) {
      return { shouldHandover: true, reason: 'explicit_request' };
    }
    
    if (lowerContent.includes('test drive') || lowerContent.includes('drive it')) {
      return { shouldHandover: true, reason: 'test_drive_request' };
    }
    
    if (lowerContent.includes('finance') || lowerContent.includes('loan') || 
        lowerContent.includes('credit')) {
      return { shouldHandover: true, reason: 'financing_request' };
    }
    
    // Track this check in metrics even if we don't handover
    prometheusMetrics.incrementHandoverTriggers({
      dealership_id: dealershipId,
      source_provider: 'unknown', // Would need to be passed in
      reason: 'content_check',
      status: 'initiated'
    });
    
    // Default - no handover needed
    return { shouldHandover: false };
  }
  
  /**
   * Process a batch of pending handovers
   */
  async processPendingHandovers(): Promise<number> {
    try {
      // Find leads with handover_initiated status
      const pendingLeads = await db.query.adfLeads.findMany({
        where: eq(adfLeads.leadStatus, 'handover_initiated' as any),
        limit: 50
      });
      
      logger.info(`Processing ${pendingLeads.length} pending handovers`);
      
      let successCount = 0;
      
      for (const lead of pendingLeads) {
        try {
          // Prepare handover data
          const handoverData: HandoverData = {
            leadId: lead.id,
            customerName: lead.customerFullName,
            customerEmail: lead.customerEmail || undefined,
            customerPhone: lead.customerPhone || undefined,
            dealershipId: lead.dealershipId || 0,
            sourceProvider: lead.providerService || 'unknown',
            vehicleInfo: lead.vehicleMake && lead.vehicleModel 
              ? `${lead.vehicleYear || ''} ${lead.vehicleMake} ${lead.vehicleModel}` 
              : undefined,
            comments: lead.comments || undefined,
            reason: 'scheduled_followup' // Default reason for batch processing
          };
          
          // Trigger handover
          const result = await this.triggerHandover(handoverData);
          
          if (result.success) {
            successCount++;
          }
          
        } catch (error) {
          logger.error('Error processing pending handover', {
            leadId: lead.id,
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Record failed handover in metrics
          prometheusMetrics.incrementHandoverTriggers({
            dealership_id: lead.dealershipId || 0,
            source_provider: lead.providerService || 'unknown',
            reason: 'batch_processing',
            status: 'failed'
          });
        }
      }
      
      return successCount;
      
    } catch (error) {
      logger.error('Error processing pending handovers batch', {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0;
    }
  }
}

// Export default instance
export const handoverService = new HandoverService();
export default handoverService;
