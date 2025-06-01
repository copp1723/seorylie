import { pgTable, uuid, text, varchar, timestamp, boolean, integer, json, unique, index, serial, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { dealerships, users } from "./schema";

// ===== ENUMS AND TYPES =====

export const leadSources = [
  'adf_email', 'website_form', 'phone_call', 'walk_in', 'referral',
  'social_media', 'advertising', 'partner', 'manual', 'api'
] as const;
export type LeadSource = typeof leadSources[number];

export const leadStatuses = [
  'new', 'contacted', 'qualified', 'proposal', 'negotiation',
  'sold', 'lost', 'follow_up', 'archived'
] as const;
export type LeadStatus = typeof leadStatuses[number];

export const leadPriorities = ['low', 'medium', 'high', 'urgent'] as const;
export type LeadPriority = typeof leadPriorities[number];

export const conversationStatuses = [
  'active', 'waiting_response', 'escalated', 'resolved', 'archived'
] as const;
export type ConversationStatus = typeof conversationStatuses[number];

export const messageTypes = [
  'inbound', 'outbound', 'internal_note', 'system', 'escalation'
] as const;
export type MessageType = typeof messageTypes[number];

export const messageSenders = ['customer', 'ai', 'agent', 'system'] as const;
export type MessageSender = typeof messageSenders[number];

export const handoverReasons = [
  'complex_inquiry', 'technical_issue', 'pricing_negotiation',
  'customer_request', 'ai_limitation', 'policy_escalation', 'other'
] as const;
export type HandoverReason = typeof handoverReasons[number];

export const handoverStatuses = [
  'pending', 'accepted', 'in_progress', 'resolved', 'rejected'
] as const;
export type HandoverStatus = typeof handoverStatuses[number];

// ===== CORE LEAD MANAGEMENT TABLES =====

// Lead Sources - Track where leads come from
export const leadSourcesTable = pgTable('lead_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).$type<LeadSource>().notNull(),
  description: text('description'),

  // Configuration for this source
  configuration: json('configuration').$type<{
    webhook_url?: string;
    api_key?: string;
    form_fields?: Record<string, any>;
    email_settings?: {
      imap_host?: string;
      imap_port?: number;
      username?: string;
      folder?: string;
    };
    attribution_rules?: Record<string, any>;
  }>().default({}),

  // Analytics and performance
  totalLeads: integer('total_leads').default(0),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  averageValue: integer('average_value'), // in cents

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  dealershipIdx: index('lead_sources_dealership_idx').on(table.dealershipId),
  typeIdx: index('lead_sources_type_idx').on(table.type),
  uniqueName: unique('lead_sources_unique_name').on(table.dealershipId, table.name),
}));

// Dealership Handover Settings - Configuration for handover system
export const dealershipHandoverSettings = pgTable('dealership_handover_settings', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  
  // Email configuration
  handoverEmail: varchar('handover_email', { length: 255 }).notNull(),
  
  // SLA configuration
  slaHours: integer('sla_hours').notNull().default(24),
  
  // Template configuration
  dossierTemplate: varchar('dossier_template', { length: 100 }).default('default'),
  
  // Feature flag
  isEnabled: boolean('is_enabled').default(true),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  dealershipIdx: index('dealership_handover_settings_dealership_idx').on(table.dealershipId),
  uniqueDealership: unique('unique_dealership_handover_settings').on(table.dealershipId),
}));

// Customers - Normalized customer information
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),

  // Personal information
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  alternatePhone: varchar('alternate_phone', { length: 50 }),

  // Address information
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  zipCode: varchar('zip_code', { length: 20 }),
  country: varchar('country', { length: 50 }).default('US'),

  // Additional demographics
  dateOfBirth: timestamp('date_of_birth'),
  preferredLanguage: varchar('preferred_language', { length: 20 }).default('en'),
  preferredContact: varchar('preferred_contact', { length: 20 }), // email, phone, sms

  // Customer scoring and segmentation
  leadScore: integer('lead_score').default(0),
  customerValue: integer('customer_value').default(0), // in cents
  segment: varchar('segment', { length: 50 }),

  // Privacy and compliance
  gdprConsent: boolean('gdpr_consent').default(false),
  marketingOptIn: boolean('marketing_opt_in').default(false),
  doNotCall: boolean('do_not_call').default(false),
  optedOut: boolean('opted_out').default(false),
  optedOutAt: timestamp('opted_out_at'),

  // Customer lifecycle
  firstContactDate: timestamp('first_contact_date'),
  lastContactDate: timestamp('last_contact_date'),
  totalLeads: integer('total_leads').default(0),
  totalPurchases: integer('total_purchases').default(0),

  // Custom fields for extensibility
  customFields: json('custom_fields').$type<Record<string, any>>().default({}),

  // Deduplication hash for customer matching
  deduplicationHash: varchar('deduplication_hash', { length: 64 }).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  dealershipIdx: index('customers_dealership_idx').on(table.dealershipId),
  emailIdx: index('customers_email_idx').on(table.email),
  phoneIdx: index('customers_phone_idx').on(table.phone),
  fullNameIdx: index('customers_full_name_idx').on(table.fullName),
  dedupIdx: index('customers_dedup_idx').on(table.deduplicationHash),
  uniqueDedup: unique('customers_unique_dedup').on(table.dealershipId, table.deduplicationHash),
}));

// Vehicle Interest - What vehicles customers are interested in
export const vehicleInterests = pgTable('vehicle_interests', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Basic vehicle information
  year: integer('year'),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  trim: varchar('trim', { length: 100 }),
  bodyStyle: varchar('body_style', { length: 100 }),

  // Specific vehicle reference
  vin: varchar('vin', { length: 17 }),
  stockNumber: varchar('stock_number', { length: 50 }),

  // Condition and price range
  condition: varchar('condition', { length: 20 }), // new, used, cpo, any
  minPrice: integer('min_price'), // in cents
  maxPrice: integer('max_price'), // in cents

  // Preferences
  mileageMax: integer('mileage_max'),
  fuelType: varchar('fuel_type', { length: 50 }),
  transmission: varchar('transmission', { length: 50 }),
  features: json('features').$type<string[]>().default([]),

  // Trade-in information
  hasTradeIn: boolean('has_trade_in').default(false),
  tradeInYear: integer('trade_in_year'),
  tradeInMake: varchar('trade_in_make', { length: 100 }),
  tradeInModel: varchar('trade_in_model', { length: 100 }),
  tradeInTrim: varchar('trade_in_trim', { length: 100 }),
  tradeInVin: varchar('trade_in_vin', { length: 17 }),
  tradeInMileage: integer('trade_in_mileage'),
  tradeInCondition: varchar('trade_in_condition', { length: 50 }),
  tradeInValue: integer('trade_in_value'), // in cents

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  makeModelIdx: index('vehicle_interests_make_model_idx').on(table.make, table.model),
  yearIdx: index('vehicle_interests_year_idx').on(table.year),
  vinIdx: index('vehicle_interests_vin_idx').on(table.vin),
}));

// Leads - Main lead entity linking customers to their inquiries
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  vehicleInterestId: uuid('vehicle_interest_id').references(() => vehicleInterests.id),
  sourceId: uuid('source_id').references(() => leadSourcesTable.id),
  assignedUserId: integer('assigned_user_id').references(() => users.id),

  // Lead identification
  leadNumber: varchar('lead_number', { length: 50 }).notNull(), // Human-readable lead ID

  // Lead details
  status: varchar('status', { length: 50 }).$type<LeadStatus>().default('new'),
  priority: varchar('priority', { length: 20 }).$type<LeadPriority>().default('medium'),

  // Request information
  requestType: varchar('request_type', { length: 50 }),
  requestCategory: varchar('request_category', { length: 100 }),
  description: text('description'),
  timeframe: varchar('timeframe', { length: 100 }),

  // Attribution and tracking
  source: varchar('source', { length: 100 }).$type<LeadSource>().notNull(),
  medium: varchar('medium', { length: 100 }), // email, form, phone, etc.
  campaign: varchar('campaign', { length: 100 }),
  keyword: varchar('keyword', { length: 255 }),
  referrer: varchar('referrer', { length: 500 }),
  landingPage: varchar('landing_page', { length: 500 }),

  // Lead scoring and value
  leadScore: integer('lead_score').default(0),
  estimatedValue: integer('estimated_value'), // in cents
  probability: decimal('probability', { precision: 3, scale: 2 }), // 0.00 to 1.00

  // Timing information
  firstContactDate: timestamp('first_contact_date'),
  lastContactDate: timestamp('last_contact_date'),
  expectedCloseDate: timestamp('expected_close_date'),
  actualCloseDate: timestamp('actual_close_date'),

  // Follow-up scheduling
  nextFollowUpDate: timestamp('next_follow_up_date'),
  followUpNotes: text('follow_up_notes'),

  // Integration data
  externalId: varchar('external_id', { length: 255 }), // ID from external system
  originalPayload: json('original_payload').$type<Record<string, any>>().default({}),

  // Custom fields for dealership-specific data
  customFields: json('custom_fields').$type<Record<string, any>>().default({}),

  // Deduplication and version control
  deduplicationHash: varchar('deduplication_hash', { length: 64 }).notNull(),
  version: integer('version').default(1),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  dealershipIdx: index('leads_dealership_idx').on(table.dealershipId),
  customerIdx: index('leads_customer_idx').on(table.customerId),
  statusIdx: index('leads_status_idx').on(table.status),
  assignedUserIdx: index('leads_assigned_user_idx').on(table.assignedUserId),
  sourceIdx: index('leads_source_idx').on(table.source),
  createdAtIdx: index('leads_created_at_idx').on(table.createdAt),
  leadNumberIdx: index('leads_lead_number_idx').on(table.leadNumber),
  uniqueLeadNumber: unique('leads_unique_lead_number').on(table.dealershipId, table.leadNumber),
  uniqueDedup: unique('leads_unique_dedup').on(table.dealershipId, table.deduplicationHash),
}));

// ===== CONVERSATION AND MESSAGING SYSTEM =====

// Conversations - Track ongoing conversations with customers
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  assignedUserId: integer('assigned_user_id').references(() => users.id),

  // Conversation metadata
  subject: varchar('subject', { length: 255 }),
  status: varchar('status', { length: 50 }).$type<ConversationStatus>().default('active'),
  channel: varchar('channel', { length: 50 }), // email, chat, sms, phone

  // Conversation state
  lastMessageAt: timestamp('last_message_at'),
  messageCount: integer('message_count').default(0),

  // AI/Agent assignment
  isAiAssisted: boolean('is_ai_assisted').default(true),
  aiPersonaId: integer('ai_persona_id').references(() => personas.id),

  // External references
  externalThreadId: varchar('external_thread_id', { length: 255 }),

  // Conversation metadata
  tags: json('tags').$type<string[]>().default([]),
  priority: varchar('priority', { length: 20 }).$type<LeadPriority>().default('medium'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
}, table => ({
  dealershipIdx: index('conversations_dealership_idx').on(table.dealershipId),
  leadIdx: index('conversations_lead_idx').on(table.leadId),
  customerIdx: index('conversations_customer_idx').on(table.customerId),
  statusIdx: index('conversations_status_idx').on(table.status),
  assignedUserIdx: index('conversations_assigned_user_idx').on(table.assignedUserId),
  lastMessageIdx: index('conversations_last_message_idx').on(table.lastMessageAt),
}));

// Messages - Individual messages within conversations
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),

  // Message content
  content: text('content').notNull(),
  contentType: varchar('content_type', { length: 50 }).default('text'), // text, html, markdown
  subject: varchar('subject', { length: 255 }),

  // Message metadata
  type: varchar('type', { length: 50 }).$type<MessageType>().notNull(),
  sender: varchar('sender', { length: 20 }).$type<MessageSender>().notNull(),
  senderUserId: integer('sender_user_id').references(() => users.id),
  senderName: varchar('sender_name', { length: 100 }),
  senderEmail: varchar('sender_email', { length: 255 }),

  // Message state
  isRead: boolean('is_read').default(false),
  readAt: timestamp('read_at'),

  // External message references
  externalMessageId: varchar('external_message_id', { length: 255 }),
  inReplyTo: uuid('in_reply_to'), // Self-reference will be added in relations

  // AI-specific fields
  aiModel: varchar('ai_model', { length: 100 }),
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }),
  processingTime: integer('processing_time'), // milliseconds

  // Attachments and media
  attachments: json('attachments').$type<{
    filename: string;
    contentType: string;
    size: number;
    url: string;
  }[]>().default([]),

  // Message analytics
  sentiment: varchar('sentiment', { length: 20 }), // positive, negative, neutral
  entities: json('entities').$type<Record<string, any>>().default({}),
  keywords: json('keywords').$type<string[]>().default([]),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  conversationIdx: index('messages_conversation_idx').on(table.conversationId),
  typeIdx: index('messages_type_idx').on(table.type),
  senderIdx: index('messages_sender_idx').on(table.sender),
  createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  externalIdIdx: index('messages_external_id_idx').on(table.externalMessageId),
  inReplyToIdx: index('messages_in_reply_to_idx').on(table.inReplyTo),
}));

// Handovers - Track escalations from AI to human agents
export const handovers = pgTable('handovers', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),

  // Handover details
  reason: varchar('reason', { length: 50 }).$type<HandoverReason>().notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).$type<HandoverStatus>().default('pending'),

  // Assignment
  fromUserId: integer('from_user_id').references(() => users.id), // null for AI handovers
  toUserId: integer('to_user_id').references(() => users.id),
  requestedById: integer('requested_by_id').references(() => users.id),

  // Timing
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
  completedAt: timestamp('completed_at'),

  // Context and notes
  context: json('context').$type<Record<string, any>>().default({}),
  handoverNotes: text('handover_notes'),
  resolutionNotes: text('resolution_notes'),
  
  // Sales dossier data (ADF-08)
  dossier: json('dossier').$type<{
    customerName: string;
    customerContact: string;
    conversationSummary: string;
    customerInsights: Array<{
      key: string;
      value: string;
      confidence: number;
    }>;
    vehicleInterests: Array<{
      make: string;
      model: string;
      year: number;
      confidence: number;
    }>;
    suggestedApproach: string;
    urgency: 'low' | 'medium' | 'high';
    escalationReason: string;
  }>(),

  // Priority and urgency
  urgency: varchar('urgency', { length: 20 }).$type<LeadPriority>().default('medium'),
  customerSatisfaction: integer('customer_satisfaction'), // 1-5 rating

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  conversationIdx: index('handovers_conversation_idx').on(table.conversationId),
  leadIdx: index('handovers_lead_idx').on(table.leadId),
  statusIdx: index('handovers_status_idx').on(table.status),
  toUserIdx: index('handovers_to_user_idx').on(table.toUserId),
  requestedAtIdx: index('handovers_requested_at_idx').on(table.requestedAt),
  dossierIdx: index('handovers_dossier_idx').on(table.dossier),
}));

// Lead Activities - Track all activities on a lead
export const leadActivities = pgTable('lead_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),

  // Activity details
  type: varchar('type', { length: 50 }).notNull(), // email, call, meeting, note, status_change, etc.
  description: text('description').notNull(),
  notes: text('notes'),

  // Activity metadata
  duration: integer('duration'), // minutes
  outcome: varchar('outcome', { length: 100 }),
  nextAction: text('next_action'),
  nextActionDate: timestamp('next_action_date'),

  // Related entities
  messageId: uuid('message_id').references(() => messages.id),
  handoverId: uuid('handover_id').references(() => handovers.id),

  // External references
  externalId: varchar('external_id', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  leadIdx: index('lead_activities_lead_idx').on(table.leadId),
  typeIdx: index('lead_activities_type_idx').on(table.type),
  userIdx: index('lead_activities_user_idx').on(table.userId),
  createdAtIdx: index('lead_activities_created_at_idx').on(table.createdAt),
}));

// Import personas from main schema
import { personas } from './schema';

// ===== RELATIONS =====

export const leadSourcesRelations = relations(leadSourcesTable, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [leadSourcesTable.dealershipId],
    references: [dealerships.id],
  }),
  leads: many(leads),
}));

export const dealershipHandoverSettingsRelations = relations(dealershipHandoverSettings, ({ one }) => ({
  dealership: one(dealerships, {
    fields: [dealershipHandoverSettings.dealershipId],
    references: [dealerships.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [customers.dealershipId],
    references: [dealerships.id],
  }),
  leads: many(leads),
  conversations: many(conversations),
}));

export const vehicleInterestsRelations = relations(vehicleInterests, ({ many }) => ({
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [leads.dealershipId],
    references: [dealerships.id],
  }),
  customer: one(customers, {
    fields: [leads.customerId],
    references: [customers.id],
  }),
  vehicleInterest: one(vehicleInterests, {
    fields: [leads.vehicleInterestId],
    references: [vehicleInterests.id],
  }),
  source: one(leadSourcesTable, {
    fields: [leads.sourceId],
    references: [leadSourcesTable.id],
  }),
  assignedUser: one(users, {
    fields: [leads.assignedUserId],
    references: [users.id],
  }),
  conversations: many(conversations),
  activities: many(leadActivities),
  handovers: many(handovers),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [conversations.dealershipId],
    references: [dealerships.id],
  }),
  lead: one(leads, {
    fields: [conversations.leadId],
    references: [leads.id],
  }),
  customer: one(customers, {
    fields: [conversations.customerId],
    references: [customers.id],
  }),
  assignedUser: one(users, {
    fields: [conversations.assignedUserId],
    references: [users.id],
  }),
  aiPersona: one(personas, {
    fields: [conversations.aiPersonaId],
    references: [personas.id],
  }),
  messages: many(messages),
  handovers: many(handovers),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  senderUser: one(users, {
    fields: [messages.senderUserId],
    references: [users.id],
  }),
  replyToMessage: one(messages, {
    fields: [messages.inReplyTo],
    references: [messages.id],
  }),
  replies: many(messages, {
    relationName: 'message_replies'
  }),
  activities: many(leadActivities),
}));

export const handoversRelations = relations(handovers, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [handovers.conversationId],
    references: [conversations.id],
  }),
  lead: one(leads, {
    fields: [handovers.leadId],
    references: [leads.id],
  }),
  fromUser: one(users, {
    fields: [handovers.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [handovers.toUserId],
    references: [users.id],
  }),
  requestedBy: one(users, {
    fields: [handovers.requestedById],
    references: [users.id],
  }),
  activities: many(leadActivities),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [leadActivities.userId],
    references: [users.id],
  }),
  message: one(messages, {
    fields: [leadActivities.messageId],
    references: [messages.id],
  }),
  handover: one(handovers, {
    fields: [leadActivities.handoverId],
    references: [handovers.id],
  }),
}));

// ===== ZOD SCHEMAS =====

export const insertLeadSourceSchema = createInsertSchema(leadSourcesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealershipHandoverSettingsSchema = createInsertSchema(dealershipHandoverSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVehicleInterestSchema = createInsertSchema(vehicleInterests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHandoverSchema = createInsertSchema(handovers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true,
});

// ===== INFERRED TYPES =====

export type LeadSourceTable = typeof leadSourcesTable.$inferSelect;
export type InsertLeadSource = z.infer<typeof insertLeadSourceSchema>;

export type DealershipHandoverSettings = typeof dealershipHandoverSettings.$inferSelect;
export type InsertDealershipHandoverSettings = z.infer<typeof insertDealershipHandoverSettingsSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type VehicleInterest = typeof vehicleInterests.$inferSelect;
export type InsertVehicleInterest = z.infer<typeof insertVehicleInterestSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Handover = typeof handovers.$inferSelect;
export type InsertHandover = z.infer<typeof insertHandoverSchema>;

export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;

// ===== API PAYLOAD SCHEMAS =====

// Schema for inbound lead data
export const inboundLeadSchema = z.object({
  // Customer information (required)
  customer: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().default('US'),
    preferredLanguage: z.string().default('en'),
  }),

  // Vehicle interest (optional)
  vehicleInterest: z.object({
    year: z.number().optional(),
    make: z.string().optional(),
    model: z.string().optional(),
    trim: z.string().optional(),
    vin: z.string().optional(),
    stockNumber: z.string().optional(),
    condition: z.enum(['new', 'used', 'cpo']).optional(),
    minPrice: z.number().optional(),
    maxPrice: z.number().optional(),
    tradeIn: z.object({
      year: z.number().optional(),
      make: z.string().optional(),
      model: z.string().optional(),
      vin: z.string().optional(),
      mileage: z.number().optional(),
      condition: z.string().optional(),
    }).optional(),
  }).optional(),

  // Lead details
  lead: z.object({
    requestType: z.string().optional(),
    description: z.string().optional(),
    timeframe: z.string().optional(),
    source: z.enum(leadSources),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    priority: z.enum(leadPriorities).default('medium'),
  }),

  // Attribution data
  attribution: z.object({
    source: z.string(),
    medium: z.string().optional(),
    campaign: z.string().optional(),
    keyword: z.string().optional(),
    referrer: z.string().optional(),
    landingPage: z.string().optional(),
  }).optional(),

  // Custom fields
  customFields: z.record(z.any()).optional(),
});

// Schema for reply messages
export const replyMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1),
  contentType: z.enum(['text', 'html', 'markdown']).default('text'),
  sender: z.enum(messageSenders),
  senderUserId: z.number().optional(),
  senderName: z.string().optional(),
  subject: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
    url: z.string(),
  })).optional(),
});

// Schema for handover requests
export const handoverRequestSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.enum(handoverReasons),
  description: z.string().min(1),
  toUserId: z.number().optional(),
  urgency: z.enum(leadPriorities).default('medium'),
  context: z.record(z.any()).optional(),
});

// Note: Type exports are handled by the individual type definitions above
// to avoid conflicts with other schema files
