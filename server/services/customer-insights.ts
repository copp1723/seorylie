/**
 * Service for extended customer insights and journey tracking
 */
import { db } from "../db";
import {
  customerProfiles,
  customerInteractions,
} from "../../shared/schema-extensions";
import { conversations, messages } from "../../shared/lead-management-schema";
import { customers } from "../../shared/enhanced-schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

// Initialize OpenAI conditionally
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

/**
 * Get or create a customer profile
 */
export async function getOrCreateCustomerProfile(
  dealershipId: number,
  customerId?: number,
  customerData?: {
    name?: string;
    email?: string;
    phone?: string;
  },
) {
  // If we have a customer ID, try to find an existing profile
  if (customerId) {
    const [existingProfile] = await db
      .select()
      .from(customerProfiles)
      .where(
        and(
          eq(customerProfiles.dealershipId, dealershipId),
          eq(customerProfiles.customerId, customerId),
        ),
      );

    if (existingProfile) {
      // Update with any new data
      if (customerData) {
        await db
          .update(customerProfiles)
          .set({
            name: customerData.name || existingProfile.name,
            email: customerData.email || existingProfile.email,
            phone: customerData.phone || existingProfile.phone,
            updatedAt: new Date(),
          })
          .where(eq(customerProfiles.id, existingProfile.id));

        // Refresh the profile
        const [updatedProfile] = await db
          .select()
          .from(customerProfiles)
          .where(eq(customerProfiles.id, existingProfile.id));

        return updatedProfile;
      }

      return existingProfile;
    }
  }

  // If no existing profile or no customer ID, create a new one
  const [newProfile] = await db
    .insert(customerProfiles)
    .values({
      dealershipId,
      customerId,
      name: customerData?.name || null,
      email: customerData?.email || null,
      phone: customerData?.phone || null,
      preferences: {},
      lastInteraction: new Date(),
    })
    .returning();

  return newProfile;
}

/**
 * Record a customer interaction
 */
export async function recordCustomerInteraction(
  profileId: number,
  conversationId: number,
  interactionType: string,
  details: Record<string, any> = {},
) {
  const [interaction] = await db
    .insert(customerInteractions)
    .values({
      profileId,
      conversationId,
      interactionType,
      details,
    })
    .returning();

  // Update last interaction time on profile
  await db
    .update(customerProfiles)
    .set({
      lastInteraction: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(customerProfiles.id, profileId));

  return interaction;
}

/**
 * Get customer journey (all interactions)
 */
export async function getCustomerJourney(profileId: number) {
  return db
    .select()
    .from(customerInteractions)
    .where(eq(customerInteractions.profileId, profileId))
    .orderBy(desc(customerInteractions.createdAt));
}

/**
 * Analyze customer preferences from conversation history
 */
export async function analyzeCustomerPreferences(
  profileId: number,
  conversationId?: number,
): Promise<Record<string, any>> {
  // Get the profile
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.id, profileId));

  if (!profile) {
    throw new Error("Customer profile not found");
  }

  // Get all conversations for this profile
  const interactions = await db
    .select({
      conversationId: customerInteractions.conversationId,
    })
    .from(customerInteractions)
    .where(eq(customerInteractions.profileId, profileId));

  const conversationIds = conversationId
    ? [conversationId]
    : [...new Set(interactions.map((i) => i.conversationId))];

  if (conversationIds.length === 0) {
    return profile.preferences as Record<string, any>;
  }

  // Get messages from all conversations
  const allMessages = [];
  for (const convId of conversationIds) {
    if (!convId) continue;

    const conversationMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(messages.createdAt);

    allMessages.push(...conversationMessages);
  }

  if (allMessages.length === 0) {
    return profile.preferences as Record<string, any>;
  }

  // Format conversation history for OpenAI
  const formattedHistory = allMessages.map((msg) => ({
    role: msg.role === "customer" ? "user" : "assistant",
    content: msg.content,
  }));

  // Use OpenAI to extract preferences
  try {
    if (!openai) {
      console.warn("OpenAI not configured - returning existing preferences");
      return profile.preferences as Record<string, any>;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze this customer's conversation history and extract their preferences and buying signals.
          Focus on vehicle preferences, budget constraints, timeline for purchase, and any lifestyle needs.
          Return the results as a JSON object with the following structure:
          {
            "vehicle_preferences": {
              "type": ["SUV", "Sedan", etc],
              "features": ["sunroof", "leather seats", etc],
              "brands": ["Toyota", "Honda", etc]
            },
            "budget": {
              "min": number or null,
              "max": number or null,
              "financing_preferred": boolean
            },
            "timeline": {
              "urgency": "immediate|soon|researching",
              "estimated_purchase_date": "string or null"
            },
            "lifestyle": {
              "family_size": number or null,
              "activities": ["string"],
              "priorities": ["safety", "fuel economy", etc]
            }
          }`,
        },
        ...formattedHistory,
      ],
      response_format: { type: "json_object" },
    });

    const preferences = JSON.parse(response.choices[0].message.content || "{}");

    // Merge with existing preferences
    const mergedPreferences = {
      ...profile.preferences,
      ...preferences,
    };

    // Update the profile with new preferences
    await db
      .update(customerProfiles)
      .set({
        preferences: mergedPreferences,
        updatedAt: new Date(),
      })
      .where(eq(customerProfiles.id, profileId));

    return mergedPreferences;
  } catch (error) {
    console.error("Error analyzing customer preferences:", error);
    return profile.preferences as Record<string, any>;
  }
}

/**
 * Predict buying window for a customer
 */
export async function predictBuyingWindow(profileId: number): Promise<{
  likelihood: number;
  timeframe: string;
  confidence: number;
}> {
  // Get the profile with preferences
  const [profile] = await db
    .select()
    .from(customerProfiles)
    .where(eq(customerProfiles.id, profileId));

  if (!profile) {
    throw new Error("Customer profile not found");
  }

  // Get interaction history
  const interactions = await getCustomerJourney(profileId);

  // Default prediction
  const defaultPrediction = {
    likelihood: 0.3,
    timeframe: "unknown",
    confidence: 0.2,
  };

  // If we have preferences and interactions, make a prediction
  if (profile.preferences && interactions.length > 0) {
    const preferences = profile.preferences as Record<string, any>;

    // Simple heuristic-based prediction
    if (preferences.timeline?.urgency === "immediate") {
      return {
        likelihood: 0.8,
        timeframe: "0-7 days",
        confidence: 0.7,
      };
    } else if (preferences.timeline?.urgency === "soon") {
      return {
        likelihood: 0.6,
        timeframe: "1-4 weeks",
        confidence: 0.6,
      };
    } else if (preferences.timeline?.estimated_purchase_date) {
      // Parse the date and calculate timeframe
      try {
        const purchaseDate = new Date(
          preferences.timeline.estimated_purchase_date,
        );
        const now = new Date();
        const daysDiff = Math.floor(
          (purchaseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff <= 7) {
          return {
            likelihood: 0.75,
            timeframe: "0-7 days",
            confidence: 0.65,
          };
        } else if (daysDiff <= 30) {
          return {
            likelihood: 0.6,
            timeframe: "1-4 weeks",
            confidence: 0.6,
          };
        } else if (daysDiff <= 90) {
          return {
            likelihood: 0.4,
            timeframe: "1-3 months",
            confidence: 0.5,
          };
        } else {
          return {
            likelihood: 0.2,
            timeframe: "3+ months",
            confidence: 0.4,
          };
        }
      } catch (e) {
        // If date parsing fails, use default
        return defaultPrediction;
      }
    }

    // Check interaction frequency
    const recentInteractions = interactions.filter((i) => {
      const interactionDate = new Date(i.createdAt);
      const now = new Date();
      const daysDiff = Math.floor(
        (now.getTime() - interactionDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return daysDiff <= 7;
    });

    if (recentInteractions.length >= 3) {
      return {
        likelihood: 0.7,
        timeframe: "1-2 weeks",
        confidence: 0.6,
      };
    } else if (recentInteractions.length >= 1) {
      return {
        likelihood: 0.5,
        timeframe: "2-4 weeks",
        confidence: 0.5,
      };
    }
  }

  return defaultPrediction;
}
