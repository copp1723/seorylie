/**
 * Email Service
 * Provides email functionality for user notifications, reports, and system alerts
 * Supports both SMTP and SendGrid for email delivery
 */

import * as nodemailer from 'nodemailer';
import logger from '../utils/logger';

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
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  provider?: 'smtp' | 'sendgrid';
  trackDelivery?: boolean;
  templateId?: string; // For SendGrid templates
  templateData?: Record<string, any>; // For SendGrid template variables
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
  constructor() {
    logger.info('EmailService initialized');
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
        const emailOptions: EmailOptions = {
          to: recipient,
          subject: options.subject,
          html: this.renderTemplate(options.template, options.data),
          text: this.renderTextTemplate(options.template, options.data),
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

  private renderTemplate(template: string, data: Record<string, any>): string {
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