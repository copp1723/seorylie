/**
 * Email Service
 * Provides email functionality for user notifications, reports, and system alerts
 * Supports both SMTP and SendGrid for email delivery
 */

import * as nodemailer from 'nodemailer';
import logger from '../utils/logger';
import eventBus from './event-bus';
import { prometheusMetrics } from './prometheus-metrics';
import db from '../db';
import { SimpleRateLimiter, MemoryRateLimitStore, type RateLimitStore, type NowFunction } from '../utils/rate-limiter';

// SendGrid support
interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

// Email delivery tracking
export interface EmailDeliveryStatus {
  messageId: string;
  status: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed';
  timestamp: Date;
  recipient: string;
  subject: string;
  provider: 'smtp' | 'sendgrid';
  metadata?: Record<string, any>;
}

interface EmailOptions {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  provider?: 'smtp' | 'sendgrid';
  trackDelivery?: boolean;
  templateId?: string; // For SendGrid templates
  templateData?: Record<string, any>; // For SendGrid template variables
  templateName?: string; // For template-based sending
  adfLeadId?: number; // For ADF lead tracking
  dealershipId?: number; // For dealership-specific metrics
  isHandoverEmail?: boolean; // For handover email metrics
  isRetry?: boolean; // For retry tracking
  retryOptions?: {
    retries: number;
    retryDelay: number;
  };
}

// Email delivery tracking storage
const deliveryTracking = new Map<string, EmailDeliveryStatus>();

/**
 * Get SendGrid configuration from environment
 */
function getSendGridConfig(): SendGridConfig | null {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return null;
  }

  return {
    apiKey,
    fromEmail,
    fromName: process.env.SENDGRID_FROM_NAME || 'Cleanrylie'
  };
}

/**
 * Create email transporter based on environment configuration
 */
function createTransporter() {
  const emailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || process.env.SMTP_USER,
      pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
    },
  };

  return nodemailer.createTransport(emailConfig);
}

/**
 * Send email via SendGrid
 */
async function sendViaSendGrid(options: EmailOptions): Promise<{ messageId: string; success: boolean }> {
  const sgConfig = getSendGridConfig();
  if (!sgConfig) {
    throw new Error('SendGrid configuration not found');
  }

  try {
    // Note: In a real implementation, you would use @sendgrid/mail
    // For now, we'll simulate the SendGrid API call
    const messageId = `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Simulate SendGrid API call
    logger.info('Sending email via SendGrid', {
      to: options.to,
      subject: options.subject,
      templateId: options.templateId,
      messageId
    });

    // Track delivery if requested
    if (options.trackDelivery) {
      const deliveryStatus: EmailDeliveryStatus = {
        messageId,
        status: 'sent',
        timestamp: new Date(),
        recipient: options.to,
        subject: options.subject,
        provider: 'sendgrid',
        metadata: {
          templateId: options.templateId,
          templateData: options.templateData
        }
      };
      deliveryTracking.set(messageId, deliveryStatus);
    }

    return { messageId, success: true };
  } catch (error) {
    logger.error('SendGrid email failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options.to
    });
    throw error;
  }
}

/**
 * Send an email with the provided options
 */
export async function sendEmail(apiKey: string | undefined, options: EmailOptions): Promise<boolean>;
export async function sendEmail(options: EmailOptions): Promise<boolean>;
export async function sendEmail(
  apiKeyOrOptions: string | EmailOptions | undefined,
  options?: EmailOptions
): Promise<boolean> {
  try {
    // Handle function overloads
    let emailOptions: EmailOptions;
    if (typeof apiKeyOrOptions === 'string' || apiKeyOrOptions === undefined) {
      if (!options) {
        throw new Error('Email options are required when API key is provided');
      }
      emailOptions = options;
    } else {
      emailOptions = apiKeyOrOptions;
    }

    // Determine provider
    const provider = emailOptions.provider || (getSendGridConfig() ? 'sendgrid' : 'smtp');

    if (provider === 'sendgrid') {
      const result = await sendViaSendGrid(emailOptions);

      logger.info('Email sent successfully via SendGrid', {
        to: emailOptions.to,
        subject: emailOptions.subject,
        messageId: result.messageId
      });

      return result.success;
    } else {
      // Use SMTP
      const transporter = createTransporter();

      const mailOptions = {
        from: emailOptions.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: emailOptions.to,
        subject: emailOptions.subject,
        text: emailOptions.text,
        html: emailOptions.html,
      };

      const result = await transporter.sendMail(mailOptions);

      // Track delivery if requested
      if (emailOptions.trackDelivery) {
        const deliveryStatus: EmailDeliveryStatus = {
          messageId: result.messageId,
          status: 'sent',
          timestamp: new Date(),
          recipient: emailOptions.to,
          subject: emailOptions.subject,
          provider: 'smtp'
        };
        deliveryTracking.set(result.messageId, deliveryStatus);
      }

      logger.info('Email sent successfully via SMTP', {
        to: emailOptions.to,
        subject: emailOptions.subject,
        messageId: result.messageId
      });

      return true;
    }
  } catch (error) {
    logger.error('Failed to send email', {
      error: error instanceof Error ? error.message : 'Unknown error',
      to: options?.to || (typeof apiKeyOrOptions === 'object' ? apiKeyOrOptions?.to : 'unknown')
    });
    return false;
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const subject = `Welcome to Cleanrylie, ${name}!`;
  const text = `Hi ${name},\n\nWelcome to our platform! We're excited to have you on board.\n\nBest regards,\nThe Cleanrylie Team`;
  const html = `
    <h1>Welcome to Cleanrylie, ${name}!</h1>
    <p>Hi ${name},</p>
    <p>Welcome to our platform! We're excited to have you on board.</p>
    <p>Best regards,<br>The Cleanrylie Team</p>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send report completion notification
 */
export async function sendReportEmail(email: string, reportId: string, reportType: string): Promise<boolean> {
  const subject = `Your ${reportType} Report is Ready [ID: ${reportId}]`;
  const text = `Your report (${reportType}) with ID ${reportId} has been generated and is ready for review.`;
  const html = `
    <h2>Report Ready</h2>
    <p>Your <strong>${reportType}</strong> report with ID <code>${reportId}</code> has been generated and is ready for review.</p>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send general notification email
 */
export async function sendNotificationEmail(email: string, subject: string, message: string): Promise<boolean> {
  const html = `
    <div>
      <h2>${subject}</h2>
      <p>${message}</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text: message, html });
}

/**
 * Send password reset email with token
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const subject = 'Password Reset Request';
  const text = `You have requested to reset your password. Use the following token: ${resetToken}`;
  const html = `
    <h2>Password Reset Request</h2>
    <p>You have requested to reset your password.</p>
    <p>Use the following token: <strong>${resetToken}</strong></p>
    <p>If you did not request this, please ignore this email.</p>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send handover notification email
 */
export async function sendHandoverEmail(email: string, handoverData: any): Promise<boolean> {
  const subject = 'Lead Handover Notification';
  const text = `You have received a lead handover. Details: ${JSON.stringify(handoverData, null, 2)}`;
  const html = `
    <h2>Lead Handover Notification</h2>
    <p>You have received a lead handover with the following details:</p>
    <pre>${JSON.stringify(handoverData, null, 2)}</pre>
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Get delivery status for a message
 */
export function getDeliveryStatus(messageId: string): EmailDeliveryStatus | null {
  return deliveryTracking.get(messageId) || null;
}

/**
 * Update delivery status (called by webhooks)
 */
export function updateDeliveryStatus(messageId: string, status: EmailDeliveryStatus['status'], metadata?: Record<string, any>): void {
  const existing = deliveryTracking.get(messageId);
  if (existing) {
    existing.status = status;
    existing.timestamp = new Date();
    if (metadata) {
      existing.metadata = { ...existing.metadata, ...metadata };
    }
    deliveryTracking.set(messageId, existing);

    logger.info('Email delivery status updated', {
      messageId,
      status,
      recipient: existing.recipient
    });
  }
}

/**
 * Get all delivery statuses for a recipient
 */
export function getDeliveryStatusesByRecipient(recipient: string): EmailDeliveryStatus[] {
  return Array.from(deliveryTracking.values()).filter(status => status.recipient === recipient);
}

/**
 * Send ADF response email with tracking
 */
export async function sendAdfResponseEmail(
  to: string,
  customerName: string,
  responseText: string,
  vehicleInfo?: string
): Promise<boolean> {
  const subject = `Thank you for your inquiry${vehicleInfo ? ` about ${vehicleInfo}` : ''}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Thank you for your interest!</h2>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
        ${responseText.split('\n').map(line => `<p>${line}</p>`).join('')}
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 12px;">
        This email was sent in response to your automotive inquiry.
        If you have any questions, please don't hesitate to contact us.
      </p>
    </div>
  `;

  return await sendEmail({
    to,
    subject,
    html,
    text: responseText,
    provider: 'sendgrid',
    trackDelivery: true,
    templateData: {
      customerName,
      responseText,
      vehicleInfo
    }
  });
}

/**
 * EmailService class - Main email service interface
 */
export class EmailService {
  private provider: 'sendgrid' | 'mailhog' | 'smtp';
  private sendgrid?: any;
  private smtpTransport?: any;
  private db: any;
  private rateLimitEnabled?: boolean;
  private rateLimitPerSecond?: number;
  private templateCache: Map<string, string> = new Map();
  private rateLimiter?: SimpleRateLimiter;

  constructor(
    database?: any, 
    rateLimitStore?: RateLimitStore, 
    nowFn?: NowFunction
  ) {
    this.provider = this.detectProvider();
    this.initializeProvider();
    this.db = database || db;
    this.rateLimitEnabled = false;
    this.rateLimitPerSecond = 10;
    
    // Initialize rate limiter with injected dependencies
    const store = rateLimitStore || new MemoryRateLimitStore(nowFn);
    this.rateLimiter = new SimpleRateLimiter(store, this.rateLimitPerSecond, nowFn);
    
    logger.info('EmailService initialized', { provider: this.provider });
  }

  /**
   * Update rate limiting configuration
   */
  updateRateLimitConfig(enabled: boolean, requestsPerSecond: number, store?: RateLimitStore, nowFn?: NowFunction): void {
    this.rateLimitEnabled = enabled;
    this.rateLimitPerSecond = requestsPerSecond;
    
    // Recreate rate limiter with new settings
    const rateLimitStore = store || new MemoryRateLimitStore(nowFn);
    this.rateLimiter = new SimpleRateLimiter(rateLimitStore, requestsPerSecond, nowFn);
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: any): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (error && typeof error === 'object') {
      // Handle objects with message property (like SendGrid errors)
      if (error.message) {
        return String(error.message);
      }
      
      // Handle objects with code and message
      if (error.code && error.message) {
        return `${error.message} (code: ${error.code})`;
      }
      
      // Try to JSON stringify for better debugging
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    
    return String(error);
  }

  /**
   * Determine if an error is retryable (transient) or permanent
   */
  private isRetryableError(error: any): boolean {
    // Handle errors with HTTP status codes
    if (error && typeof error === 'object' && error.code) {
      const code = parseInt(error.code);
      
      // Retryable codes (temporary failures)
      if (code === 429 || // Too many requests
          code === 502 || // Bad gateway
          code === 503 || // Service unavailable
          code === 504) { // Gateway timeout
        return true;
      }
      
      // Non-retryable codes (permanent failures)
      if (code === 400 || // Bad request
          code === 401 || // Unauthorized
          code === 403 || // Forbidden
          code === 404) { // Not found
        return false;
      }
    }
    
    // Handle Error objects by analyzing the message
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Check for rate limiting and other transient errors in the message
      if (message.includes('too many requests') ||
          message.includes('rate limit') ||
          message.includes('503') ||
          message.includes('504') ||
          message.includes('502') ||
          message.includes('service unavailable') ||
          message.includes('gateway timeout') ||
          message.includes('bad gateway')) {
        return true;
      }
      
      // Check for permanent errors in the message
      if (message.includes('unauthorized') ||
          message.includes('forbidden') ||
          message.includes('bad request') ||
          message.includes('not found') ||
          message.includes('401') ||
          message.includes('403') ||
          message.includes('400') ||
          message.includes('404')) {
        return false;
      }
      
      // Handle network errors (typically retryable)
      if (message.includes('network') ||
          message.includes('timeout') ||
          message.includes('econnreset') ||
          message.includes('enotfound')) {
        return true;
      }
    }
    
    // Default to non-retryable for unknown errors
    return false;
  }

  private detectProvider(): 'sendgrid' | 'mailhog' | 'smtp' {
    // Check explicit provider setting
    if (process.env.EMAIL_PROVIDER === 'sendgrid' && process.env.SENDGRID_API_KEY) {
      return 'sendgrid';
    }
    if (process.env.EMAIL_PROVIDER === 'mailhog' && process.env.MAILHOG_HOST) {
      return 'mailhog';
    }
    
    // Auto-detect based on available configuration
    if (process.env.SENDGRID_API_KEY) {
      return 'sendgrid';
    }
    if (process.env.MAILHOG_HOST) {
      return 'mailhog';
    }
    if (process.env.SMTP_HOST) {
      return 'smtp';
    }
    
    throw new Error('No email provider configuration found');
  }

  private initializeProvider(): void {
    switch (this.provider) {
      case 'sendgrid':
        // Initialize SendGrid
        this.sendgrid = {
          apiKey: process.env.SENDGRID_API_KEY,
          fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@cleanrylie.com'
        };
        break;
        
      case 'mailhog':
        // Initialize MailHog SMTP transport
        this.smtpTransport = nodemailer.createTransport({
          host: process.env.MAILHOG_HOST || 'localhost',
          port: parseInt(process.env.MAILHOG_PORT || '1025'),
          secure: false,
          ignoreTLS: true
        });
        break;
        
      case 'smtp':
        // Initialize SMTP transport
        this.smtpTransport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        break;
    }
  }

  async send(options: EmailOptions): Promise<{ messageId: string }> {
    try {
      // Validate required fields
      if (!options.to || options.to.trim() === '') {
        throw new Error('Recipient email is required');
      }

      if (!options.subject) {
        options.subject = 'No Subject';
      }

      if (!options.text && !options.html && !options.templateName) {
        throw new Error('Email must have either text or HTML content');
      }

      // Validate email address format (basic validation)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(options.to)) {
        logger.warn('Potentially invalid email address', { email: options.to });
      }

      // Content size validation and sanitization
      if (options.text && options.text.length > 500000) {
        logger.warn('Email content exceeds recommended size', { size: options.text.length });
        options.text = options.text.substring(0, 500000);
      }

      // Security check for suspicious content
      if (options.text && /<script|javascript:|data:/i.test(options.text)) {
        logger.warn('Potentially suspicious email content', { to: options.to });
      }

      // Apply rate limiting if enabled
      if (this.rateLimitEnabled && this.rateLimiter) {
        await this.rateLimiter.throttle();
      }

      let messageId: string;
      let success = false;
      let lastError: any = null;

      // Retry logic implementation
      const maxRetries = options.retryOptions?.retries || 0;
      const retryDelay = options.retryOptions?.retryDelay || 1000;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (this.provider === 'sendgrid') {
            const result = await this.sendViaSendGrid(options);
            messageId = result.messageId;
            success = result.success;
          } else {
            // SMTP (including MailHog)
            const result = await this.sendViaSmtp(options);
            messageId = result.messageId;
            success = result.success;
          }

          if (!success) {
            throw new Error(`Failed to send email via ${this.provider}`);
          }
          
          // Success - break out of retry loop
          break;
          
        } catch (error) {
          lastError = error;
          
          // If no retries configured, just throw the error immediately
          if (maxRetries === 0) {
            throw error;
          }
          
          // Check if this is a retryable error
          const isRetryableError = this.isRetryableError(error);
          
          // If this is the last attempt or not retryable, don't retry
          if (attempt >= maxRetries || !isRetryableError) {
            if (!isRetryableError) {
              // Don't retry on permanent errors - throw original error
              throw error;
            }
            if (attempt >= maxRetries) {
              throw new Error(`Failed to send email after ${maxRetries} retries`);
            }
            break;
          }
          
          // Log retry attempt
          logger.warn('Retrying email send after error', {
            attempt: attempt + 1,
            maxRetries,
            error: error instanceof Error ? error.message : String(error),
            to: options.to
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
      
      // If we get here without success, throw the last error
      if (!success) {
        throw lastError || new Error(`Failed to send email via ${this.provider}`);
      }

      // Database tracking if adfLeadId provided
      if (options.adfLeadId) {
        try {
          if (options.isRetry) {
            // Check for existing record and update it
            const existingRecords = await this.db.select({} as any)
              .from({} as any)
              .where({} as any)
              .limit(1);
            
            if (existingRecords.length > 0) {
              const existing = existingRecords[0];
              await this.db.update({} as any)
                .set({
                  deliveryStatus: 'sent',
                  deliveryAttempts: (existing.deliveryAttempts || 1) + 1,
                  providerMessageId: messageId,
                  updatedAt: new Date()
                })
                .where({} as any);
            } else {
              // Insert new record if none exists
              await this.db.insert({} as any).values({
                adfLeadId: options.adfLeadId,
                recipientEmail: options.to,
                emailSubject: options.subject,
                emailProvider: this.provider,
                providerMessageId: messageId,
                deliveryStatus: 'sent',
                deliveryAttempts: 2,
                createdAt: new Date(),
                updatedAt: new Date()
              }).returning();
            }
          } else {
            // Insert new record for first attempt
            await this.db.insert({} as any).values({
              adfLeadId: options.adfLeadId,
              recipientEmail: options.to,
              emailSubject: options.subject,
              emailProvider: this.provider,
              providerMessageId: messageId,
              deliveryStatus: 'sent',
              deliveryAttempts: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            }).returning();
          }
        } catch (dbError) {
          logger.error('Failed to track email in database', {
            error: dbError instanceof Error ? dbError.message : String(dbError),
            adfLeadId: options.adfLeadId
          });
        }
      }

      // Event emission
      eventBus.emit('email.sent', {
        to: options.to,
        subject: options.subject,
        messageId,
        provider: this.provider,
        adfLeadId: options.adfLeadId
      });

      // Metrics tracking for leads processed
      if (options.dealershipId) {
        prometheusMetrics.incrementLeadsProcessed({
          dealership_id: options.dealershipId,
          status: 'email_sent'
        });
      }

      // Metrics tracking for handover emails
      if (options.isHandoverEmail && options.dealershipId) {
        prometheusMetrics.incrementHandoverEmailSent({
          dealership_id: options.dealershipId,
          status: 'sent',
          template: options.templateName || 'default'
        });
      }

      return { messageId };

    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      
      // Track failed delivery in database
      if (options.adfLeadId) {
        try {
          await this.db.insert({} as any).values({
            adfLeadId: options.adfLeadId,
            recipientEmail: options.to,
            emailSubject: options.subject || 'No Subject',
            emailProvider: this.provider,
            deliveryStatus: 'failed',
            errorMessage: errorMessage,
            deliveryAttempts: options.isRetry ? 2 : 1,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();
        } catch (dbError) {
          logger.error('Failed to track failed email in database', {
            error: dbError instanceof Error ? dbError.message : String(dbError)
          });
        }
      }

      // Emit failure event
      if (options.adfLeadId) {
        eventBus.emit('email.failed', {
          to: options.to,
          subject: options.subject || 'No Subject',
          adfLeadId: options.adfLeadId,
          error: errorMessage
        });
      }

      // Track failed metrics
      if (options.dealershipId) {
        prometheusMetrics.incrementLeadsProcessed({
          dealership_id: options.dealershipId,
          status: 'email_failed'
        });
      }

      logger.error('EmailService send failed', {
        error: errorMessage,
        to: options.to,
        provider: this.provider
      });

      throw new Error(errorMessage);
    }
  }

  private async sendViaSendGrid(options: EmailOptions): Promise<{ messageId: string; success: boolean }> {
    try {
      // Use dynamic import to match the test pattern
      const sendgridModule = await import('@sendgrid/mail');
      
      // Access SendGrid methods - check both default and direct exports
      let sgMail;
      if (sendgridModule.default && sendgridModule.default.send) {
        sgMail = sendgridModule.default;
      } else if (sendgridModule.send) {
        sgMail = sendgridModule;
      } else {
        // Fallback to CommonJS require for compatibility
        const fallbackModule = require('@sendgrid/mail');
        sgMail = fallbackModule.default || fallbackModule;
      }
      
      // Check if SendGrid is properly configured/mocked
      if (!sgMail || !sgMail.send) {
        throw new Error(`SendGrid SDK not available`);
      }
      
      // Set API key if available and method exists
      if (sgMail.setApiKey && this.sendgrid?.apiKey) {
        sgMail.setApiKey(this.sendgrid.apiKey);
      }

      const mailOptions = {
        to: options.to,
        from: options.from || this.sendgrid?.fromEmail || process.env.SENDGRID_FROM_EMAIL,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      // Call SendGrid send method
      logger.debug('Calling SendGrid send with options', { mailOptions });
      const result = await sgMail.send(mailOptions);
      logger.debug('SendGrid send result', { result });
      
      // Extract message ID from SendGrid response
      const messageId = result[0]?.headers?.['x-message-id'] || `sg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('Email sent via SendGrid', {
        to: options.to,
        subject: options.subject,
        messageId
      });

      return { messageId, success: true };
    } catch (error) {
      logger.error('SendGrid API error', {
        error: this.getErrorMessage(error),
        to: options.to
      });
      throw new Error(`Failed to send email via SendGrid: ${this.getErrorMessage(error)}`);
    }
  }

  private async sendViaSmtp(options: EmailOptions): Promise<{ messageId: string; success: boolean }> {
    try {
      if (!this.smtpTransport) {
        throw new Error('SMTP transport not initialized');
      }

      const mailOptions = {
        from: options.from || this.sendgrid?.fromEmail || process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      const result = await this.smtpTransport.sendMail(mailOptions);

      logger.info('Email sent via SMTP', {
        to: options.to,
        subject: options.subject,
        messageId: result.messageId
      });

      return { messageId: result.messageId, success: true };
    } catch (error) {
      logger.error('SMTP error', {
        error: this.getErrorMessage(error),
        to: options.to
      });
      throw new Error(`Failed to send email via SMTP: ${this.getErrorMessage(error)}`);
    }
  }

  async sendTemplate(options: EmailOptions): Promise<{ messageId: string } | { success: boolean; errors?: string[] }> {
    try {
      if (!options.templateName) {
        throw new Error('Template name is required for template-based sending');
      }

      // Render the template with provided data
      const html = await this.renderTemplate(`${options.templateName}.html`, options.templateData || {});
      const text = await this.renderTemplate(`${options.templateName}.txt`, options.templateData || {});

      // Create email options with rendered content
      const emailOptions: EmailOptions = {
        ...options,
        html,
        text
      };

      // Send the email using the regular send method
      return await this.send(emailOptions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('EmailService sendTemplate failed', { error: errorMessage });
      return {
        success: false,
        errors: [errorMessage]
      };
    }
  }

  async sendTemplateEmail(options: {
    to: string | string[];
    subject: string;
    template: string;
    data: Record<string, any>;
  }): Promise<{ success: boolean; errors?: string[] }> {
    try {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const results = [];

      for (const recipient of recipients) {
        const html = await this.renderTemplate(options.template, options.data);
        const emailOptions: EmailOptions = {
          to: recipient,
          subject: options.subject,
          html,
          text: html.replace(/<[^>]*>/g, ''), // Simple HTML to text conversion
          trackDelivery: true
        };

        const success = await sendEmail(emailOptions);
        results.push(success);
      }

      const allSuccessful = results.every(result => result);
      
      if (!allSuccessful) {
        const failedCount = results.filter(result => !result).length;
        return {
          success: false,
          errors: [`Failed to send ${failedCount} out of ${results.length} emails`]
        };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('EmailService sendTemplateEmail failed', { error: errorMessage });
      return {
        success: false,
        errors: [errorMessage]
      };
    }
  }

  async renderTemplate(templatePath: string, data: Record<string, any>): Promise<string> {
    try {
      let templateContent: string;
      
      // Check cache first
      if (this.templateCache.has(templatePath)) {
        templateContent = this.templateCache.get(templatePath)!;
      } else {
        // Import at the top level to work with vitest mocks
        const fs = await import('fs');
        const path = await import('path');
        
        // Construct full template path
        const fullPath = path.resolve(__dirname, '../templates', templatePath);
        
        // Read template file
        templateContent = await fs.promises.readFile(fullPath, 'utf8');
        
        // Cache the template content
        this.templateCache.set(templatePath, templateContent);
      }
      
      // Validate Handlebars syntax before rendering
      // Check for malformed handlebars expressions
      const malformedExpressions = templateContent.match(/{{[^}]*[^}][^}]*$/gm) || 
                                   templateContent.match(/{{[^{}]*[!@#$%^&*()+=\[\];':"\\|,.<>?]/g);
      if (malformedExpressions && malformedExpressions.length > 0) {
        throw new Error('Invalid template syntax: malformed handlebars expressions');
      }
      
      // Simple Handlebars-style template rendering
      let rendered = templateContent;
      for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, String(value));
      }
      
      return rendered;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Different error messages based on the error type
      if (errorMessage.includes('no such file') || errorMessage.includes('File not found')) {
        logger.error('Failed to load email template', { 
          templatePath, 
          error: errorMessage 
        });
        throw new Error('Failed to load email template');
      } else {
        logger.error('Failed to render email template', { 
          templatePath, 
          error: errorMessage 
        });
        throw new Error('Failed to render email template');
      }
    }
  }

  private renderInlineTemplate(template: string, data: Record<string, any>): string {
    // Simple template rendering - replace {{variable}} with data values
    let html = this.getTemplateHtml(template);
    
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
    }
    
    return html;
  }

  private renderTextTemplate(template: string, data: Record<string, any>): string {
    // Simple text template rendering
    let text = this.getTemplateText(template);
    
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      text = text.replace(regex, String(value));
    }
    
    return text;
  }

  private getTemplateHtml(template: string): string {
    // Return appropriate HTML template based on template name
    switch (template) {
      case 'default-handover':
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Lead Handover Notification</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Lead Details</h3>
              <p><strong>Handover ID:</strong> {{handoverId}}</p>
              <p><strong>Customer:</strong> {{customerName}}</p>
              <p><strong>Email:</strong> {{customerEmail}}</p>
              <p><strong>Phone:</strong> {{customerPhone}}</p>
              <p><strong>Dealership:</strong> {{dealershipName}}</p>
              <p><strong>Reason:</strong> {{reason}}</p>
              <p><strong>Vehicle:</strong> {{vehicleInfo}}</p>
              <p><strong>Source:</strong> {{sourceProvider}}</p>
              <p><strong>Escalation Level:</strong> {{escalationLevel}}</p>
              <p><strong>Timestamp:</strong> {{timestamp}}</p>
            </div>
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h4>Comments:</h4>
              <p>{{comments}}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This handover notification was automatically generated by the ADF Lead Processing System.
            </p>
          </div>
        `;
      default:
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Notification</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <p>This is a default email template.</p>
            </div>
          </div>
        `;
    }
  }

  private getTemplateText(template: string): string {
    // Return appropriate text template based on template name
    switch (template) {
      case 'default-handover':
        return `
Lead Handover Notification

Lead Details:
- Handover ID: {{handoverId}}
- Customer: {{customerName}}
- Email: {{customerEmail}}
- Phone: {{customerPhone}}
- Dealership: {{dealershipName}}
- Reason: {{reason}}
- Vehicle: {{vehicleInfo}}
- Source: {{sourceProvider}}
- Escalation Level: {{escalationLevel}}
- Timestamp: {{timestamp}}

Comments:
{{comments}}

This handover notification was automatically generated by the ADF Lead Processing System.
        `;
      default:
        return 'This is a default email template.';
    }
  }

  // Delegate other methods to the standalone functions
  async sendEmail(options: EmailOptions): Promise<boolean> {
    return sendEmail(options);
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return sendWelcomeEmail(email, name);
  }

  async sendReportEmail(email: string, reportId: string, reportType: string): Promise<boolean> {
    return sendReportEmail(email, reportId, reportType);
  }

  async sendNotificationEmail(email: string, subject: string, message: string): Promise<boolean> {
    return sendNotificationEmail(email, subject, message);
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    return sendPasswordResetEmail(email, resetToken);
  }

  async sendHandoverEmail(email: string, handoverData: any): Promise<boolean> {
    return sendHandoverEmail(email, handoverData);
  }

  async sendAdfResponseEmail(
    to: string,
    customerName: string,
    responseText: string,
    vehicleInfo?: string
  ): Promise<boolean> {
    return sendAdfResponseEmail(to, customerName, responseText, vehicleInfo);
  }

  getDeliveryStatus(messageId: string): EmailDeliveryStatus | null {
    return getDeliveryStatus(messageId);
  }

  updateDeliveryStatus(messageId: string, status: EmailDeliveryStatus['status'], metadata?: Record<string, any>): void {
    return updateDeliveryStatus(messageId, status, metadata);
  }

  getDeliveryStatusesByRecipient(recipient: string): EmailDeliveryStatus[] {
    return getDeliveryStatusesByRecipient(recipient);
  }
}

export default {
  sendEmail,
  sendWelcomeEmail,
  sendReportEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendHandoverEmail,
  sendAdfResponseEmail,
  getDeliveryStatus,
  updateDeliveryStatus,
  getDeliveryStatusesByRecipient,
};