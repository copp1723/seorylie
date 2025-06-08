import { logger } from "../../utils/logger";
import db from "../../db/index";
import { sql } from "drizzle-orm";

export interface SentimentAnalysis {
  score: number; // -1 (negative) to 1 (positive)
  confidence: number; // 0 to 1
  emotion: "angry" | "frustrated" | "neutral" | "happy" | "excited";
  urgency: "low" | "medium" | "high" | "urgent";
}

export interface CustomerContext {
  previousMessages: string[];
  totalInteractions: number;
  averageResponseTime: number;
  lastInteractionDate: Date;
  preferredAgent?: string;
  satisfactionScore?: number;
  escalationHistory: number;
}

export interface RoutingDecision {
  recommendedAgent: string;
  confidence: number;
  reasoning: string;
  priority: "low" | "medium" | "high" | "urgent";
  shouldEscalate: boolean;
  escalationReason?: string;
}

/**
 * Advanced routing logic that considers sentiment, customer history, and context
 */
export class AdvancedRoutingEngine {
  /**
   * Analyze message sentiment and emotional state
   */
  async analyzeSentiment(message: string): Promise<SentimentAnalysis> {
    try {
      // Simple sentiment analysis using keyword-based approach
      // In production, this could be replaced with OpenAI API or dedicated sentiment service

      const lowerMessage = message.toLowerCase();

      // Negative indicators
      const negativeKeywords = [
        "angry",
        "frustrated",
        "terrible",
        "awful",
        "hate",
        "worst",
        "horrible",
        "stupid",
        "ridiculous",
        "unacceptable",
        "disappointed",
        "furious",
        "mad",
        "cancel",
        "refund",
        "complaint",
        "lawsuit",
        "lawyer",
        "bbb",
        "review",
      ];

      // Positive indicators
      const positiveKeywords = [
        "great",
        "excellent",
        "amazing",
        "wonderful",
        "fantastic",
        "perfect",
        "love",
        "best",
        "awesome",
        "happy",
        "pleased",
        "satisfied",
        "thank",
      ];

      // Urgency indicators
      const urgentKeywords = [
        "urgent",
        "emergency",
        "asap",
        "immediately",
        "now",
        "today",
        "deadline",
        "critical",
        "important",
        "rush",
      ];

      let score = 0;
      let urgencyScore = 0;

      // Score calculation
      for (const keyword of negativeKeywords) {
        if (lowerMessage.includes(keyword)) {
          score -= 0.3;
        }
      }

      for (const keyword of positiveKeywords) {
        if (lowerMessage.includes(keyword)) {
          score += 0.3;
        }
      }

      for (const keyword of urgentKeywords) {
        if (lowerMessage.includes(keyword)) {
          urgencyScore += 0.5;
        }
      }

      // Punctuation analysis
      if (message.includes("!!!") || message.includes("???")) {
        score -= 0.2;
        urgencyScore += 0.3;
      }

      if (message.includes("!!")) {
        urgencyScore += 0.2;
      }

      // Caps analysis
      const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
      if (capsRatio > 0.3) {
        score -= 0.2;
        urgencyScore += 0.2;
      }

      // Normalize scores
      score = Math.max(-1, Math.min(1, score));
      urgencyScore = Math.max(0, Math.min(1, urgencyScore));

      // Determine emotion
      let emotion: SentimentAnalysis["emotion"] = "neutral";
      if (score < -0.5) emotion = "angry";
      else if (score < -0.2) emotion = "frustrated";
      else if (score > 0.5) emotion = "excited";
      else if (score > 0.2) emotion = "happy";

      // Determine urgency
      let urgency: SentimentAnalysis["urgency"] = "low";
      if (urgencyScore > 0.7) urgency = "urgent";
      else if (urgencyScore > 0.5) urgency = "high";
      else if (urgencyScore > 0.3) urgency = "medium";

      const confidence = Math.min(0.9, 0.5 + Math.abs(score) * 0.5);

      logger.info("Sentiment analysis completed", {
        score,
        confidence,
        emotion,
        urgency,
        message: message.substring(0, 50),
      });

      return {
        score,
        confidence,
        emotion,
        urgency,
      };
    } catch (error) {
      logger.error("Sentiment analysis failed", { error, message });
      return {
        score: 0,
        confidence: 0.1,
        emotion: "neutral",
        urgency: "low",
      };
    }
  }

  /**
   * Get customer context from conversation history
   */
  async getCustomerContext(
    dealershipId: number,
    customerIdentifier: string,
  ): Promise<CustomerContext> {
    try {
      // Query conversation and message history
      // This is a simplified version - in production would join with conversations/messages tables

      const mockContext: CustomerContext = {
        previousMessages: [],
        totalInteractions: 1,
        averageResponseTime: 300000, // 5 minutes
        lastInteractionDate: new Date(),
        escalationHistory: 0,
      };

      logger.info("Customer context retrieved", {
        dealershipId,
        customerIdentifier,
        context: mockContext,
      });

      return mockContext;
    } catch (error) {
      logger.error("Failed to get customer context", {
        error,
        dealershipId,
        customerIdentifier,
      });
      return {
        previousMessages: [],
        totalInteractions: 0,
        averageResponseTime: 300000,
        lastInteractionDate: new Date(),
        escalationHistory: 0,
      };
    }
  }

  /**
   * Make intelligent routing decision based on all factors
   */
  async makeRoutingDecision(
    message: string,
    sentiment: SentimentAnalysis,
    customerContext: CustomerContext,
    conversationContext?: Record<string, any>,
  ): Promise<RoutingDecision> {
    try {
      let recommendedAgent = "general-agent";
      let confidence = 0.5;
      let priority: RoutingDecision["priority"] = "medium";
      let shouldEscalate = false;
      let escalationReason: string | undefined;

      const reasons: string[] = [];

      // Sentiment-based routing
      if (sentiment.emotion === "angry" || sentiment.emotion === "frustrated") {
        if (sentiment.score < -0.5) {
          shouldEscalate = true;
          escalationReason = "Negative customer sentiment detected";
          priority = "urgent";
          reasons.push("Escalating due to negative sentiment");
        } else {
          // Route to most experienced agent or supervisor
          recommendedAgent = "general-agent"; // Most diplomatic
          confidence += 0.2;
          priority = "high";
          reasons.push("Routing to general agent for diplomatic handling");
        }
      }

      // Urgency-based routing
      if (sentiment.urgency === "urgent") {
        priority = "urgent";
        confidence += 0.1;
        reasons.push("High urgency detected");
      }

      // Customer history-based routing
      if (customerContext.escalationHistory > 2) {
        shouldEscalate = true;
        escalationReason = "Customer has history of escalations";
        priority = "high";
        reasons.push("Customer escalation history indicates human needed");
      }

      if (customerContext.preferredAgent) {
        recommendedAgent = customerContext.preferredAgent;
        confidence += 0.3;
        reasons.push(
          `Customer previously worked well with ${customerContext.preferredAgent}`,
        );
      }

      // Content-based routing (existing logic)
      const lowerMessage = message.toLowerCase();

      // Inventory-related
      if (
        this.matchesPattern(lowerMessage, [
          "looking for",
          "interested in",
          "want to buy",
          "shopping for",
          "honda",
          "toyota",
          "ford",
          "car",
          "vehicle",
          "suv",
          "truck",
        ])
      ) {
        if (!shouldEscalate) {
          recommendedAgent = "inventory-agent";
          confidence += 0.4;
          reasons.push("Vehicle inventory inquiry detected");
        }
      }

      // Finance-related
      if (
        this.matchesPattern(lowerMessage, [
          "financing",
          "loan",
          "lease",
          "payment",
          "credit",
          "down payment",
          "monthly",
          "rate",
          "apr",
          "term",
        ])
      ) {
        if (!shouldEscalate) {
          recommendedAgent = "finance-agent";
          confidence += 0.4;
          reasons.push("Financing inquiry detected");
        }
      }

      // Service-related
      if (
        this.matchesPattern(lowerMessage, [
          "service",
          "maintenance",
          "repair",
          "appointment",
          "oil change",
          "brake",
          "tire",
          "warranty",
          "recall",
        ])
      ) {
        if (!shouldEscalate) {
          recommendedAgent = "service-agent";
          confidence += 0.4;
          reasons.push("Service inquiry detected");
        }
      }

      // Trade-in related
      if (
        this.matchesPattern(lowerMessage, [
          "trade",
          "trade-in",
          "value",
          "worth",
          "appraisal",
          "estimate",
        ])
      ) {
        if (!shouldEscalate) {
          recommendedAgent = "trade-agent";
          confidence += 0.4;
          reasons.push("Trade-in inquiry detected");
        }
      }

      // Sales-related
      if (
        this.matchesPattern(lowerMessage, [
          "test drive",
          "schedule",
          "visit",
          "showroom",
          "buy",
          "purchase",
        ])
      ) {
        if (!shouldEscalate) {
          recommendedAgent = "sales-agent";
          confidence += 0.4;
          reasons.push("Sales/test drive inquiry detected");
        }
      }

      // Adjust confidence based on sentiment confidence
      confidence = Math.min(0.95, confidence * sentiment.confidence);

      const reasoning = reasons.join("; ");

      logger.info("Routing decision made", {
        recommendedAgent,
        confidence,
        priority,
        shouldEscalate,
        reasoning,
        sentiment: sentiment.emotion,
        urgency: sentiment.urgency,
      });

      return {
        recommendedAgent,
        confidence,
        reasoning,
        priority,
        shouldEscalate,
        escalationReason,
      };
    } catch (error) {
      logger.error("Routing decision failed", { error });
      return {
        recommendedAgent: "general-agent",
        confidence: 0.1,
        reasoning: "Fallback routing due to analysis error",
        priority: "medium",
        shouldEscalate: false,
      };
    }
  }

  /**
   * Helper method to check if message matches any patterns
   */
  private matchesPattern(message: string, patterns: string[]): boolean {
    return patterns.some((pattern) => message.includes(pattern));
  }

  /**
   * Complete routing analysis combining all factors
   */
  async analyzeAndRoute(
    message: string,
    dealershipId: number,
    customerIdentifier: string,
    conversationContext?: Record<string, any>,
  ): Promise<{
    sentiment: SentimentAnalysis;
    customerContext: CustomerContext;
    routingDecision: RoutingDecision;
  }> {
    try {
      logger.info("Starting comprehensive routing analysis", {
        message: message.substring(0, 100),
        dealershipId,
        customerIdentifier,
      });

      // Run analysis in parallel where possible
      const [sentiment, customerContext] = await Promise.all([
        this.analyzeSentiment(message),
        this.getCustomerContext(dealershipId, customerIdentifier),
      ]);

      const routingDecision = await this.makeRoutingDecision(
        message,
        sentiment,
        customerContext,
        conversationContext,
      );

      return {
        sentiment,
        customerContext,
        routingDecision,
      };
    } catch (error) {
      logger.error("Comprehensive routing analysis failed", { error });

      // Return safe defaults
      return {
        sentiment: {
          score: 0,
          confidence: 0.1,
          emotion: "neutral",
          urgency: "low",
        },
        customerContext: {
          previousMessages: [],
          totalInteractions: 0,
          averageResponseTime: 300000,
          lastInteractionDate: new Date(),
          escalationHistory: 0,
        },
        routingDecision: {
          recommendedAgent: "general-agent",
          confidence: 0.1,
          reasoning: "Fallback routing due to analysis error",
          priority: "medium",
          shouldEscalate: false,
        },
      };
    }
  }
}

// Export singleton instance
export const advancedRoutingEngine = new AdvancedRoutingEngine();
