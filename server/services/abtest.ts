/**
 * A/B Testing Service for Prompt Optimization
 *
 * This service manages experiment variants, allocates traffic, and tracks metrics
 * to help optimize Rylie's prompt templates.
 */

import db from "../db";
import {
  promptExperiments,
  promptVariants,
  experimentVariants,
  promptMetrics,
  conversations,
  messages,
} from "../../shared/schema";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";

// Types
export interface ABTestContext {
  dealershipId: number;
  conversationId?: number;
  customerId?: string;
  experimentId?: number;
}

export interface PromptVariant {
  id: number;
  name: string;
  promptTemplate: string;
  isControl: boolean;
}

/**
 * Select a prompt variant for a conversation based on active experiments
 */
export async function selectPromptVariant(
  context: ABTestContext,
): Promise<PromptVariant | null> {
  try {
    // If we already have an experimentId, return the variant used in that experiment
    if (context.experimentId && context.conversationId) {
      // Check if we've already assigned a variant to this conversation in the metrics
      const existingMetric = await db
        .select()
        .from(promptMetrics)
        .where(eq(promptMetrics.conversationId, context.conversationId))
        .limit(1);

      if (existingMetric.length > 0 && existingMetric[0].variantId) {
        // Return the previously assigned variant
        const [variant] = await db
          .select()
          .from(promptVariants)
          .where(eq(promptVariants.id, existingMetric[0].variantId));

        return variant || null;
      }
    }

    // Otherwise, find all active experiments for this dealership
    const now = new Date();
    const activeExperiments = await db
      .select()
      .from(promptExperiments)
      .where(
        and(
          eq(promptExperiments.dealershipId, context.dealershipId),
          eq(promptExperiments.isActive, true),
          lte(promptExperiments.startDate, now),
          sql`${promptExperiments.endDate} IS NULL OR ${promptExperiments.endDate} >= ${now}`,
        ),
      );

    if (activeExperiments.length === 0) {
      // No active experiments, fall back to the default/control prompt for the dealership
      const [defaultVariant] = await db
        .select()
        .from(promptVariants)
        .where(
          and(
            eq(promptVariants.dealershipId, context.dealershipId),
            eq(promptVariants.isControl, true),
            eq(promptVariants.isActive, true),
          ),
        )
        .limit(1);

      if (defaultVariant) {
        return defaultVariant;
      }

      // If no default/control, just get any active variant
      const [anyVariant] = await db
        .select()
        .from(promptVariants)
        .where(
          and(
            eq(promptVariants.dealershipId, context.dealershipId),
            eq(promptVariants.isActive, true),
          ),
        )
        .limit(1);

      return anyVariant || null;
    }

    // Pick a random active experiment
    const selectedExperiment =
      activeExperiments[Math.floor(Math.random() * activeExperiments.length)];

    // Get all variants for this experiment with their traffic allocation
    const variantsWithAllocation = await db
      .select({
        experiment: experimentVariants,
        variant: promptVariants,
      })
      .from(experimentVariants)
      .innerJoin(
        promptVariants,
        eq(experimentVariants.variantId, promptVariants.id),
      )
      .where(
        and(
          eq(experimentVariants.experimentId, selectedExperiment.id),
          eq(promptVariants.isActive, true),
        ),
      );

    if (variantsWithAllocation.length === 0) {
      // No variants for this experiment, fall back to default
      return null;
    }

    // Perform weighted random selection based on traffic allocation
    const totalAllocation = variantsWithAllocation.reduce(
      (sum, { experiment }) => sum + (experiment.trafficAllocation || 50),
      0,
    );

    let randomPoint = Math.random() * totalAllocation;
    let selectedVariant = variantsWithAllocation[0].variant; // Default to first in case of issues

    for (const { experiment, variant } of variantsWithAllocation) {
      const allocation = experiment.trafficAllocation || 50;
      if (randomPoint <= allocation) {
        selectedVariant = variant;
        break;
      }
      randomPoint -= allocation;
    }

    // If a conversation ID is provided, record which variant was selected
    if (context.conversationId && selectedVariant) {
      recordExperimentAssignment(
        selectedExperiment.id,
        selectedVariant.id,
        context.conversationId,
      );
    }

    return selectedVariant;
  } catch (error) {
    console.error("Error selecting prompt variant:", error);
    return null;
  }
}

/**
 * Record which experiment and variant were assigned to a conversation
 */
async function recordExperimentAssignment(
  experimentId: number,
  variantId: number,
  conversationId: number,
) {
  try {
    // Get the first message in the conversation to use for metrics
    const [firstMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(1);

    if (!firstMessage) {
      console.error("No messages found for conversation:", conversationId);
      return;
    }

    // Store assignment in metrics table
    await db.insert(promptMetrics).values({
      variantId,
      conversationId,
      messageId: firstMessage.id,
      // Other fields will be updated later when we have more data
    });
  } catch (error) {
    console.error("Error recording experiment assignment:", error);
  }
}

/**
 * Record metrics for a prompt variant used in a conversation
 */
export async function recordPromptMetrics(
  variantId: number,
  conversationId: number,
  messageId: number,
  metrics: {
    responseTime?: number;
    tokensUsed?: number;
    customerMessageLength?: number;
    assistantResponseLength?: number;
    wasEscalated?: boolean;
    wasSuccessful?: boolean;
    customerRating?: number;
  },
) {
  try {
    // Check if we already have an entry for this variant and conversation
    const [existingMetric] = await db
      .select()
      .from(promptMetrics)
      .where(
        and(
          eq(promptMetrics.variantId, variantId),
          eq(promptMetrics.conversationId, conversationId),
        ),
      );

    if (existingMetric) {
      // Update existing metric
      await db
        .update(promptMetrics)
        .set({
          messageId, // Update to the latest message
          responseTime: metrics.responseTime,
          tokensUsed: metrics.tokensUsed,
          customerMessageLength: metrics.customerMessageLength,
          assistantResponseLength: metrics.assistantResponseLength,
          wasEscalated: metrics.wasEscalated,
          wasSuccessful: metrics.wasSuccessful,
          customerRating: metrics.customerRating,
        })
        .where(eq(promptMetrics.id, existingMetric.id));
    } else {
      // Insert new metric
      await db.insert(promptMetrics).values({
        variantId,
        conversationId,
        messageId,
        responseTime: metrics.responseTime,
        tokensUsed: metrics.tokensUsed,
        customerMessageLength: metrics.customerMessageLength,
        assistantResponseLength: metrics.assistantResponseLength,
        wasEscalated: metrics.wasEscalated,
        wasSuccessful: metrics.wasSuccessful,
        customerRating: metrics.customerRating,
      });
    }
  } catch (error) {
    console.error("Error recording prompt metrics:", error);
  }
}

/**
 * Create a new A/B test experiment
 */
export async function createExperiment(
  dealershipId: number,
  data: {
    name: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    isActive?: boolean;
    variantAssignments: Array<{
      variantId: number;
      trafficAllocation: number;
    }>;
  },
) {
  try {
    // Validate the traffic allocations sum to 100
    const totalAllocation = data.variantAssignments.reduce(
      (sum, assignment) => sum + assignment.trafficAllocation,
      0,
    );

    if (totalAllocation !== 100) {
      throw new Error(
        `Traffic allocations must sum to 100%, got ${totalAllocation}%`,
      );
    }

    // Create the experiment
    const [experiment] = await db
      .insert(promptExperiments)
      .values({
        dealershipId,
        name: data.name,
        description: data.description,
        startDate: data.startDate || new Date(),
        endDate: data.endDate,
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .returning();

    // Add variant assignments
    for (const assignment of data.variantAssignments) {
      await db.insert(experimentVariants).values({
        experimentId: experiment.id,
        variantId: assignment.variantId,
        trafficAllocation: assignment.trafficAllocation,
      });
    }

    return experiment;
  } catch (error) {
    console.error("Error creating experiment:", error);
    throw error;
  }
}

/**
 * Get the results of an experiment
 */
export async function getExperimentResults(experimentId: number) {
  try {
    // Get the experiment
    const [experiment] = await db
      .select()
      .from(promptExperiments)
      .where(eq(promptExperiments.id, experimentId));

    if (!experiment) {
      throw new Error(`Experiment not found: ${experimentId}`);
    }

    // Get all variants used in this experiment
    const variantsInExperiment = await db
      .select({
        experiment: experimentVariants,
        variant: promptVariants,
      })
      .from(experimentVariants)
      .innerJoin(
        promptVariants,
        eq(experimentVariants.variantId, promptVariants.id),
      )
      .where(eq(experimentVariants.experimentId, experimentId));

    // For each variant, get the metrics
    const results = [];

    for (const { variant, experiment: expVariant } of variantsInExperiment) {
      const metrics = await db
        .select()
        .from(promptMetrics)
        .where(eq(promptMetrics.variantId, variant.id));

      // Calculate aggregate metrics
      const totalInteractions = metrics.length;
      const avgResponseTime =
        metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) /
        (metrics.filter((m) => m.responseTime !== null).length || 1);
      const avgTokensUsed =
        metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0) /
        (metrics.filter((m) => m.tokensUsed !== null).length || 1);
      const escalationRate =
        metrics.filter((m) => m.wasEscalated).length / (totalInteractions || 1);
      const successRate =
        metrics.filter((m) => m.wasSuccessful).length /
        (metrics.filter((m) => m.wasSuccessful !== undefined).length || 1);

      // Calculate average customer rating if available
      const ratedMetrics = metrics.filter((m) => m.customerRating !== null);
      const avgCustomerRating =
        ratedMetrics.length > 0
          ? ratedMetrics.reduce((sum, m) => sum + (m.customerRating || 0), 0) /
            ratedMetrics.length
          : null;

      results.push({
        variant: {
          id: variant.id,
          name: variant.name,
          isControl: variant.isControl,
          trafficAllocation: expVariant.trafficAllocation,
        },
        metrics: {
          totalInteractions,
          avgResponseTime,
          avgTokensUsed,
          escalationRate,
          successRate,
          avgCustomerRating,
        },
      });
    }

    return {
      experiment,
      results,
    };
  } catch (error) {
    console.error("Error getting experiment results:", error);
    throw error;
  }
}

/**
 * Create a new prompt variant
 */
export async function createPromptVariant(
  dealershipId: number,
  data: {
    name: string;
    description?: string;
    promptTemplate: string;
    isControl?: boolean;
    isActive?: boolean;
  },
) {
  try {
    // If setting as control, update other variants to not be control
    if (data.isControl) {
      await db
        .update(promptVariants)
        .set({ isControl: false })
        .where(
          and(
            eq(promptVariants.dealershipId, dealershipId),
            eq(promptVariants.isControl, true),
          ),
        );
    }

    // Create the variant
    const [variant] = await db
      .insert(promptVariants)
      .values({
        dealershipId,
        name: data.name,
        description: data.description,
        promptTemplate: data.promptTemplate,
        isControl: data.isControl !== undefined ? data.isControl : false,
        isActive: data.isActive !== undefined ? data.isActive : true,
      })
      .returning();

    return variant;
  } catch (error) {
    console.error("Error creating prompt variant:", error);
    throw error;
  }
}

/**
 * Get prompt variants for a dealership
 */
export async function getPromptVariants(
  dealershipId: number,
  includeInactive = false,
) {
  try {
    let query = db
      .select()
      .from(promptVariants)
      .where(eq(promptVariants.dealershipId, dealershipId));

    if (!includeInactive) {
      query = query.where(eq(promptVariants.isActive, true));
    }

    const variants = await query;
    return variants;
  } catch (error) {
    console.error("Error getting prompt variants:", error);
    throw error;
  }
}

/**
 * Get active experiments for a dealership
 */
export async function getActiveExperiments(dealershipId: number) {
  try {
    const now = new Date();
    const activeExperiments = await db
      .select()
      .from(promptExperiments)
      .where(
        and(
          eq(promptExperiments.dealershipId, dealershipId),
          eq(promptExperiments.isActive, true),
          lte(promptExperiments.startDate, now),
          sql`${promptExperiments.endDate} IS NULL OR ${promptExperiments.endDate} >= ${now}`,
        ),
      );

    return activeExperiments;
  } catch (error) {
    console.error("Error getting active experiments:", error);
    throw error;
  }
}

/**
 * End an experiment and record conclusions
 */
export async function endExperiment(
  experimentId: number,
  conclusionNotes?: string,
) {
  try {
    await db
      .update(promptExperiments)
      .set({
        isActive: false,
        endDate: new Date(),
        conclusionNotes,
      })
      .where(eq(promptExperiments.id, experimentId));

    return true;
  } catch (error) {
    console.error("Error ending experiment:", error);
    throw error;
  }
}

/**
 * Rate a conversation for A/B testing feedback
 */
export async function rateConversation(
  conversationId: number,
  rating: number,
  wasSuccessful: boolean,
) {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Find the metric for this conversation
    const [metric] = await db
      .select()
      .from(promptMetrics)
      .where(eq(promptMetrics.conversationId, conversationId));

    if (!metric) {
      console.error("No metric found for conversation:", conversationId);
      return false;
    }

    // Update the metric
    await db
      .update(promptMetrics)
      .set({
        customerRating: rating,
        wasSuccessful,
      })
      .where(eq(promptMetrics.id, metric.id));

    return true;
  } catch (error) {
    console.error("Error rating conversation:", error);
    return false;
  }
}
