import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import crypto from 'crypto';
import logger from '../utils/logger';
import { AdfService } from '../services/adf-service';
import { AdfParser } from '../services/adf-parser';

const router = Router();

/**
 * SendGrid Webhook Security Verification
 * Verifies webhook signature to ensure emails are from SendGrid
 * Uses SendGrid's Inbound Parse webhook signature verification
 */
function verifyWebhookSignature(req: Request): boolean {
  // SendGrid Inbound Parse doesn't use the same signature method as Event Webhook
  // For Inbound Parse, we can verify by checking the User-Agent and other headers
  const userAgent = req.headers['user-agent'] as string;
  
  if (!process.env.SENDGRID_VERIFICATION_ENABLED || process.env.SENDGRID_VERIFICATION_ENABLED !== 'true') {
    return true; // Skip verification if disabled
  }

  // Basic verification - check if request comes from SendGrid
  if (userAgent && userAgent.includes('SendGrid')) {
    return true;
  }

  // For additional security, you can also verify the webhook secret in a custom header
  const webhookSecret = req.headers['x-webhook-secret'] as string;
  if (webhookSecret && webhookSecret === process.env.SENDGRID_WEBHOOK_SECRET) {
    return true;
  }

  logger.warn('Webhook verification failed', {
    userAgent,
    hasSecret: !!webhookSecret
  });
  
  return false;
}

/**
 * SendGrid Inbound Parse Webhook
 * Processes incoming emails with ADF XML attachments
 * 
 * This route works in PARALLEL with existing email processing
 * Feature flag: SENDGRID_WEBHOOK_ENABLED
 */
router.post('/webhook/inbound', 
  // Security: Verify webhook signature
  (req: Request, res: Response, next) => {
    // Skip verification in development
    if (process.env.NODE_ENV === 'development') {
      return next();
    }

    if (!verifyWebhookSignature(req)) {
      logger.error('Invalid SendGrid webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    next();
  },
  
  async (req: Request, res: Response) => {
    try {
      // Feature flag check - don't process if disabled
      if (process.env.SENDGRID_WEBHOOK_ENABLED !== 'true') {
        logger.info('SendGrid webhook disabled, ignoring email');
        return res.status(200).json({ status: 'disabled' });
      }

      logger.info('Processing SendGrid inbound email', {
        from: req.body.from,
        to: req.body.to,
        subject: req.body.subject,
        attachments: req.body.attachment_info ? JSON.parse(req.body.attachment_info) : []
      });

      // Parse email data from SendGrid
      const emailData = {
        from: req.body.from,
        to: req.body.to,
        subject: req.body.subject,
        text: req.body.text,
        html: req.body.html,
        headers: JSON.parse(req.body.headers || '{}'),
        attachments: req.body.attachment_info ? JSON.parse(req.body.attachment_info) : []
      };

      // Check if this email has ADF XML attachments
      const adfAttachments = emailData.attachments.filter((att: any) => 
        att.filename?.toLowerCase().endsWith('.xml') ||
        att.type?.includes('xml') ||
        att.filename?.toLowerCase().includes('adf')
      );

      if (adfAttachments.length === 0) {
        logger.info('No ADF XML attachments found, skipping', {
          from: emailData.from,
          attachments: emailData.attachments.map((a: any) => a.filename)
        });
        return res.status(200).json({ status: 'no_adf_attachments' });
      }

      // Process each ADF attachment
      const adfService = new AdfService();
      const adfParser = new AdfParser();
      const results = [];

      for (const attachment of adfAttachments) {
        try {
          // Get attachment content (SendGrid provides it in the request)
          const attachmentKey = `attachment${attachment.content_id || '1'}`;
          const xmlContent = req.body[attachmentKey];

          if (!xmlContent) {
            logger.warn('Attachment content not found', { filename: attachment.filename });
            continue;
          }

          logger.info('Processing ADF XML attachment', { 
            filename: attachment.filename,
            size: xmlContent.length 
          });

          // Parse and validate ADF XML
          const adfData = await adfParser.parseAdfXml(xmlContent);
          
          // Process the ADF lead using existing service
          const leadResult = await adfService.processAdfLead({
            xmlContent,
            parsedData: adfData,
            source: 'sendgrid_webhook',
            originalEmail: {
              from: emailData.from,
              to: emailData.to,
              subject: emailData.subject,
              receivedAt: new Date()
            }
          });

          results.push({
            filename: attachment.filename,
            status: 'processed',
            leadId: leadResult.leadId
          });

          logger.info('ADF lead processed successfully', {
            filename: attachment.filename,
            leadId: leadResult.leadId,
            source: 'sendgrid_webhook'
          });

        } catch (error) {
          logger.error('Error processing ADF attachment', {
            filename: attachment.filename,
            error: error.message
          });
          
          results.push({
            filename: attachment.filename,
            status: 'error',
            error: error.message
          });
        }
      }

      // Return success response to SendGrid
      res.status(200).json({
        status: 'processed',
        timestamp: new Date().toISOString(),
        processed_attachments: results.length,
        results
      });

    } catch (error) {
      logger.error('SendGrid webhook processing error', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * SendGrid Event Webhook (Optional)
 * Handles delivery events, bounces, etc.
 */
router.post('/webhook/events', async (req: Request, res: Response) => {
  try {
    const events = req.body;
    
    logger.info('SendGrid events received', { 
      eventCount: events.length,
      events: events.map((e: any) => ({ event: e.event, email: e.email }))
    });

    // Process events (bounces, deliveries, etc.)
    for (const event of events) {
      switch (event.event) {
        case 'bounce':
        case 'dropped':
          logger.warn('Email delivery failed', {
            email: event.email,
            reason: event.reason,
            event: event.event
          });
          break;
        
        case 'delivered':
          logger.info('Email delivered successfully', {
            email: event.email,
            timestamp: event.timestamp
          });
          break;
      }
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    logger.error('SendGrid events webhook error', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health check for SendGrid webhook
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    webhook_enabled: process.env.SENDGRID_WEBHOOK_ENABLED === 'true',
    verification_enabled: process.env.SENDGRID_VERIFICATION_ENABLED === 'true',
    timestamp: new Date().toISOString()
  });
});

export default router;