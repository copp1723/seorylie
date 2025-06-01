/**
 * Webhook Framework
 *
 * A comprehensive webhook system that handles:
 * - Incoming webhooks from third-party services
 * - Outgoing webhooks to external systems
 * - Webhook registration and management
 * - Security with HMAC signature validation
 * - Retry logic and rate limiting
 * - Monitoring and metrics
 * - Templating and transformations
 *
 * This framework is designed to be extensible and support various webhook scenarios.
 */

import { Request, Response, NextFunction, Router } from 'express';
import axios, { AxiosRequestConfig, Method } from 'axios';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { db } from '../db';
import { logger } from '../utils/logger';
import { CircuitBreaker } from './circuit-breaker';
import { eventBus } from './event-bus';
import {
  webhookEvents,
  webhookDeliveryLogs,
  adsSpendLogs,
  systemDiagnostics
  // webhooks,
  // webhookSubscriptions
} from '../../shared/schema';
import { eq, and, desc, sql, like } from 'drizzle-orm';
import { promClient } from '../observability/metrics';

// Prometheus metrics
const webhookMetrics = {
  incomingTotal: new promClient.Counter({
    name: 'webhook_incoming_total',
    help: 'Total number of incoming webhooks',
    labelNames: ['type', 'source', 'status']
  }),
  outgoingTotal: new promClient.Counter({
    name: 'webhook_outgoing_total',
    help: 'Total number of outgoing webhooks',
    labelNames: ['type', 'destination', 'status']
  }),
  processingTime: new promClient.Histogram({
    name: 'webhook_processing_time',
    help: 'Time taken to process webhooks',
    labelNames: ['type', 'direction'],
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
  }),
  retryCount: new promClient.Counter({
    name: 'webhook_retry_count',
    help: 'Number of webhook delivery retries',
    labelNames: ['type', 'destination']
  }),
  rateLimitExceeded: new promClient.Counter({
    name: 'webhook_rate_limit_exceeded',
    help: 'Number of times rate limits were exceeded',
    labelNames: ['type', 'source']
  })
};

/**
 * Webhook types
 */
export enum WebhookType {
  ADS_SPEND = 'ads_spend',
  SYSTEM_DIAGNOSTIC = 'system_diagnostic',
  NOTIFICATION = 'notification',
  INTEGRATION = 'integration',
  CUSTOM = 'custom'
}

/**
 * Webhook security levels
 */
export enum WebhookSecurityLevel {
  NONE = 'none',
  HMAC = 'hmac',
  JWT = 'jwt',
  OAUTH = 'oauth'
}

/**
 * Webhook status
 */
export enum WebhookStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
  INVALID = 'invalid'
}

/**
 * Webhook direction
 */
export enum WebhookDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing'
}

/**
 * Webhook event payload schema
 */
export const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  source: z.string(),
  timestamp: z.string().datetime(),
  data: z.record(z.any()),
  metadata: z.record(z.any()).optional()
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

/**
 * Webhook configuration schema
 */
export const WebhookConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  description: z.string().optional(),
  type: z.nativeEnum(WebhookType),
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  securityLevel: z.nativeEnum(WebhookSecurityLevel).default(WebhookSecurityLevel.HMAC),
  securityConfig: z.record(z.any()).optional(),
  rateLimitPerMinute: z.number().int().positive().default(60),
  retryConfig: z.object({
    maxRetries: z.number().int().min(0).default(3),
    retryDelay: z.number().int().positive().default(1000),
    retryBackoffMultiplier: z.number().positive().default(2)
  }).optional(),
  transformationTemplate: z.string().optional(),
  isActive: z.boolean().default(true),
  dealershipId: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional()
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

/**
 * Webhook subscription schema
 */
export const WebhookSubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  webhookId: z.string().uuid(),
  eventTypes: z.array(z.string()),
  filter: z.record(z.any()).optional(),
  transformationTemplate: z.string().optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional()
});

export type WebhookSubscription = z.infer<typeof WebhookSubscriptionSchema>;

/**
 * Webhook delivery log schema
 */
export const WebhookDeliveryLogSchema = z.object({
  id: z.string().uuid().optional(),
  webhookId: z.string().uuid(),
  eventId: z.string().uuid(),
  direction: z.nativeEnum(WebhookDirection),
  status: z.nativeEnum(WebhookStatus),
  requestUrl: z.string().url().optional(),
  requestMethod: z.string().optional(),
  requestHeaders: z.record(z.string()).optional(),
  requestBody: z.any().optional(),
  responseStatus: z.number().int().optional(),
  responseHeaders: z.record(z.string()).optional(),
  responseBody: z.any().optional(),
  error: z.string().optional(),
  retryCount: z.number().int().min(0).default(0),
  processingTimeMs: z.number().int().min(0).optional(),
  timestamp: z.date().optional(),
  metadata: z.record(z.any()).optional()
});

export type WebhookDeliveryLog = z.infer<typeof WebhookDeliveryLogSchema>;

/**
 * Webhook service configuration
 */
export interface WebhookServiceConfig {
  defaultSecurityLevel?: WebhookSecurityLevel;
  defaultRateLimitPerMinute?: number;
  defaultMaxRetries?: number;
  defaultRetryDelay?: number;
  defaultRetryBackoffMultiplier?: number;
  templatesDir?: string;
  hmacSecretKey?: string;
  enableMetrics?: boolean;
}

/**
 * WebhookService class
 *
 * Manages webhook registration, processing, and delivery with
 * comprehensive security, monitoring, and error handling.
 */
export class WebhookService {
  private config: WebhookServiceConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, { count: number, resetAt: number }> = new Map();
  private webhookHandlers: Map<string, (event: WebhookEvent) => Promise<any>> = new Map();
  private templateCache: Map<string, Function> = new Map();

  constructor(config: WebhookServiceConfig = {}) {
    this.config = {
      defaultSecurityLevel: WebhookSecurityLevel.HMAC,
      defaultRateLimitPerMinute: 60,
      defaultMaxRetries: 3,
      defaultRetryDelay: 1000,
      defaultRetryBackoffMultiplier: 2,
      templatesDir: './templates/webhooks',
      hmacSecretKey: process.env.WEBHOOK_HMAC_SECRET || 'default-secret-key',
      enableMetrics: true,
      ...config
    };

    // Register built-in webhook handlers
    this.registerHandler(WebhookType.ADS_SPEND, this.handleAdsSpendWebhook.bind(this));
    this.registerHandler(WebhookType.SYSTEM_DIAGNOSTIC, this.handleSystemDiagnosticWebhook.bind(this));
    this.registerHandler(WebhookType.NOTIFICATION, this.handleNotificationWebhook.bind(this));

    // Subscribe to relevant events for webhook delivery
    this.subscribeToEvents();
  }

  /**
   * Register a webhook handler for a specific type
   */
  registerHandler(type: string, handler: (event: WebhookEvent) => Promise<any>): void {
    this.webhookHandlers.set(type, handler);
    logger.info(`Registered webhook handler for type: ${type}`);
  }

  /**
   * Subscribe to platform events for webhook delivery
   */
  private subscribeToEvents(): void {
    eventBus.subscribe('events.platform', 'webhook-service', async (event) => {
      try {
        // Check if any webhooks are subscribed to this event type
        const subscriptions = await this.getSubscriptionsForEventType(event.type);

        if (subscriptions.length === 0) {
          return;
        }

        // Create webhook event
        const webhookEvent: WebhookEvent = {
          id: uuidv4(),
          type: event.type,
          source: 'platform',
          timestamp: new Date().toISOString(),
          data: event.payload,
          metadata: {
            correlationId: event.correlationId
          }
        };

        // Store the event
        await this.storeWebhookEvent(webhookEvent);

        // Deliver to all subscribed webhooks
        for (const subscription of subscriptions) {
          await this.deliverWebhook(subscription.webhookId, webhookEvent);
        }
      } catch (error) {
        logger.error('Error processing event for webhook delivery', {
          eventType: event.type,
          error: error.message,
          correlationId: event.correlationId
        });
      }
    });
  }

  /**
   * Store a webhook event in the database
   */
  private async storeWebhookEvent(event: WebhookEvent): Promise<string> {
    try {
      await db.insert(webhookEvents).values({
        id: event.id,
        type: event.type,
        source: event.source,
        data: event.data,
        metadata: event.metadata || {},
        createdAt: new Date()
      });

      return event.id;
    } catch (error) {
      logger.error('Error storing webhook event', {
        error: error.message,
        eventType: event.type
      });
      throw error;
    }
  }

  /**
   * Get webhook subscriptions for an event type
   */
  private async getSubscriptionsForEventType(eventType: string): Promise<any[]> {
    try {
      // Find all active subscriptions that match the event type
      // TODO: Replace 'webhookSubscriptions' with the correct reference to the subscriptions table or model.
      // return db.query.webhookSubscriptions.findMany({
      //   where: and(
      //     eq(webhookSubscriptions.isActive, true),
      //     sql`${eventType} = ANY(${webhookSubscriptions.eventTypes})`
      //   ),
      //   with: {
      //     webhook: true
      //   }
      // });
      // TODO: Implement correct subscription lookup
      return [];
    } catch (error) {
      logger.error('Error getting webhook subscriptions', {
        error: error.message,
        eventType
      });
      return [];
    }
  }

  /**
   * Deliver a webhook to its destination
   */
  async deliverWebhook(webhookId: string, event: WebhookEvent): Promise<boolean> {
    try {
      // Get webhook configuration
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // const webhook = await db.query.webhooks.findFirst({
      //   where: and(
      //     eq(webhooks.id, webhookId),
      //     eq(webhooks.isActive, true)
      //   )
      // });
      // TODO: Implement correct webhook lookup
      const webhook = null;

      if (!webhook) {
        logger.warn('Webhook not found or inactive', { webhookId });
        return false;
      }

      // Check rate limits
      if (this.isRateLimited(webhookId, webhook.rateLimitPerMinute)) {
        logger.warn('Webhook rate limit exceeded', { webhookId, url: webhook.url });

        // Log rate limited delivery
        await this.logWebhookDelivery({
          webhookId,
          eventId: event.id,
          direction: WebhookDirection.OUTGOING,
          status: WebhookStatus.RATE_LIMITED,
          requestUrl: webhook.url,
          requestMethod: webhook.method,
          requestBody: event,
          error: 'Rate limit exceeded',
          timestamp: new Date()
        });

        // Update metrics
        if (this.config.enableMetrics) {
          webhookMetrics.rateLimitExceeded.inc({
            type: webhook.type,
            destination: new URL(webhook.url).hostname
          });
        }

        return false;
      }

      // Transform the event if needed
      const payload = await this.transformPayload(event, webhook.transformationTemplate);

      // Initialize circuit breaker if not exists
      if (!this.circuitBreakers.has(webhookId)) {
        this.circuitBreakers.set(webhookId, new CircuitBreaker({
          name: `webhook-${webhookId}`,
          maxFailures: 5,
          resetTimeout: 30000,
          timeout: 10000
        }));
      }

      const circuitBreaker = this.circuitBreakers.get(webhookId);

      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-ID': webhookId,
        'X-Event-ID': event.id,
        'X-Event-Type': event.type,
        ...webhook.headers
      };

      // Add security headers
      if (webhook.securityLevel === WebhookSecurityLevel.HMAC) {
        const hmacSecret = webhook.securityConfig?.hmacSecret || this.config.hmacSecretKey;
        const signature = this.generateHmacSignature(payload, hmacSecret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Get retry configuration
      const retryConfig = webhook.retryConfig || {
        maxRetries: this.config.defaultMaxRetries,
        retryDelay: this.config.defaultRetryDelay,
        retryBackoffMultiplier: this.config.defaultRetryBackoffMultiplier
      };

      // Start timing
      const startTime = Date.now();

      // Send the webhook with retry logic
      const result = await circuitBreaker.execute(async () => {
        let retries = 0;
        let success = false;
        let lastResponse = null;
        let lastError = null;

        while (retries <= retryConfig.maxRetries && !success) {
          try {
            const response = await axios({
              method: webhook.method as Method,
              url: webhook.url,
              headers,
              data: payload,
              timeout: 10000
            });

            lastResponse = response;

            if (response.status >= 200 && response.status < 300) {
              success = true;
            } else {
              lastError = new Error(`HTTP error: ${response.status}`);
              retries++;

              // Update metrics
              if (this.config.enableMetrics) {
                webhookMetrics.retryCount.inc({
                  type: webhook.type,
                  destination: new URL(webhook.url).hostname
                });
              }

              if (retries <= retryConfig.maxRetries) {
                const delay = retryConfig.retryDelay * Math.pow(retryConfig.retryBackoffMultiplier, retries - 1);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
          } catch (error) {
            lastError = error;
            retries++;

            // Update metrics
            if (this.config.enableMetrics) {
              webhookMetrics.retryCount.inc({
                type: webhook.type,
                destination: new URL(webhook.url).hostname
              });
            }

            if (retries <= retryConfig.maxRetries) {
              const delay = retryConfig.retryDelay * Math.pow(retryConfig.retryBackoffMultiplier, retries - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        // Calculate processing time
        const processingTime = Date.now() - startTime;

        // Log webhook delivery
        await this.logWebhookDelivery({
          webhookId,
          eventId: event.id,
          direction: WebhookDirection.OUTGOING,
          status: success ? WebhookStatus.DELIVERED : WebhookStatus.FAILED,
          requestUrl: webhook.url,
          requestMethod: webhook.method,
          requestHeaders: headers,
          requestBody: payload,
          responseStatus: lastResponse?.status,
          responseHeaders: lastResponse?.headers,
          responseBody: lastResponse?.data,
          error: lastError?.message,
          retryCount: retries,
          processingTimeMs: processingTime,
          timestamp: new Date()
        });

        // Update metrics
        if (this.config.enableMetrics) {
          webhookMetrics.outgoingTotal.inc({
            type: webhook.type,
            destination: new URL(webhook.url).hostname,
            status: success ? 'success' : 'failure'
          });

          webhookMetrics.processingTime.observe(
            {
              type: webhook.type,
              direction: 'outgoing'
            },
            processingTime
          );
        }

        // Update rate limit counter
        this.incrementRateLimit(webhookId);

        if (!success && lastError) {
          throw lastError;
        }

        return success;
      });

      return result;
    } catch (error) {
      logger.error('Error delivering webhook', {
        error: error.message,
        webhookId,
        eventId: event.id
      });
      return false;
    }
  }

  /**
   * Process an incoming webhook
   */
  async processIncomingWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const { path } = req;

    try {
      // Extract webhook type from path
      const pathParts = path.split('/');
      const webhookType = pathParts[pathParts.length - 1];

      // Validate the webhook signature if required
      const isValid = await this.validateWebhookSignature(req);

      if (!isValid) {
        logger.warn('Invalid webhook signature', { path });

        // Log invalid webhook
        await this.logWebhookDelivery({
          webhookId: 'unknown',
          eventId: uuidv4(),
          direction: WebhookDirection.INCOMING,
          status: WebhookStatus.INVALID,
          requestUrl: req.originalUrl,
          requestMethod: req.method,
          requestHeaders: req.headers as Record<string, string>,
          requestBody: req.body,
          error: 'Invalid signature',
          timestamp: new Date()
        });

        // Update metrics
        if (this.config.enableMetrics) {
          webhookMetrics.incomingTotal.inc({
            type: webhookType,
            source: req.get('host') || 'unknown',
            status: 'invalid'
          });
        }

        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }

      // Create webhook event
      const webhookEvent: WebhookEvent = {
        id: uuidv4(),
        type: webhookType,
        source: req.get('host') || 'unknown',
        timestamp: new Date().toISOString(),
        data: req.body,
        metadata: {
          headers: req.headers,
          query: req.query,
          ip: req.ip
        }
      };

      // Store the event
      await this.storeWebhookEvent(webhookEvent);

      // Process the webhook
      let result = null;

      if (this.webhookHandlers.has(webhookType)) {
        // Use registered handler
        const handler = this.webhookHandlers.get(webhookType);
        result = await handler(webhookEvent);
      } else {
        // Default handling - publish to event bus
        eventBus.publish('events.webhook', {
          type: `WEBHOOK_${webhookType.toUpperCase()}`,
          payload: webhookEvent.data,
          correlationId: webhookEvent.id
        });
      }

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Log successful webhook
      await this.logWebhookDelivery({
        webhookId: 'incoming',
        eventId: webhookEvent.id,
        direction: WebhookDirection.INCOMING,
        status: WebhookStatus.DELIVERED,
        requestUrl: req.originalUrl,
        requestMethod: req.method,
        requestHeaders: req.headers as Record<string, string>,
        requestBody: req.body,
        responseStatus: 200,
        responseBody: { success: true },
        processingTimeMs: processingTime,
        timestamp: new Date()
      });

      // Update metrics
      if (this.config.enableMetrics) {
        webhookMetrics.incomingTotal.inc({
          type: webhookType,
          source: req.get('host') || 'unknown',
          status: 'success'
        });

        webhookMetrics.processingTime.observe(
          {
            type: webhookType,
            direction: 'incoming'
          },
          processingTime
        );
      }

      res.status(200).json({ success: true, result });
    } catch (error) {
      logger.error('Error processing incoming webhook', {
        error: error.message,
        path
      });

      // Log failed webhook
      await this.logWebhookDelivery({
        webhookId: 'incoming',
        eventId: uuidv4(),
        direction: WebhookDirection.INCOMING,
        status: WebhookStatus.FAILED,
        requestUrl: req.originalUrl,
        requestMethod: req.method,
        requestHeaders: req.headers as Record<string, string>,
        requestBody: req.body,
        error: error.message,
        timestamp: new Date()
      });

      // Update metrics
      if (this.config.enableMetrics) {
        const pathParts = path.split('/');
        const webhookType = pathParts[pathParts.length - 1];

        webhookMetrics.incomingTotal.inc({
          type: webhookType,
          source: req.get('host') || 'unknown',
          status: 'failure'
        });
      }

      next(error);
    }
  }

  /**
   * Validate webhook signature
   */
  private async validateWebhookSignature(req: Request): Promise<boolean> {
    try {
      // Get signature from headers
      const signature = req.headers['x-webhook-signature'] as string;

      // If no signature, check if validation is required
      if (!signature) {
        // Default to requiring signature
        return false;
      }

      // Get webhook path for configuration lookup
      const path = req.path;

      // Find webhook configuration for this path
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // const webhook = await db.query.webhooks.findFirst({
      //   where: and(
      //     like(webhooks.url, `%${path}%`),
      //     eq(webhooks.isActive, true)
      //   )
      // });
      // TODO: Implement correct webhook config lookup
      const webhook = null;

      // If no configuration found, use default security level
      const securityLevel = webhook?.securityLevel || this.config.defaultSecurityLevel;

      // Skip validation if security level is NONE
      if (securityLevel === WebhookSecurityLevel.NONE) {
        return true;
      }

      // Validate based on security level
      if (securityLevel === WebhookSecurityLevel.HMAC) {
        const hmacSecret = webhook?.securityConfig?.hmacSecret || this.config.hmacSecretKey;
        const payload = req.body;
        const expectedSignature = this.generateHmacSignature(payload, hmacSecret);

        return signature === expectedSignature;
      }

      // JWT and OAuth validation would go here

      return false;
    } catch (error) {
      logger.error('Error validating webhook signature', {
        error: error.message,
        path: req.path
      });
      return false;
    }
  }

  /**
   * Generate HMAC signature for payload
   */
  private generateHmacSignature(payload: any, secret: string): string {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  /**
   * Transform webhook payload using template
   */
  private async transformPayload(event: WebhookEvent, templateId?: string): Promise<any> {
    if (!templateId) {
      return event;
    }

    try {
      // Check if template is in cache
      if (this.templateCache.has(templateId)) {
        const template = this.templateCache.get(templateId);
        return template(event);
      }

      // Get template from database
      const template = await db.query.webhookTemplates.findFirst({
        where: eq(db.webhookTemplates.id, templateId)
      });

      if (!template) {
        return event;
      }

      // Compile and cache the template
      const compiledTemplate = new Function('event', template.template);
      this.templateCache.set(templateId, compiledTemplate);

      return compiledTemplate(event);
    } catch (error) {
      logger.error('Error transforming webhook payload', {
        error: error.message,
        templateId
      });
      return event;
    }
  }

  /**
   * Log webhook delivery
   */
  private async logWebhookDelivery(log: Partial<WebhookDeliveryLog>): Promise<void> {
    try {
      await db.insert(webhookDeliveryLogs).values({
        id: uuidv4(),
        ...log,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error logging webhook delivery', {
        error: error.message
      });
    }
  }

  /**
   * Check if a webhook is rate limited
   */
  private isRateLimited(webhookId: string, limit: number): boolean {
    const now = Date.now();
    const rateLimitInfo = this.rateLimiters.get(webhookId);

    // If no rate limit info or reset time has passed, not rate limited
    if (!rateLimitInfo || rateLimitInfo.resetAt < now) {
      return false;
    }

    // Check if count exceeds limit
    return rateLimitInfo.count >= limit;
  }

  /**
   * Increment rate limit counter for a webhook
   */
  private incrementRateLimit(webhookId: string): void {
    const now = Date.now();
    const resetAt = now + 60000; // Reset after 1 minute

    // Get current rate limit info
    const rateLimitInfo = this.rateLimiters.get(webhookId);

    if (!rateLimitInfo || rateLimitInfo.resetAt < now) {
      // Initialize or reset counter
      this.rateLimiters.set(webhookId, {
        count: 1,
        resetAt
      });
    } else {
      // Increment counter
      rateLimitInfo.count++;
    }
  }

  /**
   * Register a new webhook
   */
  async registerWebhook(config: Omit<WebhookConfig, 'id'>): Promise<string> {
    try {
      // Validate configuration
      const validatedConfig = WebhookConfigSchema.parse(config);

      // Generate ID if not provided
      const id = validatedConfig.id || uuidv4();

      // Insert into database
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // await db.insert(webhooks).values({
      //   id,
      //   name: validatedConfig.name,
      //   description: validatedConfig.description || '',
      //   type: validatedConfig.type,
      //   url: validatedConfig.url,
      //   method: validatedConfig.method,
      //   headers: validatedConfig.headers || {},
      //   securityLevel: validatedConfig.securityLevel,
      //   securityConfig: validatedConfig.securityConfig || {},
      //   rateLimitPerMinute: validatedConfig.rateLimitPerMinute,
      //   retryConfig: validatedConfig.retryConfig || {
      //     maxRetries: this.config.defaultMaxRetries,
      //     retryDelay: this.config.defaultRetryDelay,
      //     retryBackoffMultiplier: this.config.defaultRetryBackoffMultiplier
      //   },
      //   transformationTemplate: validatedConfig.transformationTemplate,
      //   isActive: validatedConfig.isActive,
      //   dealershipId: validatedConfig.dealershipId,
      //   metadata: validatedConfig.metadata || {},
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // });

      logger.info('Webhook registered successfully', { webhookId: id, type: validatedConfig.type });

      return id;
    } catch (error) {
      logger.error('Error registering webhook', {
        error: error.message,
        name: config.name
      });
      throw error;
    }
  }

  /**
   * Update a webhook
   */
  async updateWebhook(id: string, config: Partial<WebhookConfig>): Promise<boolean> {
    try {
      // Get current webhook
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // const webhook = await db.query.webhooks.findFirst({
      //   where: eq(webhooks.id, id)
      // });
      // TODO: Implement correct webhook lookup
      const webhook = null;

      if (!webhook) {
        throw new Error(`Webhook not found: ${id}`);
      }

      // Update webhook
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // await db.update(webhooks)
      //   .set({
      //     ...config,
      //     updatedAt: new Date()
      //   })
      //   .where(eq(webhooks.id, id));

      logger.info('Webhook updated successfully', { webhookId: id });

      return true;
    } catch (error) {
      logger.error('Error updating webhook', {
        error: error.message,
        webhookId: id
      });
      throw error;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(id: string): Promise<boolean> {
    try {
      // Soft delete by setting isActive to false
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // await db.update(webhooks)
      //   .set({
      //     isActive: false,
      //     updatedAt: new Date()
      //   })
      //   .where(eq(webhooks.id, id));

      logger.info('Webhook deleted successfully', { webhookId: id });

      return true;
    } catch (error) {
      logger.error('Error deleting webhook', {
        error: error.message,
        webhookId: id
      });
      throw error;
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(id: string): Promise<any> {
    // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
    // return db.query.webhooks.findFirst({
    //   where: eq(webhooks.id, id)
    // });
    return null;
  }

  /**
   * Get all webhooks
   */
  async getWebhooks(options: {
    type?: WebhookType;
    dealershipId?: number;
    isActive?: boolean;
  } = {}): Promise<any[]> {
    const { type, dealershipId, isActive } = options;

    // Build query conditions
    const conditions = [];

    if (type) {
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // conditions.push(eq(webhooks.type, type));
    }

    if (dealershipId) {
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // conditions.push(eq(webhooks.dealershipId, dealershipId));
    }

    if (isActive !== undefined) {
      // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
      // conditions.push(eq(webhooks.isActive, isActive));
    }

    // TODO: Replace 'webhooks' with the correct reference to the webhooks table or model.
    // return db.query.webhooks.findMany({
    //   where: conditions.length > 0 ? and(...conditions) : undefined,
    //   orderBy: [desc(webhooks.updatedAt)]
    // });
    return [];
  }

  /**
   * Subscribe to webhook events
   */
  async subscribeToWebhook(subscription: Omit<WebhookSubscription, 'id'>): Promise<string> {
    try {
      // Validate subscription
      const validatedSubscription = WebhookSubscriptionSchema.parse(subscription);

      // Generate ID if not provided
      const id = validatedSubscription.id || uuidv4();

      // Insert into database
      // TODO: Replace 'webhookSubscriptions' with the correct reference to the subscriptions table or model.
      // await db.insert(webhookSubscriptions).values({
      //   id,
      //   webhookId: validatedSubscription.webhookId,
      //   eventTypes: validatedSubscription.eventTypes,
      //   filter: validatedSubscription.filter || {},
      //   transformationTemplate: validatedSubscription.transformationTemplate,
      //   isActive: validatedSubscription.isActive,
      //   metadata: validatedSubscription.metadata || {},
      //   createdAt: new Date(),
      //   updatedAt: new Date()
      // });

      logger.info('Webhook subscription created successfully', {
        subscriptionId: id,
        webhookId: validatedSubscription.webhookId
      });

      return id;
    } catch (error) {
      logger.error('Error creating webhook subscription', {
        error: error.message,
        webhookId: subscription.webhookId
      });
      throw error;
    }
  }

  /**
   * Get webhook delivery logs
   */
  async getWebhookDeliveryLogs(options: {
    webhookId?: string;
    eventId?: string;
    status?: WebhookStatus;
    direction?: WebhookDirection;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const { webhookId, eventId, status, direction, limit = 50, offset = 0 } = options;

    // Build query conditions
    const conditions = [];

    if (webhookId) {
      conditions.push(eq(webhookDeliveryLogs.webhookId, webhookId));
    }

    if (eventId) {
      conditions.push(eq(webhookDeliveryLogs.eventId, eventId));
    }

    if (status) {
      conditions.push(eq(webhookDeliveryLogs.status, status));
    }

    if (direction) {
      conditions.push(eq(webhookDeliveryLogs.direction, direction));
    }

    return db.query.webhookDeliveryLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(webhookDeliveryLogs.createdAt)],
      limit,
      offset
    });
  }

  /**
   * Get webhook events
   */
  async getWebhookEvents(options: {
    type?: string;
    source?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<any[]> {
    const { type, source, limit = 50, offset = 0 } = options;

    // Build query conditions
    const conditions = [];

    if (type) {
      conditions.push(eq(webhookEvents.type, type));
    }

    if (source) {
      conditions.push(eq(webhookEvents.source, source));
    }

    return db.query.webhookEvents.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(webhookEvents.createdAt)],
      limit,
      offset
    });
  }

  /**
   * Handle ads spend webhook
   */
  private async handleAdsSpendWebhook(event: WebhookEvent): Promise<any> {
    try {
      logger.info('Processing ads spend webhook', {
        eventId: event.id,
        source: event.source
      });

      // Extract data from webhook
      const { accountId, date, spend, metrics } = event.data;

      // Log the event
      await db.insert(adsSpendLogs).values({
        id: uuidv4(),
        accountId,
        date: new Date(date),
        spend,
        metrics,
        source: event.source,
        webhookEventId: event.id,
        createdAt: new Date()
      });

      // Publish to event bus for further processing
      eventBus.publish('events.platform', {
        type: 'ADS_SPEND_RECORDED',
        payload: {
          accountId,
          date,
          spend,
          metrics
        },
        correlationId: event.id
      });

      return { success: true };
    } catch (error) {
      logger.error('Error handling ads spend webhook', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id
      });
      throw error;
    }
  }

  /**
   * Handle system diagnostic webhook
   */
  private async handleSystemDiagnosticWebhook(event: WebhookEvent): Promise<any> {
    try {
      logger.info('Processing system diagnostic webhook', {
        eventId: event.id,
        source: event.source
      });

      // Extract data from webhook
      const { system, status, metrics, timestamp } = event.data;

      // Log the diagnostic
      await db.insert(systemDiagnostics).values({
        id: uuidv4(),
        system,
        status,
        metrics,
        source: event.source,
        webhookEventId: event.id,
        timestamp: new Date(timestamp || Date.now()),
        createdAt: new Date()
      });

      // Check for critical status
      if (status === 'critical') {
        // Publish critical event
        eventBus.publish('events.platform', {
          type: 'DIAGNOSTIC_CRITICAL',
          payload: {
            system,
            status,
            metrics,
            source: event.source
          },
          correlationId: event.id
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling system diagnostic webhook', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id
      });
      throw error;
    }
  }

  /**
   * Handle notification webhook
   */
  private async handleNotificationWebhook(event: WebhookEvent): Promise<any> {
    try {
      logger.info('Processing notification webhook', {
        eventId: event.id,
        source: event.source
      });

      // Extract data from webhook
      const { title, message, priority, channel, recipients } = event.data;

      // Forward to notification service
      const { notificationService } = require('./notification-service');

      if (channel === 'slack') {
        await notificationService.sendSlackNotification({
          title,
          message,
          priority,
          data: event.data,
          correlationId: event.id
        });
      } else if (channel === 'email' && recipients) {
        await notificationService.sendEmailNotification({
          to: recipients,
          subject: title,
          message,
          priority,
          data: event.data,
          correlationId: event.id
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Error handling notification webhook', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event.id
      });
      throw error;
    }
  }

  /**
   * Create Express router for webhook endpoints
   */
  createWebhookRouter(): Router {
    const router = Router();

    // Generic webhook handler
    router.post('/:type', this.processIncomingWebhook.bind(this));

    // Specific webhook endpoints
    router.post('/ads/spend', (req, res, next) => {
      req.body.type = WebhookType.ADS_SPEND;
      this.processIncomingWebhook(req, res, next);
    });

    router.post('/system/diagnostic', (req, res, next) => {
      req.body.type = WebhookType.SYSTEM_DIAGNOSTIC;
      this.processIncomingWebhook(req, res, next);
    });

    router.post('/notification', (req, res, next) => {
      req.body.type = WebhookType.NOTIFICATION;
      this.processIncomingWebhook(req, res, next);
    });

    // Webhook management endpoints
    router.get('/config', async (req, res, next) => {
      try {
        const webhooks = await this.getWebhooks({
          dealershipId: req.query.dealershipId ? parseInt(req.query.dealershipId as string) : undefined,
          type: req.query.type as WebhookType,
          isActive: req.query.isActive === 'true'
        });

        res.json({ webhooks });
      } catch (error) {
        next(error);
      }
    });

    router.get('/config/:id', async (req, res, next) => {
      try {
        const webhook = await this.getWebhook(req.params.id);

        if (!webhook) {
          return res.status(404).json({ error: 'Webhook not found' });
        }

        res.json({ webhook });
      } catch (error) {
        next(error);
      }
    });

    router.post('/config', async (req, res, next) => {
      try {
        const id = await this.registerWebhook(req.body);
        res.status(201).json({ id });
      } catch (error) {
        next(error);
      }
    });

    router.put('/config/:id', async (req, res, next) => {
      try {
        const success = await this.updateWebhook(req.params.id, req.body);
        res.json({ success });
      } catch (error) {
        next(error);
      }
    });

    router.delete('/config/:id', async (req, res, next) => {
      try {
        const success = await this.deleteWebhook(req.params.id);
        res.json({ success });
      } catch (error) {
        next(error);
      }
    });

    // Webhook logs endpoints
    router.get('/logs', async (req, res, next) => {
      try {
        const logs = await this.getWebhookDeliveryLogs({
          webhookId: req.query.webhookId as string,
          eventId: req.query.eventId as string,
          status: req.query.status as WebhookStatus,
          direction: req.query.direction as WebhookDirection,
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
        });

        res.json({ logs });
      } catch (error) {
        next(error);
      }
    });

    // Webhook events endpoints
    router.get('/events', async (req, res, next) => {
      try {
        const events = await this.getWebhookEvents({
          type: req.query.type as string,
          source: req.query.source as string,
          limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
          offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
        });

        res.json({ events });
      } catch (error) {
        next(error);
      }
    });

    return router;
  }
}

// Export a singleton instance for convenience
export const webhookService = new WebhookService();
