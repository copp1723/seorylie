import { eq, and, desc } from "drizzle-orm";
import db from "../db";
import {
  conversations,
  messages,
  leads,
  leadActivities,
  type InsertMessage,
  type Message,
  type Conversation,
  type MessageSender,
  type MessageType,
} from "../../shared/lead-management-schema";
import { enhancedAIService } from "./enhanced-ai-service";
import { conversationIntelligence } from "./conversation-intelligence";
import logger from "../utils/logger";

export interface ReplyMessageData {
  conversationId: string;
  content: string;
  contentType?: "text" | "html" | "markdown";
  sender: MessageSender;
  senderUserId?: number;
  senderName?: string;
  subject?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    size: number;
    url: string;
  }>;
}

export interface ReplyResult {
  success: boolean;
  messageId?: string;
  conversationId?: string;
  timestamp?: Date;
  errors: string[];
  conversationNotFound?: boolean;
}

export interface ConversationDetails {
  conversation: Conversation;
  messages: Message[];
  totalMessages: number;
}

export class ConversationService {
  private db: any;

  constructor(database?: any) {
    this.db = database || db;
  }

  /**
   * Send a reply message to a conversation
   */
  async sendReply(
    dealershipId: number,
    replyData: ReplyMessageData,
  ): Promise<ReplyResult> {
    const errors: string[] = [];

    try {
      logger.info("Sending reply message", {
        dealershipId,
        conversationId: replyData.conversationId,
        sender: replyData.sender,
      });

      // Verify conversation exists and belongs to dealership
      const conversationResults = await this.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, replyData.conversationId),
            eq(conversations.dealershipId, dealershipId),
          ),
        )
        .limit(1);

      if (conversationResults.length === 0) {
        return {
          success: false,
          errors: ["Conversation not found"],
          conversationNotFound: true,
        };
      }

      const conversation = conversationResults[0];

      // Determine message type based on sender
      let messageType: MessageType;
      switch (replyData.sender) {
        case "customer":
          messageType = "inbound";
          break;
        case "ai":
        case "agent":
          messageType = "outbound";
          break;
        case "system":
          messageType = "system";
          break;
        default:
          messageType = "outbound";
      }

      // Create the message
      const messageData: InsertMessage = {
        conversationId: replyData.conversationId,
        content: replyData.content,
        contentType: replyData.contentType || "text",
        subject: replyData.subject,
        type: messageType,
        sender: replyData.sender,
        senderUserId: replyData.senderUserId,
        senderName: replyData.senderName,
        attachments: replyData.attachments || [],
        isRead: replyData.sender !== "customer", // Mark as read if not from customer
      };

      const [newMessage] = await this.db
        .insert(messages)
        .values(messageData)
        .returning();

      // Update conversation metadata
      await this.db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          messageCount: conversation.messageCount + 1,
          updatedAt: new Date(),
          // Update status based on sender
          status:
            replyData.sender === "customer" ? "waiting_response" : "active",
        })
        .where(eq(conversations.id, replyData.conversationId));

      // Log activity on the lead
      await this.db.insert(leadActivities).values({
        leadId: conversation.leadId,
        userId: replyData.senderUserId,
        type: "message_sent",
        description: `${replyData.sender} sent a message: ${replyData.content.substring(0, 100)}${replyData.content.length > 100 ? "..." : ""}`,
        messageId: newMessage.id,
      });

      // Generate intelligent AI response if message is from customer
      if (replyData.sender === "customer") {
        try {
          const aiResponse = await enhancedAIService.generateResponse(
            replyData.conversationId,
            replyData.content,
            dealershipId,
          );

          if (aiResponse) {
            // Send AI response automatically
            const aiMessageData: InsertMessage = {
              conversationId: replyData.conversationId,
              content: aiResponse,
              contentType: "text",
              type: "outbound",
              sender: "ai",
              senderName: "Rylie AI Assistant",
              isRead: true,
            };

            const [aiMessage] = await this.db
              .insert(messages)
              .values(aiMessageData)
              .returning();

            // Update conversation after AI response
            await this.db
              .update(conversations)
              .set({
                lastMessageAt: new Date(),
                messageCount: conversation.messageCount + 2, // +1 for customer message, +1 for AI response
                updatedAt: new Date(),
                status: "active",
              })
              .where(eq(conversations.id, replyData.conversationId));

            // Log AI response activity
            await this.db.insert(leadActivities).values({
              leadId: conversation.leadId,
              type: "ai_response",
              description: `AI generated intelligent response: ${aiResponse.substring(0, 100)}${aiResponse.length > 100 ? "..." : ""}`,
              messageId: aiMessage.id,
            });

            logger.info("Intelligent AI response generated and sent", {
              customerMessageId: newMessage.id,
              aiMessageId: aiMessage.id,
              conversationId: replyData.conversationId,
            });
          }
        } catch (error) {
          logger.error("Error generating intelligent AI response", {
            error: error instanceof Error ? error.message : String(error),
            conversationId: replyData.conversationId,
          });
          // Don't fail the entire request if AI response fails
        }
      }

      logger.info("Reply message sent successfully", {
        messageId: newMessage.id,
        conversationId: replyData.conversationId,
        sender: replyData.sender,
      });

      return {
        success: true,
        messageId: newMessage.id,
        conversationId: replyData.conversationId,
        timestamp: newMessage.createdAt,
        errors,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Reply message failed", {
        error: err.message,
        dealershipId,
        conversationId: replyData.conversationId,
      });

      errors.push(`Failed to send reply: ${err.message}`);

      return {
        success: false,
        errors,
      };
    }
  }

  /**
   * Get conversation details with messages
   */
  async getConversation(
    dealershipId: number,
    conversationId: string,
    options: {
      includeMessages?: boolean;
      messageLimit?: number;
      messageOffset?: number;
    } = {},
  ): Promise<ConversationDetails | null> {
    try {
      const {
        includeMessages = true,
        messageLimit = 50,
        messageOffset = 0,
      } = options;

      // Get conversation
      const conversationResults = await this.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.dealershipId, dealershipId),
          ),
        )
        .limit(1);

      if (conversationResults.length === 0) {
        return null;
      }

      const conversation = conversationResults[0];
      let conversationMessages: Message[] = [];
      let totalMessages = 0;

      if (includeMessages) {
        // Get messages for the conversation
        conversationMessages = await this.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(desc(messages.createdAt))
          .limit(messageLimit)
          .offset(messageOffset);

        // Get total message count
        const messageCountResults = await this.db
          .select({ count: messages.id })
          .from(messages)
          .where(eq(messages.conversationId, conversationId));

        totalMessages = messageCountResults.length;
      }

      return {
        conversation,
        messages: conversationMessages,
        totalMessages,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Get conversation failed", {
        error: err.message,
        dealershipId,
        conversationId,
      });

      return null;
    }
  }

  /**
   * Get conversations for a dealership
   */
  async getConversations(
    dealershipId: number,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      leadId?: string;
      customerId?: string;
    } = {},
  ): Promise<Conversation[]> {
    try {
      const { limit = 50, offset = 0, status, leadId, customerId } = options;

      let query = db
        .select()
        .from(conversations)
        .where(eq(conversations.dealershipId, dealershipId));

      if (status) {
        query = query.where(
          and(
            eq(conversations.dealershipId, dealershipId),
            eq(conversations.status, status as any),
          ),
        );
      }

      if (leadId) {
        query = query.where(
          and(
            eq(conversations.dealershipId, dealershipId),
            eq(conversations.leadId, leadId),
          ),
        );
      }

      if (customerId) {
        query = query.where(
          and(
            eq(conversations.dealershipId, dealershipId),
            eq(conversations.customerId, customerId),
          ),
        );
      }

      return query
        .orderBy(desc(conversations.lastMessageAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Get conversations failed", {
        error: err.message,
        dealershipId,
      });

      return [];
    }
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(
    dealershipId: number,
    conversationId: string,
    userId?: number,
  ): Promise<{ success: boolean; updatedCount: number }> {
    try {
      // Verify conversation belongs to dealership
      const conversationExists = await this.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.dealershipId, dealershipId),
          ),
        )
        .limit(1);

      if (conversationExists.length === 0) {
        return { success: false, updatedCount: 0 };
      }

      // Mark unread messages as read
      const updateResult = await this.db
        .update(messages)
        .set({
          isRead: true,
          readAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.isRead, false),
          ),
        )
        .returning({ id: messages.id });

      return { success: true, updatedCount: updateResult.length };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Mark messages as read failed", {
        error: err.message,
        dealershipId,
        conversationId,
      });

      return { success: false, updatedCount: 0 };
    }
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    dealershipId: number,
    conversationId: string,
    status: string,
    userId?: number,
  ): Promise<{ success: boolean; conversation?: Conversation }> {
    try {
      const updateResult = await this.db
        .update(conversations)
        .set({
          status: status as any,
          updatedAt: new Date(),
          closedAt:
            status === "resolved" || status === "archived" ? new Date() : null,
        })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.dealershipId, dealershipId),
          ),
        )
        .returning();

      if (updateResult.length === 0) {
        return { success: false };
      }

      const conversation = updateResult[0];

      // Log activity
      await this.db.insert(leadActivities).values({
        leadId: conversation.leadId,
        userId,
        type: "conversation_status_changed",
        description: `Conversation status changed to: ${status}`,
      });

      return { success: true, conversation };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Update conversation status failed", {
        error: err.message,
        dealershipId,
        conversationId,
        status,
      });

      return { success: false };
    }
  }

  /**
   * List conversations - alias for getConversations
   */
  async listConversations(
    dealershipId: number,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      leadId?: string;
      customerId?: string;
    } = {},
  ): Promise<Conversation[]> {
    return this.getConversations(dealershipId, options);
  }

  /**
   * Get conversation by ID - alias for getConversation
   */
  async getConversationById(
    conversationId: string,
    dealershipId: number,
  ): Promise<ConversationDetails | null> {
    return this.getConversation(dealershipId, conversationId);
  }

  /**
   * Get conversation statistics
   */
  async getConversationStats(
    dealershipId: number,
    timeframe: string = "24h",
  ): Promise<{
    total: number;
    active: number;
    resolved: number;
    averageResponseTime: number;
  }> {
    try {
      // Calculate date range based on timeframe
      const now = new Date();
      let startDate = new Date();

      switch (timeframe) {
        case "1h":
          startDate.setHours(now.getHours() - 1);
          break;
        case "24h":
          startDate.setDate(now.getDate() - 1);
          break;
        case "7d":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30d":
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 1);
      }

      // Get conversation counts
      const totalConversations = await this.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.dealershipId, dealershipId),
            // Add date filter if needed
          ),
        );

      const activeConversations = totalConversations.filter(
        (c) => c.status === "active",
      );
      const resolvedConversations = totalConversations.filter(
        (c) => c.status === "resolved",
      );

      return {
        total: totalConversations.length,
        active: activeConversations.length,
        resolved: resolvedConversations.length,
        averageResponseTime: 0, // TODO: Calculate actual response time
      };
    } catch (error) {
      logger.error("Get conversation stats failed", {
        error,
        dealershipId,
        timeframe,
      });
      return { total: 0, active: 0, resolved: 0, averageResponseTime: 0 };
    }
  }

  /**
   * Verify conversation access
   */
  async verifyConversationAccess(
    conversationId: string,
    dealershipId: number,
  ): Promise<boolean> {
    try {
      const conversation = await this.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.dealershipId, dealershipId),
          ),
        )
        .limit(1);

      return conversation.length > 0;
    } catch (error) {
      logger.error("Verify conversation access failed", {
        error,
        conversationId,
        dealershipId,
      });
      return false;
    }
  }

  /**
   * Get conversation messages with cursor-based pagination
   */
  async getConversationMessagesWithCursor(
    conversationId: string,
    dealershipId: number,
    cursor?: string,
    limit: number = 50,
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    try {
      // Verify access
      const hasAccess = await this.verifyConversationAccess(
        conversationId,
        dealershipId,
      );
      if (!hasAccess) {
        return { messages: [], hasMore: false };
      }

      let query = db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(limit + 1); // Get one extra to check if there are more

      if (cursor) {
        // Add cursor-based filtering if needed
        // For now, just use simple pagination
      }

      const results = await query;
      const hasMore = results.length > limit;
      const messages = hasMore ? results.slice(0, -1) : results;

      const nextCursor = hasMore
        ? messages[messages.length - 1]?.id
        : undefined;

      return {
        messages,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      logger.error("Get conversation messages with cursor failed", {
        error,
        conversationId,
      });
      return { messages: [], hasMore: false };
    }
  }

  /**
   * Get lead context for a conversation
   */
  async getLeadContext(adfLeadId?: string): Promise<any> {
    if (!adfLeadId) {
      return null;
    }

    try {
      const lead = await this.db
        .select()
        .from(leads)
        .where(eq(leads.id, adfLeadId))
        .limit(1);

      return lead[0] || null;
    } catch (error) {
      logger.error("Get lead context failed", { error, adfLeadId });
      return null;
    }
  }

  /**
   * Log conversation event
   */
  async logConversationEvent(
    conversationId: string,
    eventType: string,
    eventData: any,
    userId?: number,
  ): Promise<string> {
    try {
      // Find the conversation to get leadId
      const conversation = await this.db
        .select({ leadId: conversations.leadId })
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error("Conversation not found");
      }

      const [activity] = await this.db
        .insert(leadActivities)
        .values({
          leadId: conversation[0].leadId,
          userId,
          type: eventType,
          description: `Event: ${eventType}`,
          metadata: eventData,
        })
        .returning();

      return activity.id;
    } catch (error) {
      logger.error("Log conversation event failed", {
        error,
        conversationId,
        eventType,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const conversationService = new ConversationService();
export default conversationService;
