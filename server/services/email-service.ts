/**
 * Email Service
 * Provides email functionality for user notifications, reports, and system alerts
 */

import * as nodemailer from 'nodemailer';
import logger from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
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

    const transporter = createTransporter();
    
    const mailOptions = {
      from: emailOptions.from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: emailOptions.to,
      subject: emailOptions.subject,
      text: emailOptions.text,
      html: emailOptions.html,
    };

    const result = await transporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully', {
      to: emailOptions.to,
      subject: emailOptions.subject,
      messageId: result.messageId
    });

    return true;
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

export default {
  sendEmail,
  sendWelcomeEmail,
  sendReportEmail,
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendHandoverEmail,
};