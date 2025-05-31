/**
 * AI Cost Control Service
 * 
 * Implements cost optimization strategies for OpenAI API usage:
 * - Template-first generation for common intents
 * - Redis-based response caching with configurable TTL
 * - Rate limiting using Bottleneck
 * - Cost tracking with Prometheus metrics
 * 
 * This service wraps the enhanced-ai-service.ts and should be used
 * for all AI interactions to ensure cost control.
 */

import { Redis } from 'redis';
import Bottleneck from 'bottleneck';
import Handlebars from 'handlebars';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { aiService, AIResponse } from './enhanced-ai-service';
import { prometheusMetrics } from './prometheus-metrics';
import logger from '../utils/logger';
import { AdfLead } from '../../shared/adf-schema';
import { Dealership } from '../../shared/schema';

// Define template structure
interface ResponseTemplate {
  id: string;
  intent: string;
  vehicleTypes?: string[];
  template: string;
  fallbackToAI: boolean;
}

// Define response cache structure
interface CachedResponse {
  text: string;
  tokens: number;
  createdAt: number; // timestamp
  expiresAt: number; // timestamp
  source: 'template' | 'ai' | 'personalized';
}

// Define rate limit configuration
interface RateLimitConfig {
  maxConcurrent: number;
  dailyLimit: number;
  dealershipOverrides?: Record<number, { dailyLimit: number }>;
}

export class AiCostControlService {
  private redis: Redis;
  private limiter: Record<string, Bottleneck>; // Key is dealershipId
  private templates: ResponseTemplate[] = [];
  private defaultRateLimitConfig: RateLimitConfig;
  private cacheEnabled: boolean;
  private cacheTtlSeconds: number;
  private templatePath: string;
  private redisKeyPrefix: string = 'ai:response:';
  
  constructor(options: {
    redis: Redis;
    rateLimitConfig?: Partial<RateLimitConfig>;
    cacheEnabled?: boolean;
    cacheTtlSeconds?: number;
    templatePath?: string;
    redisKeyPrefix?: string;
  }) {
    this.redis = options.redis;
    this.defaultRateLimitConfig = {
      maxConcurrent: options.rateLimitConfig?.maxConcurrent || 1,
      dailyLimit: options.rateLimitConfig?.dailyLimit || 100,
      dealershipOverrides: options.rateLimitConfig?.dealershipOverrides || {}
    };
    this.limiter = {};
    this.cacheEnabled = options.cacheEnabled !== undefined ? options.cacheEnabled : true;
    this.cacheTtlSeconds = options.cacheTtlSeconds || 86400; // 24 hours default
    this.templatePath = options.templatePath || path.join(process.cwd(), 'server', 'templates', 'ai-responses');
    this.redisKeyPrefix = options.redisKeyPrefix || 'ai:response:';
    
    // Initialize
    this.init().catch(err => {
      logger.error('Failed to initialize AI Cost Control Service', {
        error: err instanceof Error ? err.message : String(err)
      });
    });
  }
  
  /**
   * Initialize the service by loading templates and setting up rate limiters
   */
  private async init(): Promise<void> {
    try {
      // Load response templates
      await this.loadTemplates();
      
      logger.info('AI Cost Control Service initialized', {
        templatesLoaded: this.templates.length,
        cacheEnabled: this.cacheEnabled,
        cacheTtlSeconds: this.cacheTtlSeconds
      });
    } catch (error) {
      logger.error('Error initializing AI Cost Control Service', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Load response templates from the templates directory
   */
  private async loadTemplates(): Promise<void> {
    try {
      // Ensure template directory exists
      try {
        await fs.access(this.templatePath);
      } catch (error) {
        // Create directory if it doesn't exist
        await fs.mkdir(this.templatePath, { recursive: true });
        logger.info(`Created template directory: ${this.templatePath}`);
        return; // No templates to load yet
      }
      
      // Read template files
      const files = await fs.readdir(this.templatePath);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Load each template file
      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(path.join(this.templatePath, file), 'utf-8');
          const template = JSON.parse(content) as ResponseTemplate;
          this.templates.push(template);
          logger.debug(`Loaded template: ${template.id} for intent: ${template.intent}`);
        } catch (error) {
          logger.error(`Error loading template file ${file}`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      logger.info(`Loaded ${this.templates.length} response templates`);
    } catch (error) {
      logger.error('Error loading templates', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
  
  /**
   * Get or create a rate limiter for a specific dealership
   */
  private getRateLimiter(dealershipId: number | string): Bottleneck {
    const dealershipIdStr = String(dealershipId);
    
    if (!this.limiter[dealershipIdStr]) {
      // Get dealership-specific limit or use default
      const dailyLimit = this.defaultRateLimitConfig.dealershipOverrides?.[Number(dealershipId)]?.dailyLimit || 
                         this.defaultRateLimitConfig.dailyLimit;
      
      // Create new limiter
      this.limiter[dealershipIdStr] = new Bottleneck({
        maxConcurrent: this.defaultRateLimitConfig.maxConcurrent,
        reservoir: dailyLimit, // Daily limit
        reservoirRefreshInterval: 86400000, // 24 hours in ms
        reservoirRefreshAmount: dailyLimit
      });
      
      // Add events for monitoring
      this.limiter[dealershipIdStr].on('depleted', () => {
        logger.warn(`Rate limit depleted for dealership ${dealershipId}`);
        prometheusMetrics.incrementAiRateLimitEvents({
          dealership_id: dealershipIdStr,
          event_type: 'depleted'
        });
      });
      
      this.limiter[dealershipIdStr].on('dropped', () => {
        logger.warn(`Request dropped due to rate limit for dealership ${dealershipId}`);
        prometheusMetrics.incrementAiRateLimitEvents({
          dealership_id: dealershipIdStr,
          event_type: 'dropped'
        });
      });
    }
    
    return this.limiter[dealershipIdStr];
  }
  
  /**
   * Generate a cache key for a specific lead/intent
   */
  private generateCacheKey(lead: Partial<AdfLead>, intent: string): string {
    // Create a deterministic key based on intent and vehicle info
    const vehicleKey = lead.vehicleMake && lead.vehicleModel 
      ? `${lead.vehicleMake.toLowerCase()}:${lead.vehicleModel.toLowerCase()}`
      : 'generic';
    
    return `${this.redisKeyPrefix}${intent.toLowerCase()}:${vehicleKey}`;
  }
  
  /**
   * Find a matching template for a given lead and intent
   */
  private findMatchingTemplate(lead: Partial<AdfLead>, intent: string): ResponseTemplate | null {
    // Find template that matches the intent
    const matchingTemplates = this.templates.filter(t => 
      t.intent.toLowerCase() === intent.toLowerCase()
    );
    
    if (matchingTemplates.length === 0) {
      return null;
    }
    
    // If there are vehicle-specific templates, try to match those first
    if (lead.vehicleMake && lead.vehicleModel) {
      const vehicleSpecificTemplate = matchingTemplates.find(t => 
        t.vehicleTypes?.some(vt => 
          lead.vehicleMake?.toLowerCase().includes(vt.toLowerCase()) ||
          lead.vehicleModel?.toLowerCase().includes(vt.toLowerCase())
        )
      );
      
      if (vehicleSpecificTemplate) {
        return vehicleSpecificTemplate;
      }
    }
    
    // Return the first generic template for this intent
    const genericTemplate = matchingTemplates.find(t => !t.vehicleTypes || t.vehicleTypes.length === 0);
    return genericTemplate || matchingTemplates[0];
  }
  
  /**
   * Personalize a template with lead data
   */
  private personalizeTemplate(template: string, lead: Partial<AdfLead>, dealership?: Partial<Dealership>): string {
    try {
      // Compile Handlebars template
      const compiledTemplate = Handlebars.compile(template);
      
      // Create template data
      const templateData = {
        customer: {
          firstName: lead.customerName?.split(' ')[0] || 'there',
          lastName: lead.customerName?.split(' ').slice(1).join(' ') || '',
          fullName: lead.customerName || 'there',
          email: lead.customerEmail || '',
          phone: lead.customerPhone || '',
          comments: lead.customerComments || ''
        },
        vehicle: {
          year: lead.vehicleYear || '',
          make: lead.vehicleMake || '',
          model: lead.vehicleModel || '',
          trim: lead.vehicleTrim || '',
          stockNumber: lead.vehicleStockNumber || ''
        },
        dealership: {
          name: dealership?.name || 'our dealership',
          address: dealership?.address || '',
          phone: dealership?.phone || '',
          website: dealership?.website || '',
          salesHours: dealership?.salesHours || ''
        },
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString()
      };
      
      // Apply template
      return compiledTemplate(templateData);
    } catch (error) {
      logger.error('Error personalizing template', {
        error: error instanceof Error ? error.message : String(error),
        leadId: lead.id
      });
      
      // Return template with basic personalization as fallback
      return template
        .replace(/{{customer.firstName}}/g, lead.customerName?.split(' ')[0] || 'there')
        .replace(/{{customer.fullName}}/g, lead.customerName || 'there')
        .replace(/{{vehicle.make}}/g, lead.vehicleMake || 'your vehicle')
        .replace(/{{vehicle.model}}/g, lead.vehicleModel || 'your vehicle');
    }
  }
  
  /**
   * Get response from cache if available
   */
  private async getFromCache(cacheKey: string): Promise<CachedResponse | null> {
    if (!this.cacheEnabled) {
      return null;
    }
    
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (!cachedData) {
        return null;
      }
      
      const cached = JSON.parse(cachedData) as CachedResponse;
      
      // Check if cache has expired (double-check in case Redis TTL failed)
      if (cached.expiresAt < Date.now()) {
        await this.redis.del(cacheKey);
        return null;
      }
      
      // Track cache hit in metrics
      prometheusMetrics.incrementAiCacheEvents({
        event_type: 'hit',
        source: cached.source
      });
      
      logger.debug('AI response cache hit', { cacheKey, source: cached.source });
      return cached;
    } catch (error) {
      logger.error('Error retrieving from cache', {
        error: error instanceof Error ? error.message : String(error),
        cacheKey
      });
      
      // Track cache error in metrics
      prometheusMetrics.incrementAiCacheEvents({
        event_type: 'error',
        source: 'unknown'
      });
      
      return null;
    }
  }
  
  /**
   * Store response in cache
   */
  private async storeInCache(
    cacheKey: string, 
    text: string, 
    tokens: number, 
    source: 'template' | 'ai' | 'personalized',
    ttlSeconds?: number
  ): Promise<void> {
    if (!this.cacheEnabled) {
      return;
    }
    
    try {
      const ttl = ttlSeconds || this.cacheTtlSeconds;
      const now = Date.now();
      
      const cachedResponse: CachedResponse = {
        text,
        tokens,
        createdAt: now,
        expiresAt: now + (ttl * 1000),
        source
      };
      
      await this.redis.set(
        cacheKey,
        JSON.stringify(cachedResponse),
        { EX: ttl }
      );
      
      // Track cache store in metrics
      prometheusMetrics.incrementAiCacheEvents({
        event_type: 'store',
        source
      });
      
      logger.debug('Stored AI response in cache', { 
        cacheKey, 
        source, 
        ttlSeconds: ttl,
        tokens
      });
    } catch (error) {
      logger.error('Error storing in cache', {
        error: error instanceof Error ? error.message : String(error),
        cacheKey
      });
      
      // Track cache error in metrics
      prometheusMetrics.incrementAiCacheEvents({
        event_type: 'error',
        source
      });
    }
  }
  
  /**
   * Generate AI response with cost control
   * 
   * This is the main method that implements the cost control strategy:
   * 1. Check for a matching template
   * 2. If template exists, personalize and return (unless fallbackToAI=true)
   * 3. Check cache for similar intent/vehicle
   * 4. If cached response exists, personalize and return
   * 5. Apply rate limiting
   * 6. Generate response using OpenAI
   * 7. Cache the response
   * 8. Track metrics
   */
  async generateResponse(
    lead: Partial<AdfLead>,
    intent: string,
    dealership?: Partial<Dealership>,
    options?: {
      forceFresh?: boolean;
      maxTokens?: number;
      temperature?: number;
      cacheTtlSeconds?: number;
    }
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const dealershipId = lead.dealershipId || dealership?.id || 0;
    const forceFresh = options?.forceFresh || false;
    const cacheKey = this.generateCacheKey(lead, intent);
    
    try {
      // 1. Check for matching template (unless forceFresh is true)
      if (!forceFresh) {
        const template = this.findMatchingTemplate(lead, intent);
        if (template) {
          const personalizedText = this.personalizeTemplate(template.template, lead, dealership);
          
          // If template doesn't require AI fallback, use it directly
          if (!template.fallbackToAI) {
            // Estimate token count (rough approximation)
            const estimatedTokens = Math.ceil(personalizedText.length / 4);
            
            // Store in cache for future use
            await this.storeInCache(
              cacheKey, 
              personalizedText, 
              estimatedTokens, 
              'template',
              options?.cacheTtlSeconds
            );
            
            // Track template usage in metrics
            prometheusMetrics.incrementAiResponsesGenerated({
              dealership_id: String(dealershipId),
              source: 'template',
              intent
            });
            
            prometheusMetrics.trackOpenAiTokensUsed({
              dealership_id: String(dealershipId),
              model: 'template',
              tokens: 0,
              token_type: 'total'
            });
            
            logger.info('Used template for AI response', {
              intent,
              templateId: template.id,
              dealershipId,
              leadId: lead.id
            });
            
            return {
              text: personalizedText,
              model: 'template',
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime
            };
          }
        }
      }
      
      // 2. Check cache (unless forceFresh is true)
      if (!forceFresh) {
        const cached = await this.getFromCache(cacheKey);
        if (cached) {
          // Personalize the cached response
          const personalizedText = this.personalizeTemplate(cached.text, lead, dealership);
          
          // Track cache usage in metrics
          prometheusMetrics.incrementAiResponsesGenerated({
            dealership_id: String(dealershipId),
            source: 'cache',
            intent
          });
          
          prometheusMetrics.trackOpenAiTokensUsed({
            dealership_id: String(dealershipId),
            model: 'cache',
            tokens: 0,
            token_type: 'total'
          });
          
          logger.info('Used cached AI response', {
            intent,
            cacheSource: cached.source,
            dealershipId,
            leadId: lead.id
          });
          
          return {
            text: personalizedText,
            model: `cache:${cached.source}`,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: Date.now() - startTime
          };
        }
      }
      
      // 3. Apply rate limiting
      const limiter = this.getRateLimiter(dealershipId);
      
      // Check if we're already at the limit
      const reservoir = await limiter.currentReservoir();
      if (reservoir !== null && reservoir <= 0) {
        logger.warn('AI rate limit exceeded for dealership', {
          dealershipId,
          intent,
          leadId: lead.id
        });
        
        prometheusMetrics.incrementAiRateLimitEvents({
          dealership_id: String(dealershipId),
          event_type: 'exceeded'
        });
        
        // Use fallback template if available
        const fallbackTemplate = this.templates.find(t => t.intent === 'rate_limit_exceeded');
        if (fallbackTemplate) {
          const fallbackText = this.personalizeTemplate(fallbackTemplate.template, lead, dealership);
          
          return {
            text: fallbackText,
            model: 'rate_limited',
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: Date.now() - startTime
          };
        }
        
        // Generic fallback if no template
        return {
          text: `Thank you for your interest. Our team will review your inquiry about the ${lead.vehicleYear || ''} ${lead.vehicleMake || ''} ${lead.vehicleModel || ''} and get back to you shortly.`,
          model: 'rate_limited',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime
        };
      }
      
      // 4. Generate response using OpenAI (with rate limiting)
      return await limiter.schedule(async () => {
        logger.debug('Generating AI response', {
          intent,
          dealershipId,
          leadId: lead.id
        });
        
        // Construct prompt
        const prompt = this.constructPrompt(lead, intent, dealership);
        
        // Call OpenAI
        const aiResponse = await aiService.getCompletion(
          prompt,
          {
            maxTokens: options?.maxTokens,
            temperature: options?.temperature,
            dealershipId: String(dealershipId),
            sourceProvider: 'adf',
            promptType: `lead_${intent}`
          }
        );
        
        // Track AI usage in metrics
        prometheusMetrics.incrementAiResponsesGenerated({
          dealership_id: String(dealershipId),
          source: 'openai',
          intent
        });
        
        prometheusMetrics.trackOpenAiTokensUsed({
          dealership_id: String(dealershipId),
          model: aiResponse.model,
          tokens: aiResponse.totalTokens,
          token_type: 'total'
        });
        
        prometheusMetrics.trackOpenAiTokensUsed({
          dealership_id: String(dealershipId),
          model: aiResponse.model,
          tokens: aiResponse.promptTokens,
          token_type: 'prompt'
        });
        
        prometheusMetrics.trackOpenAiTokensUsed({
          dealership_id: String(dealershipId),
          model: aiResponse.model,
          tokens: aiResponse.completionTokens,
          token_type: 'completion'
        });
        
        // Store in cache
        await this.storeInCache(
          cacheKey,
          aiResponse.text,
          aiResponse.totalTokens,
          'ai',
          options?.cacheTtlSeconds
        );
        
        logger.info('Generated AI response', {
          intent,
          dealershipId,
          leadId: lead.id,
          tokens: aiResponse.totalTokens,
          latencyMs: aiResponse.latencyMs
        });
        
        return aiResponse;
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error generating AI response', {
        error: errorMessage,
        intent,
        dealershipId,
        leadId: lead.id
      });
      
      // Track error in metrics
      prometheusMetrics.incrementAiResponsesGenerated({
        dealership_id: String(dealershipId),
        source: 'error',
        intent
      });
      
      // Use fallback template if available
      const fallbackTemplate = this.templates.find(t => t.intent === 'error_fallback');
      if (fallbackTemplate) {
        const fallbackText = this.personalizeTemplate(fallbackTemplate.template, lead, dealership);
        
        return {
          text: fallbackText,
          model: 'error_fallback',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          latencyMs: Date.now() - startTime
        };
      }
      
      // Generic fallback if no template
      return {
        text: `Thank you for your interest in the ${lead.vehicleYear || ''} ${lead.vehicleMake || ''} ${lead.vehicleModel || ''}. One of our representatives will contact you shortly to assist with your inquiry.`,
        model: 'error_fallback',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs: Date.now() - startTime
      };
    }
  }
  
  /**
   * Construct a prompt for OpenAI based on lead data and intent
   */
  private constructPrompt(
    lead: Partial<AdfLead>,
    intent: string,
    dealership?: Partial<Dealership>
  ): string {
    // Basic prompt structure
    const prompt = `
You are an automotive sales assistant at ${dealership?.name || 'a car dealership'}.
Respond to a customer inquiry with the following details:

Customer: ${lead.customerName || 'A potential customer'}
Email: ${lead.customerEmail || 'Not provided'}
Phone: ${lead.customerPhone || 'Not provided'}
Vehicle Interest: ${lead.vehicleYear || ''} ${lead.vehicleMake || ''} ${lead.vehicleModel || ''} ${lead.vehicleTrim || ''}
Stock Number: ${lead.vehicleStockNumber || 'Not specified'}
Customer Comments: "${lead.customerComments || 'No comments provided'}"

The customer's intent appears to be: ${intent}

Respond in a helpful, professional manner addressing their specific inquiry about the vehicle.
Keep your response concise (3-4 paragraphs maximum).
Include dealership contact information at the end.
Do not include any disclaimers about being an AI.
`;

    return prompt;
  }
  
  /**
   * Invalidate a specific cache entry
   */
  async invalidateCache(lead: Partial<AdfLead>, intent: string): Promise<boolean> {
    try {
      const cacheKey = this.generateCacheKey(lead, intent);
      await this.redis.del(cacheKey);
      
      logger.debug('Invalidated AI response cache', {
        cacheKey,
        leadId: lead.id,
        intent
      });
      
      return true;
    } catch (error) {
      logger.error('Error invalidating cache', {
        error: error instanceof Error ? error.message : String(error),
        leadId: lead.id,
        intent
      });
      
      return false;
    }
  }
  
  /**
   * Clear all AI response caches for a dealership
   */
  async clearDealershipCache(dealershipId: number | string): Promise<number> {
    try {
      const pattern = `${this.redisKeyPrefix}*`;
      let cursor = 0;
      let deletedCount = 0;
      
      // Scan for matching keys and delete them
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        cursor = parseInt(nextCursor);
        
        if (keys.length > 0) {
          // Filter keys by dealership if needed
          // This would require storing dealershipId in the cache key or value
          
          // Delete keys
          await this.redis.del(keys);
          deletedCount += keys.length;
        }
      } while (cursor !== 0);
      
      logger.info('Cleared AI response cache for dealership', {
        dealershipId,
        deletedCount
      });
      
      return deletedCount;
    } catch (error) {
      logger.error('Error clearing dealership cache', {
        error: error instanceof Error ? error.message : String(error),
        dealershipId
      });
      
      return 0;
    }
  }
  
  /**
   * Get rate limit status for a dealership
   */
  async getRateLimitStatus(dealershipId: number | string): Promise<{
    remaining: number;
    total: number;
    resetInMs: number;
  }> {
    try {
      const limiter = this.getRateLimiter(dealershipId);
      const reservoir = await limiter.currentReservoir() || 0;
      const reservoirTotal = this.defaultRateLimitConfig.dealershipOverrides?.[Number(dealershipId)]?.dailyLimit || 
                             this.defaultRateLimitConfig.dailyLimit;
      
      // Calculate time until reset (ms)
      const reservoirRefreshInterval = 86400000; // 24 hours in ms
      const currentTimeMs = Date.now();
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      midnight.setDate(midnight.getDate() + 1);
      const resetInMs = midnight.getTime() - currentTimeMs;
      
      return {
        remaining: reservoir,
        total: reservoirTotal,
        resetInMs
      };
    } catch (error) {
      logger.error('Error getting rate limit status', {
        error: error instanceof Error ? error.message : String(error),
        dealershipId
      });
      
      // Return conservative estimate
      return {
        remaining: 0,
        total: this.defaultRateLimitConfig.dailyLimit,
        resetInMs: 86400000 // 24 hours in ms
      };
    }
  }
  
  /**
   * Add or update a response template
   */
  async addOrUpdateTemplate(template: ResponseTemplate): Promise<boolean> {
    try {
      // Validate template
      if (!template.id || !template.intent || !template.template) {
        throw new Error('Invalid template: missing required fields');
      }
      
      // Check if template already exists
      const existingIndex = this.templates.findIndex(t => t.id === template.id);
      
      if (existingIndex >= 0) {
        // Update existing template
        this.templates[existingIndex] = template;
      } else {
        // Add new template
        this.templates.push(template);
      }
      
      // Save to file
      const templateFilePath = path.join(this.templatePath, `${template.id}.json`);
      await fs.writeFile(templateFilePath, JSON.stringify(template, null, 2), 'utf-8');
      
      logger.info('Added/updated response template', {
        templateId: template.id,
        intent: template.intent
      });
      
      return true;
    } catch (error) {
      logger.error('Error adding/updating template', {
        error: error instanceof Error ? error.message : String(error),
        templateId: template.id
      });
      
      return false;
    }
  }
  
  /**
   * Delete a response template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      // Remove from memory
      const initialLength = this.templates.length;
      this.templates = this.templates.filter(t => t.id !== templateId);
      
      if (this.templates.length === initialLength) {
        logger.warn(`Template not found: ${templateId}`);
        return false;
      }
      
      // Remove from file system
      const templateFilePath = path.join(this.templatePath, `${templateId}.json`);
      await fs.unlink(templateFilePath);
      
      logger.info('Deleted response template', { templateId });
      
      return true;
    } catch (error) {
      logger.error('Error deleting template', {
        error: error instanceof Error ? error.message : String(error),
        templateId
      });
      
      return false;
    }
  }
  
  /**
   * Get all templates
   */
  getTemplates(): ResponseTemplate[] {
    return [...this.templates];
  }
  
  /**
   * Update rate limit configuration
   */
  updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    // Update config
    if (config.maxConcurrent !== undefined) {
      this.defaultRateLimitConfig.maxConcurrent = config.maxConcurrent;
    }
    
    if (config.dailyLimit !== undefined) {
      this.defaultRateLimitConfig.dailyLimit = config.dailyLimit;
    }
    
    if (config.dealershipOverrides) {
      this.defaultRateLimitConfig.dealershipOverrides = {
        ...this.defaultRateLimitConfig.dealershipOverrides,
        ...config.dealershipOverrides
      };
    }
    
    // Reset limiters to apply new configuration
    this.limiter = {};
    
    logger.info('Updated rate limit configuration', {
      maxConcurrent: this.defaultRateLimitConfig.maxConcurrent,
      dailyLimit: this.defaultRateLimitConfig.dailyLimit,
      dealershipOverridesCount: Object.keys(this.defaultRateLimitConfig.dealershipOverrides || {}).length
    });
  }
}

// Create and export singleton instance
let aiCostControlService: AiCostControlService | null = null;

export const initializeAiCostControlService = async (redis: Redis, options?: {
  rateLimitConfig?: Partial<RateLimitConfig>;
  cacheEnabled?: boolean;
  cacheTtlSeconds?: number;
  templatePath?: string;
  redisKeyPrefix?: string;
}): Promise<AiCostControlService> => {
  if (!aiCostControlService) {
    aiCostControlService = new AiCostControlService({
      redis,
      ...options
    });
  }
  return aiCostControlService;
};

export const getAiCostControlService = (): AiCostControlService => {
  if (!aiCostControlService) {
    throw new Error('AI Cost Control Service not initialized. Call initializeAiCostControlService first.');
  }
  return aiCostControlService;
};

export default {
  initialize: initializeAiCostControlService,
  getInstance: getAiCostControlService
};
