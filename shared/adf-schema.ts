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

import { pgTable, serial, text, varchar, timestamp, boolean, integer, json, decimal, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ADF Processing Status enum
export type AdfProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed' | 'retrying';
export type AdfLeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'archived';

// ADF XML Structure types for parsing
export interface AdfXmlStructure {
  adf: {
    $?: { version?: string };
    prospect: {
      requestdate?: string;
      customer?: {
        contact?: {
          name?: any;
          email?: string;
          phone?: any;
          address?: {
            street?: string;
            apartment?: string;
            city?: string;
            regioncode?: string;
            postalcode?: string;
            country?: string;
          };
        };
      };
      vehicle?: {
        year?: string;
        make?: string;
        model?: string;
        trim?: string;
        vin?: string;
        stock?: string;
        condition?: string;
        price?: string;
        mileage?: string;
      };
      vendor?: {
        vendorname?: string;
        contact?: {
          email?: string;
          phone?: string;
          address?: {
            street?: string;
            city?: string;
            regioncode?: string;
            postalcode?: string;
          };
        };
      };
      provider?: {
        name?: string;
        email?: string;
        phone?: string;
        service?: string;
      };
      trade?: {
        vehicle?: {
          year?: string;
          make?: string;
          model?: string;
          trim?: string;
          vin?: string;
          mileage?: string;
          condition?: string;
          value?: string;
        };
      };
      comments?: string;
      timeframe?: string;
    };
  };
}

// Main ADF Leads table
export const adfLeads = pgTable('adf_leads', {
  id: serial('id').primaryKey(),

  // ADF Header Information
  adfVersion: varchar('adf_version', { length: 10 }).notNull().default('1.0'),
  requestDate: timestamp('request_date').notNull(),

  // Customer Information
  customerFullName: varchar('customer_full_name', { length: 255 }).notNull(),
  customerFirstName: varchar('customer_first_name', { length: 100 }),
  customerLastName: varchar('customer_last_name', { length: 100 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerAddress: text('customer_address'),
  customerCity: varchar('customer_city', { length: 100 }),
  customerState: varchar('customer_state', { length: 50 }),
  customerZip: varchar('customer_zip', { length: 20 }),
  customerCountry: varchar('customer_country', { length: 50 }).default('US'),

  // Vehicle Information
  vehicleYear: integer('vehicle_year'),
  vehicleMake: varchar('vehicle_make', { length: 100 }),
  vehicleModel: varchar('vehicle_model', { length: 100 }),
  vehicleTrim: varchar('vehicle_trim', { length: 100 }),
  vehicleVin: varchar('vehicle_vin', { length: 17 }),
  vehicleStock: varchar('vehicle_stock', { length: 50 }),
  vehicleCondition: varchar('vehicle_condition', { length: 50 }),
  vehiclePrice: integer('vehicle_price'), // Stored in cents
  vehicleMileage: integer('vehicle_mileage'),

  // Vendor Information
  vendorName: varchar('vendor_name', { length: 255 }),
  vendorEmail: varchar('vendor_email', { length: 255 }),
  vendorPhone: varchar('vendor_phone', { length: 50 }),
  vendorAddress: text('vendor_address'),
  vendorCity: varchar('vendor_city', { length: 100 }),
  vendorState: varchar('vendor_state', { length: 50 }),
  vendorZip: varchar('vendor_zip', { length: 20 }),

  // Provider Information
  providerName: varchar('provider_name', { length: 255 }),
  providerEmail: varchar('provider_email', { length: 255 }),
  providerPhone: varchar('provider_phone', { length: 50 }),
  providerService: varchar('provider_service', { length: 100 }),

  // Trade-in Information
  tradeInYear: integer('trade_in_year'),
  tradeInMake: varchar('trade_in_make', { length: 100 }),
  tradeInModel: varchar('trade_in_model', { length: 100 }),
  tradeInTrim: varchar('trade_in_trim', { length: 100 }),
  tradeInVin: varchar('trade_in_vin', { length: 17 }),
  tradeInMileage: integer('trade_in_mileage'),
  tradeInCondition: varchar('trade_in_condition', { length: 50 }),
  tradeInValue: integer('trade_in_value'), // Stored in cents

  // Additional Information
  comments: text('comments'),
  timeFrame: varchar('time_frame', { length: 100 }),

  // Source Email Information
  sourceEmailId: varchar('source_email_id', { length: 255 }),
  sourceEmailSubject: varchar('source_email_subject', { length: 500 }),
  sourceEmailFrom: varchar('source_email_from', { length: 255 }),
  sourceEmailDate: timestamp('source_email_date'),

  // Processing Information
  dealershipId: integer('dealership_id'), // Foreign key to dealerships table
  leadStatus: varchar('lead_status', { length: 50 }).notNull().default('new'),
  processingStatus: varchar('processing_status', { length: 50 }).notNull().default('pending'),
  deduplicationHash: varchar('deduplication_hash', { length: 64 }).notNull(),

  // Raw Data Storage
  rawAdfXml: text('raw_adf_xml').notNull(),
  parsedAdfData: json('parsed_adf_data').$type<AdfXmlStructure>(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  processedAt: timestamp('processed_at'),
}, table => ({
  // Indexes for performance
  deduplicationIdx: index('adf_leads_deduplication_idx').on(table.deduplicationHash),
  dealershipIdx: index('adf_leads_dealership_idx').on(table.dealershipId),
  customerEmailIdx: index('adf_leads_customer_email_idx').on(table.customerEmail),
  customerPhoneIdx: index('adf_leads_customer_phone_idx').on(table.customerPhone),
  vendorNameIdx: index('adf_leads_vendor_name_idx').on(table.vendorName),
  requestDateIdx: index('adf_leads_request_date_idx').on(table.requestDate),
  leadStatusIdx: index('adf_leads_lead_status_idx').on(table.leadStatus),
  processingStatusIdx: index('adf_leads_processing_status_idx').on(table.processingStatus),

  // Unique constraint for deduplication
  uniqueDeduplication: unique('adf_leads_unique_deduplication').on(table.deduplicationHash),
}));

// ADF Email Queue table for processing pipeline
export const adfEmailQueue = pgTable('adf_email_queue', {
  id: serial('id').primaryKey(),

  // Email Metadata
  emailMessageId: varchar('email_message_id', { length: 255 }).notNull(),
  emailSubject: varchar('email_subject', { length: 500 }),
  emailFrom: varchar('email_from', { length: 255 }).notNull(),
  emailTo: varchar('email_to', { length: 255 }).notNull(),
  emailDate: timestamp('email_date').notNull(),

  // Email Content
  rawEmailContent: text('raw_email_content'),
  adfXmlContent: text('adf_xml_content'),
  attachmentInfo: json('attachment_info').$type<Array<{
    filename: string;
    contentType: string;
    size: number;
  }>>().default([]),

  // Processing Information
  processingStatus: varchar('processing_status', { length: 50 }).notNull().default('pending'),
  processingAttempts: integer('processing_attempts').notNull().default(0),
  maxRetries: integer('max_retries').notNull().default(3),
  processingErrors: json('processing_errors').$type<string[]>().default([]),
  resultingLeadId: integer('resulting_lead_id'), // Foreign key to adf_leads

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  processedAt: timestamp('processed_at'),
}, table => ({
  // Indexes
  emailMessageIdIdx: index('adf_email_queue_message_id_idx').on(table.emailMessageId),
  processingStatusIdx: index('adf_email_queue_processing_status_idx').on(table.processingStatus),
  emailFromIdx: index('adf_email_queue_email_from_idx').on(table.emailFrom),
  emailDateIdx: index('adf_email_queue_email_date_idx').on(table.emailDate),
  resultingLeadIdx: index('adf_email_queue_resulting_lead_idx').on(table.resultingLeadId),

  // Unique constraint for email message ID
  uniqueEmailMessage: unique('adf_email_queue_unique_message').on(table.emailMessageId),
}));

// ADF Processing Logs table for audit trail
export const adfProcessingLogs = pgTable('adf_processing_logs', {
  id: serial('id').primaryKey(),

  // Reference Information
  adfLeadId: integer('adf_lead_id'), // Foreign key to adf_leads (nullable for pre-lead processing steps)
  emailQueueId: integer('email_queue_id'), // Foreign key to adf_email_queue

  // Processing Step Information
  processStep: varchar('process_step', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'warning', 'error'
  message: text('message').notNull(),
  errorDetails: json('error_details').$type<Record<string, any>>().default({}),

  // Timing Information
  processingTimeMs: integer('processing_time_ms'),

  // Timestamp
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  // Indexes
  adfLeadIdx: index('adf_processing_logs_lead_idx').on(table.adfLeadId),
  emailQueueIdx: index('adf_processing_logs_queue_idx').on(table.emailQueueId),
  processStepIdx: index('adf_processing_logs_step_idx').on(table.processStep),
  statusIdx: index('adf_processing_logs_status_idx').on(table.status),
  createdAtIdx: index('adf_processing_logs_created_at_idx').on(table.createdAt),
}));

// Relations
export const adfLeadsRelations = relations(adfLeads, ({ many, one }) => ({
  processingLogs: many(adfProcessingLogs),
  emailQueue: one(adfEmailQueue, {
    fields: [adfLeads.sourceEmailId],
    references: [adfEmailQueue.emailMessageId],
  }),
}));

export const adfEmailQueueRelations = relations(adfEmailQueue, ({ one, many }) => ({
  resultingLead: one(adfLeads, {
    fields: [adfEmailQueue.resultingLeadId],
    references: [adfLeads.id],
  }),
  processingLogs: many(adfProcessingLogs),
}));

export const adfProcessingLogsRelations = relations(adfProcessingLogs, ({ one }) => ({
  adfLead: one(adfLeads, {
    fields: [adfProcessingLogs.adfLeadId],
    references: [adfLeads.id],
  }),
  emailQueue: one(adfEmailQueue, {
    fields: [adfProcessingLogs.emailQueueId],
    references: [adfEmailQueue.id],
  }),
}));

// Create insert schemas
export const insertAdfLeadSchema = createInsertSchema(adfLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertAdfEmailQueueSchema = createInsertSchema(adfEmailQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export const insertAdfProcessingLogSchema = createInsertSchema(adfProcessingLogs).omit({
  id: true,
  createdAt: true
});

// Types
export type AdfLead = typeof adfLeads.$inferSelect;
export type InsertAdfLead = z.infer<typeof insertAdfLeadSchema>;

export type AdfEmailQueue = typeof adfEmailQueue.$inferSelect;
export type InsertAdfEmailQueue = z.infer<typeof insertAdfEmailQueueSchema>;

export type AdfProcessingLog = typeof adfProcessingLogs.$inferSelect;
export type InsertAdfProcessingLog = z.infer<typeof insertAdfProcessingLogSchema>;