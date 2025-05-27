import express from 'express';
import { Request, Response } from 'express';
import logger from '../utils/logger';
import { twilioSMSService } from '../services/twilio-sms-service';
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const router = express.Router();

// Twilio webhook signature validation middleware
const validateTwilioSignature = (req: Request, res: Response, next: express.NextFunction) => {
  try {
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    const webhookUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    
    // In production, validate the signature using Twilio's validation
    // For now, we'll just check that the header exists
    if (!twilioSignature && process.env.NODE_ENV === 'production') {
      logger.warn('Missing Twilio signature', { url: webhookUrl });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Twilio signature validation failed', { error: err.message });
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// Schema for Twilio status webhook
const twilioStatusWebhookSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.enum(['queued', 'sent', 'delivered', 'failed', 'undelivered']),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  To: z.string(),
  From: z.string(),
  AccountSid: z.string()
});

// Schema for inbound SMS webhook
const twilioInboundWebhookSchema = z.object({
  MessageSid: z.string(),
  Body: z.string(),
  From: z.string(),
  To: z.string(),
  AccountSid: z.string(),
  NumMedia: z.string().optional()
});

/**
 * Webhook endpoint for SMS delivery status updates
 */
router.post('/status', 
  validateTwilioSignature,
  validateBody(twilioStatusWebhookSchema),
  async (req: Request, res: Response) => {
    try {
      const webhookData = req.body;
      
      logger.info('Received Twilio status webhook', {
        messageSid: webhookData.MessageSid,
        status: webhookData.MessageStatus,
        to: twilioSMSService.maskPhoneNumber(webhookData.To)
      });

      // Process the webhook through our SMS service
      await twilioSMSService.processWebhook(webhookData);

      // Respond with TwiML (empty response is fine for status webhooks)
      res.set('Content-Type', 'text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to process Twilio status webhook', { 
        error: err.message,
        body: req.body 
      });
      
      // Return 200 to prevent Twilio from retrying
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }
);

/**
 * Webhook endpoint for inbound SMS messages
 */
router.post('/inbound',
  validateTwilioSignature,
  validateBody(twilioInboundWebhookSchema),
  async (req: Request, res: Response) => {
    try {
      const webhookData = req.body;
      
      logger.info('Received inbound SMS', {
        messageSid: webhookData.MessageSid,
        from: twilioSMSService.maskPhoneNumber(webhookData.From),
        to: webhookData.To,
        body: webhookData.Body.substring(0, 50) + '...'
      });

      // Check for opt-out keywords
      const body = webhookData.Body.toLowerCase().trim();
      const optOutKeywords = ['stop', 'stopall', 'unsubscribe', 'quit', 'cancel', 'end', 'opt-out', 'optout'];
      
      if (optOutKeywords.some(keyword => body.includes(keyword))) {
        // Find dealership ID based on the "To" number
        const dealershipId = await findDealershipByPhoneNumber(webhookData.To);
        
        if (dealershipId) {
          // Handle opt-out in both SMS service and customer records
          await twilioSMSService.handleOptOut(dealershipId, webhookData.From, 'user_request');
          await updateCustomerOptOutStatus(dealershipId, webhookData.From, true);
          
          // Send confirmation message
          await sendOptOutConfirmation(dealershipId, webhookData.From);
          
          logger.info('Opt-out processed', {
            dealership: dealershipId,
            phone: twilioSMSService.maskPhoneNumber(webhookData.From)
          });
        }
      } else if (body.includes('start') || body.includes('subscribe') || body.includes('yes')) {
        // Handle opt-in
        const dealershipId = await findDealershipByPhoneNumber(webhookData.To);
        
        if (dealershipId) {
          await handleOptIn(dealershipId, webhookData.From);
          await updateCustomerOptOutStatus(dealershipId, webhookData.From, false);
          
          // Send welcome back message
          await sendOptInConfirmation(dealershipId, webhookData.From);
          
          logger.info('Opt-in processed', {
            dealership: dealershipId,
            phone: twilioSMSService.maskPhoneNumber(webhookData.From)
          });
        }
      } else {
        // Forward to conversation system for customer support
        await forwardToConversationSystem(webhookData);
      }

      // Respond with empty TwiML
      res.set('Content-Type', 'text/xml');
      res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to process inbound SMS webhook', { 
        error: err.message,
        body: req.body 
      });
      
      // Return 200 to prevent Twilio from retrying
      res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }
  }
);

/**
 * Health check endpoint for webhook monitoring
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'twilio-webhooks',
    timestamp: new Date().toISOString()
  });
});

// Helper functions
async function findDealershipByPhoneNumber(phoneNumber: string): Promise<number | null> {
  try {
    // This would query your dealership phone numbers table
    // For now, return a default dealership ID
    return 1; // Replace with actual lookup
  } catch (error) {
    logger.error('Failed to find dealership by phone number', { error });
    return null;
  }
}

async function handleOptIn(dealershipId: number, phoneNumber: string): Promise<void> {
  try {
    // Remove from opt-out list or mark as opted back in
    const db = (await import('../db')).default;
    const { sql } = await import('drizzle-orm');
    
    const crypto = require('crypto');
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    const phoneHash = crypto.createHash('sha256').update(normalizedPhone).digest('hex');
    
    await db.execute(sql`
      UPDATE sms_opt_outs 
      SET opted_back_in_at = NOW()
      WHERE dealership_id = ${dealershipId} 
      AND phone_number_hash = ${phoneHash}
    `);
    
    logger.info('Phone number opted back in', {
      dealership: dealershipId,
      phone: twilioSMSService.maskPhoneNumber(phoneNumber)
    });
  } catch (error) {
    logger.error('Failed to handle opt-in', { error });
  }
}

async function forwardToConversationSystem(webhookData: any): Promise<void> {
  try {
    // In a real implementation, this would:
    // 1. Find or create a conversation for this phone number
    // 2. Add the message to the conversation
    // 3. Potentially notify human agents or trigger automated responses
    
    logger.info('Inbound SMS forwarded to conversation system', {
      from: twilioSMSService.maskPhoneNumber(webhookData.From),
      to: webhookData.To,
      messageSid: webhookData.MessageSid
    });
  } catch (error) {
    logger.error('Failed to forward to conversation system', { error });
  }
}

async function updateCustomerOptOutStatus(dealershipId: number, phoneNumber: string, optedOut: boolean): Promise<void> {
  try {
    const db = (await import('../db')).default;
    const { sql } = await import('drizzle-orm');
    
    // Normalize phone number for matching
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    
    // Update customer record if exists
    await db.execute(sql`
      UPDATE customers 
      SET opted_out = ${optedOut},
          opted_out_at = ${optedOut ? sql`NOW()` : sql`NULL`},
          updated_at = NOW()
      WHERE dealership_id = ${dealershipId} 
      AND (
        phone LIKE ${'%' + normalizedPhone.slice(-10)}
        OR alternate_phone LIKE ${'%' + normalizedPhone.slice(-10)}
      )
    `);
    
    logger.info('Customer opt-out status updated', {
      dealership: dealershipId,
      phone: twilioSMSService.maskPhoneNumber(phoneNumber),
      optedOut
    });
  } catch (error) {
    logger.error('Failed to update customer opt-out status', { error });
  }
}

async function sendOptOutConfirmation(dealershipId: number, phoneNumber: string): Promise<void> {
  try {
    const confirmationMessage = "You have been unsubscribed from SMS messages. Reply START to opt back in.";
    
    // Use a direct Twilio send here since this is a compliance message
    const credentials = await (await import('../services/credentials-service')).credentialsService.getTwilioCredentials(dealershipId);
    if (credentials?.accountSid && credentials?.authToken && credentials?.fromNumber) {
      const { Twilio } = await import('twilio');
      const client = new Twilio(credentials.accountSid, credentials.authToken);
      
      await client.messages.create({
        body: confirmationMessage,
        from: credentials.fromNumber,
        to: phoneNumber
      });
      
      logger.info('Opt-out confirmation sent', {
        dealership: dealershipId,
        phone: twilioSMSService.maskPhoneNumber(phoneNumber)
      });
    }
  } catch (error) {
    logger.error('Failed to send opt-out confirmation', { error });
  }
}

async function sendOptInConfirmation(dealershipId: number, phoneNumber: string): Promise<void> {
  try {
    const welcomeMessage = "Welcome back! You are now subscribed to receive SMS messages from us. Reply STOP to opt out anytime.";
    
    // Use a direct Twilio send here since this is a compliance message
    const credentials = await (await import('../services/credentials-service')).credentialsService.getTwilioCredentials(dealershipId);
    if (credentials?.accountSid && credentials?.authToken && credentials?.fromNumber) {
      const { Twilio } = await import('twilio');
      const client = new Twilio(credentials.accountSid, credentials.authToken);
      
      await client.messages.create({
        body: welcomeMessage,
        from: credentials.fromNumber,
        to: phoneNumber
      });
      
      logger.info('Opt-in confirmation sent', {
        dealership: dealershipId,
        phone: twilioSMSService.maskPhoneNumber(phoneNumber)
      });
    }
  } catch (error) {
    logger.error('Failed to send opt-in confirmation', { error });
  }
}

export default router;