import {
  AIResponseService,
  type AIResponseRequest,
  type AIResponseResult,
} from "./ai-response-service";
import {
  routeMessageThroughAgentSquad,
  isAgentSquadReady,
  type AgentSquadResponse,
} from "./agentSquad/index";
import logger from "../utils/logger";

export interface HybridAIConfig {
  useAgentSquad: boolean;
  fallbackToOriginal: boolean;
  agentSquadThreshold?: number; // Minimum confidence to use Agent Squad
  timeoutMs?: number; // Timeout for Agent Squad responses
  enablePerformanceTracking?: boolean;
  maxRetries?: number;
  preferAgentSquadFor?: string[]; // List of intent types to prefer Agent Squad for
}

export interface HybridAIResponse extends AIResponseResult {
  usedAgentSquad?: boolean;
  selectedAgent?: string;
  confidence?: number;
  fallbackReason?: string;
  processingTimeMs?: number;
  agentSquadTimeMs?: number;
  originalAITimeMs?: number;
  retryAttempt?: number;
  performanceMetrics?: {
    agentSquadLatency?: number;
    fallbackLatency?: number;
    totalLatency: number;
    functionCallsUsed?: number;
  };
}

/**
 * Hybrid AI Service that can route between Agent Squad and original Rylie AI
 * This maintains backward compatibility while adding Agent Squad capabilities
 */
export class HybridAIService {
  private originalAIService = new AIResponseService();
  private config: HybridAIConfig;

  constructor(
    config: HybridAIConfig = {
      useAgentSquad: false,
      fallbackToOriginal: true,
      timeoutMs: 30000,
      enablePerformanceTracking: true,
      maxRetries: 2,
      preferAgentSquadFor: [
        "inventory",
        "vehicle_search",
        "pricing",
        "availability",
      ],
    },
  ) {
    this.config = {
      timeoutMs: 30000,
      enablePerformanceTracking: true,
      maxRetries: 2,
      preferAgentSquadFor: [
        "inventory",
        "vehicle_search",
        "pricing",
        "availability",
      ],
      ...config,
    };
    logger.info("HybridAIService initialized with enhanced configuration", {
      config: this.config,
    });
  }

  /**
   * Generate AI response using enhanced hybrid approach with performance optimization
   */
  async generateResponse(
    request: AIResponseRequest,
  ): Promise<HybridAIResponse> {
    const startTime = Date.now();
    let agentSquadStartTime: number | undefined;
    let originalAIStartTime: number | undefined;
    let retryAttempt = 0;

    logger.info("Hybrid AI processing request with enhanced routing", {
      dealershipId: request.dealershipId,
      conversationId: request.conversationId,
      useAgentSquad: this.config.useAgentSquad,
      agentSquadReady: isAgentSquadReady(),
      timeoutMs: this.config.timeoutMs,
      performanceTracking: this.config.enablePerformanceTracking,
    });

    // Check if this request type should prefer Agent Squad
    const shouldPreferAgentSquad = this.shouldUseAgentSquad(request);

    // Try Agent Squad first if enabled, ready, and preferred for this type of request
    if (
      this.config.useAgentSquad &&
      isAgentSquadReady() &&
      shouldPreferAgentSquad
    ) {
      for (
        retryAttempt = 0;
        retryAttempt < (this.config.maxRetries || 2);
        retryAttempt++
      ) {
        try {
          agentSquadStartTime = Date.now();
          const agentSquadResult = await this.tryAgentSquadWithTimeout(
            request,
            retryAttempt,
          );
          const agentSquadTimeMs = Date.now() - agentSquadStartTime;

          if (agentSquadResult.success && !agentSquadResult.fallbackRequired) {
            const totalTime = Date.now() - startTime;

            logger.info("Agent Squad successfully handled request", {
              conversationId: request.conversationId,
              selectedAgent: agentSquadResult.selectedAgent,
              processingTime: totalTime,
              agentSquadTime: agentSquadTimeMs,
              retryAttempt,
              confidence: agentSquadResult.confidence,
            });

            return {
              success: true,
              content: agentSquadResult.response,
              usedAgentSquad: true,
              selectedAgent: agentSquadResult.selectedAgent,
              confidence: agentSquadResult.confidence,
              processingTimeMs: totalTime,
              agentSquadTimeMs,
              retryAttempt,
              performanceMetrics: this.config.enablePerformanceTracking
                ? {
                    agentSquadLatency: agentSquadTimeMs,
                    totalLatency: totalTime,
                    functionCallsUsed: agentSquadResult.functionCallsUsed || 0,
                  }
                : undefined,
              errors: [],
            };
          } else {
            logger.warn(
              `Agent Squad attempt ${retryAttempt + 1} failed or requested fallback`,
              {
                conversationId: request.conversationId,
                error: agentSquadResult.error,
                fallbackRequired: agentSquadResult.fallbackRequired,
                agentSquadTime: agentSquadTimeMs,
              },
            );

            // Don't retry if fallback was explicitly requested
            if (agentSquadResult.fallbackRequired) {
              break;
            }
          }
        } catch (error) {
          const agentSquadTimeMs = agentSquadStartTime
            ? Date.now() - agentSquadStartTime
            : 0;
          logger.error(
            `Agent Squad processing failed on attempt ${retryAttempt + 1}`,
            {
              error: error instanceof Error ? error.message : String(error),
              conversationId: request.conversationId,
              agentSquadTime: agentSquadTimeMs,
              retryAttempt,
            },
          );

          // Don't retry on timeout or certain errors
          if (
            error instanceof Error &&
            (error.message.includes("timeout") ||
              error.message.includes("rate limit"))
          ) {
            break;
          }
        }

        // Wait before retry (exponential backoff)
        if (retryAttempt < (this.config.maxRetries || 2) - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, retryAttempt) * 1000),
          );
        }
      }
    }

    // Fallback to original AI service
    if (this.config.fallbackToOriginal) {
      originalAIStartTime = Date.now();

      logger.info("Using original AI service as fallback", {
        conversationId: request.conversationId,
        agentSquadAttempts: retryAttempt + 1,
        reason: shouldPreferAgentSquad
          ? "agent_squad_failed"
          : "agent_squad_not_preferred",
      });

      try {
        const originalResult =
          await this.originalAIService.generateAndSendResponse(request);
        const originalAITimeMs = Date.now() - originalAIStartTime;
        const totalTime = Date.now() - startTime;

        return {
          ...originalResult,
          usedAgentSquad: false,
          fallbackReason: this.config.useAgentSquad
            ? shouldPreferAgentSquad
              ? "agent_squad_failed"
              : "agent_squad_not_preferred"
            : "agent_squad_disabled",
          processingTimeMs: totalTime,
          originalAITimeMs,
          retryAttempt,
          performanceMetrics: this.config.enablePerformanceTracking
            ? {
                fallbackLatency: originalAITimeMs,
                totalLatency: totalTime,
                functionCallsUsed: 0,
              }
            : undefined,
        };
      } catch (error) {
        const originalAITimeMs = Date.now() - originalAIStartTime;
        const totalTime = Date.now() - startTime;

        logger.error("Original AI service also failed", {
          error: error instanceof Error ? error.message : String(error),
          conversationId: request.conversationId,
          originalAITime: originalAITimeMs,
          totalTime,
        });

        return {
          success: false,
          errors: [
            `All AI systems failed: ${error instanceof Error ? error.message : String(error)}`,
          ],
          usedAgentSquad: false,
          fallbackReason: "all_systems_failed",
          processingTimeMs: totalTime,
          originalAITimeMs,
          retryAttempt,
        };
      }
    }

    // Both systems unavailable
    const totalTime = Date.now() - startTime;
    return {
      success: false,
      errors: ["All AI systems unavailable"],
      usedAgentSquad: false,
      fallbackReason: "all_systems_failed",
      processingTimeMs: totalTime,
      retryAttempt,
    };
  }

  /**
   * Determine if Agent Squad should be used for this request type
   */
  private shouldUseAgentSquad(request: AIResponseRequest): boolean {
    if (!this.config.useAgentSquad || !this.config.preferAgentSquadFor) {
      return this.config.useAgentSquad;
    }

    const prompt = request.prompt.toLowerCase();
    const preferredTypes = this.config.preferAgentSquadFor;

    // Check if prompt contains keywords that benefit from Agent Squad
    const hasInventoryKeywords = [
      "inventory",
      "vehicle",
      "car",
      "truck",
      "suv",
      "sedan",
      "search",
      "find",
      "available",
      "price",
      "cost",
      "financing",
      "lease",
      "buy",
      "purchase",
      "model",
      "make",
      "year",
      "mileage",
      "features",
      "specs",
      "details",
    ].some((keyword) => prompt.includes(keyword));

    const hasPreferredIntent = preferredTypes.some((type) => {
      switch (type) {
        case "inventory":
          return hasInventoryKeywords;
        case "vehicle_search":
          return (
            hasInventoryKeywords ||
            prompt.includes("looking for") ||
            prompt.includes("need a")
          );
        case "pricing":
          return (
            prompt.includes("price") ||
            prompt.includes("cost") ||
            prompt.includes("payment")
          );
        case "availability":
          return (
            prompt.includes("available") ||
            prompt.includes("in stock") ||
            prompt.includes("test drive")
          );
        default:
          return false;
      }
    });

    return hasPreferredIntent;
  }

  /**
   * Try processing with Agent Squad with timeout support
   */
  private async tryAgentSquadWithTimeout(
    request: AIResponseRequest,
    retryAttempt: number = 0,
  ): Promise<AgentSquadResponse> {
    try {
      // Build enhanced context from request
      const context = {
        dealershipId: request.dealershipId,
        personaId: request.personaId,
        retryAttempt,
        timestamp: new Date().toISOString(),
        preferredFeatures: ["inventory_search", "real_time_data"],
        ...request.context,
      };

      // Create timeout promise
      const timeoutPromise = new Promise<AgentSquadResponse>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`Agent Squad timeout after ${this.config.timeoutMs}ms`),
          );
        }, this.config.timeoutMs || 30000);
      });

      // Race between Agent Squad processing and timeout
      const agentSquadPromise = routeMessageThroughAgentSquad(
        request.prompt,
        `user_${request.dealershipId}`, // User ID based on dealership
        request.conversationId,
        context,
      );

      const agentSquadResult = await Promise.race([
        agentSquadPromise,
        timeoutPromise,
      ]);

      // If successful, save the message to Rylie's database
      if (agentSquadResult.success && agentSquadResult.response) {
        await this.saveAgentSquadResponse(request, agentSquadResult);
      }

      return agentSquadResult;
    } catch (error) {
      logger.error("Agent Squad processing error with timeout", {
        error: error instanceof Error ? error.message : String(error),
        conversationId: request.conversationId,
        retryAttempt,
        timeoutMs: this.config.timeoutMs,
      });

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Agent Squad processing failed",
        fallbackRequired: true,
      };
    }
  }

  /**
   * Save Agent Squad response to Rylie's conversation system
   */
  private async saveAgentSquadResponse(
    request: AIResponseRequest,
    agentSquadResult: AgentSquadResponse,
  ): Promise<void> {
    try {
      // Import ConversationService to save the response
      const { ConversationService } = await import("./conversation-service");
      const conversationService = new ConversationService();

      // Save Agent Squad response as AI message
      await conversationService.sendReply(request.dealershipId, {
        conversationId: request.conversationId,
        content: agentSquadResult.response || "",
        sender: "ai",
        contentType: "text",
        senderName: `Rylie AI (${agentSquadResult.selectedAgent})`,
      });

      logger.info("Agent Squad response saved to conversation", {
        conversationId: request.conversationId,
        selectedAgent: agentSquadResult.selectedAgent,
      });
    } catch (error) {
      logger.error("Failed to save Agent Squad response", {
        error: error instanceof Error ? error.message : String(error),
        conversationId: request.conversationId,
      });
    }
  }

  /**
   * Update hybrid configuration
   */
  updateConfig(newConfig: Partial<HybridAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("HybridAIService configuration updated", {
      config: this.config,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): HybridAIConfig {
    return { ...this.config };
  }

  /**
   * Get comprehensive service health status with performance metrics
   */
  async getHealthStatus(): Promise<{
    originalAI: boolean;
    agentSquad: boolean;
    hybrid: boolean;
    performance?: {
      avgResponseTime: number;
      agentSquadUsageRate: number;
      fallbackRate: number;
      errorRate: number;
    };
    configuration: HybridAIConfig;
  }> {
    const agentSquadReady = isAgentSquadReady();

    return {
      originalAI: true, // Original AI service is always available
      agentSquad: agentSquadReady,
      hybrid: true, // Hybrid service is always available due to fallback
      performance: this.config.enablePerformanceTracking
        ? {
            avgResponseTime: 0, // Would be calculated from metrics in production
            agentSquadUsageRate: 0, // Percentage of requests routed to Agent Squad
            fallbackRate: 0, // Percentage of requests that fell back to original AI
            errorRate: 0, // Percentage of requests that failed completely
          }
        : undefined,
      configuration: { ...this.config },
    };
  }

  /**
   * Get performance analytics for the hybrid system
   */
  async getPerformanceAnalytics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<{
    totalRequests: number;
    agentSquadRequests: number;
    originalAIRequests: number;
    averageLatency: {
      agentSquad: number;
      originalAI: number;
      overall: number;
    };
    successRates: {
      agentSquad: number;
      originalAI: number;
      overall: number;
    };
    functionCallStats: {
      totalCalls: number;
      averageCallsPerRequest: number;
      mostUsedFunctions: Record<string, number>;
    };
  }> {
    // This would integrate with actual metrics storage in production
    // For now, return placeholder data structure
    return {
      totalRequests: 0,
      agentSquadRequests: 0,
      originalAIRequests: 0,
      averageLatency: {
        agentSquad: 0,
        originalAI: 0,
        overall: 0,
      },
      successRates: {
        agentSquad: 0,
        originalAI: 0,
        overall: 0,
      },
      functionCallStats: {
        totalCalls: 0,
        averageCallsPerRequest: 0,
        mostUsedFunctions: {},
      },
    };
  }
}

// Export singleton instance with production-ready configuration
export const hybridAIService = new HybridAIService({
  useAgentSquad: process.env.AGENT_SQUAD_ENABLED === "true",
  fallbackToOriginal: true,
  timeoutMs: parseInt(process.env.AGENT_SQUAD_TIMEOUT_MS || "30000"),
  enablePerformanceTracking: process.env.NODE_ENV === "production",
  maxRetries: parseInt(process.env.AGENT_SQUAD_MAX_RETRIES || "2"),
  preferAgentSquadFor: [
    "inventory",
    "vehicle_search",
    "pricing",
    "availability",
  ],
  agentSquadThreshold: parseFloat(
    process.env.AGENT_SQUAD_CONFIDENCE_THRESHOLD || "0.7",
  ),
});
