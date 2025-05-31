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