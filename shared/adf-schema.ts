/**
 * ADF (Automotive Data Format) Schema
 * 
 * This schema defines tables and types for handling ADF lead processing,
 * including lead storage, processing logs, email queue management, and SMS integration.
 * 
 * Based on migrations:
 * - 0011_adf_sms_responses_table.sql
 * - 0014_adf_conversation_integration.sql
 * - References from schema-resolver.ts
 */

import { pgTable, serial, text, integer, timestamp, boolean, jsonb, pgEnum, uuid, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums for ADF processing
export const adfLeadStatuses = pgEnum('adf_lead_status', [
  'new',
  'processing',
  'processed',
  'error',
  'duplicate',
  'spam',
  'archived'
]);

export const adfRequestTypes = pgEnum('adf_request_type', [
  'new_vehicle',
  'used_vehicle',
  'service',
  'parts',
  'general_inquiry',
  'test_drive',
  'trade_appraisal',
  'financing'
]);

export const adfProcessingStatuses = pgEnum('adf_processing_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'retry',
  'skipped'
]);

export const smsDeliveryStatus = pgEnum('sms_delivery_status', [
  'pending',
  'queued',
  'sent',
  'delivered',
  'failed',
  'undelivered',
  'opted_out',
  'retried_success',
  'retried_failed'
]);

// ADF Leads Table
export const adfLeads = pgTable('adf_leads', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => ({ schema: 'public', table: 'dealerships' } as any).id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => ({ schema: 'public', table: 'customers' } as any).id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => ({ schema: 'public', table: 'leads' } as any).id, { onDelete: 'cascade' }),
  
  // ADF specific fields
  adfId: text('adf_id'), // Original ADF identifier
  requestType: adfRequestTypes('request_type').notNull(),
  status: adfLeadStatuses('status').notNull().default('new'),
  
  // Customer information (from ADF)
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  mobilePhone: text('mobile_phone'),
  homePhone: text('home_phone'),
  workPhone: text('work_phone'),
  
  // Vehicle interest
  vehicleOfInterest: text('vehicle_of_interest'),
  vehicleYear: integer('vehicle_year'),
  vehicleMake: text('vehicle_make'),
  vehicleModel: text('vehicle_model'),
  vehicleTrim: text('vehicle_trim'),
  vehicleStock: text('vehicle_stock'),
  vehicleVin: text('vehicle_vin'),
  vehicleCondition: text('vehicle_condition'), // new, used, cpo
  
  // Trade-in information
  hasTradeIn: boolean('has_trade_in').default(false),
  tradeInYear: integer('trade_in_year'),
  tradeInMake: text('trade_in_make'),
  tradeInModel: text('trade_in_model'),
  tradeInTrim: text('trade_in_trim'),
  tradeInMileage: integer('trade_in_mileage'),
  tradeInCondition: text('trade_in_condition'),
  
  // Contact preferences and timing
  preferredContactMethod: text('preferred_contact_method'),
  preferredContactTime: text('preferred_contact_time'),
  timeframe: text('timeframe'),
  urgency: text('urgency'),
  
  // Lead source and attribution
  source: text('source'), // dealer website, third party, etc
  medium: text('medium'),
  campaign: text('campaign'),
  referrer: text('referrer'),
  landingPage: text('landing_page'),
  
  // Processing information
  processedAt: timestamp('processed_at', { withTimezone: true }),
  assignedUserId: integer('assigned_user_id').references(() => ({ schema: 'public', table: 'users' } as any).id),
  lastContactDate: timestamp('last_contact_date', { withTimezone: true }),
  nextFollowUpDate: timestamp('next_follow_up_date', { withTimezone: true }),
  
  // SMS tracking (from migration 0011)
  smsStatus: text('sms_status'),
  smsError: text('sms_error'),
  smsSentAt: timestamp('sms_sent_at', { withTimezone: true }),
  smsDeliveredAt: timestamp('sms_delivered_at', { withTimezone: true }),
  
  // Data storage
  originalXml: text('original_xml'), // Raw ADF XML
  originalPayload: jsonb('original_payload').default('{}'),
  customFields: jsonb('custom_fields').default('{}'),
  metadata: jsonb('metadata').default('{}'),
  
  // Deduplication
  deduplicationHash: text('deduplication_hash').notNull(),
  
  // Scoring and value
  leadScore: integer('lead_score').default(0),
  estimatedValue: integer('estimated_value'), // in cents
  probability: decimal('probability', { precision: 3, scale: 2 }), // 0.00 to 1.00
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  dealershipIdIdx: index('idx_adf_leads_dealership_id').on(table.dealershipId),
  statusIdx: index('idx_adf_leads_status').on(table.status),
  emailIdx: index('idx_adf_leads_email').on(table.email),
  phoneIdx: index('idx_adf_leads_phone').on(table.phone),
  adfIdIdx: index('idx_adf_leads_adf_id').on(table.adfId),
  createdAtIdx: index('idx_adf_leads_created_at').on(table.createdAt),
  smsStatusIdx: index('idx_adf_leads_sms_status').on(table.smsStatus),
  dedupHashIdx: index('idx_adf_leads_dedup_hash').on(table.deduplicationHash),
  assignedUserIdx: index('idx_adf_leads_assigned_user').on(table.assignedUserId)
}));

// ADF Processing Logs Table
export const adfProcessingLogs = pgTable('adf_processing_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adfLeadId: integer('adf_lead_id').references(() => adfLeads.id, { onDelete: 'cascade' }),
  dealershipId: integer('dealership_id').notNull(),
  
  // Processing details
  status: adfProcessingStatuses('status').notNull().default('pending'),
  step: text('step').notNull(), // parsing, validation, dedup, creation, etc
  message: text('message'),
  errorDetails: text('error_details'),
  
  // Performance metrics
  processingTimeMs: integer('processing_time_ms'),
  memoryUsageMb: integer('memory_usage_mb'),
  
  // Data
  inputData: jsonb('input_data'),
  outputData: jsonb('output_data'),
  metadata: jsonb('metadata').default('{}'),
  
  // Timestamps
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  adfLeadIdIdx: index('idx_adf_processing_logs_adf_lead_id').on(table.adfLeadId),
  statusIdx: index('idx_adf_processing_logs_status').on(table.status),
  stepIdx: index('idx_adf_processing_logs_step').on(table.step),
  createdAtIdx: index('idx_adf_processing_logs_created_at').on(table.createdAt),
  dealershipIdIdx: index('idx_adf_processing_logs_dealership_id').on(table.dealershipId)
}));

// ADF Email Queue Table
export const adfEmailQueue = pgTable('adf_email_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  adfLeadId: integer('adf_lead_id').references(() => adfLeads.id, { onDelete: 'cascade' }),
  dealershipId: integer('dealership_id').notNull(),
  
  // Email details
  toEmail: text('to_email').notNull(),
  fromEmail: text('from_email').notNull(),
  replyTo: text('reply_to'),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  bodyHtml: text('body_html'),
  
  // Queue management
  status: adfProcessingStatuses('status').notNull().default('pending'),
  priority: integer('priority').default(5), // 1 = highest, 10 = lowest
  maxRetries: integer('max_retries').default(3),
  retryCount: integer('retry_count').default(0),
  
  // Delivery tracking
  messageId: text('message_id'), // External email service message ID
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  clickedAt: timestamp('clicked_at', { withTimezone: true }),
  
  // Error handling
  lastError: text('last_error'),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  
  // Metadata
  headers: jsonb('headers').default('{}'),
  metadata: jsonb('metadata').default('{}'),
  
  // Timestamps
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  adfLeadIdIdx: index('idx_adf_email_queue_adf_lead_id').on(table.adfLeadId),
  statusIdx: index('idx_adf_email_queue_status').on(table.status),
  scheduledForIdx: index('idx_adf_email_queue_scheduled_for').on(table.scheduledFor),
  nextAttemptIdx: index('idx_adf_email_queue_next_attempt').on(table.nextAttemptAt),
  dealershipIdIdx: index('idx_adf_email_queue_dealership_id').on(table.dealershipId),
  priorityIdx: index('idx_adf_email_queue_priority').on(table.priority)
}));

// SMS Response Table (from migration 0011)
export const adfSmsResponses = pgTable('adf_sms_responses', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: integer('lead_id').notNull().references(() => adfLeads.id, { onDelete: 'cascade' }),
  dealershipId: integer('dealership_id').notNull(),
  
  // Phone and message details
  phoneNumber: text('phone_number').notNull(),
  phoneNumberMasked: text('phone_number_masked').notNull(),
  message: text('message').notNull(),
  
  // Twilio integration
  messageSid: text('message_sid'),
  status: smsDeliveryStatus('status').notNull().default('pending'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  
  // Retry logic
  retryCount: integer('retry_count').notNull().default(0),
  isOptOut: boolean('is_opt_out').notNull().default(false),
  
  // Security
  encryptedPhone: text('encrypted_phone'),
  
  // Metadata
  metadata: jsonb('metadata'),
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true })
}, (table) => ({
  leadIdIdx: index('idx_adf_sms_responses_lead_id').on(table.leadId),
  messageSidIdx: index('idx_adf_sms_responses_message_sid').on(table.messageSid),
  statusIdx: index('idx_adf_sms_responses_status').on(table.status),
  createdAtIdx: index('idx_adf_sms_responses_created_at').on(table.createdAt),
  dealershipPhoneIdx: index('idx_adf_sms_responses_dealership_phone').on(table.dealershipId, table.phoneNumberMasked),
  retryIdx: index('idx_adf_sms_responses_retry').on(table.retryCount)
}));

// SMS Delivery Events Table (from migration 0011)
export const adfSmsDeliveryEvents = pgTable('adf_sms_delivery_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => adfSmsResponses.id, { onDelete: 'cascade' }),
  messageSid: text('message_sid').notNull(),
  status: smsDeliveryStatus('status').notNull(),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull().defaultNow(),
  rawPayload: jsonb('raw_payload') // Store the raw webhook payload for debugging
}, (table) => ({
  messageIdIdx: index('idx_adf_sms_delivery_events_message_id').on(table.messageId),
  messageSidIdx: index('idx_adf_sms_delivery_events_message_sid').on(table.messageSid),
  timestampIdx: index('idx_adf_sms_delivery_events_timestamp').on(table.eventTimestamp)
}));

// SMS Opt-outs Table (from migration 0011)
export const adfSmsOptOuts = pgTable('adf_sms_opt_outs', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: integer('dealership_id').notNull(),
  phoneNumber: text('phone_number').notNull(),
  phoneNumberMasked: text('phone_number_masked').notNull(),
  phoneNumberHash: text('phone_number_hash').notNull(), // For secure lookups
  reason: text('reason').notNull().default('user_request'),
  optedOutAt: timestamp('opted_out_at', { withTimezone: true }).notNull().defaultNow(),
  optedBackInAt: timestamp('opted_back_in_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => ({
  dealershipPhoneIdx: index('idx_adf_sms_opt_outs_dealership_phone').on(table.dealershipId, table.phoneNumberHash),
  phoneHashIdx: index('idx_adf_sms_opt_outs_phone_hash').on(table.phoneNumberHash),
  optedOutAtIdx: index('idx_adf_sms_opt_outs_opted_out_at').on(table.optedOutAt)
}));

// Relations
export const adfLeadsRelations = relations(adfLeads, ({ one, many }) => ({
  dealership: one(({ schema: 'public', table: 'dealerships' } as any), {
    fields: [adfLeads.dealershipId],
    references: [({ schema: 'public', table: 'dealerships' } as any).id]
  }),
  customer: one(({ schema: 'public', table: 'customers' } as any), {
    fields: [adfLeads.customerId],
    references: [({ schema: 'public', table: 'customers' } as any).id]
  }),
  lead: one(({ schema: 'public', table: 'leads' } as any), {
    fields: [adfLeads.leadId],
    references: [({ schema: 'public', table: 'leads' } as any).id]
  }),
  assignedUser: one(({ schema: 'public', table: 'users' } as any), {
    fields: [adfLeads.assignedUserId],
    references: [({ schema: 'public', table: 'users' } as any).id]
  }),
  processingLogs: many(adfProcessingLogs),
  emailQueue: many(adfEmailQueue),
  smsResponses: many(adfSmsResponses)
}));

export const adfProcessingLogsRelations = relations(adfProcessingLogs, ({ one }) => ({
  adfLead: one(adfLeads, {
    fields: [adfProcessingLogs.adfLeadId],
    references: [adfLeads.id]
  })
}));

export const adfEmailQueueRelations = relations(adfEmailQueue, ({ one }) => ({
  adfLead: one(adfLeads, {
    fields: [adfEmailQueue.adfLeadId],
    references: [adfLeads.id]
  })
}));

export const adfSmsResponsesRelations = relations(adfSmsResponses, ({ one, many }) => ({
  adfLead: one(adfLeads, {
    fields: [adfSmsResponses.leadId],
    references: [adfLeads.id]
  }),
  deliveryEvents: many(adfSmsDeliveryEvents)
}));

export const adfSmsDeliveryEventsRelations = relations(adfSmsDeliveryEvents, ({ one }) => ({
  smsResponse: one(adfSmsResponses, {
    fields: [adfSmsDeliveryEvents.messageId],
    references: [adfSmsResponses.id]
  })
}));

// Zod schemas for validation
export const insertAdfLeadSchema = createInsertSchema(adfLeads, {
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  vehicleYear: z.number().min(1900).max(new Date().getFullYear() + 2).optional(),
  estimatedValue: z.number().min(0).optional(),
  probability: z.number().min(0).max(1).optional(),
  leadScore: z.number().min(0).max(100).optional()
});

export const insertAdfProcessingLogSchema = createInsertSchema(adfProcessingLogs, {
  processingTimeMs: z.number().min(0).optional(),
  memoryUsageMb: z.number().min(0).optional()
});

export const insertAdfEmailQueueSchema = createInsertSchema(adfEmailQueue, {
  toEmail: z.string().email(),
  fromEmail: z.string().email(),
  replyTo: z.string().email().optional(),
  priority: z.number().min(1).max(10).optional(),
  maxRetries: z.number().min(0).max(10).optional()
});

export const insertAdfSmsResponseSchema = createInsertSchema(adfSmsResponses, {
  phoneNumber: z.string().min(1),
  message: z.string().min(1).max(1600), // SMS length limit
  retryCount: z.number().min(0).max(5).optional()
});

// Type exports
export type AdfLeadStatus = typeof adfLeadStatuses.enumValues[number];
export type AdfRequestType = typeof adfRequestTypes.enumValues[number];
export type AdfProcessingStatus = typeof adfProcessingStatuses.enumValues[number];
export type SmsDeliveryStatus = typeof smsDeliveryStatus.enumValues[number];

export type AdfLead = typeof adfLeads.$inferSelect;
export type InsertAdfLead = typeof adfLeads.$inferInsert;

export type AdfProcessingLog = typeof adfProcessingLogs.$inferSelect;
export type InsertAdfProcessingLog = typeof adfProcessingLogs.$inferInsert;

export type AdfEmailQueue = typeof adfEmailQueue.$inferSelect;
export type InsertAdfEmailQueue = typeof adfEmailQueue.$inferInsert;

export type AdfSmsResponse = typeof adfSmsResponses.$inferSelect;
export type InsertAdfSmsResponse = typeof adfSmsResponses.$inferInsert;

export type AdfSmsDeliveryEvent = typeof adfSmsDeliveryEvents.$inferSelect;
export type InsertAdfSmsDeliveryEvent = typeof adfSmsDeliveryEvents.$inferInsert;

export type AdfSmsOptOut = typeof adfSmsOptOuts.$inferSelect;
export type InsertAdfSmsOptOut = typeof adfSmsOptOuts.$inferInsert;

// ADF XML Structure type for parsing
export interface AdfXmlStructure {
  prospect: {
    requestdate: string;
    vehicle: {
      year?: string;
      make?: string;
      model?: string;
      trim?: string;
      stock?: string;
      vin?: string;
      condition?: 'new' | 'used' | 'cpo';
    };
    customer: {
      contact: {
        name: {
          part: { type: string; content: string }[];
        };
        email?: string;
        phone?: { type: string; number: string }[];
        address?: {
          street?: string;
          apartment?: string;
          city?: string;
          regioncode?: string;
          postalcode?: string;
          country?: string;
        };
      };
      comments?: string;
      timeframe?: string;
      urgency?: string;
    };
    vendor: {
      vendorname: string;
      contact?: {
        name?: string;
        email?: string;
        phone?: string;
      };
    };
    provider?: {
      name: string;
      service?: string;
      contact?: {
        name?: string;
        email?: string;
        phone?: string;
      };
    };
  };
}