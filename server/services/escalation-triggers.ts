/**
 * Service for managing customizable escalation triggers
 */
import { db } from '../db';
import { escalationTriggers } from '../../shared/schema-extensions';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

// Initialize OpenAI conditionally
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

export interface TriggerCondition {
  type: 'sentiment' | 'urgency' | 'repeated_questions' | 'keyword' | 'custom';
  value: string | number | string[];
  threshold?: number;
}

/**
 * Get all escalation triggers for a dealership
 */
export async function getEscalationTriggers(dealershipId: number) {
  return db.select().from(escalationTriggers)
    .where(eq(escalationTriggers.dealershipId, dealershipId));
}

/**
 * Create a new escalation trigger
 */
export async function createEscalationTrigger(data: {
  dealershipId: number;
  name: string;
  description?: string;
  conditions: TriggerCondition[];
  isActive?: boolean;
}) {
  const [trigger] = await db.insert(escalationTriggers).values({
    dealershipId: data.dealershipId,
    name: data.name,
    description: data.description,
    conditions: data.conditions,
    isActive: data.isActive ?? true
  }).returning();

  return trigger;
}

/**
 * Update an existing escalation trigger
 */
export async function updateEscalationTrigger(
  triggerId: number,
  data: Partial<{
    name: string;
    description: string;
    conditions: TriggerCondition[];
    isActive: boolean;
  }>
) {
  const [updatedTrigger] = await db.update(escalationTriggers)
    .set({
      ...data,
      updatedAt: new Date()
    })
    .where(eq(escalationTriggers.id, triggerId))
    .returning();

  return updatedTrigger;
}

/**
 * Delete an escalation trigger
 */
export async function deleteEscalationTrigger(triggerId: number) {
  await db.delete(escalationTriggers)
    .where(eq(escalationTriggers.id, triggerId));

  return { success: true };
}

/**
 * Analyze conversation sentiment
 */
async function analyzeSentiment(messages: { content: string, isFromCustomer: boolean }[]): Promise<number> {
  // Only analyze customer messages
  const customerMessages = messages
    .filter(msg => msg.isFromCustomer)
    .map(msg => msg.content)
    .join('\n');

  if (!customerMessages) return 0.5; // Neutral if no customer messages

  try {
    if (!openai) {
      console.warn("OpenAI not configured - returning neutral sentiment");
      return 0.5;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Analyze the sentiment of the following customer messages. Return a single number between 0 and 1, where 0 is extremely negative, 0.5 is neutral, and 1 is extremely positive."
        },
        {
          role: "user",
          content: customerMessages
        }
      ]
    });

    const sentimentText = response.choices[0].message.content?.trim() || "0.5";
    const sentimentMatch = sentimentText.match(/(\d+\.\d+|\d+)/);

    if (sentimentMatch) {
      const sentiment = parseFloat(sentimentMatch[0]);
      return Math.max(0, Math.min(1, sentiment)); // Ensure between 0 and 1
    }

    return 0.5; // Default to neutral
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return 0.5; // Default to neutral on error
  }
}

/**
 * Detect repeated questions in conversation
 */
function detectRepeatedQuestions(messages: { content: string, isFromCustomer: boolean }[]): number {
  const customerMessages = messages.filter(msg => msg.isFromCustomer);
  const questions = customerMessages
    .filter(msg => msg.content.includes('?'))
    .map(msg => msg.content.toLowerCase());

  // Simple algorithm to detect similar questions
  const repeatedCount = questions.reduce((count, question, index) => {
    for (let i = 0; i < index; i++) {
      // Check for similarity (contains similar words)
      const words1 = new Set(question.split(/\s+/).filter(w => w.length > 3));
      const words2 = new Set(questions[i].split(/\s+/).filter(w => w.length > 3));

      // Count common words
      const commonWords = [...words1].filter(word => words2.has(word));

      // If enough common words, consider it a repeated question
      if (commonWords.length >= 3 || (commonWords.length >= 2 && words1.size < 5)) {
        count++;
        break;
      }
    }
    return count;
  }, 0);

  return repeatedCount;
}

/**
 * Evaluate all triggers for a conversation to determine if escalation is needed
 */
export async function evaluateEscalationTriggers(
  dealershipId: number,
  conversationData: {
    messages: { content: string, isFromCustomer: boolean }[]
  }
): Promise<{ shouldEscalate: boolean; reason?: string; description?: string }> {
  const triggers = await getEscalationTriggers(dealershipId);

  if (!triggers.length) {
    return { shouldEscalate: false };
  }

  // Analyze conversation data once for all triggers
  const sentiment = await analyzeSentiment(conversationData.messages);
  const repeatedQuestions = detectRepeatedQuestions(conversationData.messages);

  // Enhanced conversation data with analysis results
  const enhancedData = {
    ...conversationData,
    sentiment,
    repeatedQuestions
  };

  // Evaluate each trigger
  for (const trigger of triggers) {
    if (!trigger.isActive) continue;

    const conditions = trigger.conditions as TriggerCondition[];
    const shouldEscalate = conditions.every(condition => {
      switch(condition.type) {
        case 'sentiment':
          return enhancedData.sentiment <= (condition.threshold || 0.3);

        case 'urgency':
          return conversationData.messages.some(msg =>
            msg.isFromCustomer &&
            msg.content.toLowerCase().includes(condition.value as string)
          );

        case 'repeated_questions':
          return enhancedData.repeatedQuestions >= (condition.threshold || 2);

        case 'keyword':
          const keywords = Array.isArray(condition.value) ? condition.value : [condition.value];
          return conversationData.messages.some(msg =>
            msg.isFromCustomer &&
            keywords.some(keyword =>
              msg.content.toLowerCase().includes((keyword as string).toLowerCase())
            )
          );

        case 'custom':
          // Custom logic would go here
          return false;

        default:
          return false;
      }
    });

    if (shouldEscalate) {
      return {
        shouldEscalate: true,
        reason: trigger.name,
        description: trigger.description || undefined
      };
    }
  }

  return { shouldEscalate: false };
}