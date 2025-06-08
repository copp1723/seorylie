import { OpenAI } from "openai";
import logger from "../utils/logger";
import { cacheService } from "./unified-cache-service";
import { prometheusMetrics } from "./prometheus-metrics";

export interface AIServiceOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  cacheEnabled?: boolean;
  cacheTtl?: number; // in seconds
}

export interface AIResponse {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

/**
 * Enhanced AI Service with caching, error handling, and metrics
 */
export class EnhancedAIService {
  private openai: OpenAI;
  private defaultModel: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;
  private cacheEnabled: boolean;
  private cacheTtl: number;

  constructor(options: AIServiceOptions = {}) {
    const apiKey = options.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    this.openai = new OpenAI({ apiKey });
    this.defaultModel = options.model || "gpt-3.5-turbo";
    this.defaultTemperature =
      options.temperature !== undefined ? options.temperature : 0.7;
    this.defaultMaxTokens = options.maxTokens || 1000;
    this.cacheEnabled =
      options.cacheEnabled !== undefined ? options.cacheEnabled : true;
    this.cacheTtl = options.cacheTtl || 3600; // 1 hour default

    logger.info("Enhanced AI Service initialized", {
      model: this.defaultModel,
      cacheEnabled: this.cacheEnabled,
    });
  }

  /**
   * Get completion for a prompt
   */
  async getCompletion(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      dealershipId?: string | number;
      sourceProvider?: string;
      promptType?: string;
    } = {},
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const temperature =
      options.temperature !== undefined
        ? options.temperature
        : this.defaultTemperature;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const dealershipId = options.dealershipId || "0";
    const sourceProvider = options.sourceProvider || "unknown";
    const promptType = options.promptType || "standard";

    // Generate cache key
    const cacheKey = this.generateCacheKey(
      prompt,
      model,
      temperature,
      maxTokens,
    );

    // Try to get from cache
    if (this.cacheEnabled) {
      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        logger.debug("AI response retrieved from cache", { cacheKey });

        // Record cache hit latency in metrics
        const latencyMs = Date.now() - startTime;
        prometheusMetrics.recordAiResponseLatency(latencyMs, {
          dealership_id: dealershipId,
          source_provider: sourceProvider,
          model: model,
          prompt_type: `${promptType}_cached`,
        });

        return {
          ...cachedResponse,
          latencyMs,
        };
      }
    }

    try {
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens: maxTokens,
      });

      const latencyMs = Date.now() - startTime;

      // Extract response data
      const result: AIResponse = {
        text: response.choices[0]?.message?.content || "",
        model: response.model,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        latencyMs,
      };

      // Cache the result
      if (this.cacheEnabled) {
        await cacheService.set(cacheKey, result, this.cacheTtl);
      }

      // Record metrics for AI response latency
      prometheusMetrics.recordAiResponseLatency(latencyMs, {
        dealership_id: dealershipId,
        source_provider: sourceProvider,
        model: model,
        prompt_type: promptType,
      });

      logger.debug("AI response generated", {
        model,
        tokens: result.totalTokens,
        latencyMs,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("AI service error", {
        error: errorMessage,
        model,
        latencyMs,
      });

      // Record metrics for failed AI response
      prometheusMetrics.recordAiResponseLatency(latencyMs, {
        dealership_id: dealershipId,
        source_provider: sourceProvider,
        model: model,
        prompt_type: `${promptType}_error`,
      });

      throw new Error(`AI service error: ${errorMessage}`);
    }
  }

  /**
   * Generate a completion for a conversation
   */
  async getChatCompletion(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      dealershipId?: string | number;
      sourceProvider?: string;
      promptType?: string;
    } = {},
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const model = options.model || this.defaultModel;
    const temperature =
      options.temperature !== undefined
        ? options.temperature
        : this.defaultTemperature;
    const maxTokens = options.maxTokens || this.defaultMaxTokens;
    const dealershipId = options.dealershipId || "0";
    const sourceProvider = options.sourceProvider || "unknown";
    const promptType = options.promptType || "chat";

    // Generate cache key - only cache if there are fewer than 5 messages
    // This prevents the cache from growing too large with long conversations
    const shouldCache = this.cacheEnabled && messages.length < 5;
    const cacheKey = shouldCache
      ? this.generateChatCacheKey(messages, model, temperature, maxTokens)
      : "";

    // Try to get from cache
    if (shouldCache) {
      const cachedResponse = await cacheService.get(cacheKey);
      if (cachedResponse) {
        logger.debug("Chat response retrieved from cache", { cacheKey });

        // Record cache hit latency in metrics
        const latencyMs = Date.now() - startTime;
        prometheusMetrics.recordAiResponseLatency(latencyMs, {
          dealership_id: dealershipId,
          source_provider: sourceProvider,
          model: model,
          prompt_type: `${promptType}_cached`,
        });

        return {
          ...cachedResponse,
          latencyMs,
        };
      }
    }

    try {
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const latencyMs = Date.now() - startTime;

      // Extract response data
      const result: AIResponse = {
        text: response.choices[0]?.message?.content || "",
        model: response.model,
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        latencyMs,
      };

      // Cache the result if appropriate
      if (shouldCache) {
        await cacheService.set(cacheKey, result, this.cacheTtl);
      }

      // Record metrics for AI response latency
      prometheusMetrics.recordAiResponseLatency(latencyMs, {
        dealership_id: dealershipId,
        source_provider: sourceProvider,
        model: model,
        prompt_type: promptType,
      });

      logger.debug("Chat response generated", {
        model,
        tokens: result.totalTokens,
        latencyMs,
        messageCount: messages.length,
      });

      return result;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Chat completion error", {
        error: errorMessage,
        model,
        latencyMs,
        messageCount: messages.length,
      });

      // Record metrics for failed AI response
      prometheusMetrics.recordAiResponseLatency(latencyMs, {
        dealership_id: dealershipId,
        source_provider: sourceProvider,
        model: model,
        prompt_type: `${promptType}_error`,
      });

      throw new Error(`Chat completion error: ${errorMessage}`);
    }
  }

  /**
   * Generate a cache key for a prompt
   */
  private generateCacheKey(
    prompt: string,
    model: string,
    temperature: number,
    maxTokens: number,
  ): string {
    // Create a deterministic hash of the prompt to use as cache key
    const hash = require("crypto")
      .createHash("md5")
      .update(`${prompt}|${model}|${temperature}|${maxTokens}`)
      .digest("hex");

    return `ai:completion:${hash}`;
  }

  /**
   * Generate a cache key for a chat conversation
   */
  private generateChatCacheKey(
    messages: Array<{ role: string; content: string }>,
    model: string,
    temperature: number,
    maxTokens: number,
  ): string {
    // Create a deterministic hash of the messages to use as cache key
    const messagesString = JSON.stringify(messages);
    const hash = require("crypto")
      .createHash("md5")
      .update(`${messagesString}|${model}|${temperature}|${maxTokens}`)
      .digest("hex");

    return `ai:chat:${hash}`;
  }
}

// Export singleton instance with default configuration
export const aiService = new EnhancedAIService();

// Export with alternative name for backward compatibility
export const enhancedAIService = aiService;

export default aiService;
