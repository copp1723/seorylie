import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import db from '../db';
import {
  conversations,
  messages,
  handovers,
  leads,
  customers,
  type Conversation,
  type Message,
  type ConversationStatus,
  type MessageSender
} from '../../shared/lead-management-schema';
import { users } from '../../shared/schema';
import logger from '../utils/logger';

export interface ConversationLogEntry {
  conversation: Conversation & {
    customer?: { id: string; fullName: string; email?: string; phone?: string };
    lead?: { id: string; leadNumber: string; status: string };
    assignedUser?: { id: number; name: string; email: string };
  };
  messageCount: number;
  lastMessage?: Message;
  hasEscalations: boolean;
  escalationCount: number;
}

export interface ConversationLogFilters {
  dealershipId: number;
  status?: ConversationStatus[];
  assignedUserId?: number;
  escalatedOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'created_at' | 'last_message_at' | 'message_count';
  sortOrder?: 'asc' | 'desc';
}

export interface ConversationAnalytics {
  totalConversations: number;
  activeConversations: number;
  escalatedConversations: number;
  avgResponseTime: number; // in minutes
  avgConversationLength: number; // message count
  topEscalationReasons: Array<{ reason: string; count: number }>;
  conversationsByStatus: Array<{ status: string; count: number }>;
  conversationsByChannel: Array<{ channel: string; count: number }>;
  dailyStats: Array<{
    date: string;
    conversations: number;
    messages: number;
    escalations: number;
  }>;
}

export class ConversationLogsService {
  
  /**
   * Get filtered conversation logs
   */
  async getConversationLogs(filters: ConversationLogFilters): Promise<{
    logs: ConversationLogEntry[];
    total: number;
    analytics: Partial<ConversationAnalytics>;
  }> {
    try {
      logger.info('Fetching conversation logs', filters);

      const {
        dealershipId,
        status,
        assignedUserId,
        escalatedOnly,
        dateFrom,
        dateTo,
        searchTerm,
        limit = 50,
        offset = 0,
        sortBy = 'last_message_at',
        sortOrder = 'desc'
      } = filters;

      // Build where conditions
      let whereConditions = [eq(conversations.dealershipId, dealershipId)];

      if (status && status.length > 0) {
        whereConditions.push(sql`${conversations.status} = ANY(${status})`);
      }

      if (assignedUserId) {
        whereConditions.push(eq(conversations.assignedUserId, assignedUserId));
      }

      if (dateFrom) {
        whereConditions.push(gte(conversations.createdAt, dateFrom));
      }

      if (dateTo) {
        whereConditions.push(lte(conversations.createdAt, dateTo));
      }

      // Base query for conversations with joins
      const baseQuery = db
        .select({
          conversation: conversations,
          customer: {
            id: customers.id,
            fullName: customers.fullName,
            email: customers.email,
            phone: customers.phone
          },
          lead: {
            id: leads.id,
            leadNumber: leads.leadNumber,
            status: leads.status
          },
          assignedUser: {
            id: users.id,
            name: users.name,
            email: users.email
          }
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .leftJoin(leads, eq(conversations.leadId, leads.id))
        .leftJoin(users, eq(conversations.assignedUserId, users.id))
        .where(and(...whereConditions));

      // Add search term filtering
      if (searchTerm) {
        const searchCondition = sql`(
          ${customers.fullName} ILIKE ${`%${searchTerm}%`} OR
          ${customers.email} ILIKE ${`%${searchTerm}%`} OR
          ${leads.leadNumber} ILIKE ${`%${searchTerm}%`} OR
          ${conversations.subject} ILIKE ${`%${searchTerm}%`}
        )`;
        whereConditions.push(searchCondition);
      }

      // Get total count
      const totalCountResult = await db
        .select({ count: sql`COUNT(*)` })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .leftJoin(leads, eq(conversations.leadId, leads.id))
        .where(and(...whereConditions));

      const total = totalCountResult[0]?.count || 0;

      // Get paginated results
      const sortColumn = sortBy === 'created_at' ? conversations.createdAt :
                        sortBy === 'last_message_at' ? conversations.lastMessageAt :
                        conversations.messageCount;

      const conversationsResult = await baseQuery
        .orderBy(sortOrder === 'desc' ? desc(sortColumn) : sortColumn)
        .limit(limit)
        .offset(offset);

      // Enhance with additional data
      const logs: ConversationLogEntry[] = [];

      for (const row of conversationsResult) {
        // Get message count and last message
        const messageStats = await this.getConversationMessageStats(row.conversation.id);
        
        // Check for escalations
        const escalationStats = await this.getConversationEscalationStats(row.conversation.id);

        // Apply escalation filter if requested
        if (escalatedOnly && escalationStats.escalationCount === 0) {
          continue;
        }

        logs.push({
          conversation: {
            ...row.conversation,
            customer: row.customer,
            lead: row.lead,
            assignedUser: row.assignedUser
          },
          messageCount: messageStats.count,
          lastMessage: messageStats.lastMessage,
          hasEscalations: escalationStats.escalationCount > 0,
          escalationCount: escalationStats.escalationCount
        });
      }

      // Get basic analytics
      const analytics = await this.getBasicAnalytics(dealershipId, dateFrom, dateTo);

      return { logs, total, analytics };

    } catch (error) {
      logger.error('Error fetching conversation logs:', error);
      throw error;
    }
  }

  /**
   * Get detailed conversation with full message history
   */
  async getDetailedConversation(
    conversationId: string,
    dealershipId: number
  ): Promise<{
    conversation: ConversationLogEntry;
    messages: Message[];
    escalations: any[];
  } | null> {
    try {
      // Get conversation details
      const conversationResult = await db
        .select({
          conversation: conversations,
          customer: {
            id: customers.id,
            fullName: customers.fullName,
            email: customers.email,
            phone: customers.phone
          },
          lead: {
            id: leads.id,
            leadNumber: leads.leadNumber,
            status: leads.status
          },
          assignedUser: {
            id: users.id,
            name: users.name,
            email: users.email
          }
        })
        .from(conversations)
        .leftJoin(customers, eq(conversations.customerId, customers.id))
        .leftJoin(leads, eq(conversations.leadId, leads.id))
        .leftJoin(users, eq(conversations.assignedUserId, users.id))
        .where(and(
          eq(conversations.id, conversationId),
          eq(conversations.dealershipId, dealershipId)
        ))
        .limit(1);

      if (conversationResult.length === 0) {
        return null;
      }

      const row = conversationResult[0];

      // Get all messages
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);

      // Get escalations
      const conversationEscalations = await db
        .select()
        .from(handovers)
        .where(eq(handovers.conversationId, conversationId))
        .orderBy(handovers.requestedAt);

      // Get message and escalation stats
      const messageStats = await this.getConversationMessageStats(conversationId);
      const escalationStats = await this.getConversationEscalationStats(conversationId);

      const conversationLog: ConversationLogEntry = {
        conversation: {
          ...row.conversation,
          customer: row.customer,
          lead: row.lead,
          assignedUser: row.assignedUser
        },
        messageCount: messageStats.count,
        lastMessage: messageStats.lastMessage,
        hasEscalations: escalationStats.escalationCount > 0,
        escalationCount: escalationStats.escalationCount
      };

      return {
        conversation: conversationLog,
        messages: conversationMessages,
        escalations: conversationEscalations
      };

    } catch (error) {
      logger.error('Error fetching detailed conversation:', error);
      throw error;
    }
  }

  /**
   * Get conversation analytics
   */
  async getAnalytics(
    dealershipId: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<ConversationAnalytics> {
    try {
      const analytics = await this.getBasicAnalytics(dealershipId, dateFrom, dateTo);
      
      // Get additional detailed analytics
      const [
        topEscalationReasons,
        conversationsByStatus,
        conversationsByChannel,
        dailyStats
      ] = await Promise.all([
        this.getTopEscalationReasons(dealershipId, dateFrom, dateTo),
        this.getConversationsByStatus(dealershipId, dateFrom, dateTo),
        this.getConversationsByChannel(dealershipId, dateFrom, dateTo),
        this.getDailyStats(dealershipId, dateFrom, dateTo)
      ]);

      return {
        ...analytics,
        topEscalationReasons,
        conversationsByStatus,
        conversationsByChannel,
        dailyStats
      } as ConversationAnalytics;

    } catch (error) {
      logger.error('Error getting conversation analytics:', error);
      throw error;
    }
  }

  // Private helper methods

  private async getConversationMessageStats(conversationId: string) {
    const messageCountResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));

    const lastMessageResult = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(1);

    return {
      count: messageCountResult[0]?.count || 0,
      lastMessage: lastMessageResult[0] || undefined
    };
  }

  private async getConversationEscalationStats(conversationId: string) {
    const escalationCountResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(handovers)
      .where(eq(handovers.conversationId, conversationId));

    return {
      escalationCount: escalationCountResult[0]?.count || 0
    };
  }

  private async getBasicAnalytics(
    dealershipId: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<Partial<ConversationAnalytics>> {
    let whereConditions = [eq(conversations.dealershipId, dealershipId)];

    if (dateFrom) {
      whereConditions.push(gte(conversations.createdAt, dateFrom));
    }

    if (dateTo) {
      whereConditions.push(lte(conversations.createdAt, dateTo));
    }

    // Total conversations
    const totalResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(conversations)
      .where(and(...whereConditions));

    // Active conversations
    const activeResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(conversations)
      .where(and(...whereConditions, eq(conversations.status, 'active')));

    // Escalated conversations
    const escalatedResult = await db
      .select({ count: sql`COUNT(*)` })
      .from(conversations)
      .innerJoin(handovers, eq(conversations.id, handovers.conversationId))
      .where(and(...whereConditions));

    return {
      totalConversations: totalResult[0]?.count || 0,
      activeConversations: activeResult[0]?.count || 0,
      escalatedConversations: escalatedResult[0]?.count || 0,
      avgResponseTime: 0, // TODO: Implement response time calculation
      avgConversationLength: 0, // TODO: Implement average message count
    };
  }

  private async getTopEscalationReasons(
    dealershipId: number,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    // TODO: Implement escalation reasons aggregation
    return [];
  }

  private async getConversationsByStatus(
    dealershipId: number,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    // TODO: Implement status aggregation
    return [];
  }

  private async getConversationsByChannel(
    dealershipId: number,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    // TODO: Implement channel aggregation
    return [];
  }

  private async getDailyStats(
    dealershipId: number,
    dateFrom?: Date,
    dateTo?: Date
  ) {
    // TODO: Implement daily stats aggregation
    return [];
  }
}

export const conversationLogsService = new ConversationLogsService();