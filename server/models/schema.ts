/**
 * @file Database Schema for Rylie SEO Hub
 * @description Core data models using Drizzle ORM with PostgreSQL
 */

import { pgTable, text, timestamp, integer, jsonb, boolean, uuid, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - stores all user types (clients, agencies, admins)
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // 'client', 'agency', 'admin'
  status: text('status').notNull().default('active'), // 'active', 'inactive', 'suspended'
  firstName: text('first_name'),
  lastName: text('last_name'),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  agencyId: uuid('agency_id').references(() => agencies.id),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
  tenantIdx: index('users_tenant_idx').on(table.tenantId),
}));

// Tenants table - white-label client organizations
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  domain: text('domain'),
  branding: jsonb('branding'), // Logo, colors, company name, etc.
  settings: jsonb('settings'),
  status: text('status').notNull().default('active'),
  subscriptionTier: text('subscription_tier').default('basic'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Agencies table - SEO service providers
export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  capabilities: jsonb('capabilities'), // Types of work they can handle
  settings: jsonb('settings'),
  status: text('status').notNull().default('active'),
  performanceMetrics: jsonb('performance_metrics'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Requests table - all client SEO requests
export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'blog', 'page', 'gbp', 'maintenance', 'install'
  status: text('status').notNull().default('pending'), // 'pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled'
  priority: text('priority').default('medium'), // 'low', 'medium', 'high', 'urgent'
  title: text('title').notNull(),
  description: text('description'),
  requirements: jsonb('requirements').notNull(), // Structured request data based on type
  clientId: uuid('client_id').notNull().references(() => users.id),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  assignedAgencyId: uuid('assigned_agency_id').references(() => agencies.id),
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  deadline: timestamp('deadline'),
  estimatedHours: integer('estimated_hours'),
  actualHours: integer('actual_hours'),
  deliverables: jsonb('deliverables'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  clientIdx: index('requests_client_idx').on(table.clientId),
  statusIdx: index('requests_status_idx').on(table.status),
  typeIdx: index('requests_type_idx').on(table.type),
  agencyIdx: index('requests_agency_idx').on(table.assignedAgencyId),
  tenantIdx: index('requests_tenant_idx').on(table.tenantId),
}));

// Messages table - chat messages and communication
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  senderRole: text('sender_role').notNull(), // 'client', 'agency', 'admin', 'system'
  requestId: uuid('request_id').references(() => requests.id),
  threadId: uuid('thread_id').notNull(),
  parentMessageId: uuid('parent_message_id').references(() => messages.id),
  messageType: text('message_type').default('text'), // 'text', 'file', 'system', 'update'
  metadata: jsonb('metadata'), // File attachments, system data, etc.
  isAnonymized: boolean('is_anonymized').default(false),
  processedByAI: boolean('processed_by_ai').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  editedAt: timestamp('edited_at'),
}, (table) => ({
  threadIdx: index('messages_thread_idx').on(table.threadId),
  requestIdx: index('messages_request_idx').on(table.requestId),
  senderIdx: index('messages_sender_idx').on(table.senderId),
  createdIdx: index('messages_created_idx').on(table.createdAt),
}));

// Reports table - generated reports and analytics
export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // 'seo_overview', 'content_performance', 'agency_performance'
  title: text('title').notNull(),
  period: text('period').notNull(), // '7d', '30d', '90d', 'custom'
  dateRange: jsonb('date_range').notNull(),
  data: jsonb('data').notNull(),
  summary: text('summary'),
  recommendations: jsonb('recommendations'),
  clientId: uuid('client_id').references(() => users.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  agencyId: uuid('agency_id').references(() => agencies.id),
  generatedBy: uuid('generated_by').references(() => users.id),
  status: text('status').default('generated'), // 'generating', 'generated', 'failed'
  fileUrl: text('file_url'),
  format: text('format').default('json'), // 'json', 'pdf', 'csv'
  isScheduled: boolean('is_scheduled').default(false),
  branding: jsonb('branding'),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  clientIdx: index('reports_client_idx').on(table.clientId),
  tenantIdx: index('reports_tenant_idx').on(table.tenantId),
  typeIdx: index('reports_type_idx').on(table.type),
  statusIdx: index('reports_status_idx').on(table.status),
}));

// Audit logs table - comprehensive system audit trail
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  entityType: text('entity_type'), // 'user', 'request', 'message', 'report'
  entityId: uuid('entity_id'),
  userId: uuid('user_id').references(() => users.id),
  userRole: text('user_role'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  actionIdx: index('audit_logs_action_idx').on(table.action),
  userIdx: index('audit_logs_user_idx').on(table.userId),
  entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  createdIdx: index('audit_logs_created_idx').on(table.createdAt),
}));

// Report schedules table - automated reporting configuration
export const reportSchedules = pgTable('report_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  reportType: text('report_type').notNull(),
  frequency: text('frequency').notNull(), // 'daily', 'weekly', 'monthly', 'quarterly'
  clientId: uuid('client_id').references(() => users.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  recipients: jsonb('recipients').notNull(), // Email addresses
  settings: jsonb('settings'), // Report parameters
  status: text('status').default('active'), // 'active', 'paused', 'inactive'
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  clientIdx: index('report_schedules_client_idx').on(table.clientId),
  statusIdx: index('report_schedules_status_idx').on(table.status),
  nextRunIdx: index('report_schedules_next_run_idx').on(table.nextRun),
}));

// File uploads table - track all file uploads
export const fileUploads = pgTable('file_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  filename: text('filename').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
  requestId: uuid('request_id').references(() => requests.id),
  messageId: uuid('message_id').references(() => messages.id),
  storageUrl: text('storage_url').notNull(),
  isPublic: boolean('is_public').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uploaderIdx: index('file_uploads_uploader_idx').on(table.uploadedBy),
  requestIdx: index('file_uploads_request_idx').on(table.requestId),
}));

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  agency: one(agencies, {
    fields: [users.agencyId],
    references: [agencies.id],
  }),
  requests: many(requests),
  messages: many(messages),
  auditLogs: many(auditLogs),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  requests: many(requests),
  reports: many(reports),
}));

export const agenciesRelations = relations(agencies, ({ many }) => ({
  users: many(users),
  requests: many(requests),
  reports: many(reports),
}));

export const requestsRelations = relations(requests, ({ one, many }) => ({
  client: one(users, {
    fields: [requests.clientId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [requests.tenantId],
    references: [tenants.id],
  }),
  assignedAgency: one(agencies, {
    fields: [requests.assignedAgencyId],
    references: [agencies.id],
  }),
  assignedUser: one(users, {
    fields: [requests.assignedUserId],
    references: [users.id],
  }),
  messages: many(messages),
  fileUploads: many(fileUploads),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  request: one(requests, {
    fields: [messages.requestId],
    references: [requests.id],
  }),
  parentMessage: one(messages, {
    fields: [messages.parentMessageId],
    references: [messages.id],
  }),
  replies: many(messages),
  fileUploads: many(fileUploads),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  client: one(users, {
    fields: [reports.clientId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [reports.tenantId],
    references: [tenants.id],
  }),
  agency: one(agencies, {
    fields: [reports.agencyId],
    references: [agencies.id],
  }),
  generatedBy: one(users, {
    fields: [reports.generatedBy],
    references: [users.id],
  }),
}));