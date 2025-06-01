import { EventEmitter } from 'events';
import { eq, and } from 'drizzle-orm';
import db from '../db';
import { 
  handovers, 
  conversations, 
  leads,
  dealershipHandoverSettings,
  type Handover,
  type HandoverReason
} from '../../shared/lead-management-schema';
import logger from '../utils/logger';
import { handoverDossierService, type HandoverDossier } from './handover-dossier-service';
import { HandoverService } from './handover-service';
import { EmailService } from './email-service';
import { prometheusMetrics } from './prometheus-metrics';
import eventBus from './event-bus';
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';

/**
 * HandoverOrchestrator - Coordinates the handover process from intent detection to email notification
 * 
 * Listens for 'intent.ready_for_handover' events
 * Generates sales dossier
 * Persists dossier and sends email notification
 * Tracks handover status and metrics
 */
export class HandoverOrchestrator extends EventEmitter {
  private handoverService: HandoverService;
  private emailService: EmailService;
  private emailTemplate: HandlebarsTemplateDelegate;
  private textTemplate: HandlebarsTemplateDelegate;
  private isInitialized: boolean = false;
  
  constructor() {
    super();
    this.handoverService = new HandoverService();
    this.emailService = new EmailService();
    
    // Register Handlebars helpers
    Handlebars.registerHelper('multiply', function(a, b) {
      return a * b;
    });
    
    Handlebars.registerHelper('uppercase', function(str) {
      return str ? str.toUpperCase() : '';
    });
    
    Handlebars.registerHelper('formatConfidence', function(confidence) {
      return `${Math.round(confidence * 100)}%`;
    });
    
    // Initialize templates
    try {
      const templateDir = path.join(__dirname, '../templates/email');
      const htmlTemplate = fs.readFileSync(path.join(templateDir, 'handover-dossier.html'), 'utf8');
      const textTemplate = fs.readFileSync(path.join(templateDir, 'handover-dossier.txt'), 'utf8');
      
      this.emailTemplate = Handlebars.compile(htmlTemplate);
      this.textTemplate = Handlebars.compile(textTemplate);
      
      this.isInitialized = true;
      logger.info('HandoverOrchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize HandoverOrchestrator templates', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Initialize event listeners
   */
  init(): void {
    if (!this.isInitialized) {
      logger.error('Cannot initialize HandoverOrchestrator: templates not loaded');
      return;
    }
    
    // Subscribe to intent detection events
    eventBus.on('intent.ready_for_handover', this.handleReadyForHandover.bind(this));
    
    // Subscribe to email status events for tracking
    eventBus.on('email.delivered', this.handleEmailDelivered.bind(this));
    eventBus.on('email.failed', this.handleEmailFailed.bind(this));
    
    logger.info('HandoverOrchestrator event listeners registered');
  }
  
  /**
   * Handle ready_for_handover intent detection
   */
  private async handleReadyForHandover(data: {
    conversationId: string;
    leadId: string;
    dealershipId: number;
    reason: HandoverReason;
    confidence: number;
    context?: Record<string, any>;
  }): Promise<void> {
    const { conversationId, leadId, dealershipId, reason, confidence, context } = data;
    const handoverId = `ho_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    logger.info('Received ready_for_handover intent', {
      handoverId,
      conversationId,
      leadId,
      dealershipId,
      reason,
      confidence
    });
    
    try {
      // Check if handover is already in progress for this conversation
      const existingHandover = await this.checkExistingHandover(conversationId);
      if (existingHandover) {
        logger.info('Handover already in progress, skipping', {
          handoverId,
          existingHandoverId: existingHandover.id,
          conversationId
        });
        return;
      }
      
      // Emit handover initiated event
      this.emit('handover:initiated', {
        handoverId,
        conversationId,
        leadId,
        reason,
        timestamp: new Date()
      });
      
      // Track handover trigger in metrics
      prometheusMetrics.incrementHandoverTriggers({
        dealership_id: dealershipId,
        source_provider: 'intent_detection',
        reason,
        status: 'initiated'
      });
      
      // Create handover record with pending status
      const handoverResult = await this.handoverService.createHandover(dealershipId, {
        conversationId,
        reason,
        description: `Auto-detected intent: ${reason} (confidence: ${confidence.toFixed(2)})`,
        urgency: this.determineUrgency(confidence),
        context
      });
      
      if (!handoverResult.success) {
        logger.error('Failed to create handover record', {
          handoverId,
          conversationId,
          errors: handoverResult.errors
        });
        
        prometheusMetrics.incrementHandoverTriggers({
          dealership_id: dealershipId,
          source_provider: 'intent_detection',
          reason,
          status: 'failed'
        });
        
        this.emit('handover:failed', {
          handoverId,
          conversationId,
          leadId,
          reason,
          errors: handoverResult.errors
        });
        
        return;
      }
      
      const createdHandoverId = handoverResult.handoverId;
      if (!createdHandoverId) {
        logger.error('Handover created but no ID returned', {
          handoverId,
          conversationId
        });
        return;
      }
      
      // Generate handover dossier
      logger.info('Generating handover dossier', {
        handoverId: createdHandoverId,
        conversationId,
        leadId
      });
      
      const dossier = await handoverDossierService.generateDossier(
        conversationId,
        leadId,
        reason
      );
      
      // Update handover record with dossier
      await this.updateHandoverWithDossier(createdHandoverId, dossier);
      
      // Send handover email
      const emailResult = await this.sendHandoverEmail(
        createdHandoverId,
        dealershipId,
        dossier
      );
      
      // Update handover status based on email result
      if (emailResult.success) {
        await this.updateHandoverStatus(createdHandoverId, 'email_sent', emailResult.messageId);
        
        // Emit handover email sent event
        this.emit('handover_email:sent', {
          handoverId: createdHandoverId,
          conversationId,
          leadId,
          emailMessageId: emailResult.messageId
        });
        
        // Track successful handover in metrics
        prometheusMetrics.incrementHandoverTriggers({
          dealership_id: dealershipId,
          source_provider: 'intent_detection',
          reason,
          status: 'completed'
        });
        
        prometheusMetrics.incrementHandoverEmailSent({
          dealership_id: dealershipId,
          status: 'sent',
          template: 'handover-dossier'
        });
        
        logger.info('Handover process completed successfully', {
          handoverId: createdHandoverId,
          conversationId,
          emailMessageId: emailResult.messageId
        });
      } else {
        await this.updateHandoverStatus(createdHandoverId, 'email_failed', null, emailResult.error);
        
        // Emit handover email failed event
        this.emit('handover_email:failed', {
          handoverId: createdHandoverId,
          conversationId,
          leadId,
          error: emailResult.error
        });
        
        // Track failed handover in metrics
        prometheusMetrics.incrementHandoverTriggers({
          dealership_id: dealershipId,
          source_provider: 'intent_detection',
          reason,
          status: 'email_failed'
        });
        
        prometheusMetrics.incrementHandoverEmailSent({
          dealership_id: dealershipId,
          status: 'failed',
          template: 'handover-dossier'
        });
        
        logger.error('Handover email sending failed', {
          handoverId: createdHandoverId,
          conversationId,
          error: emailResult.error
        });
      }
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Handover orchestration failed', {
        handoverId,
        conversationId,
        leadId,
        error: err.message
      });
      
      // Track failed handover in metrics
      prometheusMetrics.incrementHandoverTriggers({
        dealership_id: dealershipId,
        source_provider: 'intent_detection',
        reason,
        status: 'failed'
      });
      
      // Emit handover failed event
      this.emit('handover:failed', {
        handoverId,
        conversationId,
        leadId,
        reason,
        error: err.message
      });
    }
  }
  
  /**
   * Check if a handover is already in progress for this conversation
   */
  private async checkExistingHandover(conversationId: string): Promise<Handover | null> {
    try {
      const results = await db
        .select()
        .from(handovers)
        .where(and(
          eq(handovers.conversationId, conversationId),
          eq(handovers.status, 'pending')
        ))
        .limit(1);
      
      return results.length > 0 ? results[0] : null;
      
    } catch (error) {
      logger.error('Error checking existing handover', {
        error: error instanceof Error ? error.message : String(error),
        conversationId
      });
      return null;
    }
  }
  
  /**
   * Determine urgency based on confidence score
   */
  private determineUrgency(confidence: number): 'low' | 'medium' | 'high' | 'urgent' {
    if (confidence >= 0.9) {
      return 'urgent';
    } else if (confidence >= 0.7) {
      return 'high';
    } else if (confidence >= 0.5) {
      return 'medium';
    } else {
      return 'low';
    }
  }
  
  /**
   * Update handover record with dossier
   */
  private async updateHandoverWithDossier(handoverId: string, dossier: HandoverDossier): Promise<void> {
    try {
      await db
        .update(handovers)
        .set({
          dossier,
          updatedAt: new Date()
        })
        .where(eq(handovers.id, handoverId));
      
      logger.info('Handover record updated with dossier', { handoverId });
      
    } catch (error) {
      logger.error('Failed to update handover with dossier', {
        error: error instanceof Error ? error.message : String(error),
        handoverId
      });
      throw error;
    }
  }
  
  /**
   * Send handover email notification
   */
  private async sendHandoverEmail(
    handoverId: string,
    dealershipId: number,
    dossier: HandoverDossier
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get dealership handover settings
      const settings = await this.getDealershipHandoverSettings(dealershipId);
      if (!settings || !settings.handoverEmail) {
        throw new Error(`No handover email configured for dealership ${dealershipId}`);
      }
      
      // Prepare email content
      const htmlContent = this.emailTemplate(dossier);
      const textContent = this.textTemplate(dossier);
      
      // Determine urgency for subject line
      const urgencyPrefix = dossier.urgency === 'high' || dossier.urgency === 'urgent' 
        ? `[${dossier.urgency.toUpperCase()}] ` 
        : '';
      
      // Send email
      const emailResult = await this.emailService.sendEmail({
        to: settings.handoverEmail,
        subject: `${urgencyPrefix}Sales Lead Handover: ${dossier.customerName}`,
        html: htmlContent,
        text: textContent,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@dealership.com',
        replyTo: process.env.HANDOVER_REPLY_TO || settings.handoverEmail
      });
      
      if (!emailResult.success) {
        return {
          success: false,
          error: emailResult.error || 'Unknown email sending error'
        };
      }
      
      return {
        success: true,
        messageId: emailResult.messageId
      };
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error sending handover email', {
        error: err.message,
        handoverId,
        dealershipId
      });
      
      return {
        success: false,
        error: err.message
      };
    }
  }
  
  /**
   * Update handover status
   */
  private async updateHandoverStatus(
    handoverId: string,
    status: 'email_sent' | 'email_failed',
    messageId?: string | null,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };
      
      // Use proper SQL syntax for JSON operations
      if (status === 'email_sent' && messageId) {
        // Create a new context object with the updated values
        updateData.context = db.sql`
          jsonb_set(
            COALESCE(${handovers.context}, '{}'::jsonb),
            '{emailMessageId}',
            ${JSON.stringify(messageId)}::jsonb
          )
        `;
      }
      
      if (status === 'email_failed' && errorMessage) {
        // Create a new context object with the updated values
        updateData.context = db.sql`
          jsonb_set(
            COALESCE(${handovers.context}, '{}'::jsonb),
            '{emailError}',
            ${JSON.stringify(errorMessage)}::jsonb
          )
        `;
      }
      
      await db
        .update(handovers)
        .set(updateData)
        .where(eq(handovers.id, handoverId));
      
      logger.info(`Handover status updated to ${status}`, { 
        handoverId, 
        messageId: messageId || undefined 
      });
      
    } catch (error) {
      logger.error('Failed to update handover status', {
        error: error instanceof Error ? error.message : String(error),
        handoverId,
        status
      });
    }
  }
  
  /**
   * Get dealership handover settings
   */
  private async getDealershipHandoverSettings(dealershipId: number) {
    try {
      const results = await db
        .select()
        .from(dealershipHandoverSettings)
        .where(eq(dealershipHandoverSettings.dealershipId, dealershipId))
        .limit(1);
      
      return results.length > 0 ? results[0] : null;
      
    } catch (error) {
      logger.error('Error fetching dealership handover settings', {
        error: error instanceof Error ? error.message : String(error),
        dealershipId
      });
      return null;
    }
  }
  
  /**
   * Handle email delivered event
   */
  private async handleEmailDelivered(data: { messageId: string }): Promise<void> {
    try {
      // Find handover by message ID in context
      const results = await db
        .select()
        .from(handovers)
        .where(db.sql`${handovers.context}->>'emailMessageId' = ${data.messageId}`)
        .limit(1);
      
      if (results.length === 0) {
        return; // Not a handover email
      }
      
      const handover = results[0];
      
      // Update context with delivery timestamp using proper SQL syntax
      await db
        .update(handovers)
        .set({
          context: db.sql`
            jsonb_set(
              COALESCE(${handovers.context}, '{}'::jsonb),
              '{emailDeliveredAt}',
              ${JSON.stringify(new Date().toISOString())}::jsonb
            )
          `,
          updatedAt: new Date()
        })
        .where(eq(handovers.id, handover.id));
      
      logger.info('Handover email delivery confirmed', {
        handoverId: handover.id,
        messageId: data.messageId
      });
      
    } catch (error) {
      logger.error('Error handling email delivered event', {
        error: error instanceof Error ? error.message : String(error),
        messageId: data.messageId
      });
    }
  }
  
  /**
   * Handle email failed event
   */
  private async handleEmailFailed(data: { messageId: string; reason: string }): Promise<void> {
    try {
      // Find handover by message ID in context
      const results = await db
        .select()
        .from(handovers)
        .where(db.sql`${handovers.context}->>'emailMessageId' = ${data.messageId}`)
        .limit(1);
      
      if (results.length === 0) {
        return; // Not a handover email
      }
      
      const handover = results[0];
      
      // Update status and context with failure details using proper SQL syntax
      await db
        .update(handovers)
        .set({
          status: 'email_failed',
          context: db.sql`
            jsonb_set(
              jsonb_set(
                COALESCE(${handovers.context}, '{}'::jsonb),
                '{emailFailedAt}',
                ${JSON.stringify(new Date().toISOString())}::jsonb
              ),
              '{emailFailureReason}',
              ${JSON.stringify(data.reason)}::jsonb
            )
          `,
          updatedAt: new Date()
        })
        .where(eq(handovers.id, handover.id));
      
      logger.error('Handover email delivery failed', {
        handoverId: handover.id,
        messageId: data.messageId,
        reason: data.reason
      });
      
      // Track failed email in metrics
      const dealershipId = await this.getDealershipIdForHandover(handover.id);
      if (dealershipId) {
        prometheusMetrics.incrementHandoverEmailSent({
          dealership_id: dealershipId,
          status: 'failed',
          template: 'handover-dossier'
        });
      }
      
      // Schedule retry if this is the first failure
      if (!handover.context?.emailRetryAttempted) {
        this.scheduleEmailRetry(handover.id, 5 * 60 * 1000); // 5 minutes
      }
      
    } catch (error) {
      logger.error('Error handling email failed event', {
        error: error instanceof Error ? error.message : String(error),
        messageId: data.messageId
      });
    }
  }
  
  /**
   * Get dealership ID for a handover
   */
  private async getDealershipIdForHandover(handoverId: string): Promise<number | null> {
    try {
      const results = await db
        .select({
          handover: handovers,
          conversation: conversations
        })
        .from(handovers)
        .leftJoin(conversations, eq(handovers.conversationId, conversations.id))
        .where(eq(handovers.id, handoverId))
        .limit(1);
      
      return results.length > 0 ? results[0].conversation.dealershipId : null;
      
    } catch (error) {
      logger.error('Error getting dealership ID for handover', {
        error: error instanceof Error ? error.message : String(error),
        handoverId
      });
      return null;
    }
  }
  
  /**
   * Schedule email retry
   */
  private scheduleEmailRetry(handoverId: string, delayMs: number): void {
    logger.info(`Scheduling handover email retry in ${delayMs}ms`, { handoverId });
    
    setTimeout(async () => {
      try {
        // Get handover with dossier
        const handover = await db
          .select()
          .from(handovers)
          .where(eq(handovers.id, handoverId))
          .limit(1)
          .then(results => results[0]);
        
        if (!handover || handover.status !== 'email_failed') {
          return; // Handover no longer needs retry
        }
        
        // Mark as retry attempted using proper SQL syntax
        await db
          .update(handovers)
          .set({
            context: db.sql`
              jsonb_set(
                COALESCE(${handovers.context}, '{}'::jsonb),
                '{emailRetryAttempted}',
                'true'::jsonb
              )
            `,
            updatedAt: new Date()
          })
          .where(eq(handovers.id, handoverId));
        
        // Get dealership ID
        const dealershipId = await this.getDealershipIdForHandover(handoverId);
        if (!dealershipId) {
          throw new Error('Could not determine dealership ID for retry');
        }
        
        // Retry sending email
        logger.info('Retrying handover email delivery', { handoverId });
        
        const emailResult = await this.sendHandoverEmail(
          handoverId,
          dealershipId,
          handover.dossier
        );
        
        // Update handover status based on retry result
        if (emailResult.success) {
          await this.updateHandoverStatus(handoverId, 'email_sent', emailResult.messageId);
          
          logger.info('Handover email retry successful', {
            handoverId,
            messageId: emailResult.messageId
          });
          
          // Track successful retry in metrics
          prometheusMetrics.incrementHandoverEmailSent({
            dealership_id: dealershipId,
            status: 'retry_success',
            template: 'handover-dossier'
          });
        } else {
          await this.updateHandoverStatus(
            handoverId, 
            'email_failed', 
            null, 
            `Retry failed: ${emailResult.error}`
          );
          
          logger.error('Handover email retry failed', {
            handoverId,
            error: emailResult.error
          });
          
          // Track failed retry in metrics
          prometheusMetrics.incrementHandoverEmailSent({
            dealership_id: dealershipId,
            status: 'retry_failed',
            template: 'handover-dossier'
          });
        }
        
      } catch (error) {
        logger.error('Error during handover email retry', {
          error: error instanceof Error ? error.message : String(error),
          handoverId
        });
      }
    }, delayMs);
  }
}

// Export singleton instance
export const handoverOrchestrator = new HandoverOrchestrator();

// Auto-initialize if not in test environment
if (process.env.NODE_ENV !== 'test') {
  handoverOrchestrator.init();
}

export default handoverOrchestrator;
