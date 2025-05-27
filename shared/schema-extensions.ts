import { pgTable, serial, text, varchar, timestamp, boolean, integer, json, unique, foreignKey, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { dealerships, users, customers } from "./enhanced-schema";
import { conversations } from "./lead-management-schema";

// Escalation triggers for customizable handover logic
export const escalationTriggers = pgTable('escalation_triggers', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  conditions: json('conditions').$type<{
    type: 'sentiment' | 'urgency' | 'repeated_questions' | 'keyword' | 'custom';
    value: string | number | string[];
    threshold?: number;
  }[]>().default([]),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  dealershipIdx: index('trigger_dealership_idx').on(table.dealershipId),
}));

// Lead scoring system
export const leadScores = pgTable('lead_scores', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  score: integer('score').notNull(),
  factors: json('factors').$type<{
    urgencySignals: number;
    engagementLevel: number;
    buyerSignals: number;
    specificQuestions: number;
  }>().default({
    urgencySignals: 0,
    engagementLevel: 0,
    buyerSignals: 0,
    specificQuestions: 0
  }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  conversationIdx: index('score_conversation_idx').on(table.conversationId),
  uniqueConversation: unique('unique_conversation_score').on(table.conversationId),
}));

// Follow-up scheduling
export const followUps = pgTable('follow_ups', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerContact: varchar('customer_contact', { length: 255 }),
  assignedTo: integer('assigned_to').references(() => users.id),
  scheduledTime: timestamp('scheduled_time').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('scheduled'), // scheduled, reminded, completed, cancelled
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  dealershipIdx: index('followup_dealership_idx').on(table.dealershipId),
  assignedIdx: index('followup_assigned_idx').on(table.assignedTo),
}));

// User invitations for seamless onboarding
export const userInvitations = pgTable('user_invitations', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  dealershipId: integer('dealership_id').references(() => dealerships.id, { onDelete: 'cascade' }),
  invitedBy: integer('invited_by').references(() => users.id),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  status: varchar('status', { length: 50 }).default('pending'), // pending, accepted, expired
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  dealershipIdx: index('invitation_dealership_idx').on(table.dealershipId),
  emailIdx: index('invitation_email_idx').on(table.email),
}));

// Audit logs for user management
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  dealershipId: integer('dealership_id').references(() => dealerships.id),
  action: varchar('action', { length: 255 }).notNull(),
  resourceType: varchar('resource_type', { length: 100 }),
  resourceId: integer('resource_id'),
  details: json('details').$type<Record<string, any>>().default({}),
  ipAddress: varchar('ip_address', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  userIdx: index('audit_user_idx').on(table.userId),
  dealershipIdx: index('audit_dealership_idx').on(table.dealershipId),
}));

// Customer profiles for extended insights
export const customerProfiles = pgTable('customer_profiles', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  preferences: json('preferences').$type<Record<string, any>>().default({}),
  buyingTimeline: varchar('buying_timeline', { length: 100 }),
  lastInteraction: timestamp('last_interaction'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, table => ({
  dealershipIdx: index('profile_dealership_idx').on(table.dealershipId),
  customerIdx: index('profile_customer_idx').on(table.customerId),
}));

// Customer journey tracking
export const customerInteractions = pgTable('customer_interactions', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id').references(() => customerProfiles.id, { onDelete: 'cascade' }),
  conversationId: integer('conversation_id').references(() => conversations.id),
  interactionType: varchar('interaction_type', { length: 50 }).notNull(),
  details: json('details').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  profileIdx: index('interaction_profile_idx').on(table.profileId),
}));

// Customer insights for AI analysis
export const customerInsights = pgTable('customer_insights', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  insightType: varchar('insight_type', { length: 100 }).notNull(), // 'buying_intent', 'urgency', 'budget', etc.
  confidence: integer('confidence').notNull(), // 0-100
  value: text('value').notNull(),
  context: json('context').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  conversationIdx: index('insights_conversation_idx').on(table.conversationId),
}));

// Response suggestions for agents
export const responseSuggestions = pgTable('response_suggestions', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  suggestionType: varchar('suggestion_type', { length: 100 }).notNull(), // 'quick_reply', 'follow_up', 'escalation'
  content: text('content').notNull(),
  priority: integer('priority').default(1), // 1-5
  metadata: json('metadata').$type<Record<string, any>>().default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  conversationIdx: index('suggestions_conversation_idx').on(table.conversationId),
}));

// Create insert schemas
export const insertEscalationTriggerSchema = createInsertSchema(escalationTriggers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeadScoreSchema = createInsertSchema(leadScores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFollowUpSchema = createInsertSchema(followUps).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertCustomerProfileSchema = createInsertSchema(customerProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerInteractionSchema = createInsertSchema(customerInteractions).omit({ id: true, createdAt: true });
export const insertCustomerInsightSchema = createInsertSchema(customerInsights).omit({ id: true, createdAt: true });
export const insertResponseSuggestionSchema = createInsertSchema(responseSuggestions).omit({ id: true, createdAt: true });

// Types
export type EscalationTrigger = typeof escalationTriggers.$inferSelect;
export type InsertEscalationTrigger = z.infer<typeof insertEscalationTriggerSchema>;

export type LeadScore = typeof leadScores.$inferSelect;
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;

export type FollowUp = typeof followUps.$inferSelect;
export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;

export type UserInvitation = typeof userInvitations.$inferSelect;
export type InsertUserInvitation = z.infer<typeof insertUserInvitationSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type CustomerProfile = typeof customerProfiles.$inferSelect;
export type InsertCustomerProfile = z.infer<typeof insertCustomerProfileSchema>;

export type CustomerInteraction = typeof customerInteractions.$inferSelect;
export type InsertCustomerInteraction = z.infer<typeof insertCustomerInteractionSchema>;

export type CustomerInsight = typeof customerInsights.$inferSelect;
export type InsertCustomerInsight = z.infer<typeof insertCustomerInsightSchema>;

export type ResponseSuggestion = typeof responseSuggestions.$inferSelect;
export type InsertResponseSuggestion = z.infer<typeof insertResponseSuggestionSchema>;