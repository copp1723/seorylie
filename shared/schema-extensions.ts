import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  json,
  unique,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { dealerships, users } from "./enhanced-schema";
import { conversations, customers } from "./lead-management-schema";

// Escalation triggers for customizable handover logic
export const escalationTriggers = pgTable(
  "escalation_triggers",
  {
    id: serial("id").primaryKey(),
    dealershipId: integer("dealership_id")
      .notNull()
      .references(() => dealerships.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    conditions: json("conditions")
      .$type<
        {
          type:
            | "sentiment"
            | "urgency"
            | "repeated_questions"
            | "keyword"
            | "custom";
          value: string | number | string[];
          threshold?: number;
        }[]
      >()
      .default([]),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    dealershipIdx: index("trigger_dealership_idx").on(table.dealershipId),
  }),
);

// Lead scoring system
export const leadScores = pgTable(
  "lead_scores",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    factors: json("factors")
      .$type<{
        urgencySignals: number;
        engagementLevel: number;
        buyerSignals: number;
        specificQuestions: number;
      }>()
      .default({
        urgencySignals: 0,
        engagementLevel: 0,
        buyerSignals: 0,
        specificQuestions: 0,
      }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    conversationIdx: index("score_conversation_idx").on(table.conversationId),
    uniqueConversation: unique("unique_conversation_score").on(
      table.conversationId,
    ),
  }),
);

// Follow-up scheduling
export const followUps = pgTable(
  "follow_ups",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    dealershipId: integer("dealership_id")
      .notNull()
      .references(() => dealerships.id, { onDelete: "cascade" }),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    customerContact: varchar("customer_contact", { length: 255 }),
    assignedTo: integer("assigned_to").references(() => users.id),
    scheduledTime: timestamp("scheduled_time").notNull(),
    notes: text("notes"),
    status: varchar("status", { length: 50 }).default("scheduled"), // scheduled, reminded, completed, cancelled
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    dealershipIdx: index("followup_dealership_idx").on(table.dealershipId),
    assignedIdx: index("followup_assigned_idx").on(table.assignedTo),
  }),
);

// User invitations for seamless onboarding
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    role: varchar("role", { length: 50 }).notNull(),
    dealershipId: integer("dealership_id").references(() => dealerships.id, {
      onDelete: "cascade",
    }),
    invitedBy: integer("invited_by").references(() => users.id),
    token: varchar("token", { length: 255 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    status: varchar("status", { length: 50 }).default("pending"), // pending, accepted, expired
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    dealershipIdx: index("invitation_dealership_idx").on(table.dealershipId),
    emailIdx: index("invitation_email_idx").on(table.email),
  }),
);

// Audit logs for user management
export const extensionAuditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    dealershipId: integer("dealership_id").references(() => dealerships.id),
    action: varchar("action", { length: 255 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }),
    resourceId: integer("resource_id"),
    details: json("details").$type<Record<string, any>>().default({}),
    ipAddress: varchar("ip_address", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdx: index("audit_user_idx").on(table.userId),
    dealershipIdx: index("audit_dealership_idx").on(table.dealershipId),
  }),
);

// Customer profiles for extended insights
export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: serial("id").primaryKey(),
    dealershipId: integer("dealership_id")
      .notNull()
      .references(() => dealerships.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    preferences: json("preferences").$type<Record<string, any>>().default({}),
    buyingTimeline: varchar("buying_timeline", { length: 100 }),
    lastInteraction: timestamp("last_interaction"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    dealershipIdx: index("profile_dealership_idx").on(table.dealershipId),
    customerIdx: index("profile_customer_idx").on(table.customerId),
  }),
);

// Customer journey tracking
export const customerInteractions = pgTable(
  "customer_interactions",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id").references(() => customerProfiles.id, {
      onDelete: "cascade",
    }),
    conversationId: integer("conversation_id").references(
      () => conversations.id,
    ),
    interactionType: varchar("interaction_type", { length: 50 }).notNull(),
    details: json("details").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    profileIdx: index("interaction_profile_idx").on(table.profileId),
  }),
);

// Customer insights for AI analysis
export const customerInsights = pgTable(
  "customer_insights",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    insightType: varchar("insight_type", { length: 100 }).notNull(), // 'buying_intent', 'urgency', 'budget', etc.
    confidence: integer("confidence").notNull(), // 0-100
    value: text("value").notNull(),
    context: json("context").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    conversationIdx: index("insights_conversation_idx").on(
      table.conversationId,
    ),
  }),
);

// Response suggestions for agents
export const responseSuggestions = pgTable(
  "response_suggestions",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    suggestionType: varchar("suggestion_type", { length: 100 }).notNull(), // 'quick_reply', 'follow_up', 'escalation'
    content: text("content").notNull(),
    priority: integer("priority").default(1), // 1-5
    metadata: json("metadata").$type<Record<string, any>>().default({}),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    conversationIdx: index("suggestions_conversation_idx").on(
      table.conversationId,
    ),
  }),
);

// ===== ENHANCED SCHEMAS WITH DUAL-CASE SUPPORT =====

// Import enhanced schema mappers
import {
  createSelectSchemaWithMapping,
  createInsertSchemaWithMapping,
  createMappedSchemas,
  createTransitionalSchema,
  createDeprecationWrapper
} from './schema-mappers';

// Create enhanced schema mappings for all extension tables
export const enhancedEscalationTriggerSchemas = createMappedSchemas(escalationTriggers, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const enhancedLeadScoreSchemas = createMappedSchemas(leadScores, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const enhancedFollowUpSchemas = createMappedSchemas(followUps, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const enhancedUserInvitationSchemas = createMappedSchemas(userInvitations, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const enhancedExtensionAuditLogSchemas = createMappedSchemas(extensionAuditLogs, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt']
});

export const enhancedCustomerProfileSchemas = createMappedSchemas(customerProfiles, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const enhancedCustomerInteractionSchemas = createMappedSchemas(customerInteractions, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt']
});

export const enhancedCustomerInsightSchemas = createMappedSchemas(customerInsights, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt']
});

export const enhancedResponseSuggestionSchemas = createMappedSchemas(responseSuggestions, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt']
});

// ===== TRANSITIONAL SCHEMAS FOR API ENDPOINTS =====

// Escalation trigger creation schema with legacy support
export const createEscalationTriggerRequestSchema = createTransitionalSchema(
  {
    dealershipId: z.number(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    conditions: z.array(
      z.object({
        type: z.enum(['sentiment', 'urgency', 'repeated_questions', 'keyword', 'custom']),
        value: z.union([z.string(), z.number(), z.array(z.string())]),
        threshold: z.number().optional()
      })
    ).default([]),
    isActive: z.boolean().default(true)
  },
  {
    // Legacy mappings
    'dealership_id': 'dealershipId',
    'is_active': 'isActive'
  }
);

// Follow-up creation schema with dual-case support
export const createFollowUpRequestSchema = createTransitionalSchema(
  {
    conversationId: z.number(),
    dealershipId: z.number(),
    customerName: z.string().min(1).max(255),
    customerContact: z.string().max(255).optional(),
    assignedTo: z.number().optional(),
    scheduledTime: z.string().datetime(),
    notes: z.string().optional(),
    status: z.enum(['scheduled', 'reminded', 'completed', 'cancelled']).default('scheduled')
  },
  {
    // Legacy mappings
    'conversation_id': 'conversationId',
    'dealership_id': 'dealershipId',
    'customer_name': 'customerName',
    'customer_contact': 'customerContact',
    'assigned_to': 'assignedTo',
    'scheduled_time': 'scheduledTime'
  }
);

// Customer profile creation schema
export const createCustomerProfileRequestSchema = createTransitionalSchema(
  {
    dealershipId: z.number(),
    customerId: z.number().optional(),
    name: z.string().max(255).optional(),
    email: z.string().email().max(255).optional(),
    phone: z.string().max(50).optional(),
    preferences: z.record(z.any()).default({}),
    buyingTimeline: z.string().max(100).optional(),
    lastInteraction: z.string().datetime().optional()
  },
  {
    // Legacy mappings
    'dealership_id': 'dealershipId',
    'customer_id': 'customerId',
    'buying_timeline': 'buyingTimeline',
    'last_interaction': 'lastInteraction'
  }
);

// User invitation creation schema
export const createUserInvitationRequestSchema = createTransitionalSchema(
  {
    email: z.string().email().max(255),
    role: z.string().max(50),
    dealershipId: z.number().optional(),
    invitedBy: z.number().optional(),
    token: z.string().max(255),
    expiresAt: z.string().datetime()
  },
  {
    // Legacy mappings
    'dealership_id': 'dealershipId',
    'invited_by': 'invitedBy',
    'expires_at': 'expiresAt'
  }
);

// Customer insight creation schema
export const createCustomerInsightRequestSchema = createTransitionalSchema(
  {
    conversationId: z.number(),
    insightType: z.string().max(100),
    confidence: z.number().min(0).max(100),
    value: z.string().min(1),
    context: z.record(z.any()).default({})
  },
  {
    // Legacy mappings
    'conversation_id': 'conversationId',
    'insight_type': 'insightType'
  }
);

// ===== API RESPONSE SCHEMAS (ALWAYS CAMELCASE) =====

// API response schemas that standardize output to camelCase
export const apiEscalationTriggerSchema = z.object({
  id: z.number(),
  dealershipId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  conditions: z.array(z.object({
    type: z.string(),
    value: z.union([z.string(), z.number(), z.array(z.string())]),
    threshold: z.number().optional()
  })),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiFollowUpSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  dealershipId: z.number(),
  customerName: z.string(),
  customerContact: z.string().nullable(),
  assignedTo: z.number().nullable(),
  scheduledTime: z.string().datetime(),
  notes: z.string().nullable(),
  status: z.string(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiCustomerProfileSchema = z.object({
  id: z.number(),
  dealershipId: z.number(),
  customerId: z.number().nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  preferences: z.record(z.any()),
  buyingTimeline: z.string().nullable(),
  lastInteraction: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiUserInvitationSchema = z.object({
  id: z.number(),
  email: z.string(),
  role: z.string(),
  dealershipId: z.number().nullable(),
  invitedBy: z.number().nullable(),
  token: z.string(),
  expiresAt: z.string().datetime(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiCustomerInsightSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  insightType: z.string(),
  confidence: z.number(),
  value: z.string(),
  context: z.record(z.any()),
  createdAt: z.string().datetime()
});

// ===== BACKWARD COMPATIBILITY SCHEMAS (DEPRECATED) =====

// Keep legacy schemas for existing code compatibility but mark as deprecated
// These will be removed in v2.0.0
export const insertEscalationTriggerSchema = enhancedEscalationTriggerSchemas.insert;
export const insertLeadScoreSchema = enhancedLeadScoreSchemas.insert;
export const insertFollowUpSchema = enhancedFollowUpSchemas.insert;
export const insertUserInvitationSchema = enhancedUserInvitationSchemas.insert;
export const insertExtensionAuditLogSchema = enhancedExtensionAuditLogSchemas.insert;
export const insertCustomerProfileSchema = enhancedCustomerProfileSchemas.insert;
export const insertCustomerInteractionSchema = enhancedCustomerInteractionSchemas.insert;
export const insertCustomerInsightSchema = enhancedCustomerInsightSchemas.insert;
export const insertResponseSuggestionSchema = enhancedResponseSuggestionSchemas.insert;

// ===== VALIDATION HELPERS =====

/**
 * Helper to validate escalation trigger data for database insertion
 */
export function validateEscalationTriggerForDB(data: unknown) {
  return enhancedEscalationTriggerSchemas.insert.parse(data);
}

/**
 * Helper to transform database escalation trigger to API format
 */
export function transformEscalationTriggerForAPI(dbResult: any) {
  return apiEscalationTriggerSchema.parse(
    enhancedEscalationTriggerSchemas.select.parse(dbResult)
  );
}

/**
 * Helper to validate follow-up data for database insertion
 */
export function validateFollowUpForDB(data: unknown) {
  return enhancedFollowUpSchemas.insert.parse(data);
}

/**
 * Helper to transform database follow-up to API format
 */
export function transformFollowUpForAPI(dbResult: any) {
  return apiFollowUpSchema.parse(
    enhancedFollowUpSchemas.select.parse(dbResult)
  );
}

// Types
export type EscalationTrigger = typeof escalationTriggers.$inferSelect;
export type InsertEscalationTrigger = z.infer<
  typeof insertEscalationTriggerSchema
>;

export type LeadScore = typeof leadScores.$inferSelect;
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

export type ExtensionAuditLog = typeof extensionAuditLogs.$inferSelect;
export type InsertExtensionAuditLog = z.infer<
  typeof insertExtensionAuditLogSchema
>;

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = z.infer<typeof insertCustomerProfileSchema>;

export type CustomerInteraction = typeof customerInteractions.$inferSelect;
export type InsertCustomerInteraction = z.infer<
  typeof insertCustomerInteractionSchema
>;

export type CustomerInsight = typeof customerInsights.$inferSelect;
export type InsertCustomerInsight = z.infer<typeof insertCustomerInsightSchema>;

export type ResponseSuggestion = typeof responseSuggestions.$inferSelect;
export type InsertResponseSuggestion = z.infer<
  typeof insertResponseSuggestionSchema
>;
