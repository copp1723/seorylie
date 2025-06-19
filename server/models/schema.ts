import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  serial,
  uuid,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const userRoleEnum = pgEnum('user_role', ['super', 'agency', 'dealer']);

// ---------------------------------------------------------------------------
// Tenants (multi-tenant root)
// ---------------------------------------------------------------------------
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  brand: jsonb('brand'),          // {logoUrl, primaryColor, ...}
  parentId: uuid('parent_id').references(() => tenants.id), // agency → null, dealer → agencyId
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: userRoleEnum('role').default('dealer'),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true),
});

// ---------------------------------------------------------------------------
// SEO Requests
// ---------------------------------------------------------------------------
export const seoRequests = pgTable('seo_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('pending'),
  priority: text('priority').default('medium'),
  assignedTo: integer('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  data: text('data'),
  generatedAt: timestamp('generated_at').defaultNow(),
  isPublic: boolean('is_public').default(false),
});

// ---------------------------------------------------------------------------
// Seoworks Tasks (unchanged)
// ---------------------------------------------------------------------------
export const seoworksTasks = pgTable('seoworks_tasks', {
  id: text('id').primaryKey(),
  taskType: text('task_type').notNull(),
  status: text('status').notNull(),
  completionNotes: text('completion_notes'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ---------------------------------------------------------------------------
// Audit Logs
// ---------------------------------------------------------------------------
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  action: text('action').notNull(),
  resource: text('resource'),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  traceId: text('trace_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ---------------------------------------------------------------------------
// GA4 tables (already uuid tenantId) – unchanged except reference arrow
// ---------------------------------------------------------------------------
export const ga4Properties = pgTable('ga4_properties', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull(),
  propertyName: text('property_name').notNull(),
  websiteUrl: text('website_url'),
  isActive: boolean('is_active').default(true),
  accessGrantedAt: timestamp('access_granted_at'),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: text('sync_status').default('pending'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const ga4ServiceAccount = pgTable('ga4_service_account', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  environment: text('environment').notNull().default('production'),
  serviceAccountEmail: text('service_account_email').notNull(),
  projectId: text('project_id').notNull(),
  privateKeyEncrypted: text('private_key_encrypted').notNull(),
  keyId: text('key_id').notNull(),
  quotaLimits: jsonb('quota_limits'),
  status: text('status').default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const ga4ReportCache = pgTable('ga4_report_cache', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  propertyId: text('property_id').notNull(),
  reportType: text('report_type').notNull(),
  dateRange: jsonb('date_range').notNull(),
  reportData: jsonb('report_data').notNull(),
  generatedAt: timestamp('generated_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  cacheKey: text('cache_key').notNull().unique(),
});

export const ga4ApiUsage = pgTable('ga4_api_usage', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  propertyId: text('property_id'),
  endpoint: text('endpoint').notNull(),
  requestCount: integer('request_count').default(1),
  quotaConsumed: integer('quota_consumed').default(1),
  responseTime: integer('response_time'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  requestDate: timestamp('request_date').defaultNow(),
  hour: text('hour').notNull(),
  day: text('day').notNull(),
});

// ---------------------------------------------------------------------------
// Export Types
// ---------------------------------------------------------------------------
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type SeoRequest = typeof seoRequests.$inferSelect;
export type NewSeoRequest = typeof seoRequests.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type SeoworksTask = typeof seoworksTasks.$inferSelect;
export type NewSeoworksTask = typeof seoworksTasks.$inferInsert;
export type GA4Property = typeof ga4Properties.$inferSelect;
export type NewGA4Property = typeof ga4Properties.$inferInsert;
export type GA4ServiceAccount = typeof ga4ServiceAccount.$inferSelect;
export type NewGA4ServiceAccount = typeof ga4ServiceAccount.$inferInsert;
export type GA4ReportCache = typeof ga4ReportCache.$inferSelect;
export type NewGA4ReportCache = typeof ga4ReportCache.$inferInsert;
export type GA4ApiUsage = typeof ga4ApiUsage.$inferSelect;
export type NewGA4ApiUsage = typeof ga4ApiUsage.$inferInsert;
