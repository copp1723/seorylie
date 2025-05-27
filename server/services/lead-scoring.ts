/**
 * Service for lead scoring based on engagement, urgency, and buyer signals
 */
import { db } from '../db';
import { messages, conversations } from '../../shared/lead-management-schema';
import { leadScores } from '../../shared/schema-extensions';
import { eq, and, desc } from 'drizzle-orm';

interface LeadScoreFactors {
  urgencySignals: number;
  engagementLevel: number;
  buyerSignals: number;
  specificQuestions: number;
}

/**
 * Calculate a lead score for a conversation
 */
export async function calculateLeadScore(conversationId: number): Promise<number> {
  // Get conversation messages
  const messageHistory = await db.select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  const factors: LeadScoreFactors = {
    urgencySignals: 0,
    engagementLevel: 0,
    buyerSignals: 0,
    specificQuestions: 0
  };

  // Analyze customer messages for scoring factors
  const customerMessages = messageHistory.filter(msg => msg.role === 'customer');

  // Score urgency signals
  const urgencyKeywords = ['today', 'asap', 'soon', 'urgent', 'immediately', 'quickly', 'hurry'];
  factors.urgencySignals = countKeywordMatches(customerMessages, urgencyKeywords) * 5;

  // Score engagement level (based on message count and length)
  factors.engagementLevel = Math.min(customerMessages.length * 2, 20);

  // Add points for longer messages
  const longMessages = customerMessages.filter(msg => msg.content.length > 100).length;
  factors.engagementLevel += longMessages * 2;

  // Score buyer signals
  const buyerKeywords = [
    'price', 'offer', 'deal', 'buy', 'purchase', 'test drive', 'financing',
    'payment', 'interest rate', 'down payment', 'trade-in', 'warranty'
  ];
  factors.buyerSignals = countKeywordMatches(customerMessages, buyerKeywords) * 4;

  // Score specific questions
  factors.specificQuestions = customerMessages.filter(msg =>
    msg.content.includes('?') ||
    msg.content.toLowerCase().startsWith('how') ||
    msg.content.toLowerCase().startsWith('what') ||
    msg.content.toLowerCase().startsWith('when') ||
    msg.content.toLowerCase().startsWith('where') ||
    msg.content.toLowerCase().startsWith('can')
  ).length * 3;

  // Calculate total score (0-100)
  const totalScore = Math.min(
    factors.urgencySignals +
    factors.engagementLevel +
    factors.buyerSignals +
    factors.specificQuestions,
    100
  );

  // Store the score
  await db.insert(leadScores).values({
    conversationId,
    score: totalScore,
    factors
  }).onConflictDoUpdate({
    target: [leadScores.conversationId],
    set: {
      score: totalScore,
      factors,
      updatedAt: new Date()
    }
  });

  return totalScore;
}

/**
 * Get the lead score for a conversation
 */
export async function getLeadScore(conversationId: number): Promise<{
  score: number;
  factors: LeadScoreFactors;
} | null> {
  const [score] = await db.select()
    .from(leadScores)
    .where(eq(leadScores.conversationId, conversationId));

  if (!score) {
    // Calculate score if it doesn't exist
    const newScore = await calculateLeadScore(conversationId);
    const [createdScore] = await db.select()
      .from(leadScores)
      .where(eq(leadScores.conversationId, conversationId));

    return createdScore ? {
      score: createdScore.score,
      factors: createdScore.factors as LeadScoreFactors
    } : null;
  }

  return {
    score: score.score,
    factors: score.factors as LeadScoreFactors
  };
}

/**
 * Get top leads for a dealership
 */
export async function getTopLeads(dealershipId: number, limit: number = 10): Promise<{
  conversationId: number;
  score: number;
  customerName?: string;
  lastMessage?: Date;
}[]> {
  const results = await db.select({
    conversationId: leadScores.conversationId,
    score: leadScores.score,
    customerName: conversations.subject,
    lastMessage: conversations.updatedAt
  })
  .from(leadScores)
  .innerJoin(conversations, eq(leadScores.conversationId, conversations.id))
  .where(and(
    eq(conversations.dealershipId, dealershipId),
    eq(conversations.status, 'active')
  ))
  .orderBy(desc(leadScores.score))
  .limit(limit);

  return results;
}

/**
 * Helper function to count keyword matches in messages
 */
function countKeywordMatches(messages: any[], keywords: string[]): number {
  let count = 0;
  messages.forEach(msg => {
    const content = msg.content.toLowerCase();
    keywords.forEach(keyword => {
      if (content.includes(keyword.toLowerCase())) count++;
    });
  });
  return count;
}