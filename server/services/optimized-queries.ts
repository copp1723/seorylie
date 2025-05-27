import db from "../db";
import { eq, desc, asc, and, gte, lte, inArray, sql, count } from 'drizzle-orm';
import { users, dealerships } from '../../shared/schema';
import logger from '../utils/logger';
import { cacheService, createCacheKey } from './unified-cache-service';
import type { User } from '../../shared/schema';

// Types
interface ConversationResult {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

interface PaginatedConversations {
  conversations: ConversationResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MessageResult {
  id: number;
  content: string;
  isFromCustomer: boolean;
  createdAt: Date;
  metadata: any;
}

interface ConversationWithMessages extends ConversationResult {
  messages: MessageResult[];
}

// Optimized conversation queries
export async function getRecentConversations(
  dealershipId: number,
  page: number = 1,
  limit: number = 20,
  status?: string
): Promise<PaginatedConversations> {
  const offset = (page - 1) * limit;

  try {
    const query = db.select()
      .from(sql`conversations`)
      .where(sql`dealership_id = ${dealershipId}`)
      .limit(limit)
      .offset(offset);

    if (status) {
      query.where(sql`status = ${status}`);
    }

    const [conversations, countResult] = await Promise.all([
      query.execute(),
      db.select({ count: sql`count(*)` })
        .from(sql`conversations`)
        .where(sql`dealership_id = ${dealershipId}`)
        .execute()
    ]);

    const total = Number(countResult[0]?.count || 0);

    return {
      conversations: conversations.map(conv => ({
        id: conv.id,
        customerName: conv.customer_name,
        customerEmail: conv.customer_email,
        customerPhone: conv.customer_phone,
        status: conv.status,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
        messageCount: conv.message_count || 0
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching conversations', { error: err.message });
    throw err;
  }
}

export async function getConversationWithMessages(
  conversationId: number,
  messageLimit: number = 50
): Promise<ConversationWithMessages | null> {
  try {
    const [conversation, messages] = await Promise.all([
      db.select()
        .from(sql`conversations`)
        .where(sql`id = ${conversationId}`)
        .limit(1)
        .execute(),
      db.select()
        .from(sql`messages`)
        .where(sql`conversation_id = ${conversationId}`)
        .orderBy(sql`created_at desc`)
        .limit(messageLimit)
        .execute()
    ]);

    if (!conversation[0]) return null;

    return {
      id: conversation[0].id,
      customerName: conversation[0].customer_name,
      customerEmail: conversation[0].customer_email,
      customerPhone: conversation[0].customer_phone,
      status: conversation[0].status,
      createdAt: new Date(conversation[0].created_at),
      updatedAt: new Date(conversation[0].updated_at),
      messageCount: 0,
      messages: messages.map(msg => ({
        id: msg.id,
        content: msg.content,
        isFromCustomer: msg.is_from_customer,
        createdAt: new Date(msg.created_at),
        metadata: msg.metadata
      })).reverse()
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching conversation', { error: err.message });
    throw err;
  }
}

export async function getConversationCountsByStatus(
  dealershipId: number
): Promise<Record<string, number>> {
  try {
    const results = await db.select({
      status: sql`status`,
      count: sql`count(*)`
    })
      .from(sql`conversations`)
      .where(sql`dealership_id = ${dealershipId}`)
      .groupBy(sql`status`)
      .execute();

    return results.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching counts', { error: err.message });
    throw err;
  }
}

export async function findUserForAuth(loginIdentifier: string): Promise<User | null> {
  try {
    const user = await db.select()
      .from(users)
      .where(sql`email = ${loginIdentifier} OR username = ${loginIdentifier}`)
      .limit(1);

    return user[0] || null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error finding user', { error: err.message });
    throw err;
  }
}

export async function getDealershipUsers(
  dealershipId: number,
  includeUnverified: boolean = false
): Promise<User[]> {
  try {
    const query = db.select()
      .from(users)
      .where(eq(users.dealership_id, dealershipId));

    if (!includeUnverified) {
      query.where(eq(users.is_verified, true));
    }

    return await query.execute();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching users', { error: err.message });
    throw err;
  }
}

export async function searchConversations(
  dealershipId: number,
  searchTerm: string,
  limit: number = 20
): Promise<ConversationResult[]> {
  try {
    const pattern = `%${searchTerm}%`;
    const results = await db.select()
      .from(sql`conversations`)
      .where(sql`
        dealership_id = ${dealershipId}
        AND (
          customer_name ILIKE ${pattern}
          OR customer_email ILIKE ${pattern}
          OR customer_phone ILIKE ${pattern}
        )
      `)
      .limit(limit);

    return results.map(conv => ({
      id: conv.id,
      customerName: conv.customer_name,
      customerEmail: conv.customer_email,
      customerPhone: conv.customer_phone,
      status: conv.status,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      messageCount: 0
    }));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error searching', { error: err.message });
    throw err;
  }
}

export async function getConversationAnalytics(
  dealershipId: number,
  startDate: Date,
  endDate: Date
): Promise<any[]> {
  try {
    return await db.select({
      date: sql`date(created_at)`,
      totalConversations: sql`count(distinct id)`,
      messagesCount: sql`count(*)`
    })
      .from(sql`conversations`)
      .where(sql`
        dealership_id = ${dealershipId}
        AND created_at >= ${startDate.toISOString()}
        AND created_at <= ${endDate.toISOString()}
      `)
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`)
      .execute();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Error fetching analytics', { error: err.message });
    throw err;
  }
}