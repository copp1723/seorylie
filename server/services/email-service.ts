
import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import { createTransport } from 'nodemailer';

// Email configuration
interface EmailConfig {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  pool?: boolean;
  maxConnections?: number;
  maxMessages?: number;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig;
  private retryConfig: RetryConfig;
  private isInitialized = false;

  constructor() {
    this.config = this.getEmailConfig();
    this.retryConfig = {
      maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3'),
      baseDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '1000'),
      maxDelay: parseInt(process.env.EMAIL_MAX_DELAY || '30000'),
      exponentialBackoff: true
    };
  }

  private getEmailConfig(): EmailConfig {
    const emailService = process.env.EMAIL_SERVICE;

    switch (emailService) {
      case 'sendgrid':
        return {
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY || ''
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        };

      case 'gmail':
        return {
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER || '',
            pass: process.env.GMAIL_APP_PASSWORD || ''
          },
          pool: true,
          maxConnections: 3,
          maxMessages: 50
        };

      case 'smtp':
      default:
        return {
          host: process.env.EMAIL_HOST || process.env.SMTP_HOST || '0.0.0.0',
          port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER || process.env.SMTP_USER || '',
            pass: process.env.EMAIL_PASS || process.env.SMTP_PASSWORD || ''
          },
          pool: true,
          maxConnections: 5,
          maxMessages: 100
        };
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!this.config.auth.user || !this.config.auth.pass) {
        throw new Error('Email authentication credentials not configured');
      }

      this.transporter = createTransport(this.config);
      await this.testConnection();

      this.isInitialized = true;
      logger.info('Email service initialized', {
        service: process.env.EMAIL_SERVICE || 'smtp'
      });

    } catch (error) {
      logger.error('Failed to initialize email service:', error);

      if (process.env.NODE_ENV === 'development') {
        logger.warn('Using test email transporter for development');
        this.transporter = createTransport({
          host: '0.0.0.0',
          port: 1025,
          ignoreTLS: true
        });
        this.isInitialized = true;
      } else {
        throw error;
      }
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      await this.transporter.verify();
      logger.debug('Email connection test successful');
    } catch (error) {
      logger.error('Email connection test failed:', error);
      throw new Error(`Email service connection failed: ${error.message}`);
    }
  }

  private calculateDelay(attempt: number): number {
    if (!this.retryConfig.exponentialBackoff) {
      return this.retryConfig.baseDelay;
    }

    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    const jitterDelay = exponentialDelay + Math.random() * 1000;
    return Math.min(jitterDelay, this.retryConfig.maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise<void>((resolve: () => void) => setTimeout(resolve, ms));
  }

  async sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      return { success: false, error: 'Email service not available' };
    }

    if (!options.to || !options.subject) {
      return { success: false, error: 'Missing required email fields' };
    }

    if (!options.html && !options.text) {
      return { success: false, error: 'Email must have content' };
    }

    const emailData = {
      from: options.from || process.env.EMAIL_FROM || 'noreply@rylie.ai',
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      attachments: options.attachments
    };

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        logger.debug(`Sending email attempt ${attempt}/${this.retryConfig.maxRetries}`);
        const result = await this.transporter.sendMail(emailData);

        logger.info('Email sent successfully', {
          messageId: result.messageId,
          to: emailData.to,
          subject: emailData.subject
        });

        return { success: true, messageId: result.messageId };

      } catch (error: any) {
        logger.warn(`Email send attempt ${attempt} failed:`, {
          error: error.message,
          code: error.code
        });

        const nonRetryableErrors = ['EAUTH', 'EENVELOPE', 'EMESSAGE'];
        if (nonRetryableErrors.includes(error.code) || attempt === this.retryConfig.maxRetries) {
          logger.error('Email send failed permanently:', error);
          return { success: false, error: error.message };
        }

        const delayMs = this.calculateDelay(attempt);
        await this.delay(delayMs);
      }
    }

    return { success: false, error: 'Failed to send email after all retries' };
  }

  async sendTemplatedEmail(
    templateName: string,
    to: string | string[],
    variables: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const template = await this.getEmailTemplate(templateName);
      if (!template) {
        return { success: false, error: `Template '${templateName}' not found` };
      }

      const subject = this.replaceVariables(template.subject, variables);
      const html = this.replaceVariables(template.html, variables);
      const text = template.text ? this.replaceVariables(template.text, variables) : undefined;

      return await this.sendEmail({ to, subject, html, text });
    } catch (error: any) {
      logger.error('Failed to send templated email:', error);
      return { success: false, error: error.message };
    }
  }

  private replaceVariables(content: string, variables: Record<string, any>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  private async getEmailTemplate(templateName: string): Promise<{
    subject: string;
    html: string;
    text?: string;
  } | null> {
    const templates: Record<string, any> = {
      'welcome': {
        subject: 'Welcome to {{companyName}}',
        html: `
          <h1>Welcome {{userName}}!</h1>
          <p>Thank you for joining {{companyName}}.</p>
          <p>Your account has been created successfully.</p>
        `,
        text: 'Welcome {{userName}}! Thank you for joining {{companyName}}.'
      },
      'password_reset': {
        subject: 'Reset your password',
        html: `
          <h1>Password Reset Request</h1>
          <p>You requested a password reset for your {{companyName}} account.</p>
          <p><a href="{{resetLink}}">Click here to reset your password</a></p>
          <p>This link will expire in 1 hour.</p>
        `,
        text: 'Reset your password: {{resetLink}} (expires in 1 hour)'
      }
    };

    return templates[templateName] || null;
  }

  async getServiceStatus(): Promise<{
    isInitialized: boolean;
    isConnected: boolean;
    error?: string;
  }> {
    if (!this.isInitialized) {
      return {
        isInitialized: false,
        isConnected: false,
        error: 'Email service not initialized'
      };
    }

    try {
      await this.testConnection();
      return { isInitialized: true, isConnected: true };
    } catch (error: any) {
      return {
        isInitialized: true,
        isConnected: false,
        error: error.message
      };
    }
  }

  async close(): Promise<void> {
    if (this.transporter && this.isInitialized) {
      try {
        this.transporter.close();
        logger.info('Email service connection closed');
      } catch (error) {
        logger.error('Error closing email service:', error);
      }
    }
    this.isInitialized = false;
  }
}

export const emailService = new EmailService();

export async function sendEmail(options: EmailOptions) {
  return emailService.sendEmail(options);
}

export async function sendTemplatedEmail(
  templateName: string,
  to: string | string[],
  variables: Record<string, any>
) {
  return emailService.sendTemplatedEmail(templateName, to, variables);
}

export async function initializeEmailService() {
  return emailService.initialize();
}

export async function getEmailServiceStatus() {
  return emailService.getServiceStatus();
}

export async function sendNotificationEmail(email: string, subject: string, message: string) {
  return emailService.sendEmail({
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Notification</h2>
        <p style="color: #666; line-height: 1.6;">${message}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">This is an automated notification from Rylie AI.</p>
      </div>
    `,
    text: `Notification: ${message}`
  });
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5001'}/reset-password?token=${resetToken}`;

  return emailService.sendEmail({
    to: email,
    subject: 'Password Reset Request - Rylie AI',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p style="color: #666; line-height: 1.6;">
          You have requested to reset your password for your Rylie AI account.
        </p>
        <p style="color: #666; line-height: 1.6;">
          Click the button below to reset your password:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #666; line-height: 1.6;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
        </p>
      </div>
    `,
    text: `Password Reset Request\n\nYou have requested to reset your password for your Rylie AI account.\n\nClick this link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour. If you didn't request this password reset, please ignore this email.`
  });
}

export async function sendHandoverEmail(email: string, handoverData: any) {
  const { customerName, dealershipName, conversationSummary, nextSteps } = handoverData;

  return emailService.sendEmail({
    to: email,
    subject: `Customer Handover: ${customerName} - ${dealershipName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Customer Handover</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${customerName}</p>
          <p><strong>Dealership:</strong> ${dealershipName}</p>
        </div>

        <h3 style="color: #333;">Conversation Summary</h3>
        <p style="color: #666; line-height: 1.6;">${conversationSummary}</p>

        <h3 style="color: #333;">Recommended Next Steps</h3>
        <ul style="color: #666; line-height: 1.6;">
          ${Array.isArray(nextSteps) ? nextSteps.map(step => `<li>${step}</li>`).join('') : `<li>${nextSteps}</li>`}
        </ul>

        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">This handover was generated by Rylie AI.</p>
      </div>
    `,
    text: `Customer Handover: ${customerName} - ${dealershipName}\n\nConversation Summary:\n${conversationSummary}\n\nRecommended Next Steps:\n${Array.isArray(nextSteps) ? nextSteps.join('\n- ') : nextSteps}\n\nThis handover was generated by Rylie AI.`
  });
}

export async function sendWelcomeEmail(email: string, name: string) {
  return emailService.sendEmail({
    to: email,
    subject: 'Welcome to Rylie AI!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Rylie AI, ${name}!</h2>
        <p style="color: #666; line-height: 1.6;">
          Thank you for joining Rylie AI. We're excited to help you transform your customer interactions with our AI-powered platform.
        </p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Getting Started</h3>
          <ul style="color: #666; line-height: 1.6;">
            <li>Complete your profile setup</li>
            <li>Configure your dealership settings</li>
            <li>Start your first AI conversation</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5001'}/dashboard" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Get Started
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Welcome to the future of automotive customer service!</p>
      </div>
    `,
    text: `Welcome to Rylie AI, ${name}!\n\nThank you for joining Rylie AI. We're excited to help you transform your customer interactions with our AI-powered platform.\n\nGetting Started:\n- Complete your profile setup\n- Configure your dealership settings\n- Start your first AI conversation\n\nVisit your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:5001'}/dashboard\n\nWelcome to the future of automotive customer service!`
  });
}

export async function sendInventoryUpdateEmail(email: string, subject: string, result: any) {
  return emailService.sendEmail({
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Inventory Update Processed</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Processing Results</h3>
          <p><strong>Status:</strong> ${result.success ? 'Success' : 'Failed'}</p>
          ${result.stats ? `
            <p><strong>Added:</strong> ${result.stats.added} vehicles</p>
            <p><strong>Updated:</strong> ${result.stats.updated} vehicles</p>
            <p><strong>Deactivated:</strong> ${result.stats.deactivated} vehicles</p>
            <p><strong>Errors:</strong> ${result.stats.errors} errors</p>
          ` : ''}
          ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">This update was processed by Rylie AI inventory system.</p>
      </div>
    `,
    text: `Inventory Update Processed\n\nStatus: ${result.success ? 'Success' : 'Failed'}\n${result.stats ? `Added: ${result.stats.added} vehicles\nUpdated: ${result.stats.updated} vehicles\nDeactivated: ${result.stats.deactivated} vehicles\nErrors: ${result.stats.errors} errors\n` : ''}${result.error ? `Error: ${result.error}` : ''}`
  });
}

export async function sendReportEmail(email: string, reportId: string, reportType: string) {
  const reportUrl = `${process.env.FRONTEND_URL || 'http://localhost:5001'}/reports/${reportId}`;

  return emailService.sendEmail({
    to: email,
    subject: `Your ${reportType} Report is Ready - Rylie AI`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your Report is Ready</h2>
        <p style="color: #666; line-height: 1.6;">
          Your ${reportType} report has been generated and is ready for review.
        </p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Report Details</h3>
          <p><strong>Type:</strong> ${reportType}</p>
          <p><strong>Report ID:</strong> ${reportId}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${reportUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            View Report
          </a>
        </div>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">This report was generated by Rylie AI analytics.</p>
      </div>
    `,
    text: `Your Report is Ready\n\nYour ${reportType} report has been generated and is ready for review.\n\nReport Details:\nType: ${reportType}\nReport ID: ${reportId}\nGenerated: ${new Date().toLocaleDateString()}\n\nView your report: ${reportUrl}\n\nThis report was generated by Rylie AI analytics.`
  });
}
