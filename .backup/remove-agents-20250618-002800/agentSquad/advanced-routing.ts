import logger from "../../utils/logger";
import { db } from "../../db";
import { sql } from "drizzle-orm";

export interface SentimentAnalysis {
  score: number; // -1 (negative) to 1 (positive)
  confidence: number; // 0 to 1
  emotion:
    | "angry"
    | "frustrated"
    | "neutral"
    | "happy"
    | "excited"
    | "anxious"
    | "confused"
    | "impressed"
    | "disappointed"
    | "curious";
  urgency: "low" | "medium" | "high" | "urgent";
  intensity: "mild" | "moderate" | "strong" | "intense";
  triggers: string[]; // What triggered this sentiment
  emotionalJourney: string; // Description of emotional progression
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
   * Enhanced sentiment analysis with advanced emotion detection
   */
  async analyzeSentiment(
    message: string,
    conversationHistory?: string[],
  ): Promise<SentimentAnalysis> {
    try {
      logger.debug("Enhanced sentiment analysis starting", {
        messageLength: message.length,
        hasHistory: !!conversationHistory?.length,
      });

      const lowerMessage = message.toLowerCase();
      const triggers: string[] = [];
      let emotionalJourney = "";

      // Enhanced emotion keyword mapping
      const emotionKeywords = {
        angry: [
          "angry",
          "furious",
          "enraged",
          "livid",
          "outraged",
          "pissed",
          "mad as hell",
        ],
        frustrated: [
          "frustrated",
          "annoyed",
          "irritated",
          "aggravated",
          "fed up",
          "sick of",
        ],
        disappointed: [
          "disappointed",
          "let down",
          "unsatisfied",
          "expected better",
          "not what I wanted",
        ],
        anxious: [
          "worried",
          "concerned",
          "nervous",
          "anxious",
          "stressed",
          "unsure",
        ],
        confused: [
          "confused",
          "don't understand",
          "unclear",
          "lost",
          "what does",
          "how do",
        ],
        curious: [
          "curious",
          "wondering",
          "interested",
          "tell me more",
          "learn about",
        ],
        impressed: ["impressed", "wow", "amazing", "incredible", "outstanding"],
        happy: [
          "happy",
          "pleased",
          "satisfied",
          "glad",
          "delighted",
          "thrilled",
        ],
        excited: [
          "excited",
          "can't wait",
          "awesome",
          "fantastic",
          "love it",
          "perfect",
        ],
      };

      // Intensity indicators
      const intensityIndicators = {
        mild: ["a bit", "somewhat", "kind of", "slightly", "a little"],
        moderate: ["quite", "fairly", "pretty", "rather"],
        strong: ["very", "really", "extremely", "highly", "deeply"],
        intense: [
          "absolutely",
          "completely",
          "totally",
          "incredibly",
          "unbelievably",
        ],
      };

      // Advanced negative indicators with intensity
      const negativePatterns = {
        high: [
          "hate",
          "worst",
          "terrible",
          "awful",
          "horrible",
          "disgusting",
          "unacceptable",
        ],
        medium: [
          "bad",
          "poor",
          "disappointing",
          "unsatisfactory",
          "problematic",
        ],
        low: ["not great", "could be better", "not ideal", "lacking"],
      };

      // Advanced positive indicators with intensity
      const positivePatterns = {
        high: [
          "love",
          "amazing",
          "excellent",
          "outstanding",
          "phenomenal",
          "perfect",
        ],
        medium: ["good", "nice", "decent", "satisfactory", "solid"],
        low: ["okay", "fine", "acceptable", "not bad"],
      };

      // Urgency indicators with context
      const urgencyPatterns = {
        urgent: [
          "emergency",
          "urgent",
          "asap",
          "immediately",
          "right now",
          "critical",
        ],
        high: ["soon", "today", "this week", "important", "time sensitive"],
        medium: ["when possible", "sometime", "eventually", "at some point"],
        low: ["no rush", "whenever", "no hurry", "take your time"],
      };

      let score = 0;
      let urgencyScore = 0;
      let intensityScore = 0;

      // Enhanced scoring with pattern matching
      Object.entries(negativePatterns).forEach(([intensity, patterns]) => {
        patterns.forEach((pattern) => {
          if (lowerMessage.includes(pattern)) {
            const multiplier =
              intensity === "high" ? 0.4 : intensity === "medium" ? 0.25 : 0.15;
            score -= multiplier;
            triggers.push(`negative-${intensity}: ${pattern}`);
          }
        });
      });

      Object.entries(positivePatterns).forEach(([intensity, patterns]) => {
        patterns.forEach((pattern) => {
          if (lowerMessage.includes(pattern)) {
            const multiplier =
              intensity === "high" ? 0.4 : intensity === "medium" ? 0.25 : 0.15;
            score += multiplier;
            triggers.push(`positive-${intensity}: ${pattern}`);
          }
        });
      });

      // Urgency analysis
      Object.entries(urgencyPatterns).forEach(([level, patterns]) => {
        patterns.forEach((pattern) => {
          if (lowerMessage.includes(pattern)) {
            const multiplier =
              level === "urgent"
                ? 0.8
                : level === "high"
                  ? 0.6
                  : level === "medium"
                    ? 0.4
                    : 0.2;
            urgencyScore = Math.max(urgencyScore, multiplier);
            triggers.push(`urgency-${level}: ${pattern}`);
          }
        });
      });

      // Intensity analysis
      Object.entries(intensityIndicators).forEach(([level, indicators]) => {
        indicators.forEach((indicator) => {
          if (lowerMessage.includes(indicator)) {
            const multiplier =
              level === "intense"
                ? 0.8
                : level === "strong"
                  ? 0.6
                  : level === "moderate"
                    ? 0.4
                    : 0.2;
            intensityScore = Math.max(intensityScore, multiplier);
            triggers.push(`intensity-${level}: ${indicator}`);
          }
        });
      });

      // Enhanced punctuation and capitalization analysis
      const exclamationCount = (message.match(/!/g) || []).length;
      const questionCount = (message.match(/\?/g) || []).length;
      const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;

      if (exclamationCount > 2) {
        score -= 0.2;
        urgencyScore += 0.3;
        triggers.push("multiple-exclamations");
      }

      if (questionCount > 2) {
        // Multiple questions might indicate confusion or frustration
        if (score < 0) score -= 0.1;
        triggers.push("multiple-questions");
      }

      if (capsRatio > 0.5) {
        score -= 0.3;
        urgencyScore += 0.4;
        intensityScore += 0.3;
        triggers.push("excessive-caps");
      }

      // Conversation history analysis for emotional journey
      if (conversationHistory && conversationHistory.length > 0) {
        const recentMessages = conversationHistory.slice(-3);
        emotionalJourney = this.analyzeEmotionalProgression(
          recentMessages,
          message,
        );

        // Adjust score based on emotional trend
        if (emotionalJourney.includes("escalating")) {
          score -= 0.2;
          urgencyScore += 0.2;
        } else if (emotionalJourney.includes("improving")) {
          score += 0.1;
        }
      }

      // Normalize scores
      score = Math.max(-1, Math.min(1, score));
      urgencyScore = Math.max(0, Math.min(1, urgencyScore));
      intensityScore = Math.max(0, Math.min(1, intensityScore));

      // Enhanced emotion determination
      const emotion = this.determineComplexEmotion(
        lowerMessage,
        score,
        emotionKeywords,
        triggers,
      );

      // Enhanced urgency determination
      const urgency = this.determineUrgencyLevel(urgencyScore);

      // Enhanced intensity determination
      const intensity = this.determineIntensityLevel(
        intensityScore,
        capsRatio,
        exclamationCount,
      );

      // Enhanced confidence calculation
      const confidence = this.calculateConfidence(
        score,
        triggers.length,
        conversationHistory?.length || 0,
      );

      logger.info("Enhanced sentiment analysis completed", {
        score,
        confidence,
        emotion,
        urgency,
        intensity,
        triggersCount: triggers.length,
        message: message.substring(0, 50),
      });

      return {
        score,
        confidence,
        emotion,
        urgency,
        intensity,
        triggers,
        emotionalJourney: emotionalJourney || "Initial interaction",
      };
    } catch (error) {
      logger.error("Enhanced sentiment analysis failed", { error, message });
      return {
        score: 0,
        confidence: 0.1,
        emotion: "neutral",
        urgency: "low",
        intensity: "mild",
        triggers: [],
        emotionalJourney: "Analysis failed",
      };
    }
  }

  /**
   * Analyze emotional progression across conversation history
   */
  private analyzeEmotionalProgression(
    recentMessages: string[],
    currentMessage: string,
  ): string {
    try {
      if (recentMessages.length === 0) return "Initial interaction";

      const emotions = [];

      // Analyze each recent message for basic sentiment
      for (const msg of recentMessages) {
        const sentiment = this.getBasicSentiment(msg);
        emotions.push(sentiment);
      }

      // Add current message sentiment
      const currentSentiment = this.getBasicSentiment(currentMessage);
      emotions.push(currentSentiment);

      // Determine trend
      const positiveCount = emotions.filter((e) => e > 0.2).length;
      const negativeCount = emotions.filter((e) => e < -0.2).length;
      const neutral = emotions.length - positiveCount - negativeCount;

      if (emotions.length >= 3) {
        const trend = emotions[emotions.length - 1] - emotions[0];
        if (trend > 0.3)
          return "Emotional state improving throughout conversation";
        if (trend < -0.3)
          return "Emotional state escalating negatively, requires attention";
      }

      if (negativeCount > positiveCount) {
        return "Consistently negative sentiment pattern detected";
      } else if (positiveCount > negativeCount) {
        return "Generally positive interaction pattern";
      } else {
        return "Mixed emotional signals, customer may be undecided";
      }
    } catch (error) {
      logger.error("Failed to analyze emotional progression", { error });
      return "Unable to determine emotional trend";
    }
  }

  /**
   * Get basic sentiment score for a single message
   */
  private getBasicSentiment(message: string): number {
    const lowerMessage = message.toLowerCase();
    let score = 0;

    const positives = [
      "good",
      "great",
      "thanks",
      "excellent",
      "perfect",
      "love",
      "happy",
    ];
    const negatives = [
      "bad",
      "terrible",
      "hate",
      "worst",
      "awful",
      "frustrated",
      "angry",
    ];

    positives.forEach((word) => {
      if (lowerMessage.includes(word)) score += 0.3;
    });

    negatives.forEach((word) => {
      if (lowerMessage.includes(word)) score -= 0.3;
    });

    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Determine complex emotion from advanced analysis
   */
  private determineComplexEmotion(
    message: string,
    score: number,
    emotionKeywords: Record<string, string[]>,
    triggers: string[],
  ): SentimentAnalysis["emotion"] {
    // Check for specific emotion keywords first
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      for (const keyword of keywords) {
        if (message.includes(keyword)) {
          return emotion as SentimentAnalysis["emotion"];
        }
      }
    }

    // Check triggers for emotion hints
    const triggerText = triggers.join(" ");
    if (triggerText.includes("multiple-questions") && score <= 0)
      return "confused";
    if (triggerText.includes("excessive-caps") && score < -0.3) return "angry";
    if (triggerText.includes("urgency") && score < 0) return "anxious";

    // Fallback to score-based determination with enhanced ranges
    if (score < -0.6) return "angry";
    if (score < -0.3) return "frustrated";
    if (score < -0.1) return "disappointed";
    if (score > 0.6) return "excited";
    if (score > 0.3) return "happy";
    if (score > 0.1) return "curious";

    return "neutral";
  }

  /**
   * Determine urgency level from score
   */
  private determineUrgencyLevel(
    urgencyScore: number,
  ): SentimentAnalysis["urgency"] {
    if (urgencyScore > 0.7) return "urgent";
    if (urgencyScore > 0.5) return "high";
    if (urgencyScore > 0.3) return "medium";
    return "low";
  }

  /**
   * Determine intensity level from multiple factors
   */
  private determineIntensityLevel(
    intensityScore: number,
    capsRatio: number,
    exclamationCount: number,
  ): SentimentAnalysis["intensity"] {
    let finalScore = intensityScore;

    // Adjust based on caps and punctuation
    if (capsRatio > 0.7) finalScore += 0.3;
    if (exclamationCount > 3) finalScore += 0.2;

    if (finalScore > 0.7) return "intense";
    if (finalScore > 0.5) return "strong";
    if (finalScore > 0.3) return "moderate";
    return "mild";
  }

  /**
   * Calculate confidence based on multiple factors
   */
  private calculateConfidence(
    score: number,
    triggerCount: number,
    historyLength: number,
  ): number {
    let confidence = 0.5;

    // Higher confidence with stronger sentiment scores
    confidence += Math.abs(score) * 0.3;

    // Higher confidence with more triggers detected
    confidence += Math.min(triggerCount * 0.05, 0.2);

    // Higher confidence with more conversation history
    confidence += Math.min(historyLength * 0.02, 0.15);

    return Math.min(0.95, confidence);
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
   * Enhanced intelligent routing with comprehensive customer history analysis
   */
  async makeRoutingDecision(
    message: string,
    sentiment: SentimentAnalysis,
    customerContext: CustomerContext,
    conversationContext?: Record<string, any>,
  ): Promise<RoutingDecision> {
    try {
      logger.debug("Enhanced routing decision analysis starting", {
        emotion: sentiment.emotion,
        intensity: sentiment.intensity,
        urgency: sentiment.urgency,
        customerInteractions: customerContext.totalInteractions,
        escalationHistory: customerContext.escalationHistory,
      });

      let recommendedAgent = "general-agent";
      let confidence = 0.5;
      let priority: RoutingDecision["priority"] = "medium";
      let shouldEscalate = false;
      let escalationReason: string | undefined;

      const reasons: string[] = [];
      const lowerMessage = message.toLowerCase();

      // PHASE 1: Customer History Analysis (Primary Routing Factor)
      const historyAnalysis = this.analyzeCustomerHistoryForRouting(
        customerContext,
        conversationContext,
      );

      if (historyAnalysis.shouldEscalate) {
        shouldEscalate = true;
        escalationReason = historyAnalysis.escalationReason;
        priority = "urgent";
        reasons.push(historyAnalysis.reasoning);
      } else if (historyAnalysis.recommendedAgent && !shouldEscalate) {
        recommendedAgent = historyAnalysis.recommendedAgent;
        confidence += historyAnalysis.confidenceBoost;
        reasons.push(historyAnalysis.reasoning);
      }

      // PHASE 2: Enhanced Sentiment-Based Routing
      const sentimentRouting = this.analyzeSentimentRouting(
        sentiment,
        customerContext,
      );

      if (sentimentRouting.shouldEscalate && !shouldEscalate) {
        shouldEscalate = true;
        escalationReason = sentimentRouting.escalationReason;
        priority = "urgent";
        reasons.push(sentimentRouting.reasoning);
      } else if (sentimentRouting.agentOverride && !shouldEscalate) {
        recommendedAgent = sentimentRouting.agentOverride;
        confidence += 0.2;
        reasons.push(sentimentRouting.reasoning);
      }

      // PHASE 3: Content-Based Routing with Customer Context
      if (!shouldEscalate) {
        const contentRouting = this.analyzeContentRouting(
          lowerMessage,
          customerContext,
          conversationContext,
        );

        if (contentRouting.recommendedAgent) {
          // Only override if no strong history preference or if confidence is very high
          if (
            !customerContext.preferredAgent ||
            contentRouting.confidence > 0.8
          ) {
            recommendedAgent = contentRouting.recommendedAgent;
            confidence += contentRouting.confidence;
            reasons.push(contentRouting.reasoning);
          } else {
            // Acknowledge content but keep preferred agent
            confidence += contentRouting.confidence * 0.5;
            reasons.push(
              `${contentRouting.reasoning} (maintained preferred agent)`,
            );
          }
        }
      }

      // PHASE 4: Specialized Agent Routing Based on Customer Journey
      if (!shouldEscalate && conversationContext) {
        const specializedRouting = this.analyzeSpecializedRouting(
          conversationContext,
          customerContext,
          sentiment,
          lowerMessage,
        );

        if (specializedRouting.agent && specializedRouting.confidence > 0.6) {
          recommendedAgent = specializedRouting.agent;
          confidence += specializedRouting.confidence * 0.3;
          reasons.push(specializedRouting.reasoning);
        }
      }

      // PHASE 5: Priority and Urgency Adjustment
      priority = this.determineFinalPriority(
        sentiment,
        customerContext,
        conversationContext,
      );

      // PHASE 6: Final Confidence Calibration
      confidence = this.calibrateFinalConfidence(
        confidence,
        sentiment,
        customerContext,
        conversationContext,
        shouldEscalate,
      );

      const reasoning = reasons.join("; ");

      logger.info("Enhanced routing decision completed", {
        recommendedAgent,
        confidence,
        priority,
        shouldEscalate,
        reasoning,
        sentiment: sentiment.emotion,
        intensity: sentiment.intensity,
        urgency: sentiment.urgency,
        customerType: conversationContext?.customerType,
        totalReasons: reasons.length,
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
      logger.error("Enhanced routing decision failed", { error });
      return {
        recommendedAgent: "general-agent",
        confidence: 0.1,
        reasoning: "Fallback routing due to enhanced analysis error",
        priority: "medium",
        shouldEscalate: false,
      };
    }
  }

  /**
   * Analyze customer history to determine optimal agent routing
   */
  private analyzeCustomerHistoryForRouting(
    customerContext: CustomerContext,
    conversationContext?: Record<string, any>,
  ): {
    shouldEscalate: boolean;
    escalationReason?: string;
    recommendedAgent?: string;
    confidenceBoost: number;
    reasoning: string;
  } {
    // Critical escalation conditions
    if (customerContext.escalationHistory > 3) {
      return {
        shouldEscalate: true,
        escalationReason:
          "Customer has extensive escalation history (>3 escalations)",
        confidenceBoost: 0,
        reasoning:
          "Customer history indicates immediate human intervention required",
      };
    }

    if (
      customerContext.escalationHistory > 1 &&
      customerContext.satisfactionScore &&
      customerContext.satisfactionScore < 3
    ) {
      return {
        shouldEscalate: true,
        escalationReason:
          "Customer has escalation history and low satisfaction",
        confidenceBoost: 0,
        reasoning:
          "Escalation history combined with low satisfaction requires human attention",
      };
    }

    // Preferred agent routing
    if (customerContext.preferredAgent) {
      let confidenceBoost = 0.4;

      // Increase confidence if customer has had multiple successful interactions
      if (
        customerContext.totalInteractions > 5 &&
        customerContext.satisfactionScore &&
        customerContext.satisfactionScore >= 4
      ) {
        confidenceBoost = 0.6;
      }

      return {
        shouldEscalate: false,
        recommendedAgent: customerContext.preferredAgent,
        confidenceBoost,
        reasoning: `Customer has established successful relationship with ${customerContext.preferredAgent} (${customerContext.totalInteractions} interactions)`,
      };
    }

    // High-value customer routing
    if (customerContext.totalInteractions > 10) {
      return {
        shouldEscalate: false,
        recommendedAgent: "general-agent", // Route to most experienced general agent
        confidenceBoost: 0.3,
        reasoning:
          "High-value customer with extensive interaction history deserves premium service",
      };
    }

    // First-time customer considerations
    if (customerContext.totalInteractions === 0) {
      return {
        shouldEscalate: false,
        recommendedAgent: "general-agent",
        confidenceBoost: 0.2,
        reasoning:
          "First-time customer routed to general agent for comprehensive introduction",
      };
    }

    return {
      shouldEscalate: false,
      confidenceBoost: 0,
      reasoning: "No specific customer history routing factors identified",
    };
  }

  /**
   * Analyze sentiment for routing decisions
   */
  private analyzeSentimentRouting(
    sentiment: SentimentAnalysis,
    customerContext: CustomerContext,
  ): {
    shouldEscalate: boolean;
    escalationReason?: string;
    agentOverride?: string;
    reasoning: string;
  } {
    // Critical sentiment escalation
    if (sentiment.emotion === "angry" && sentiment.intensity === "intense") {
      return {
        shouldEscalate: true,
        escalationReason: "Customer expressing intense anger",
        reasoning:
          "Intense anger detected - immediate human intervention required",
      };
    }

    if (
      sentiment.emotion === "frustrated" &&
      sentiment.intensity === "strong" &&
      customerContext.escalationHistory > 0
    ) {
      return {
        shouldEscalate: true,
        escalationReason: "Strong frustration with prior escalation history",
        reasoning:
          "Strong frustration combined with escalation history indicates escalation needed",
      };
    }

    // Emotion-based agent selection
    if (sentiment.emotion === "anxious" || sentiment.emotion === "confused") {
      return {
        shouldEscalate: false,
        agentOverride: "general-agent",
        reasoning:
          "Customer needs patient, educational approach - routing to general agent",
      };
    }

    if (
      sentiment.emotion === "disappointed" &&
      customerContext.totalInteractions > 0
    ) {
      return {
        shouldEscalate: false,
        agentOverride: "general-agent",
        reasoning:
          "Returning customer expressing disappointment - needs empathetic handling",
      };
    }

    if (sentiment.emotion === "excited" && sentiment.urgency === "high") {
      return {
        shouldEscalate: false,
        agentOverride: "sales-agent",
        reasoning:
          "Excited customer with high urgency - route to sales for immediate action",
      };
    }

    return {
      shouldEscalate: false,
      reasoning: "No sentiment-based routing override required",
    };
  }

  /**
   * Enhanced content-based routing with customer context
   */
  private analyzeContentRouting(
    message: string,
    customerContext: CustomerContext,
    conversationContext?: Record<string, any>,
  ): {
    recommendedAgent?: string;
    confidence: number;
    reasoning: string;
  } {
    let bestMatch = { agent: "", confidence: 0, reasoning: "" };

    // Enhanced pattern matching with confidence scoring
    const agentPatterns = {
      "inventory-agent": {
        patterns: [
          "looking for",
          "interested in",
          "want to buy",
          "shopping for",
          "need a car",
          "honda",
          "toyota",
          "ford",
          "car",
          "vehicle",
          "suv",
          "truck",
          "sedan",
          "available",
          "in stock",
          "colors",
          "features",
          "specs",
          "model",
        ],
        boost: customerContext.totalInteractions === 0 ? 0.1 : 0, // Boost for new customers
      },
      "finance-agent": {
        patterns: [
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
          "budget",
          "afford",
          "qualify",
        ],
        boost: conversationContext?.creditConcerns ? 0.2 : 0,
      },
      "service-agent": {
        patterns: [
          "service",
          "maintenance",
          "repair",
          "appointment",
          "oil change",
          "brake",
          "tire",
          "warranty",
          "recall",
          "problem",
          "noise",
          "issue",
        ],
        boost: customerContext.totalInteractions > 5 ? 0.1 : 0, // Existing customers more likely to need service
      },
      "trade-agent": {
        patterns: [
          "trade",
          "trade-in",
          "value",
          "worth",
          "appraisal",
          "estimate",
          "current car",
          "my car",
          "sell",
          "owe",
          "payoff",
        ],
        boost: conversationContext?.hasCurrentVehicle ? 0.15 : 0,
      },
      "sales-agent": {
        patterns: [
          "test drive",
          "schedule",
          "visit",
          "showroom",
          "buy",
          "purchase",
          "ready to",
          "decision",
          "today",
          "now",
          "deal",
        ],
        boost: conversationContext?.journeyStage === "decision" ? 0.2 : 0,
      },
      "credit-agent": {
        patterns: [
          "bad credit",
          "no credit",
          "bankruptcy",
          "first time buyer",
          "co-signer",
          "credit problems",
          "rebuilding credit",
          "poor credit",
        ],
        boost: 0,
      },
      "lease-agent": {
        patterns: [
          "lease end",
          "lease return",
          "mileage",
          "wear and tear",
          "lease payment",
          "residual",
          "buyout",
          "lease vs buy",
        ],
        boost: conversationContext?.currentlyLeasing ? 0.2 : 0,
      },
    };

    // Score each agent based on pattern matches
    Object.entries(agentPatterns).forEach(([agent, config]) => {
      let matches = 0;
      let totalPatterns = config.patterns.length;

      config.patterns.forEach((pattern) => {
        if (message.includes(pattern)) {
          matches++;
        }
      });

      if (matches > 0) {
        let confidence = (matches / totalPatterns) * 0.8 + config.boost;

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            agent,
            confidence,
            reasoning: `Content analysis: ${matches}/${totalPatterns} patterns matched for ${agent}`,
          };
        }
      }
    });

    return {
      recommendedAgent: bestMatch.agent || undefined,
      confidence: bestMatch.confidence,
      reasoning:
        bestMatch.reasoning || "No strong content-based routing match found",
    };
  }

  /**
   * Analyze specialized routing based on customer journey and context
   */
  private analyzeSpecializedRouting(
    conversationContext: Record<string, any>,
    customerContext: CustomerContext,
    sentiment: SentimentAnalysis,
    message: string,
  ): {
    agent?: string;
    confidence: number;
    reasoning: string;
  } {
    // Journey stage based routing
    if (conversationContext.journeyStage) {
      switch (conversationContext.journeyStage) {
        case "awareness":
          return {
            agent: "general-agent",
            confidence: 0.7,
            reasoning: "Customer in awareness stage needs educational approach",
          };
        case "consideration":
          return {
            agent: "inventory-agent",
            confidence: 0.8,
            reasoning:
              "Customer in consideration stage needs detailed vehicle information",
          };
        case "decision":
          return {
            agent: "sales-agent",
            confidence: 0.9,
            reasoning: "Customer in decision stage ready for sales assistance",
          };
        case "purchase":
          return {
            agent: "finance-agent",
            confidence: 0.8,
            reasoning: "Customer in purchase stage needs financing assistance",
          };
      }
    }

    // Customer type based routing
    if (conversationContext.customerType) {
      switch (conversationContext.customerType) {
        case "first-time-buyer":
          return {
            agent: "general-agent",
            confidence: 0.75,
            reasoning: "First-time buyer needs comprehensive guidance",
          };
        case "returning-customer":
          if (customerContext.preferredAgent) {
            return {
              agent: customerContext.preferredAgent,
              confidence: 0.8,
              reasoning: "Returning customer with preferred agent relationship",
            };
          }
          break;
        case "business-customer":
          return {
            agent: "sales-agent",
            confidence: 0.7,
            reasoning:
              "Business customer likely needs fleet or bulk purchase assistance",
          };
      }
    }

    // Urgency and sentiment combination
    if (sentiment.urgency === "urgent" && sentiment.emotion === "excited") {
      return {
        agent: "sales-agent",
        confidence: 0.85,
        reasoning: "Urgent excitement indicates ready-to-purchase customer",
      };
    }

    return {
      confidence: 0,
      reasoning: "No specialized routing factors identified",
    };
  }

  /**
   * Determine final priority based on all factors
   */
  private determineFinalPriority(
    sentiment: SentimentAnalysis,
    customerContext: CustomerContext,
    conversationContext?: Record<string, any>,
  ): RoutingDecision["priority"] {
    // Urgent conditions
    if (sentiment.urgency === "urgent" || sentiment.intensity === "intense") {
      return "urgent";
    }

    if (customerContext.escalationHistory > 2) {
      return "urgent";
    }

    // High priority conditions
    if (sentiment.urgency === "high" || sentiment.emotion === "frustrated") {
      return "high";
    }

    if (customerContext.totalInteractions > 10) {
      return "high"; // VIP treatment
    }

    if (conversationContext?.journeyStage === "decision") {
      return "high";
    }

    // Medium priority conditions
    if (sentiment.emotion === "confused" || sentiment.emotion === "anxious") {
      return "medium";
    }

    if (customerContext.totalInteractions === 0) {
      return "medium"; // New customers deserve attention
    }

    return "low";
  }

  /**
   * Calibrate final confidence score
   */
  private calibrateFinalConfidence(
    baseConfidence: number,
    sentiment: SentimentAnalysis,
    customerContext: CustomerContext,
    conversationContext?: Record<string, any>,
    shouldEscalate: boolean,
  ): number {
    let finalConfidence = Math.min(0.95, baseConfidence);

    // Boost confidence for escalations
    if (shouldEscalate) {
      finalConfidence = Math.min(0.98, finalConfidence + 0.1);
    }

    // Boost confidence for established customers
    if (customerContext.totalInteractions > 5) {
      finalConfidence = Math.min(0.95, finalConfidence + 0.05);
    }

    // Boost confidence for clear emotional signals
    if (sentiment.confidence > 0.8) {
      finalConfidence = Math.min(0.95, finalConfidence + 0.05);
    }

    // Reduce confidence for conflicting signals
    if (sentiment.emotion === "neutral" && sentiment.urgency === "low") {
      finalConfidence = Math.max(0.3, finalConfidence - 0.1);
    }

    return finalConfidence;
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
