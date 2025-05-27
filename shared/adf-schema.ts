import { pgTable, serial, text, varchar, timestamp, boolean, integer, json, unique, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
// Import from schema.ts to avoid circular dependencies
import { dealerships } from "./schema";

// ADF Lead Status enum
export const adfLeadStatuses = ['new', 'contacted', 'qualified', 'unqualified', 'closed', 'duplicate'] as const;
export type AdfLeadStatus = typeof adfLeadStatuses[number];

// ADF Request Types enum  
export const adfRequestTypes = ['New', 'Used', 'Service', 'Parts', 'Finance', 'General'] as const;
export type AdfRequestType = typeof adfRequestTypes[number];

// ADF Processing Status enum
export const adfProcessingStatuses = ['pending', 'processed', 'failed', 'quarantined'] as const;
export type AdfProcessingStatus = typeof adfProcessingStatuses[number];

// Main ADF Leads table based on ADF 1.0 specification
export const adfLeads = pgTable('adf_leads', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').references(() => dealerships.id, { onDelete: 'cascade' }),
  
  // ADF Header Information
  adfVersion: varchar('adf_version', { length: 10 }).default('1.0'),
  requestDate: timestamp('request_date').notNull(),
  
  // Prospect Information (Required)
  prospectId: varchar('prospect_id', { length: 100 }),
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
  vehicleCondition: varchar('vehicle_condition', { length: 20 }), // New, Used, CPO
  vehiclePrice: integer('vehicle_price'), // Price in cents
  vehicleMileage: integer('vehicle_mileage'),
  
  // Vendor/Dealership Information
  vendorName: varchar('vendor_name', { length: 255 }),
  vendorEmail: varchar('vendor_email', { length: 255 }),
  vendorPhone: varchar('vendor_phone', { length: 50 }),
  vendorAddress: text('vendor_address'),
  vendorCity: varchar('vendor_city', { length: 100 }),
  vendorState: varchar('vendor_state', { length: 50 }),
  vendorZip: varchar('vendor_zip', { length: 20 }),
  
  // Provider Information (Lead Source)
  providerName: varchar('provider_name', { length: 255 }),
  providerEmail: varchar('provider_email', { length: 255 }),
  providerPhone: varchar('provider_phone', { length: 50 }),
  providerService: varchar('provider_service', { length: 100 }), // AutoTrader, Cars.com, etc.
  
  // Request Details
  requestType: varchar('request_type', { length: 50 }).$type<AdfRequestType>(),
  requestCategory: varchar('request_category', { length: 100 }),
  comments: text('comments'),
  timeFrame: varchar('time_frame', { length: 100 }),
  
  // Trade-in Information
  tradeInYear: integer('trade_in_year'),
  tradeInMake: varchar('trade_in_make', { length: 100 }),
  tradeInModel: varchar('trade_in_model', { length: 100 }),
  tradeInTrim: varchar('trade_in_trim', { length: 100 }),
  tradeInVin: varchar('trade_in_vin', { length: 17 }),
  tradeInMileage: integer('trade_in_mileage'),
  tradeInCondition: varchar('trade_in_condition', { length: 50 }),
  tradeInValue: integer('trade_in_value'), // Value in cents
  
  // Lead Status and Processing
  leadStatus: varchar('lead_status', { length: 50 }).$type<AdfLeadStatus>().default('new'),
  processingStatus: varchar('processing_status', { length: 50 }).$type<AdfProcessingStatus>().default('pending'),
  
  // Source Email Metadata
  sourceEmailId: varchar('source_email_id', { length: 255 }),
  sourceEmailSubject: varchar('source_email_subject', { length: 500 }),
  sourceEmailFrom: varchar('source_email_from', { length: 255 }),
  sourceEmailDate: timestamp('source_email_date'),
  
  // ADF XML and Processing Data
  rawAdfXml: text('raw_adf_xml').notNull(), // Store original XML for audit
  parsedAdfData: json('parsed_adf_data').$type<Record<string, any>>().default({}), // Full parsed structure
  validationErrors: json('validation_errors').$type<string[]>().default([]),
  processingErrors: json('processing_errors').$type<string[]>().default([]),
  
  // Deduplication Hash
  deduplicationHash: varchar('deduplication_hash', { length: 64 }).notNull(), // SHA-256 hash for dedup
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, table => ({
  // Indexes for performance
  dealershipIdx: index('adf_leads_dealership_idx').on(table.dealershipId),
  requestDateIdx: index('adf_leads_request_date_idx').on(table.requestDate),
  customerEmailIdx: index('adf_leads_customer_email_idx').on(table.customerEmail),
  processingStatusIdx: index('adf_leads_processing_status_idx').on(table.processingStatus),
  leadStatusIdx: index('adf_leads_lead_status_idx').on(table.leadStatus),
  
  // Unique constraint for deduplication
  uniqueDeduplication: unique('adf_leads_dedup_unique').on(table.deduplicationHash),
  
  // Composite index for common queries
  statusDateIdx: index('adf_leads_status_date_idx').on(table.processingStatus, table.createdAt),
}));

// ADF Processing Log table for detailed audit trail
export const adfProcessingLogs = pgTable('adf_processing_logs', {
  id: serial('id').primaryKey(),
  adfLeadId: integer('adf_lead_id').references(() => adfLeads.id, { onDelete: 'cascade' }),
  
  // Processing details
  processStep: varchar('process_step', { length: 100 }).notNull(), // email_fetch, xml_parse, validation, mapping, storage
  status: varchar('status', { length: 50 }).notNull(), // success, warning, error
  message: text('message'),
  errorDetails: json('error_details').$type<Record<string, any>>().default({}),
  
  // Processing metadata
  processingDuration: integer('processing_duration'), // Duration in milliseconds
  emailMessageId: varchar('email_message_id', { length: 255 }),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  adfLeadIdx: index('adf_processing_logs_lead_idx').on(table.adfLeadId),
  processStepIdx: index('adf_processing_logs_step_idx').on(table.processStep),
  statusIdx: index('adf_processing_logs_status_idx').on(table.status),
  createdAtIdx: index('adf_processing_logs_created_at_idx').on(table.createdAt),
}));

// ADF Email Queue table for managing email processing
export const adfEmailQueue = pgTable('adf_email_queue', {
  id: serial('id').primaryKey(),
  
  // Email identification
  emailMessageId: varchar('email_message_id', { length: 255 }).notNull().unique(),
  emailSubject: varchar('email_subject', { length: 500 }),
  emailFrom: varchar('email_from', { length: 255 }).notNull(),
  emailTo: varchar('email_to', { length: 255 }),
  emailDate: timestamp('email_date').notNull(),
  
  // Processing status
  processingStatus: varchar('processing_status', { length: 50 }).$type<AdfProcessingStatus>().default('pending'),
  processingAttempts: integer('processing_attempts').default(0),
  maxRetries: integer('max_retries').default(3),
  
  // Email content
  rawEmailContent: text('raw_email_content'), // Full email for debugging
  adfXmlContent: text('adf_xml_content'), // Extracted ADF XML
  attachmentInfo: json('attachment_info').$type<{
    filename: string;
    contentType: string;
    size: number;
  }[]>().default([]),
  
  // Processing results
  resultingLeadId: integer('resulting_lead_id').references(() => adfLeads.id),
  processingErrors: json('processing_errors').$type<string[]>().default([]),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
  nextRetryAt: timestamp('next_retry_at'),
}, table => ({
  processingStatusIdx: index('adf_email_queue_status_idx').on(table.processingStatus),
  emailFromIdx: index('adf_email_queue_from_idx').on(table.emailFrom),
  emailDateIdx: index('adf_email_queue_date_idx').on(table.emailDate),
  nextRetryIdx: index('adf_email_queue_retry_idx').on(table.nextRetryAt),
}));

// Relations
export const adfLeadsRelations = relations(adfLeads, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [adfLeads.dealershipId],
    references: [dealerships.id],
  }),
  processingLogs: many(adfProcessingLogs),
  sourceEmail: one(adfEmailQueue, {
    fields: [adfLeads.sourceEmailId],
    references: [adfEmailQueue.emailMessageId],
  }),
}));

export const adfProcessingLogsRelations = relations(adfProcessingLogs, ({ one }) => ({
  adfLead: one(adfLeads, {
    fields: [adfProcessingLogs.adfLeadId],
    references: [adfLeads.id],
  }),
}));

export const adfEmailQueueRelations = relations(adfEmailQueue, ({ one }) => ({
  resultingLead: one(adfLeads, {
    fields: [adfEmailQueue.resultingLeadId],
    references: [adfLeads.id],
  }),
}));

// Zod Schemas for validation
export const insertAdfLeadSchema = createInsertSchema(adfLeads).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  processedAt: true 
});

export const insertAdfProcessingLogSchema = createInsertSchema(adfProcessingLogs).omit({ 
  id: true, 
  createdAt: true 
});

export const insertAdfEmailQueueSchema = createInsertSchema(adfEmailQueue).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  processedAt: true 
});

// Types
export type AdfLead = typeof adfLeads.$inferSelect;
export type InsertAdfLead = z.infer<typeof insertAdfLeadSchema>;

export type AdfProcessingLog = typeof adfProcessingLogs.$inferSelect;
export type InsertAdfProcessingLog = z.infer<typeof insertAdfProcessingLogSchema>;

export type AdfEmailQueue = typeof adfEmailQueue.$inferSelect;
export type InsertAdfEmailQueue = z.infer<typeof insertAdfEmailQueueSchema>;

// ADF XML Schema validation interface
export interface AdfXmlStructure {
  adf: {
    $: {
      version: string;
    };
    prospect: {
      requestdate: string;
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
      customer: {
        contact: {
          name: {
            part: Array<{
              $: { type: string };
              _: string;
            }>;
          };
          email?: string;
          phone?: {
            $: { type?: string; time?: string };
            _: string;
          };
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
      vendor: {
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
      comments?: string;
      timeframe?: string;
      trade?: {
        vehicle: {
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
    };
  };
}