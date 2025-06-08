/**
 * ADF-W10: Advanced Conversation Orchestrator
 *
 * Production-ready, extensible conversation orchestration system that serves as the foundation
 * for adaptive conversation capabilities while maintaining backward compatibility.
 *
 * Features:
 * - Event-driven architecture with Redis Streams
 * - Circuit breaker protection for AI services
 * - Comprehensive metrics and observability
 * - Queue-based processing with retry logic
 * - Dynamic prompt management
 * - Adaptive conversation support hooks
 */

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import Queue from "bull";
import { getRedisClient } from "../lib/redis";
import db from "../db";
import { eq, and, desc, sql } from "drizzle-orm";
import logger from "../utils/logger";
import { CircuitBreaker, type CircuitBreakerOptions } from "./circuit-breaker";
import { AIResponseService } from "./ai-response-service";
import { PromptManager } from "./prompt-manager";
import { MetricsCollector } from "./metrics-collector";

// Types and Interfaces
export interface ConversationContext {
  leadId: string;
  conversationId: string;
  dealershipId: number;
  currentTurn: number;
  maxTurns: number;
  metadata: {
    source: string;
    vehicleInterest?: string;
    customerInfo: {
      name?: string;
      phone?: string;
      email?: string;
    };
    timing?: string;
    sessionData?: Record<string, any>;
  };
  history: ConversationMessage[];
  state: "active" | "paused" | "completed" | "escalated" | "failed";
  aiModel?: string;
  temperature?: number;
  priority: number;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  turnNumber: number;
  metadata: {
    model?: string;
    promptTemplate?: string;
    processingTime?: number;
    confidence?: number;
    intent?: string;
    sentiment?: number;
    tokensUsed?: number;
    cost?: number;
    channel?: string;
    deliveryStatus?: "pending" | "delivered" | "failed";
    deliveryTimestamp?: Date;
    errorDetails?: any;
  };
  createdAt: Date;
}

export interface OrchestrationResult {
  conversationId: string;
  turnNumber: number;
  message: string;
  nextAction: "continue" | "complete" | "escalate" | "pause";
  metadata: {
    responseTime: number;
    aiConfidence?: number;
    intentDetected?: string;
    sentiment?: number;
    cost?: number;
    tokensUsed?: number;
  };
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  circuitBreaker: {
    state: string;
    failures: number;
  };
  metrics: {
    totalConversations: number;
    activeConversations: number;
    averageTurnsPerConversation: number;
    averageResponseTime: number;
  };
  redis: {
    connected: boolean;
    streamsActive: boolean;
  };
}

/**
 * Advanced Conversation Orchestrator
 *
 * Handles the complete lifecycle of AI-powered conversations with:
 * - Event-driven processing via Redis Streams
 * - Resilient AI service integration with circuit breaker
 * - Comprehensive monitoring and metrics
 * - Queue-based turn processing with retry logic
 * - Dynamic prompt selection and management
 */
export class ConversationOrchestrator extends EventEmitter {
  private aiService: AIResponseService;
  private circuitBreaker: CircuitBreaker;
  private conversationQueue: Queue.Queue;
  private promptManager: PromptManager;
  private metricsCollector: MetricsCollector;
  private redis: any;
  private isInitialized = false;
  private isShuttingDown = false;
  private healthMonitorInterval?: NodeJS.Timeout;
  private processingStats = {
    totalProcessed: 0,
    successfulTurns: 0,
    failedTurns: 0,
    escalatedConversations: 0,
    averageProcessingTime: 0,
  };

  constructor() {
    super();
    this.setupErrorHandling();
  }

  /**
   * Initialize the orchestrator with all dependencies
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("ConversationOrchestrator already initialized");
      return;
    }

    try {
      logger.info("Initializing ConversationOrchestrator...");

      // Initialize Redis connection
      this.redis = await getRedisClient();

      // Initialize AI service
      this.aiService = new AIResponseService();

      // Initialize circuit breaker for AI service protection
      this.circuitBreaker = new CircuitBreaker({
        name: "ai-service",
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        halfOpenSuccessThreshold: 3,
        trackHealthHistory: true,
        onOpen: () => {
          logger.error(
            "AI service circuit breaker opened - AI service degraded",
          );
          this.emit("circuit-breaker:open", { service: "ai-service" });
        },
        onClose: () => {
          logger.info(
            "AI service circuit breaker closed - AI service recovered",
          );
          this.emit("circuit-breaker:close", { service: "ai-service" });
        },
        onHalfOpen: () => {
          logger.info(
            "AI service circuit breaker half-open - testing recovery",
          );
          this.emit("circuit-breaker:half-open", { service: "ai-service" });
        },
      });

      // Initialize prompt manager
      this.promptManager = new PromptManager();
      await this.promptManager.initialize();

      // Initialize metrics collector
      this.metricsCollector = new MetricsCollector("conversation-orchestrator");

      // Initialize Bull queue for conversation processing
      this.conversationQueue = new Queue("conversation-processing", {
        redis: this.redis
          ? {
              port: this.redis.options?.port || 6379,
              host: this.redis.options?.host || "localhost",
            }
          : undefined,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 50, // Keep last 50 failed jobs for debugging
        },
      });

      // Set up queue processors
      await this.setupQueueProcessing();

      // Subscribe to Redis streams for lead processing
      await this.subscribeToLeadStream();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      logger.info("ConversationOrchestrator initialized successfully");

      this.emit("initialized");
    } catch (error) {
      logger.error("Failed to initialize ConversationOrchestrator", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Set up error handling for the orchestrator
   */
  private setupErrorHandling(): void {
    this.on("error", (error) => {
      logger.error("ConversationOrchestrator error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Handle uncaught exceptions gracefully
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception in ConversationOrchestrator", {
        error: error.message,
        stack: error.stack,
      });
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled rejection in ConversationOrchestrator", {
        reason: reason instanceof Error ? reason.message : String(reason),
      });
    });
  }

  /**
   * Set up queue processing for conversation turns
   */
  private async setupQueueProcessing(): Promise<void> {
    // Process conversation turns with concurrency control
    this.conversationQueue.process("process-turn", 5, async (job) => {
      const startTime = Date.now();

      try {
        const result = await this.processConversationTurn(job.data);

        // Update processing stats
        this.processingStats.totalProcessed++;
        this.processingStats.successfulTurns++;

        const processingTime = Date.now() - startTime;
        this.updateAverageProcessingTime(processingTime);

        // Record metrics
        this.metricsCollector.recordTurnProcessed({
          conversationId: result.conversationId,
          turnNumber: result.turnNumber,
          processingTime,
          outcome: result.nextAction,
        });

        return result;
      } catch (error) {
        this.processingStats.failedTurns++;

        // Record failure metrics
        this.metricsCollector.recordTurnFailed({
          conversationId: job.data.context?.conversationId || "unknown",
          error: error instanceof Error ? error.message : String(error),
        });

        throw error;
      }
    });

    // Set up queue event handlers
    this.conversationQueue.on("completed", (job, result) => {
      logger.debug("Conversation turn completed", {
        jobId: job.id,
        conversationId: result.conversationId,
        turnNumber: result.turnNumber,
        nextAction: result.nextAction,
      });
    });

    this.conversationQueue.on("failed", (job, error) => {
      logger.error("Conversation turn failed", {
        jobId: job.id,
        error: error.message,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts,
      });

      this.emit("turn:failed", {
        jobId: job.id,
        error: error.message,
        data: job.data,
      });
    });

    this.conversationQueue.on("stalled", (job) => {
      logger.warn("Conversation turn stalled", {
        jobId: job.id,
        data: job.data,
      });

      this.emit("turn:stalled", {
        jobId: job.id,
        data: job.data,
      });
    });
  }

  /**
   * Subscribe to Redis streams for new lead processing
   */
  private async subscribeToLeadStream(): Promise<void> {
    if (!this.redis) {
      logger.warn("Redis not available - skipping stream subscription");
      return;
    }

    const consumerId = `orchestrator-${process.env.INSTANCE_ID || "default"}`;
    const consumerGroup = "conversation-orchestrators";

    try {
      // Create consumer group if it doesn't exist
      try {
        await this.redis.xgroup(
          "CREATE",
          "adf.lead.created",
          consumerGroup,
          "$",
          "MKSTREAM",
        );
        logger.info("Created consumer group for lead stream", {
          consumerGroup,
        });
      } catch (error) {
        // Group already exists or other error - continue
        logger.debug("Consumer group creation result", {
          error: error.message,
        });
      }

      // Start continuous processing loop
      this.processLeadStream(consumerGroup, consumerId);
    } catch (error) {
      logger.error("Failed to set up lead stream subscription", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Continuous processing of lead stream
   */
  private async processLeadStream(
    consumerGroup: string,
    consumerId: string,
  ): Promise<void> {
    let retryDelay = 1000; // Start with 1 second retry delay

    while (!this.isShuttingDown) {
      try {
        // Exit early if shutting down
        if (this.isShuttingDown) {
          logger.info("Lead stream processing stopped due to shutdown");
          break;
        }

        if (!this.redis) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(retryDelay, 1000)),
          );
          continue;
        }

        const messages = await this.redis.xreadgroup(
          "GROUP",
          consumerGroup,
          consumerId,
          "COUNT",
          10,
          "BLOCK",
          1000, // Reduced block time for faster shutdown
          "STREAMS",
          "adf.lead.created",
          ">",
        );

        if (messages && messages.length > 0) {
          for (const [streamName, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              // Check shutdown flag before processing each message
              if (this.isShuttingDown) {
                logger.info("Stopping lead processing due to shutdown");
                return;
              }

              try {
                await this.handleNewLead(messageId, fields);
                await this.redis.xack(
                  "adf.lead.created",
                  consumerGroup,
                  messageId,
                );
                retryDelay = 1000; // Reset retry delay on success
              } catch (error) {
                logger.error("Error processing lead message", {
                  messageId,
                  error: error instanceof Error ? error.message : String(error),
                });
                // Message will be redelivered later
              }
            }
          }
        }
      } catch (error) {
        // Don't log errors if we're shutting down
        if (!this.isShuttingDown) {
          logger.error("Error in lead stream processing loop", {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Exponential backoff with max delay of 30 seconds
        retryDelay = Math.min(retryDelay * 2, 30000);

        // Shorter delay during shutdown
        const delayTime = this.isShuttingDown ? 100 : retryDelay;
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    }

    logger.info("Lead stream processing loop exited");
  }

  /**
   * Handle new lead from stream
   */
  private async handleNewLead(messageId: string, leadData: any): Promise<void> {
    try {
      const lead = JSON.parse(leadData.data);

      logger.info("Processing new lead for orchestration", {
        leadId: lead.id,
        dealershipId: lead.dealership_id,
        messageId,
      });

      // Create conversation context
      const context: ConversationContext = {
        leadId: lead.id,
        conversationId: uuidv4(),
        dealershipId: lead.dealership_id,
        currentTurn: 0,
        maxTurns: this.getMaxTurns(lead),
        metadata: {
          source: lead.source || "unknown",
          vehicleInterest: lead.vehicle?.model,
          customerInfo: {
            name: lead.customer?.name,
            phone: lead.customer?.phone,
            email: lead.customer?.email,
          },
          timing: lead.comments?.timing,
          sessionData: lead.metadata || {},
        },
        history: [],
        state: "active",
        aiModel: this.selectAIModel(lead),
        temperature: this.selectTemperature(lead),
        priority: this.calculatePriority(lead),
      };

      // Store conversation in database
      await this.storeConversation(context);

      // Queue first turn for processing
      await this.conversationQueue.add(
        "process-turn",
        {
          context,
          turnNumber: 1,
        },
        {
          priority: context.priority,
          delay: this.calculateInitialDelay(context),
        },
      );

      // Emit event for monitoring
      this.emit("conversation:started", {
        conversationId: context.conversationId,
        leadId: context.leadId,
        dealershipId: context.dealershipId,
      });

      logger.info("Conversation queued for processing", {
        conversationId: context.conversationId,
        leadId: context.leadId,
        priority: context.priority,
      });
    } catch (error) {
      logger.error("Failed to handle new lead", {
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Process a conversation turn
   */
  private async processConversationTurn(
    data: any,
  ): Promise<OrchestrationResult> {
    const { context, turnNumber } = data;
    const startTime = Date.now();

    try {
      logger.info("Processing conversation turn", {
        conversationId: context.conversationId,
        turnNumber,
        dealershipId: context.dealershipId,
      });

      // Load latest conversation state and history
      const updatedContext = await this.loadConversationState(
        context.conversationId,
      );

      // Select appropriate prompt for this turn
      const prompt = await this.promptManager.selectPrompt(
        updatedContext,
        turnNumber,
      );

      // Build context for AI prompt
      const promptContext = this.buildPromptContext(updatedContext);

      // Generate AI response with circuit breaker protection
      const aiResponse = await this.circuitBreaker.execute(async () => {
        return this.aiService.generateResponse({
          dealershipId: updatedContext.dealershipId,
          conversationId: updatedContext.conversationId,
          prompt: this.promptManager.renderPrompt(prompt, promptContext),
          context: {
            history: updatedContext.history,
            metadata: updatedContext.metadata,
          },
        });
      });

      // Parse AI response
      const parsedResponse = this.parseAIResponse(aiResponse);

      // Store the assistant message
      const messageId = await this.storeMessage(updatedContext.conversationId, {
        role: "assistant",
        content: parsedResponse.content,
        turnNumber,
        metadata: {
          model: updatedContext.aiModel,
          promptTemplate: prompt.name,
          processingTime: Date.now() - startTime,
          confidence: parsedResponse.confidence,
          intent: parsedResponse.intent,
          sentiment: parsedResponse.sentiment,
          tokensUsed: parsedResponse.tokensUsed,
          cost: parsedResponse.cost,
        },
      });

      // Determine next action
      const nextAction = this.determineNextAction(
        updatedContext,
        parsedResponse,
        turnNumber,
      );

      // Update conversation state
      await this.updateConversationState(updatedContext.conversationId, {
        currentTurn: turnNumber,
        state:
          nextAction === "escalate"
            ? "escalated"
            : nextAction === "complete"
              ? "completed"
              : "active",
        lastActivity: new Date(),
        ...(nextAction === "escalate" && {
          escalatedAt: new Date(),
          escalationReason: parsedResponse.escalationReason,
        }),
        ...(nextAction === "complete" && { completedAt: new Date() }),
      });

      // Queue next turn if needed
      if (nextAction === "continue" && turnNumber < updatedContext.maxTurns) {
        await this.conversationQueue.add(
          "process-turn",
          {
            context: updatedContext,
            turnNumber: turnNumber + 1,
          },
          {
            delay: this.calculateTurnDelay(updatedContext, parsedResponse),
            priority: updatedContext.priority,
          },
        );
      }

      // Record metrics
      this.metricsCollector.recordConversationMetrics({
        conversationId: updatedContext.conversationId,
        dealershipId: updatedContext.dealershipId,
        turnNumber,
        nextAction,
        processingTime: Date.now() - startTime,
        aiModel: updatedContext.aiModel,
        tokensUsed: parsedResponse.tokensUsed,
        cost: parsedResponse.cost,
      });

      // Emit events
      if (nextAction === "complete") {
        this.emit("conversation:completed", {
          conversationId: updatedContext.conversationId,
          totalTurns: turnNumber,
          outcome: "completed",
        });
      } else if (nextAction === "escalate") {
        this.processingStats.escalatedConversations++;
        this.emit("conversation:escalated", {
          conversationId: updatedContext.conversationId,
          reason: parsedResponse.escalationReason,
          turnNumber,
        });
      }

      const result: OrchestrationResult = {
        conversationId: updatedContext.conversationId,
        turnNumber,
        message: parsedResponse.content,
        nextAction,
        metadata: {
          responseTime: Date.now() - startTime,
          aiConfidence: parsedResponse.confidence,
          intentDetected: parsedResponse.intent,
          sentiment: parsedResponse.sentiment,
          cost: parsedResponse.cost,
          tokensUsed: parsedResponse.tokensUsed,
        },
      };

      logger.info("Conversation turn completed", {
        conversationId: updatedContext.conversationId,
        turnNumber,
        nextAction,
        processingTime: result.metadata.responseTime,
      });

      return result;
    } catch (error) {
      // Record error in database
      await this.recordTurnError(context.conversationId, turnNumber, error);

      // Update conversation state to failed if max retries exceeded
      if (data.attemptsMade >= 3) {
        await this.updateConversationState(context.conversationId, {
          state: "failed",
          lastActivity: new Date(),
        });
      }

      logger.error("Conversation turn failed", {
        conversationId: context.conversationId,
        turnNumber,
        error: error instanceof Error ? error.message : String(error),
        attemptsMade: data.attemptsMade,
      });

      throw error;
    }
  }

  // Helper methods for configuration and business logic

  private getMaxTurns(lead: any): number {
    // Check for adaptive conversations feature flag
    if (process.env.ADAPTIVE_CONVERSATIONS_ENABLED === "true") {
      return lead.metadata?.maxTurns || 5;
    }

    // Default to 2-turn conversations for backward compatibility
    return 2;
  }

  private selectAIModel(lead: any): string {
    // Model selection based on dealership tier, lead value, etc.
    if (lead.dealership?.premium_tier) {
      return "gpt-4";
    }
    if (lead.metadata?.high_value || lead.vehicle?.price > 50000) {
      return "gpt-4";
    }
    return "gpt-3.5-turbo";
  }

  private selectTemperature(lead: any): number {
    // Adjust creativity based on context
    if (lead.source === "website" && lead.vehicle?.specific) {
      return 0.3; // More focused for specific inquiries
    }
    if (lead.metadata?.creative_mode) {
      return 0.8; // More creative for exploratory conversations
    }
    return 0.7; // Default balanced temperature
  }

  private calculatePriority(lead: any): number {
    let priority = 0;

    // Time-sensitive indicators
    if (
      lead.comments?.includes("today") ||
      lead.comments?.includes("immediately")
    ) {
      priority += 10;
    }

    // High-value indicators
    if (lead.vehicle?.price > 50000) {
      priority += 5;
    }

    // Premium dealership
    if (lead.dealership?.premium_tier) {
      priority += 5;
    }

    // Engagement indicators
    if (lead.metadata?.sessionDuration > 300) {
      priority += 3;
    }

    return priority;
  }

  private calculateInitialDelay(context: ConversationContext): number {
    // Immediate processing for high priority
    if (context.priority > 10) {
      return 0;
    }

    // Small delay for natural conversation flow
    return 5000 + Math.random() * 10000; // 5-15 seconds
  }

  private calculateTurnDelay(
    context: ConversationContext,
    response: any,
  ): number {
    // Base delay to simulate human-like response timing
    const baseDelay = 30000; // 30 seconds
    const variance = Math.random() * 20000; // 0-20 seconds variance

    // Faster for high-intent conversations
    if (
      response.intent === "schedule_appointment" ||
      response.intent === "purchase_intent"
    ) {
      return baseDelay / 2 + variance / 2;
    }

    // Longer delay for low engagement
    if (response.sentiment < 0.3) {
      return baseDelay + variance + 30000; // Additional 30 seconds
    }

    return baseDelay + variance;
  }

  private buildPromptContext(context: ConversationContext): any {
    return {
      customerName: context.metadata.customerInfo.name || "there",
      vehicleInterest: context.metadata.vehicleInterest || "vehicle options",
      leadSource: context.metadata.source,
      previousMessages: context.history.length,
      lastCustomerMessage:
        context.history.length > 0
          ? context.history[context.history.length - 1].content
          : "",
      dealershipId: context.dealershipId,
      turnNumber: context.currentTurn + 1,
      sessionData: context.metadata.sessionData || {},
    };
  }

  private parseAIResponse(response: any): any {
    // Handle both string and structured responses
    if (typeof response === "string") {
      return {
        content: response,
        confidence: 0.8,
        intent: "general_response",
        sentiment: 0.7,
        escalationReason: null,
        tokensUsed: response.length / 4, // Rough estimate
        cost: 0.0001, // Placeholder cost calculation
      };
    }

    return {
      content: response.content || response.answer || "",
      confidence: response.confidence || 0.8,
      intent: response.intent || response.intent_detected,
      sentiment: response.sentiment || response.sentiment_score,
      escalationReason: response.escalate
        ? response.escalation_reason || "ai_limitation"
        : null,
      tokensUsed: response.tokens_used || 0,
      cost: response.cost || 0,
    };
  }

  private determineNextAction(
    context: ConversationContext,
    response: any,
    turnNumber: number,
  ): "continue" | "complete" | "escalate" | "pause" {
    // Check for explicit escalation
    if (response.escalationReason) {
      return "escalate";
    }

    // Check turn limits
    if (turnNumber >= context.maxTurns) {
      return "complete";
    }

    // Adaptive conversation logic
    if (process.env.ADAPTIVE_CONVERSATIONS_ENABLED === "true") {
      // High confidence appointment booking
      if (
        response.intent === "schedule_appointment" &&
        response.confidence > 0.9
      ) {
        return "complete";
      }

      // Low engagement after multiple turns
      if (response.sentiment < 0.3 && turnNumber >= 3) {
        return "escalate";
      }

      // Customer explicitly asks for human
      if (response.intent === "human_request") {
        return "escalate";
      }
    }

    // Continue for basic mode
    return "continue";
  }

  // Database operations

  private async storeConversation(context: ConversationContext): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO conversations_v2 (
          id, lead_id, dealership_id, current_turn, max_turns, state,
          ai_model, temperature, metadata, priority, created_at, updated_at
        ) VALUES (
          ${context.conversationId}, ${context.leadId}, ${context.dealershipId},
          ${context.currentTurn}, ${context.maxTurns}, ${context.state},
          ${context.aiModel}, ${context.temperature}, ${JSON.stringify(context.metadata)},
          ${context.priority}, NOW(), NOW()
        )
      `);
    } catch (error) {
      logger.error("Failed to store conversation", {
        conversationId: context.conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async loadConversationState(
    conversationId: string,
  ): Promise<ConversationContext> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM conversations_v2 WHERE id = ${conversationId}
      `);

      if (!result.rows.length) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }

      const row = result.rows[0] as any;
      const messages = await this.loadConversationHistory(conversationId);

      return {
        leadId: row.lead_id,
        conversationId: row.id,
        dealershipId: row.dealership_id,
        currentTurn: row.current_turn,
        maxTurns: row.max_turns,
        metadata: row.metadata || {},
        history: messages,
        state: row.state,
        aiModel: row.ai_model,
        temperature: row.temperature,
        priority: row.priority,
      };
    } catch (error) {
      logger.error("Failed to load conversation state", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async loadConversationHistory(
    conversationId: string,
  ): Promise<ConversationMessage[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM conversation_messages_v2 
        WHERE conversation_id = ${conversationId}
        ORDER BY turn_number ASC, created_at ASC
      `);

      return result.rows.map((row: any) => ({
        id: row.id,
        role: row.role,
        content: row.content,
        turnNumber: row.turn_number,
        metadata: row.metadata || {},
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error("Failed to load conversation history", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private async storeMessage(
    conversationId: string,
    message: Partial<ConversationMessage>,
  ): Promise<string> {
    try {
      const messageId = uuidv4();

      await db.execute(sql`
        INSERT INTO conversation_messages_v2 (
          id, conversation_id, role, content, turn_number, metadata,
          processing_time_ms, confidence_score, intent_detected, sentiment_score,
          tokens_used, cost_usd, created_at, updated_at
        ) VALUES (
          ${messageId}, ${conversationId}, ${message.role}, ${message.content},
          ${message.turnNumber}, ${JSON.stringify(message.metadata)},
          ${message.metadata?.processingTime}, ${message.metadata?.confidence},
          ${message.metadata?.intent}, ${message.metadata?.sentiment},
          ${message.metadata?.tokensUsed}, ${message.metadata?.cost},
          NOW(), NOW()
        )
      `);

      return messageId;
    } catch (error) {
      logger.error("Failed to store message", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async updateConversationState(
    conversationId: string,
    updates: Partial<ConversationContext>,
  ): Promise<void> {
    try {
      const setClause = [];
      const values = [];

      if (updates.currentTurn !== undefined) {
        setClause.push("current_turn = ?");
        values.push(updates.currentTurn);
      }
      if (updates.state) {
        setClause.push("state = ?");
        values.push(updates.state);
      }
      if (updates.lastActivity) {
        setClause.push("last_activity = ?");
        values.push(updates.lastActivity);
      }
      if ((updates as any).completedAt) {
        setClause.push("completed_at = ?");
        values.push((updates as any).completedAt);
      }
      if ((updates as any).escalatedAt) {
        setClause.push("escalated_at = ?");
        values.push((updates as any).escalatedAt);
      }
      if ((updates as any).escalationReason) {
        setClause.push("escalation_reason = ?");
        values.push((updates as any).escalationReason);
      }

      setClause.push("updated_at = NOW()");

      await db.execute(
        sql.raw(`
        UPDATE conversations_v2 
        SET ${setClause.join(", ")}
        WHERE id = '${conversationId}'
      `),
      );
    } catch (error) {
      logger.error("Failed to update conversation state", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async recordTurnError(
    conversationId: string,
    turnNumber: number,
    error: any,
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO conversation_queue_jobs (
          conversation_id, turn_number, job_type, status, error_message, created_at
        ) VALUES (
          ${conversationId}, ${turnNumber}, 'process-turn', 'failed',
          ${error instanceof Error ? error.message : String(error)}, NOW()
        )
      `);
    } catch (dbError) {
      logger.error("Failed to record turn error", {
        conversationId,
        turnNumber,
        error: dbError instanceof Error ? dbError.message : String(dbError),
      });
    }
  }

  // Monitoring and health checks

  private updateAverageProcessingTime(processingTime: number): void {
    const totalTurns =
      this.processingStats.successfulTurns + this.processingStats.failedTurns;
    this.processingStats.averageProcessingTime =
      (this.processingStats.averageProcessingTime * (totalTurns - 1) +
        processingTime) /
      totalTurns;
  }

  private startHealthMonitoring(): void {
    // Clear any existing interval
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
    }

    // Report health metrics every 30 seconds
    this.healthMonitorInterval = setInterval(async () => {
      try {
        // Skip health monitoring if shutting down
        if (this.isShuttingDown) {
          return;
        }

        const health = await this.getHealthStatus();
        this.metricsCollector.recordHealthMetrics(health);

        if (health.status !== "healthy") {
          logger.warn("ConversationOrchestrator health degraded", { health });
          this.emit("health:degraded", health);
        }
      } catch (error) {
        if (!this.isShuttingDown) {
          logger.error("Health monitoring error", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, 30000);
  }

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const queueCounts = await this.conversationQueue.getJobCounts();
      const circuitBreakerStats = this.circuitBreaker.getStats();

      // Get conversation metrics from database
      const conversationMetrics = await this.getConversationMetrics();

      const status: HealthStatus = {
        status: this.determineOverallHealth(queueCounts, circuitBreakerStats),
        queue: {
          waiting: queueCounts.waiting,
          active: queueCounts.active,
          completed: queueCounts.completed,
          failed: queueCounts.failed,
        },
        circuitBreaker: {
          state: circuitBreakerStats.state,
          failures: circuitBreakerStats.failureCount,
        },
        metrics: {
          totalConversations: conversationMetrics.total,
          activeConversations: conversationMetrics.active,
          averageTurnsPerConversation: conversationMetrics.averageTurns,
          averageResponseTime: this.processingStats.averageProcessingTime,
        },
        redis: {
          connected: !!this.redis,
          streamsActive: !!this.redis,
        },
      };

      return status;
    } catch (error) {
      logger.error("Failed to get health status", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        status: "unhealthy",
        queue: { waiting: 0, active: 0, completed: 0, failed: 0 },
        circuitBreaker: { state: "unknown", failures: 0 },
        metrics: {
          totalConversations: 0,
          activeConversations: 0,
          averageTurnsPerConversation: 0,
          averageResponseTime: 0,
        },
        redis: { connected: false, streamsActive: false },
      };
    }
  }

  private determineOverallHealth(
    queueCounts: any,
    circuitBreakerStats: any,
  ): "healthy" | "degraded" | "unhealthy" {
    // Unhealthy conditions
    if (circuitBreakerStats.state === "open") {
      return "unhealthy";
    }

    if (queueCounts.failed > queueCounts.completed * 0.1) {
      // More than 10% failure rate
      return "unhealthy";
    }

    // Degraded conditions
    if (queueCounts.waiting > 100) {
      // High queue backlog
      return "degraded";
    }

    if (circuitBreakerStats.state === "half-open") {
      return "degraded";
    }

    return "healthy";
  }

  private async getConversationMetrics(): Promise<{
    total: number;
    active: number;
    averageTurns: number;
  }> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN state = 'active' THEN 1 END) as active,
          AVG(current_turn) as average_turns
        FROM conversations_v2
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      const row = result.rows[0] as any;
      return {
        total: parseInt(row.total) || 0,
        active: parseInt(row.active) || 0,
        averageTurns: parseFloat(row.average_turns) || 0,
      };
    } catch (error) {
      logger.error("Failed to get conversation metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { total: 0, active: 0, averageTurns: 0 };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      logger.debug("Shutdown already in progress");
      return;
    }

    this.isShuttingDown = true;
    logger.info("Shutting down ConversationOrchestrator...");

    try {
      // Clear health monitoring interval
      if (this.healthMonitorInterval) {
        clearInterval(this.healthMonitorInterval);
        this.healthMonitorInterval = undefined;
      }

      // Close queue gracefully with timeout
      if (this.conversationQueue) {
        const closePromise = this.conversationQueue.close();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Queue close timeout")), 5000),
        );

        try {
          await Promise.race([closePromise, timeoutPromise]);
        } catch (error) {
          logger.warn("Queue close timeout, forcing shutdown");
        }
      }

      // Emit shutdown event before removing listeners
      this.emit("shutdown");

      // Close Redis connection if we own it
      if (this.redis) {
        // Note: Redis connection is managed by lib/redis.ts
        // Just clear our reference
        this.redis = null;
      }

      // Remove all event listeners to prevent memory leaks (after emitting shutdown)
      this.removeAllListeners();

      logger.info("ConversationOrchestrator shutdown complete");
    } catch (error) {
      logger.error("Error during shutdown", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// Export singleton instance
export const conversationOrchestrator = new ConversationOrchestrator();
export default conversationOrchestrator;
