
import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import db from "../db";
import { sql } from 'drizzle-orm';
import { twilioSMSService, SMSMessage } from './twilio-sms-service';

// SMS Provider interfaces (you can implement multiple providers)
interface SMSProvider {
  sendSMS(to: string, message: string, from?: string): Promise<boolean>;
}

// Updated Twilio SMS implementation using new service
class TwilioSMSProvider implements SMSProvider {
  async sendSMS(to: string, message: string, from?: string): Promise<boolean> {
    try {
      const smsMessage: SMSMessage = {
        dealershipId: 1, // This should be passed from context
        toPhone: to,
        message: message,
        fromPhone: from
      };

      const result = await twilioSMSService.sendSMS(smsMessage);
      return result.success;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send SMS via Twilio service', { error: err.message, to: twilioSMSService.maskPhoneNumber(to) });
      return false;
    }
  }
}

// Message types and interfaces
export interface MessageTemplate {
  id: string;
  name: string;
  subject?: string; // For email
  content: string;
  variables: string[]; // Variables that can be replaced in template
  channel: 'email' | 'sms' | 'both';
  dealershipId: number;
}

export interface FollowUpRule {
  id: string;
  dealershipId: number;
  leadSource: string;
  sequence: FollowUpStep[];
  active: boolean;
}

export interface FollowUpStep {
  stepNumber: number;
  delayHours: number;
  channel: 'email' | 'sms' | 'both';
  templateId: string;
  conditions?: {
    noResponse?: boolean;
    leadScore?: { min?: number; max?: number };
  };
}

export interface SendMessageRequest {
  to: string;
  channel: 'email' | 'sms';
  templateId?: string;
  customMessage?: string;
  subject?: string; // For email
  variables?: Record<string, string>;
  conversationId?: number;
  dealershipId: number;
  fromName?: string;
  fromEmail?: string;
  fromPhone?: string;
}

export interface ScheduledMessage {
  id: string;
  conversationId: number;
  dealershipId: number;
  leadId?: number;
  channel: 'email' | 'sms';
  to: string;
  content: string;
  subject?: string;
  scheduledFor: Date;
  sent: boolean;
  sentAt?: Date;
  error?: string;
  retryCount: number;
  maxRetries: number;
}

export class MessagingService {
  private emailTransporter: nodemailer.Transporter;
  private smsProvider: SMSProvider;

  constructor() {
    this.initializeEmailTransporter();
    this.smsProvider = new TwilioSMSProvider();
  }

  private initializeEmailTransporter(): void {
    // Configure email transporter (using SendGrid as example)
    this.emailTransporter = nodemailer.createTransporter({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY || ''
      }
    });
  }

  // Send immediate message
  async sendMessage(request: SendMessageRequest): Promise<boolean> {
    try {
      let content = request.customMessage || '';
      let subject = request.subject || '';

      // If using template, load and process it
      if (request.templateId) {
        const template = await this.getTemplate(request.templateId, request.dealershipId);
        if (!template) {
          throw new Error(`Template not found: ${request.templateId}`);
        }

        content = this.processTemplate(template.content, request.variables || {});
        subject = request.subject || this.processTemplate(template.subject || '', request.variables || {});
      }

      let success = false;

      if (request.channel === 'email') {
        success = await this.sendEmail({
          to: request.to,
          subject,
          content,
          fromName: request.fromName,
          fromEmail: request.fromEmail,
          dealershipId: request.dealershipId
        });
      } else if (request.channel === 'sms') {
        success = await this.sendSMS({
          to: request.to,
          content,
          fromPhone: request.fromPhone,
          dealershipId: request.dealershipId
        });
      }

      // Log the message
      await this.logMessage({
        conversationId: request.conversationId,
        dealershipId: request.dealershipId,
        channel: request.channel,
        to: request.to,
        content,
        subject,
        success,
        sentAt: new Date()
      });

      return success;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send message', { 
        error: err.message, 
        request: { ...request, customMessage: '[REDACTED]' }
      });
      return false;
    }
  }

  // Schedule message for later delivery
  async scheduleMessage(
    request: SendMessageRequest, 
    scheduledFor: Date,
    maxRetries: number = 3
  ): Promise<string> {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      let content = request.customMessage || '';
      let subject = request.subject || '';

      if (request.templateId) {
        const template = await this.getTemplate(request.templateId, request.dealershipId);
        if (!template) {
          throw new Error(`Template not found: ${request.templateId}`);
        }

        content = this.processTemplate(template.content, request.variables || {});
        subject = request.subject || this.processTemplate(template.subject || '', request.variables || {});
      }

      const scheduledMessage: ScheduledMessage = {
        id: messageId,
        conversationId: request.conversationId || 0,
        dealershipId: request.dealershipId,
        channel: request.channel,
        to: request.to,
        content,
        subject,
        scheduledFor,
        sent: false,
        retryCount: 0,
        maxRetries
      };

      await this.saveScheduledMessage(scheduledMessage);

      logger.info('Message scheduled', {
        messageId,
        scheduledFor,
        channel: request.channel,
        to: request.to
      });

      return messageId;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to schedule message', { error: err.message });
      throw err;
    }
  }

  // Process scheduled messages (called by cron job)
  async processScheduledMessages(): Promise<void> {
    try {
      const now = new Date();
      const dueMessages = await this.getDueScheduledMessages(now);

      for (const message of dueMessages) {
        try {
          let success = false;

          if (message.channel === 'email') {
            success = await this.sendEmail({
              to: message.to,
              subject: message.subject || '',
              content: message.content,
              dealershipId: message.dealershipId
            });
          } else if (message.channel === 'sms') {
            success = await this.sendSMS({
              to: message.to,
              content: message.content,
              dealershipId: message.dealershipId
            });
          }

          if (success) {
            await this.markMessageAsSent(message.id);
            logger.info('Scheduled message sent', { messageId: message.id });
          } else {
            await this.handleMessageFailure(message);
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error('Error sending scheduled message', {
            error: err.message,
            messageId: message.id
          });
          await this.handleMessageFailure(message);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error processing scheduled messages', { error: err.message });
    }
  }

  // Setup follow-up sequence for a lead
  async setupFollowUpSequence(
    leadId: number,
    conversationId: number,
    dealershipId: number,
    leadSource: string,
    customerEmail?: string,
    customerPhone?: string
  ): Promise<void> {
    try {
      const rule = await this.getFollowUpRule(dealershipId, leadSource);
      if (!rule || !rule.active) {
        logger.info('No active follow-up rule found', { dealershipId, leadSource });
        return;
      }

      const now = new Date();

      for (const step of rule.sequence) {
        const scheduledFor = new Date(now.getTime() + (step.delayHours * 60 * 60 * 1000));

        if (step.channel === 'email' && customerEmail) {
          await this.scheduleMessage({
            to: customerEmail,
            channel: 'email',
            templateId: step.templateId,
            conversationId,
            dealershipId,
            variables: {
              leadId: leadId.toString(),
              leadSource,
              stepNumber: step.stepNumber.toString()
            }
          }, scheduledFor);
        }

        if (step.channel === 'sms' && customerPhone) {
          await this.scheduleMessage({
            to: customerPhone,
            channel: 'sms',
            templateId: step.templateId,
            conversationId,
            dealershipId,
            variables: {
              leadId: leadId.toString(),
              leadSource,
              stepNumber: step.stepNumber.toString()
            }
          }, scheduledFor);
        }

        if (step.channel === 'both') {
          if (customerEmail) {
            await this.scheduleMessage({
              to: customerEmail,
              channel: 'email',
              templateId: step.templateId,
              conversationId,
              dealershipId,
              variables: {
                leadId: leadId.toString(),
                leadSource,
                stepNumber: step.stepNumber.toString()
              }
            }, scheduledFor);
          }

          if (customerPhone) {
            await this.scheduleMessage({
              to: customerPhone,
              channel: 'sms',
              templateId: step.templateId,
              conversationId,
              dealershipId,
              variables: {
                leadId: leadId.toString(),
                leadSource,
                stepNumber: step.stepNumber.toString()
              }
            }, scheduledFor);
          }
        }
      }

      logger.info('Follow-up sequence setup completed', {
        leadId,
        dealershipId,
        leadSource,
        steps: rule.sequence.length
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to setup follow-up sequence', { 
        error: err.message, 
        leadId, 
        dealershipId, 
        leadSource 
      });
    }
  }

  // Private helper methods
  private async sendEmail(params: {
    to: string;
    subject: string;
    content: string;
    fromName?: string;
    fromEmail?: string;
    dealershipId: number;
  }): Promise<boolean> {
    try {
      const dealership = await this.getDealershipSettings(params.dealershipId);
      
      const mailOptions = {
        from: `${params.fromName || dealership.name} <${params.fromEmail || dealership.contactEmail}>`,
        to: params.to,
        subject: params.subject,
        html: params.content,
        text: params.content.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { to: params.to, subject: params.subject });
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send email', { error: err.message, to: params.to });
      return false;
    }
  }

  private async sendSMS(params: {
    to: string;
    content: string;
    fromPhone?: string;
    dealershipId: number;
  }): Promise<boolean> {
    try {
      const smsMessage: SMSMessage = {
        dealershipId: params.dealershipId,
        toPhone: params.to,
        message: params.content,
        fromPhone: params.fromPhone
      };

      const result = await twilioSMSService.sendSMS(smsMessage);
      return result.success;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send SMS', { error: err.message, to: twilioSMSService.maskPhoneNumber(params.to) });
      return false;
    }
  }
}
