import db from "../db";
import { eq, and, sql } from "drizzle-orm";
import { users, dealerships } from "../../shared/schema";
import { conversations, messages } from "../../shared/schema";
import logger from "../utils/logger";
import { cacheService, createCacheKey } from "./unified-cache-service";
import type { User } from "../../shared/schema";

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
  status?: string,
): Promise<PaginatedConversations> {
  const offset = (page - 1) * limit;

  // Build dynamic WHERE conditions
  const conditions = [eq(conversations.dealershipId, dealershipId)] as const;
  const whereClause = status
    ? and(...conditions, eq(conversations.status, status))
    : and(...conditions);

  // Query paginated rows & total count in parallel
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(conversations)
      .where(whereClause)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql`COUNT(${conversations.id})`.as("total") })
      .from(conversations)
      .where(whereClause),
  ]);

  return {
    conversations: rows.map((conv) => ({
      id: conv.id,
      customerName: conv.customerName,
      customerEmail: conv.customerEmail,
      customerPhone: conv.customerPhone,
      status: conv.status,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messageCount ?? 0,
    })),
    total: Number(total ?? 0),
    page,
    limit,
    totalPages: Math.ceil(Number(total ?? 0) / limit),
  };
}

export async function getConversationWithMessages(
  conversationId: number,
  messageLimit: number = 50,
): Promise<ConversationWithMessages | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conversation) return null;

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(sql`${messages.createdAt} desc`)
    .limit(messageLimit);

  return {
    id: conversation.id,
    customerName: conversation.customerName,
    customerEmail: conversation.customerEmail,
    customerPhone: conversation.customerPhone,
    status: conversation.status,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messageCount ?? 0,
    messages: rows
      .map((msg) => ({
        id: msg.id,
        content: msg.content,
        isFromCustomer: msg.isFromCustomer,
        createdAt: msg.createdAt,
        metadata: msg.metadata,
      }))
      .reverse(),
  };
}

export async function getConversationCountsByStatus(
  dealershipId: number,
): Promise<Record<string, number>> {
  const results = await db
    .select({
      status: conversations.status,
      count: sql`COUNT(${conversations.id})`.as("count"),
    })
    .from(conversations)
    .where(eq(conversations.dealershipId, dealershipId))
    .groupBy(conversations.status);

  return results.reduce(
    (acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    },
    {} as Record<string, number>,
  );
}

export async function findUserForAuth(
  loginIdentifier: string,
): Promise<User | null> {
  try {
    const user = await db
      .select()
      .from(users)
      .where(sql`email = ${loginIdentifier} OR username = ${loginIdentifier}`)
      .limit(1);

    return user[0] || null;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error finding user", { error: err.message });
    throw err;
  }
}

export async function getDealershipUsers(
  dealershipId: number,
  includeUnverified: boolean = false,
): Promise<User[]> {
  try {
    const query = db
      .select()
      .from(users)
      .where(eq(users.dealership_id, dealershipId));

    if (!includeUnverified) {
      query.where(eq(users.is_verified, true));
    }

    return await query.execute();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error fetching users", { error: err.message });
    throw err;
  }
}

export async function searchConversations(
  dealershipId: number,
  searchTerm: string,
  limit: number = 20,
): Promise<ConversationResult[]> {
  try {
    const pattern = `%${searchTerm}%`;
    const results = await db
      .select()
      .from(conversations)
      .where(
        sql`
        ${conversations.dealershipId} = ${dealershipId}
        AND (
          ${conversations.customerName} ILIKE ${pattern}
          OR ${conversations.customerEmail} ILIKE ${pattern}
          OR ${conversations.customerPhone} ILIKE ${pattern}
        )
      `,
      )
      .limit(limit);

    return results.map((conv) => ({
      id: conv.id,
      customerName: conv.customerName,
      customerEmail: conv.customerEmail,
      customerPhone: conv.customerPhone,
      status: conv.status,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messageCount: 0,
    }));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error searching", { error: err.message });
    throw err;
  }
}

export async function getConversationAnalytics(
  dealershipId: number,
  startDate: Date,
  endDate: Date,
): Promise<any[]> {
  try {
    return await db
      .select({
        date: sql`date(${conversations.createdAt})`,
        totalConversations: sql`count(distinct ${conversations.id})`,
        messagesCount: sql`count(*)`,
      })
      .from(conversations)
      .where(
        sql`
        ${conversations.dealershipId} = ${dealershipId}
        AND ${conversations.createdAt} >= ${startDate.toISOString()}
        AND ${conversations.createdAt} <= ${endDate.toISOString()}
      `,
      )
      .groupBy(sql`date(${conversations.createdAt})`)
      .orderBy(sql`date(${conversations.createdAt})`)
      .execute();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error fetching analytics", { error: err.message });
    throw err;
  }
}
