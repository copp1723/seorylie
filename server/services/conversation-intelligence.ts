/**
 * Advanced Conversation Intelligence System
 *
 * Provides natural, contextual, and intelligent conversation capabilities
 * with memory, customer journey tracking, and dynamic persona adaptation.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import logger from "../utils/logger";

export interface ConversationContext {
  // Customer Information
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // Conversation State
  conversationId: string;
  dealershipId: number;
  sessionStartTime: Date;
  currentIntent?: ConversationIntent;
  conversationStage: ConversationStage;

  // Customer Journey
  visitHistory: CustomerVisit[];
  previousInterests: VehicleInterest[];
  currentNeed?: CustomerNeed;

  // Conversation Memory
  keyFacts: string[];
  preferences: CustomerPreferences;
  conversationSummary: string;

  // Context Metadata
  totalMessages: number;
  lastMessageTime: Date;
  customerSentiment: "positive" | "neutral" | "negative";
  urgencyLevel: "low" | "medium" | "high";
}

export interface ConversationIntent {
  primary:
    | "browsing"
    | "specific_vehicle"
    | "pricing"
    | "financing"
    | "trade_in"
    | "scheduling"
    | "support";
  confidence: number;
  details: Record<string, any>;
}

export type ConversationStage =
  | "greeting"
  | "discovery"
  | "exploration"
  | "evaluation"
  | "negotiation"
  | "scheduling"
  | "handoff"
  | "follow_up";

export interface CustomerVisit {
  timestamp: Date;
  pages: string[];
  vehiclesViewed: number[];
  timeSpent: number;
  source: string;
}

export interface VehicleInterest {
  vehicleId?: number;
  make?: string;
  model?: string;
  year?: number;
  bodyStyle?: string;
  priceRange?: [number, number];
  features: string[];
  interestLevel: number; // 1-10
  mentions: number;
  lastMentioned: Date;
}

export interface CustomerNeed {
  primary: "replacement" | "additional" | "upgrade" | "first_car";
  timeline:
    | "immediate"
    | "within_month"
    | "within_3months"
    | "within_6months"
    | "exploring";
  budget?: [number, number];
  financing: "cash" | "finance" | "lease" | "undecided";
  tradeIn?: boolean;
}

export interface CustomerPreferences {
  communicationStyle: "formal" | "casual" | "technical" | "brief";
  informationDepth: "high_level" | "detailed" | "very_detailed";
  priceDiscussion: "upfront" | "after_features" | "avoid";
  preferredContact: "chat" | "email" | "phone" | "text";
}

export class ConversationIntelligence {
  private context: Map<string, ConversationContext> = new Map();

  /**
   * Initialize or retrieve conversation context
   */
  async getConversationContext(
    conversationId: string,
    dealershipId: number,
  ): Promise<ConversationContext> {
    if (this.context.has(conversationId)) {
      return this.context.get(conversationId)!;
    }

    // Load existing conversation context from database
    const existingContext = await this.loadConversationContext(conversationId);
    if (existingContext) {
      this.context.set(conversationId, existingContext);
      return existingContext;
    }

    // Create new conversation context
    const newContext: ConversationContext = {
      conversationId,
      dealershipId,
      sessionStartTime: new Date(),
      conversationStage: "greeting",
      visitHistory: [],
      previousInterests: [],
      keyFacts: [],
      preferences: {
        communicationStyle: "casual",
        informationDepth: "detailed",
        priceDiscussion: "after_features",
        preferredContact: "chat",
      },
      conversationSummary: "",
      totalMessages: 0,
      lastMessageTime: new Date(),
      customerSentiment: "neutral",
      urgencyLevel: "low",
    };

    this.context.set(conversationId, newContext);
    return newContext;
  }

  /**
   * Analyze message and update conversation context
   */
  async analyzeMessage(
    conversationId: string,
    message: string,
    isFromCustomer: boolean,
  ): Promise<ConversationContext> {
    const context = await this.getConversationContext(conversationId, 1); // Default dealership

    if (isFromCustomer) {
      // Extract insights from customer message
      await this.extractCustomerInsights(context, message);

      // Update conversation state
      await this.updateConversationState(context, message);

      // Detect intent and stage
      await this.detectIntentAndStage(context, message);
    }

    context.totalMessages++;
    context.lastMessageTime = new Date();

    // Save updated context
    await this.saveConversationContext(context);

    return context;
  }

  /**
   * Extract customer insights from message
   */
  private async extractCustomerInsights(
    context: ConversationContext,
    message: string,
  ): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Extract name if mentioned
    const nameMatch = message.match(
      /my name is ([a-zA-Z\s]+)|i'm ([a-zA-Z\s]+)|call me ([a-zA-Z\s]+)/i,
    );
    if (nameMatch && !context.customerName) {
      context.customerName = (
        nameMatch[1] ||
        nameMatch[2] ||
        nameMatch[3]
      ).trim();
      context.keyFacts.push(`Customer name: ${context.customerName}`);
    }

    // Extract contact info
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch && !context.customerEmail) {
      context.customerEmail = emailMatch[0];
      context.keyFacts.push(`Customer email: ${context.customerEmail}`);
    }

    const phoneMatch = message.match(
      /(\d{3}[-.]?\d{3}[-.]?\d{4}|\(\d{3}\)\s?\d{3}[-.]?\d{4})/,
    );
    if (phoneMatch && !context.customerPhone) {
      context.customerPhone = phoneMatch[0];
      context.keyFacts.push(`Customer phone: ${context.customerPhone}`);
    }

    // Extract vehicle interests
    await this.extractVehicleInterests(context, message);

    // Extract customer needs
    await this.extractCustomerNeeds(context, message);

    // Detect sentiment
    context.customerSentiment = this.detectSentiment(message);

    // Detect urgency
    context.urgencyLevel = this.detectUrgency(message);
  }

  /**
   * Extract vehicle interests from message
   */
  private async extractVehicleInterests(
    context: ConversationContext,
    message: string,
  ): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Extract makes and models
    const makes = [
      "toyota",
      "honda",
      "ford",
      "chevrolet",
      "nissan",
      "hyundai",
      "kia",
      "volkswagen",
      "bmw",
      "mercedes",
      "audi",
      "lexus",
      "acura",
    ];
    const bodyStyles = [
      "sedan",
      "suv",
      "truck",
      "coupe",
      "convertible",
      "hatchback",
      "wagon",
      "crossover",
    ];

    for (const make of makes) {
      if (lowerMessage.includes(make)) {
        const existingInterest = context.previousInterests.find(
          (i) => i.make?.toLowerCase() === make,
        );
        if (existingInterest) {
          existingInterest.mentions++;
          existingInterest.lastMentioned = new Date();
          existingInterest.interestLevel = Math.min(
            10,
            existingInterest.interestLevel + 1,
          );
        } else {
          context.previousInterests.push({
            make: make.charAt(0).toUpperCase() + make.slice(1),
            features: [],
            interestLevel: 5,
            mentions: 1,
            lastMentioned: new Date(),
          });
        }
      }
    }

    // Extract price range
    const priceMatch = message.match(
      /(\$|under |around |about |between )[\d,]+(\s*and\s*[\d,]+)?/,
    );
    if (priceMatch && !context.currentNeed?.budget) {
      if (!context.currentNeed)
        context.currentNeed = {
          primary: "replacement",
          timeline: "exploring",
          financing: "undecided",
        };
      // Parse price range logic here
    }
  }

  /**
   * Extract customer needs from message
   */
  private async extractCustomerNeeds(
    context: ConversationContext,
    message: string,
  ): Promise<void> {
    const lowerMessage = message.toLowerCase();

    if (!context.currentNeed) {
      context.currentNeed = {
        primary: "replacement",
        timeline: "exploring",
        financing: "undecided",
      };
    }

    // Timeline detection
    if (
      lowerMessage.includes("asap") ||
      lowerMessage.includes("immediately") ||
      lowerMessage.includes("urgent")
    ) {
      context.currentNeed.timeline = "immediate";
    } else if (
      lowerMessage.includes("this month") ||
      lowerMessage.includes("soon")
    ) {
      context.currentNeed.timeline = "within_month";
    } else if (
      lowerMessage.includes("few months") ||
      lowerMessage.includes("3 months")
    ) {
      context.currentNeed.timeline = "within_3months";
    }

    // Financing detection
    if (lowerMessage.includes("lease") || lowerMessage.includes("leasing")) {
      context.currentNeed.financing = "lease";
    } else if (
      lowerMessage.includes("finance") ||
      lowerMessage.includes("loan")
    ) {
      context.currentNeed.financing = "finance";
    } else if (
      lowerMessage.includes("cash") ||
      lowerMessage.includes("pay full")
    ) {
      context.currentNeed.financing = "cash";
    }

    // Trade-in detection
    if (
      lowerMessage.includes("trade") ||
      lowerMessage.includes("current car") ||
      lowerMessage.includes("existing vehicle")
    ) {
      context.currentNeed.tradeIn = true;
    }
  }

  /**
   * Detect conversation intent and stage
   */
  private async detectIntentAndStage(
    context: ConversationContext,
    message: string,
  ): Promise<void> {
    const lowerMessage = message.toLowerCase();

    // Intent detection
    if (
      lowerMessage.includes("price") ||
      lowerMessage.includes("cost") ||
      lowerMessage.includes("payment")
    ) {
      context.currentIntent = {
        primary: "pricing",
        confidence: 0.8,
        details: {},
      };
    } else if (
      lowerMessage.includes("schedule") ||
      lowerMessage.includes("appointment") ||
      lowerMessage.includes("test drive")
    ) {
      context.currentIntent = {
        primary: "scheduling",
        confidence: 0.9,
        details: {},
      };
    } else if (
      lowerMessage.includes("financing") ||
      lowerMessage.includes("loan") ||
      lowerMessage.includes("lease")
    ) {
      context.currentIntent = {
        primary: "financing",
        confidence: 0.8,
        details: {},
      };
    } else if (
      lowerMessage.includes("trade") ||
      lowerMessage.includes("trade-in")
    ) {
      context.currentIntent = {
        primary: "trade_in",
        confidence: 0.8,
        details: {},
      };
    }

    // Stage progression
    if (context.conversationStage === "greeting" && context.totalMessages > 2) {
      context.conversationStage = "discovery";
    } else if (
      context.conversationStage === "discovery" &&
      context.previousInterests.length > 0
    ) {
      context.conversationStage = "exploration";
    } else if (
      context.conversationStage === "exploration" &&
      context.currentIntent?.primary === "pricing"
    ) {
      context.conversationStage = "evaluation";
    }
  }

  /**
   * Detect customer sentiment
   */
  private detectSentiment(
    message: string,
  ): "positive" | "neutral" | "negative" {
    const lowerMessage = message.toLowerCase();

    const positiveWords = [
      "great",
      "excellent",
      "love",
      "perfect",
      "amazing",
      "fantastic",
      "interested",
      "excited",
    ];
    const negativeWords = [
      "terrible",
      "awful",
      "hate",
      "disappointed",
      "frustrated",
      "annoyed",
      "expensive",
    ];

    const positiveCount = positiveWords.filter((word) =>
      lowerMessage.includes(word),
    ).length;
    const negativeCount = negativeWords.filter((word) =>
      lowerMessage.includes(word),
    ).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /**
   * Detect urgency level
   */
  private detectUrgency(message: string): "low" | "medium" | "high" {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes("urgent") ||
      lowerMessage.includes("asap") ||
      lowerMessage.includes("immediately")
    ) {
      return "high";
    }
    if (
      lowerMessage.includes("soon") ||
      lowerMessage.includes("this week") ||
      lowerMessage.includes("need quickly")
    ) {
      return "medium";
    }
    return "low";
  }

  /**
   * Update conversation state
   */
  private async updateConversationState(
    context: ConversationContext,
    message: string,
  ): Promise<void> {
    // Update conversation summary
    if (context.conversationSummary.length > 500) {
      // Compress summary if getting too long
      context.conversationSummary = await this.compressConversationSummary(
        context.conversationSummary,
        message,
      );
    } else {
      context.conversationSummary += ` Customer: ${message.substring(0, 100)}...`;
    }
  }

  /**
   * Compress conversation summary to maintain context without losing important details
   */
  private async compressConversationSummary(
    currentSummary: string,
    newMessage: string,
  ): Promise<string> {
    // Extract key points and compress
    const keyPoints = currentSummary
      .split(".")
      .filter(
        (point) =>
          point.includes("Customer name:") ||
          point.includes("interested in") ||
          point.includes("budget") ||
          point.includes("timeline"),
      );

    return keyPoints.join(". ") + `. Recent: ${newMessage.substring(0, 50)}...`;
  }

  /**
   * Generate enhanced conversation summary for AI context
   */
  async generateContextSummary(conversationId: string): Promise<string> {
    const context = this.context.get(conversationId);
    if (!context) return "";

    let summary = `CONVERSATION CONTEXT:\n`;

    // Customer Information
    if (context.customerName) summary += `Customer: ${context.customerName}\n`;
    if (context.customerEmail) summary += `Email: ${context.customerEmail}\n`;
    if (context.customerPhone) summary += `Phone: ${context.customerPhone}\n`;

    // Current State
    summary += `Stage: ${context.conversationStage}\n`;
    summary += `Messages: ${context.totalMessages}\n`;
    summary += `Sentiment: ${context.customerSentiment}\n`;
    summary += `Urgency: ${context.urgencyLevel}\n`;

    // Interests
    if (context.previousInterests.length > 0) {
      summary += `Vehicle Interests:\n`;
      context.previousInterests.forEach((interest) => {
        summary += `- ${interest.make} ${interest.model || ""} (Interest: ${interest.interestLevel}/10, Mentions: ${interest.mentions})\n`;
      });
    }

    // Current Need
    if (context.currentNeed) {
      summary += `Customer Need:\n`;
      summary += `- Purpose: ${context.currentNeed.primary}\n`;
      summary += `- Timeline: ${context.currentNeed.timeline}\n`;
      summary += `- Financing: ${context.currentNeed.financing}\n`;
      if (context.currentNeed.tradeIn) summary += `- Has trade-in\n`;
    }

    // Key Facts
    if (context.keyFacts.length > 0) {
      summary += `Key Facts:\n`;
      context.keyFacts.forEach((fact) => (summary += `- ${fact}\n`));
    }

    // Conversation Summary
    if (context.conversationSummary) {
      summary += `\nConversation Summary: ${context.conversationSummary}\n`;
    }

    return summary;
  }

  /**
   * Save conversation context to database
   */
  private async saveConversationContext(
    context: ConversationContext,
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO conversation_context (
          conversation_id, dealership_id, customer_name, customer_email, customer_phone,
          conversation_stage, current_intent, customer_sentiment, urgency_level,
          previous_interests, current_need, key_facts, conversation_summary,
          total_messages, last_message_time, session_start_time
        ) VALUES (
          ${context.conversationId}, ${context.dealershipId}, ${context.customerName || null}, 
          ${context.customerEmail || null}, ${context.customerPhone || null},
          ${context.conversationStage}, ${JSON.stringify(context.currentIntent)}, 
          ${context.customerSentiment}, ${context.urgencyLevel},
          ${JSON.stringify(context.previousInterests)}, ${JSON.stringify(context.currentNeed)},
          ${JSON.stringify(context.keyFacts)}, ${context.conversationSummary},
          ${context.totalMessages}, ${context.lastMessageTime}, ${context.sessionStartTime}
        )
        ON CONFLICT (conversation_id) DO UPDATE SET
          customer_name = EXCLUDED.customer_name,
          customer_email = EXCLUDED.customer_email,
          customer_phone = EXCLUDED.customer_phone,
          conversation_stage = EXCLUDED.conversation_stage,
          current_intent = EXCLUDED.current_intent,
          customer_sentiment = EXCLUDED.customer_sentiment,
          urgency_level = EXCLUDED.urgency_level,
          previous_interests = EXCLUDED.previous_interests,
          current_need = EXCLUDED.current_need,
          key_facts = EXCLUDED.key_facts,
          conversation_summary = EXCLUDED.conversation_summary,
          total_messages = EXCLUDED.total_messages,
          last_message_time = EXCLUDED.last_message_time
      `);
    } catch (error) {
      logger.error("Failed to save conversation context:", error);
    }
  }

  /**
   * Load conversation context from database
   */
  private async loadConversationContext(
    conversationId: string,
  ): Promise<ConversationContext | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM conversation_context WHERE conversation_id = ${conversationId}
      `);

      if (result.length === 0) return null;

      const row = result[0] as any;
      return {
        conversationId: row.conversation_id,
        dealershipId: row.dealership_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        conversationStage: row.conversation_stage,
        currentIntent: row.current_intent
          ? JSON.parse(row.current_intent)
          : undefined,
        customerSentiment: row.customer_sentiment,
        urgencyLevel: row.urgency_level,
        previousInterests: row.previous_interests
          ? JSON.parse(row.previous_interests)
          : [],
        currentNeed: row.current_need
          ? JSON.parse(row.current_need)
          : undefined,
        keyFacts: row.key_facts ? JSON.parse(row.key_facts) : [],
        conversationSummary: row.conversation_summary || "",
        totalMessages: row.total_messages,
        lastMessageTime: new Date(row.last_message_time),
        sessionStartTime: new Date(row.session_start_time),
        visitHistory: [], // Load separately if needed
        preferences: {
          communicationStyle: "casual",
          informationDepth: "detailed",
          priceDiscussion: "after_features",
          preferredContact: "chat",
        },
      };
    } catch (error) {
      logger.error("Failed to load conversation context:", error);
      return null;
    }
  }
}

// Singleton instance
export const conversationIntelligence = new ConversationIntelligence();
