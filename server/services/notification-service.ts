/**
 * Notification Service
 * 
 * A comprehensive notification service that supports multiple channels:
 * - Slack webhook integration for critical diagnostics
 * - Email notifications using SendGrid
 * - Webhook notifications for third-party integrations
 * 
 * Features:
 * - Template-based notifications
 * - Priority levels (critical, warning, info)
 * - Retry logic and error handling
 * - Rate limiting and queuing
 * - Integration with event bus
 * - Notification history and audit trails
 */

import axios from 'axios';
import * as crypto from 'crypto';
import { db } from '../db';
import { logger } from '../utils/logger';
import * as sendgrid from '@sendgrid/mail';
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './event-bus';
import { CircuitBreaker } from './circuit-breaker';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  notificationChannels, 
  notificationHistory, 
  notificationTemplates,
  notificationSubscriptions
} from '../../shared/schema';

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Notification channel types
 */
export enum NotificationChannelType {
  SLACK = 'slack',
  EMAIL = 'email',
  WEBHOOK = 'webhook'
}

/**
 * Notification status
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited'
}

/**
 * Base notification payload
 */
export interface NotificationPayload {
  title: string;
  message: string;
  priority: NotificationPriority;
  data?: Record<string, any>;
  templateId?: string;
  correlationId?: string;
  userId?: number;
  dealershipId?: number;
  sandboxId?: number;
}

/**
 * Slack notification payload
 */
export interface SlackNotificationPayload extends NotificationPayload {
  channel?: string;
  webhookUrl?: string;
  blocks?: any[];
}

/**
 * Email notification payload
 */
export interface EmailNotificationPayload extends NotificationPayload {
  to: string | string[];
  from?: string;
  subject?: string;
  html?: string;
  text?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

/**
 * Webhook notification payload
 */
export interface WebhookNotificationPayload extends NotificationPayload {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  hmacSecret?: string;
}

/**
 * Notification template context
 */
export interface TemplateContext {
  title: string;
  message: string;
  priority: NotificationPriority;
  timestamp: string;
  data?: Record<string, any>;
  dealershipName?: string;
  userName?: string;
  [key: string]: any;
}

/**
 * Notification service configuration
 */
export interface NotificationServiceConfig {
  defaultSlackWebhook?: string;
  defaultSlackChannel?: string;
  defaultEmailFrom?: string;
  defaultEmailReplyTo?: string;
  maxRetries?: number;
  retryDelay?: number;
  rateLimit?: {
    critical: number;
    warning: number;
    info: number;
  };
  templatesDir?: string;
}

/**
 * NotificationService class
 * 
 * Handles sending notifications through various channels,
 * with support for templates, priorities, and retry logic.
 */
export class NotificationService {
  private config: NotificationServiceConfig;
  private slackCircuitBreaker: CircuitBreaker;
  private emailCircuitBreaker: CircuitBreaker;
  private webhookCircuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimitCounters: Map<string, { count: number, resetAt: number }> = new Map();
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  
  constructor(config: NotificationServiceConfig = {}) {
    this.config = {
      defaultSlackWebhook: process.env.SLACK_WEBHOOK_URL,
      defaultSlackChannel: process.env.SLACK_CHANNEL || '#notifications',
      defaultEmailFrom: process.env.EMAIL_FROM || 'noreply@example.com',
      defaultEmailReplyTo: process.env.EMAIL_REPLY_TO,
      maxRetries: 3,
      retryDelay: 1000,
      rateLimit: {
        critical: 10,  // 10 per minute
        warning: 5,    // 5 per minute
        info: 2        // 2 per minute
      },
      templatesDir: path.join(process.cwd(), 'templates', 'notifications'),
      ...config
    };
    
    // Initialize circuit breakers for external services
    this.slackCircuitBreaker = new CircuitBreaker({
      name: 'slack-notifier',
      maxFailures: 5,
      resetTimeout: 30000,
      timeout: 5000
    });
    
    this.emailCircuitBreaker = new CircuitBreaker({
      name: 'email-notifier',
      maxFailures: 5,
      resetTimeout: 30000,
      timeout: 10000
    });
    
    // Subscribe to relevant events for automated notifications
    this.subscribeToEvents();
  }
  
  /**
   * Subscribe to platform events for automated notifications
   */
  private subscribeToEvents(): void {
    // Subscribe to diagnostic events
    eventBus.subscribe('events.platform', 'notification-service', async (event) => {
      try {
        // Handle diagnostic events
        if (event.type === 'DIAGNOSTIC_CRITICAL') {
          await this.sendSlackNotification({
            title: 'CRITICAL DIAGNOSTIC ALERT',
            message: event.payload.message,
            priority: NotificationPriority.CRITICAL,
            data: event.payload,
            correlationId: event.correlationId
          });
        }
        
        // Handle zero spend events
        if (event.type === 'ADS_ZERO_SPEND_DETECTED') {
          await this.sendSlackNotification({
            title: 'Zero Ad Spend Detected',
            message: `Account ${event.payload.accountId} has zero spend for ${event.payload.days} days`,
            priority: NotificationPriority.WARNING,
            data: event.payload,
            correlationId: event.correlationId
          });
        }
        
        // Handle rate limit events
        if (event.type === 'RATE_LIMIT_EXCEEDED') {
          await this.sendSlackNotification({
            title: 'Rate Limit Exceeded',
            message: `Sandbox ${event.payload.sandboxId} has exceeded its rate limit`,
            priority: NotificationPriority.WARNING,
            data: event.payload,
            correlationId: event.correlationId
          });
        }
      } catch (error) {
        logger.error('Error processing event for notification', {
          eventType: event.type,
          error: error.message,
          correlationId: event.correlationId
        });
      }
    });
  }
  
  /**
   * Send a notification to Slack
   */
  async sendSlackNotification(payload: SlackNotificationPayload): Promise<boolean> {
    try {
      const { title, message, priority, data, templateId, correlationId, userId, dealershipId, sandboxId } = payload;
      const channel = payload.channel || this.config.defaultSlackChannel;
      const webhookUrl = payload.webhookUrl || this.config.defaultSlackWebhook;
      
      if (!webhookUrl) {
        throw new Error('Slack webhook URL is required');
      }
      
      // Check rate limits
      if (this.isRateLimited('slack', priority)) {
        await this.logNotification({
          channelType: NotificationChannelType.SLACK,
          priority,
          title,
          message,
          status: NotificationStatus.RATE_LIMITED,
          metadata: { channel, correlationId },
          userId,
          dealershipId,
          sandboxId
        });
        return false;
      }
      
      // Prepare the message payload
      let blocks = payload.blocks;
      
      if (!blocks && templateId) {
        // Use template if specified
        const context: TemplateContext = {
          title,
          message,
          priority,
          timestamp: new Date().toISOString(),
          data,
          dealershipName: dealershipId ? await this.getDealershipName(dealershipId) : undefined,
          userName: userId ? await this.getUserName(userId) : undefined
        };
        
        blocks = await this.renderSlackTemplate(templateId, context);
      }
      
      if (!blocks) {
        // Default formatting if no template or blocks provided
        blocks = [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: title,
              emoji: true
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: message
            }
          }
        ];
        
        // Add priority indicator
        const emoji = priority === NotificationPriority.CRITICAL ? '🔴' : 
                     priority === NotificationPriority.WARNING ? '🟠' : '🔵';
        
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `${emoji} *Priority:* ${priority.toUpperCase()}`
            }
          ]
        });
        
        // Add data if provided
        if (data && Object.keys(data).length > 0) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '```' + JSON.stringify(data, null, 2) + '```'
            }
          });
        }
      }
      
      // Send the notification with retry logic
      const slackPayload = {
        channel,
        blocks
      };
      
      const result = await this.slackCircuitBreaker.execute(async () => {
        let retries = 0;
        let success = false;
        let lastError = null;
        
        while (retries <= this.config.maxRetries && !success) {
          try {
            const response = await axios.post(webhookUrl, slackPayload, {
              headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.status === 200) {
              success = true;
            }
          } catch (error) {
            lastError = error;
            retries++;
            
            if (retries <= this.config.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retries));
            }
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
        
        return success;
      });
      
      // Log the notification
      await this.logNotification({
        channelType: NotificationChannelType.SLACK,
        priority,
        title,
        message,
        status: result ? NotificationStatus.SENT : NotificationStatus.FAILED,
        metadata: { channel, correlationId },
        userId,
        dealershipId,
        sandboxId
      });
      
      // Update rate limit counter
      this.incrementRateLimit('slack', priority);
      
      return result;
    } catch (error) {
      logger.error('Error sending Slack notification', {
        error: error.message,
        correlationId: payload.correlationId
      });
      
      // Log the failed notification
      await this.logNotification({
        channelType: NotificationChannelType.SLACK,
        priority: payload.priority,
        title: payload.title,
        message: payload.message,
        status: NotificationStatus.FAILED,
        metadata: { 
          error: error.message, 
          correlationId: payload.correlationId 
        },
        userId: payload.userId,
        dealershipId: payload.dealershipId,
        sandboxId: payload.sandboxId
      });
      
      return false;
    }
  }
  
  /**
   * Send an email notification
   */
  async sendEmailNotification(payload: EmailNotificationPayload): Promise<boolean> {
    try {
      const { title, message, priority, data, templateId, correlationId, userId, dealershipId, sandboxId } = payload;
      
      if (!payload.to) {
        throw new Error('Email recipient is required');
      }
      
      // Check rate limits
      if (this.isRateLimited('email', priority)) {
        await this.logNotification({
          channelType: NotificationChannelType.EMAIL,
          priority,
          title,
          message,
          status: NotificationStatus.RATE_LIMITED,
          metadata: { to: payload.to, correlationId },
          userId,
          dealershipId,
          sandboxId
        });
        return false;
      }
      
      // Prepare email content
      let html = payload.html;
      let text = payload.text;
      const subject = payload.subject || title;
      const from = payload.from || this.config.defaultEmailFrom;
      
      if (!html && templateId) {
        // Use template if specified
        const context: TemplateContext = {
          title,
          message,
          priority,
          timestamp: new Date().toISOString(),
          data,
          dealershipName: dealershipId ? await this.getDealershipName(dealershipId) : undefined,
          userName: userId ? await this.getUserName(userId) : undefined
        };
        
        html = await this.renderEmailTemplate(templateId, context);
      }
      
      if (!html) {
        // Default HTML if no template provided
        html = `
          <h1>${title}</h1>
          <p>${message}</p>
          ${data ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : ''}
          <p><small>Priority: ${priority.toUpperCase()}</small></p>
        `;
      }
      
      if (!text) {
        // Generate plain text version
        text = `${title}\n\n${message}\n\n${data ? JSON.stringify(data, null, 2) : ''}\n\nPriority: ${priority.toUpperCase()}`;
      }
      
      // Prepare email payload
      const emailPayload = {
        to: payload.to,
        from,
        subject,
        html,
        text,
        attachments: payload.attachments || []
      };
      
      // Add reply-to if configured
      if (this.config.defaultEmailReplyTo) {
        emailPayload['reply_to'] = this.config.defaultEmailReplyTo;
      }
      
      // Send the email with retry logic
      const result = await this.emailCircuitBreaker.execute(async () => {
        let retries = 0;
        let success = false;
        let lastError = null;
        
        while (retries <= this.config.maxRetries && !success) {
          try {
            await sendgrid.send(emailPayload);
            success = true;
          } catch (error) {
            lastError = error;
            retries++;
            
            if (retries <= this.config.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retries));
            }
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
        
        return success;
      });
      
      // Log the notification
      await this.logNotification({
        channelType: NotificationChannelType.EMAIL,
        priority,
        title,
        message,
        status: result ? NotificationStatus.SENT : NotificationStatus.FAILED,
        metadata: { to: payload.to, subject, correlationId },
        userId,
        dealershipId,
        sandboxId
      });
      
      // Update rate limit counter
      this.incrementRateLimit('email', priority);
      
      return result;
    } catch (error) {
      logger.error('Error sending email notification', {
        error: error.message,
        correlationId: payload.correlationId
      });
      
      // Log the failed notification
      await this.logNotification({
        channelType: NotificationChannelType.EMAIL,
        priority: payload.priority,
        title: payload.title,
        message: payload.message,
        status: NotificationStatus.FAILED,
        metadata: { 
          error: error.message, 
          to: payload.to,
          correlationId: payload.correlationId 
        },
        userId: payload.userId,
        dealershipId: payload.dealershipId,
        sandboxId: payload.sandboxId
      });
      
      return false;
    }
  }
  
  /**
   * Send a webhook notification
   */
  async sendWebhookNotification(payload: WebhookNotificationPayload): Promise<boolean> {
    try {
      const { title, message, priority, data, url, method = 'POST', headers = {}, hmacSecret, correlationId, userId, dealershipId, sandboxId } = payload;
      
      // Check rate limits
      if (this.isRateLimited('webhook', priority)) {
        await this.logNotification({
          channelType: NotificationChannelType.WEBHOOK,
          priority,
          title,
          message,
          status: NotificationStatus.RATE_LIMITED,
          metadata: { url, method, correlationId },
          userId,
          dealershipId,
          sandboxId
        });
        return false;
      }
      
      // Prepare webhook payload
      const webhookPayload = {
        title,
        message,
        priority,
        timestamp: new Date().toISOString(),
        data,
        metadata: {
          correlationId
        }
      };
      
      // Initialize circuit breaker for this webhook URL if not exists
      if (!this.webhookCircuitBreakers.has(url)) {
        this.webhookCircuitBreakers.set(url, new CircuitBreaker({
          name: `webhook-${url.replace(/[^a-z0-9]/gi, '-')}`,
          maxFailures: 5,
          resetTimeout: 30000,
          timeout: 5000
        }));
      }
      
      const circuitBreaker = this.webhookCircuitBreakers.get(url);
      
      // Add HMAC signature if secret provided
      const requestHeaders = { ...headers, 'Content-Type': 'application/json' };
      
      if (hmacSecret) {
        const payload = JSON.stringify(webhookPayload);
        const signature = crypto
          .createHmac('sha256', hmacSecret)
          .update(payload)
          .digest('hex');
        
        requestHeaders['X-Signature'] = signature;
      }
      
      // Send the webhook with retry logic
      const result = await circuitBreaker.execute(async () => {
        let retries = 0;
        let success = false;
        let lastError = null;
        
        while (retries <= this.config.maxRetries && !success) {
          try {
            const response = await axios({
              method,
              url,
              data: webhookPayload,
              headers: requestHeaders
            });
            
            if (response.status >= 200 && response.status < 300) {
              success = true;
            }
          } catch (error) {
            lastError = error;
            retries++;
            
            if (retries <= this.config.maxRetries) {
              await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * retries));
            }
          }
        }
        
        if (!success && lastError) {
          throw lastError;
        }
        
        return success;
      });
      
      // Log the notification
      await this.logNotification({
        channelType: NotificationChannelType.WEBHOOK,
        priority,
        title,
        message,
        status: result ? NotificationStatus.SENT : NotificationStatus.FAILED,
        metadata: { url, method, correlationId },
        userId,
        dealershipId,
        sandboxId
      });
      
      // Update rate limit counter
      this.incrementRateLimit('webhook', priority);
      
      return result;
    } catch (error) {
      logger.error('Error sending webhook notification', {
        error: error.message,
        correlationId: payload.correlationId
      });
      
      // Log the failed notification
      await this.logNotification({
        channelType: NotificationChannelType.WEBHOOK,
        priority: payload.priority,
        title: payload.title,
        message: payload.message,
        status: NotificationStatus.FAILED,
        metadata: { 
          error: error.message, 
          url: payload.url,
          correlationId: payload.correlationId 
        },
        userId: payload.userId,
        dealershipId: payload.dealershipId,
        sandboxId: payload.sandboxId
      });
      
      return false;
    }
  }
  
  /**
   * Generate and send a PDF report via email
   */
  async sendPdfReport(options: {
    to: string | string[];
    subject: string;
    templateId: string;
    data: Record<string, any>;
    filename?: string;
    userId?: number;
    dealershipId?: number;
  }): Promise<boolean> {
    try {
      const { to, subject, templateId, data, filename = 'report.pdf', userId, dealershipId } = options;
      
      // Render the HTML template
      const context: TemplateContext = {
        title: subject,
        message: '',
        priority: NotificationPriority.INFO,
        timestamp: new Date().toISOString(),
        data,
        dealershipName: dealershipId ? await this.getDealershipName(dealershipId) : undefined,
        userName: userId ? await this.getUserName(userId) : undefined
      };
      
      const html = await this.renderEmailTemplate(templateId, context);
      
      // Generate PDF from HTML
      const pdfBuffer = await this.generatePdf(html);
      
      // Send email with PDF attachment
      return await this.sendEmailNotification({
        to,
        subject,
        message: `Please find attached the ${subject}`,
        priority: NotificationPriority.INFO,
        html: `<p>Please find attached the ${subject}.</p>`,
        attachments: [
          {
            content: pdfBuffer.toString('base64'),
            filename,
            type: 'application/pdf',
            disposition: 'attachment'
          }
        ],
        userId,
        dealershipId
      });
    } catch (error) {
      logger.error('Error sending PDF report', {
        error: error.message,
        templateId: options.templateId
      });
      return false;
    }
  }
  
  /**
   * Schedule a weekly PDF report email
   */
  scheduleWeeklyReport(options: {
    to: string | string[];
    subject: string;
    templateId: string;
    dataFetchFn: () => Promise<Record<string, any>>;
    cronSchedule?: string;
    filename?: string;
    userId?: number;
    dealershipId?: number;
  }): void {
    const { to, subject, templateId, dataFetchFn, cronSchedule = '0 8 * * 1', filename, userId, dealershipId } = options;
    
    const task = require('node-cron').schedule(cronSchedule, async () => {
      try {
        logger.info('Generating weekly report', { templateId, to });
        
        // Fetch the data
        const data = await dataFetchFn();
        
        // Send the report
        await this.sendPdfReport({
          to,
          subject,
          templateId,
          data,
          filename,
          userId,
          dealershipId
        });
        
        logger.info('Weekly report sent successfully', { templateId, to });
      } catch (error) {
        logger.error('Error generating weekly report', {
          error: error.message,
          templateId,
          to
        });
      }
    });
    
    // Store the task reference for potential cancellation
    return task;
  }
  
  /**
   * Generate a PDF from HTML content
   */
  private async generatePdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      });
      
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }
  
  /**
   * Render a Slack template
   */
  private async renderSlackTemplate(templateId: string, context: TemplateContext): Promise<any[]> {
    try {
      // First check if we have a template in the database
      const dbTemplate = await db.query.notificationTemplates.findFirst({
        where: and(
          eq(notificationTemplates.id, templateId),
          eq(notificationTemplates.channelType, NotificationChannelType.SLACK)
        )
      });
      
      if (dbTemplate && dbTemplate.template) {
        // Parse the template JSON
        return JSON.parse(dbTemplate.template);
      }
      
      // Fall back to file-based template
      const templatePath = path.join(this.config.templatesDir, 'slack', `${templateId}.json`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      return JSON.parse(templateContent);
    } catch (error) {
      logger.error('Error rendering Slack template', {
        error: error.message,
        templateId
      });
      return null;
    }
  }
  
  /**
   * Render an email template
   */
  private async renderEmailTemplate(templateId: string, context: TemplateContext): Promise<string> {
    try {
      // Check template cache first
      if (this.templateCache.has(templateId)) {
        const template = this.templateCache.get(templateId);
        return template(context);
      }
      
      // Check if we have a template in the database
      const dbTemplate = await db.query.notificationTemplates.findFirst({
        where: and(
          eq(notificationTemplates.id, templateId),
          eq(notificationTemplates.channelType, NotificationChannelType.EMAIL)
        )
      });
      
      if (dbTemplate && dbTemplate.template) {
        const template = handlebars.compile(dbTemplate.template);
        this.templateCache.set(templateId, template);
        return template(context);
      }
      
      // Fall back to file-based template
      const templatePath = path.join(this.config.templatesDir, 'email', `${templateId}.hbs`);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const template = handlebars.compile(templateContent);
      this.templateCache.set(templateId, template);
      return template(context);
    } catch (error) {
      logger.error('Error rendering email template', {
        error: error.message,
        templateId
      });
      
      // Return a basic template as fallback
      return `
        <h1>${context.title}</h1>
        <p>${context.message}</p>
        ${context.data ? `<pre>${JSON.stringify(context.data, null, 2)}</pre>` : ''}
        <p><small>Priority: ${context.priority.toUpperCase()}</small></p>
      `;
    }
  }
  
  /**
   * Log a notification to the database
   */
  private async logNotification(options: {
    channelType: NotificationChannelType;
    priority: NotificationPriority;
    title: string;
    message: string;
    status: NotificationStatus;
    metadata?: Record<string, any>;
    userId?: number;
    dealershipId?: number;
    sandboxId?: number;
  }): Promise<void> {
    try {
      const { channelType, priority, title, message, status, metadata, userId, dealershipId, sandboxId } = options;
      
      await db.insert(notificationHistory).values({
        id: uuidv4(),
        channelType,
        priority,
        title,
        message,
        status,
        metadata: metadata || {},
        userId,
        dealershipId,
        sandboxId,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error logging notification', {
        error: error.message
      });
    }
  }
  
  /**
   * Check if a notification channel is rate limited
   */
  private isRateLimited(channel: string, priority: NotificationPriority): boolean {
    const key = `${channel}:${priority}`;
    const now = Date.now();
    const limit = this.config.rateLimit[priority];
    
    // Get current rate limit info
    const rateLimitInfo = this.rateLimitCounters.get(key);
    
    // If no rate limit info or reset time has passed, not rate limited
    if (!rateLimitInfo || rateLimitInfo.resetAt < now) {
      return false;
    }
    
    // Check if count exceeds limit
    return rateLimitInfo.count >= limit;
  }
  
  /**
   * Increment rate limit counter for a channel and priority
   */
  private incrementRateLimit(channel: string, priority: NotificationPriority): void {
    const key = `${channel}:${priority}`;
    const now = Date.now();
    const resetAt = now + 60000; // Reset after 1 minute
    
    // Get current rate limit info
    const rateLimitInfo = this.rateLimitCounters.get(key);
    
    if (!rateLimitInfo || rateLimitInfo.resetAt < now) {
      // Initialize or reset counter
      this.rateLimitCounters.set(key, {
        count: 1,
        resetAt
      });
    } else {
      // Increment counter
      rateLimitInfo.count++;
    }
  }
  
  /**
   * Get notification history
   */
  async getNotificationHistory(options: {
    userId?: number;
    dealershipId?: number;
    sandboxId?: number;
    channelType?: NotificationChannelType;
    priority?: NotificationPriority;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const { userId, dealershipId, sandboxId, channelType, priority, limit = 50, offset = 0 } = options;
    
    // Build query conditions
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(notificationHistory.userId, userId));
    }
    
    if (dealershipId) {
      conditions.push(eq(notificationHistory.dealershipId, dealershipId));
    }
    
    if (sandboxId) {
      conditions.push(eq(notificationHistory.sandboxId, sandboxId));
    }
    
    if (channelType) {
      conditions.push(eq(notificationHistory.channelType, channelType));
    }
    
    if (priority) {
      conditions.push(eq(notificationHistory.priority, priority));
    }
    
    // Execute query
    return db.query.notificationHistory.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(notificationHistory.createdAt)],
      limit,
      offset
    });
  }
  
  /**
   * Get dealership name by ID
   */
  private async getDealershipName(dealershipId: number): Promise<string> {
    try {
      const dealership = await db.query.dealerships.findFirst({
        where: eq(db.dealerships.id, dealershipId),
        columns: { name: true }
      });
      
      return dealership?.name || 'Unknown Dealership';
    } catch (error) {
      logger.error('Error getting dealership name', {
        error: error.message,
        dealershipId
      });
      return 'Unknown Dealership';
    }
  }
  
  /**
   * Get user name by ID
   */
  private async getUserName(userId: number): Promise<string> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(db.users.id, userId),
        columns: { username: true, email: true }
      });
      
      return user?.username || user?.email || 'Unknown User';
    } catch (error) {
      logger.error('Error getting user name', {
        error: error.message,
        userId
      });
      return 'Unknown User';
    }
  }
  
  /**
   * Get notification channels for a dealership
   */
  async getNotificationChannels(dealershipId: number): Promise<any[]> {
    return db.query.notificationChannels.findMany({
      where: eq(notificationChannels.dealershipId, dealershipId)
    });
  }
  
  /**
   * Create or update a notification channel
   */
  async upsertNotificationChannel(channel: {
    id?: string;
    dealershipId: number;
    channelType: NotificationChannelType;
    name: string;
    config: Record<string, any>;
    isActive?: boolean;
  }): Promise<string> {
    const { id, dealershipId, channelType, name, config, isActive = true } = channel;
    
    if (id) {
      // Update existing channel
      await db.update(notificationChannels)
        .set({
          name,
          config,
          isActive,
          updatedAt: new Date()
        })
        .where(eq(notificationChannels.id, id));
      
      return id;
    } else {
      // Create new channel
      const newId = uuidv4();
      
      await db.insert(notificationChannels).values({
        id: newId,
        dealershipId,
        channelType,
        name,
        config,
        isActive,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return newId;
    }
  }
  
  /**
   * Subscribe a user to notifications
   */
  async subscribeToNotifications(subscription: {
    userId: number;
    dealershipId: number;
    channelId: string;
    eventTypes: string[];
    priority?: NotificationPriority;
  }): Promise<string> {
    const { userId, dealershipId, channelId, eventTypes, priority = NotificationPriority.INFO } = subscription;
    
    const subscriptionId = uuidv4();
    
    await db.insert(notificationSubscriptions).values({
      id: subscriptionId,
      userId,
      dealershipId,
      channelId,
      eventTypes,
      priority,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return subscriptionId;
  }
  
  /**
   * Unsubscribe a user from notifications
   */
  async unsubscribeFromNotifications(subscriptionId: string): Promise<boolean> {
    try {
      await db.update(notificationSubscriptions)
        .set({
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(notificationSubscriptions.id, subscriptionId));
      
      return true;
    } catch (error) {
      logger.error('Error unsubscribing from notifications', {
        error: error.message,
        subscriptionId
      });
      return false;
    }
  }
}

// Export a singleton instance for convenience
export const notificationService = new NotificationService();
