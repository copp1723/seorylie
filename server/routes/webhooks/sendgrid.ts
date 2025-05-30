import express from 'express';
import { eq } from 'drizzle-orm';
import db from '../../db';
import { emailDeliveryTracking } from '../../../shared/adf-schema';
import { handovers } from '../../../shared/lead-management-schema';
import logger from '../../utils/logger';
import eventBus from '../../services/event-bus';
import { prometheusMetrics } from '../../services/prometheus-metrics';
import crypto from 'crypto';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

// Rate limiting to prevent abuse
const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all webhook routes
router.use('/sendgrid', webhookRateLimit);

/**
 * Verify SendGrid webhook signature
 */
function verifySendGridSignature(req: express.Request): boolean {
  try {
    const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
    const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'] as string;
    const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
    
    // Skip verification in development mode if no secret is set
    if (!webhookSecret && process.env.NODE_ENV === 'development') {
      logger.warn('SendGrid webhook signature verification skipped (no secret set)');
      return true;
    }
    
    if (!signature || !timestamp || !webhookSecret) {
      logger.warn('SendGrid webhook missing verification headers', {
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        hasSecret: !!webhookSecret
      });
      return false;
    }
    
    // Verify signature
    const payload = timestamp + JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(signature)
    );
  } catch (error) {
    logger.error('SendGrid webhook signature verification failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

/**
 * Update email delivery status in database
 */
async function updateEmailDeliveryStatus(
  messageId: string,
  status: string,
  eventData: any
): Promise<void> {
  try {
    // Find email delivery record by message ID
    const deliveryRecords = await db
      .select()
      .from(emailDeliveryTracking)
      .where(eq(emailDeliveryTracking.providerMessageId, messageId))
      .limit(1);
    
    if (deliveryRecords.length === 0) {
      logger.warn('Email delivery record not found for message ID', { messageId });
      return;
    }
    
    const record = deliveryRecords[0];
    
    // Map SendGrid event to our delivery status
    let deliveryStatus: string;
    switch (status) {
      case 'delivered':
        deliveryStatus = 'delivered';
        break;
      case 'bounce':
        deliveryStatus = 'bounced';
        break;
      case 'dropped':
        deliveryStatus = 'failed';
        break;
      case 'deferred':
        deliveryStatus = 'pending';
        break;
      case 'blocked':
        deliveryStatus = 'rejected';
        break;
      default:
        deliveryStatus = status;
    }
    
    // Update delivery record
    await db
      .update(emailDeliveryTracking)
      .set({
        deliveryStatus: deliveryStatus as any,
        updatedAt: new Date(),
        deliveredAt: status === 'delivered' ? new Date() : record.deliveredAt,
        errorMessage: ['bounce', 'dropped', 'blocked'].includes(status) 
          ? JSON.stringify(eventData) 
          : record.errorMessage
      })
      .where(eq(emailDeliveryTracking.id, record.id));
    
    // Track metrics
    prometheusMetrics.incrementLeadsProcessed({
      dealership_id: record.adfLeadId.toString(),
      source_provider: 'sendgrid',
      lead_type: 'email',
      status: `email_${deliveryStatus}`
    });
    
    logger.info('Email delivery status updated', {
      messageId,
      status: deliveryStatus,
      leadId: record.adfLeadId
    });
    
  } catch (error) {
    logger.error('Failed to update email delivery status', {
      error: error instanceof Error ? error.message : String(error),
      messageId,
      status
    });
  }
}

/**
 * Update handover email status in database
 */
async function updateHandoverEmailStatus(
  messageId: string,
  status: string,
  eventData: any
): Promise<void> {
  try {
    // Find handover record by message ID in context
    const handoverRecords = await db
      .select()
      .from(handovers)
      .where(db.sql`${handovers.context}->>'emailMessageId' = ${messageId}`)
      .limit(1);
    
    if (handoverRecords.length === 0) {
      return; // Not a handover email
    }
    
    const handover = handoverRecords[0];
    
    // Process based on status
    if (status === 'delivered') {
      // Update handover context with delivery timestamp
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
      
      // Emit email delivered event
      eventBus.emit('email.delivered', { 
        messageId,
        handoverId: handover.id
      });
      
      logger.info('Handover email delivery confirmed', {
        handoverId: handover.id,
        messageId
      });
      
    } else if (['bounce', 'dropped', 'blocked', 'deferred'].includes(status)) {
      // Update handover context with failure details
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
              ${JSON.stringify(`SendGrid event: ${status}`)}::jsonb
            )
          `,
          updatedAt: new Date()
        })
        .where(eq(handovers.id, handover.id));
      
      // Emit email failed event
      eventBus.emit('email.failed', { 
        messageId,
        handoverId: handover.id,
        reason: `SendGrid event: ${status}`,
        details: eventData
      });
      
      logger.error('Handover email delivery failed', {
        handoverId: handover.id,
        messageId,
        status,
        details: eventData
      });
    }
    
    // Track metrics for handover emails
    const dealershipId = handover.context?.dealershipId || '0';
    prometheusMetrics.incrementHandoverEmailSent({
      dealership_id: dealershipId,
      status: status === 'delivered' ? 'delivered' : 'failed',
      template: 'handover-dossier'
    });
    
  } catch (error) {
    logger.error('Failed to update handover email status', {
      error: error instanceof Error ? error.message : String(error),
      messageId,
      status
    });
  }
}

/**
 * SendGrid webhook handler
 */
router.post('/sendgrid', express.json(), async (req, res) => {
  try {
    // Verify webhook signature
    if (!verifySendGridSignature(req)) {
      logger.warn('Invalid SendGrid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process webhook events
    const events = req.body;
    if (!Array.isArray(events)) {
      logger.warn('Invalid SendGrid webhook payload (not an array)');
      return res.status(400).json({ error: 'Invalid payload format' });
    }
    
    logger.info(`Processing ${events.length} SendGrid webhook events`);
    
    // Process each event
    for (const event of events) {
      const messageId = event.sg_message_id;
      const status = event.event;
      
      if (!messageId || !status) {
        logger.warn('Invalid SendGrid event data', { event });
        continue;
      }
      
      // Update both email delivery and handover status
      // (only one will be affected if the message ID matches)
      await Promise.all([
        updateEmailDeliveryStatus(messageId, status, event),
        updateHandoverEmailStatus(messageId, status, event)
      ]);
    }
    
    res.status(200).json({ success: true, eventsProcessed: events.length });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error processing SendGrid webhook', { error: errorMessage });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
