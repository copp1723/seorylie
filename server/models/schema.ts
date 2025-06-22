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
  index,
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
  parentId: uuid('parent_id').references(() => tenants.id, { onDelete: 'set null' }), // agency → null, dealer → agencyId
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true).notNull(),
}, (table) => ({
  slugIdx: index('tenants_slug_idx').on(table.slug),
  nameIdx: index('tenants_name_idx').on(table.name),
  parentIdIdx: index('tenants_parent_id_idx').on(table.parentId),
  isActiveIdx: index('tenants_is_active_idx').on(table.isActive),
}));

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(), // Required name field for proper user identification
  role: userRoleEnum('role').default('dealer'),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true).notNull(), // Non-nullable with default
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  nameIdx: index('users_name_idx').on(table.name),
  tenantIdIdx: index('users_tenant_id_idx').on(table.tenantId),
  isActiveIdx: index('users_is_active_idx').on(table.isActive),
}));

// ---------------------------------------------------------------------------
// SEO Requests
// ---------------------------------------------------------------------------
export const seoRequests = pgTable('seo_requests', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('pending'),
  priority: text('priority').default('medium'),
  assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  userIdIdx: index('seo_requests_user_id_idx').on(table.userId),
  tenantIdIdx: index('seo_requests_tenant_id_idx').on(table.tenantId),
  statusIdx: index('seo_requests_status_idx').on(table.status),
  priorityIdx: index('seo_requests_priority_idx').on(table.priority),
  assignedToIdx: index('seo_requests_assigned_to_idx').on(table.assignedTo),
  createdAtIdx: index('seo_requests_created_at_idx').on(table.createdAt),
}));

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  data: text('data'),
  generatedAt: timestamp('generated_at').defaultNow(),
  isPublic: boolean('is_public').default(false),
}, (table) => ({
  userIdIdx: index('reports_user_id_idx').on(table.userId),
  tenantIdIdx: index('reports_tenant_id_idx').on(table.tenantId),
  typeIdx: index('reports_type_idx').on(table.type),
  generatedAtIdx: index('reports_generated_at_idx').on(table.generatedAt),
  isPublicIdx: index('reports_is_public_idx').on(table.isPublic),
}));

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
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resource: text('resource'),
  resourceId: text('resource_id'),
  details: text('details'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  traceId: text('trace_id'),
  category: text('category'), // Added missing category field
  isActive: boolean('is_active').default(true).notNull(), // Added missing is_active field
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('audit_logs_user_id_idx').on(table.userId),
  tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId),
  actionIdx: index('audit_logs_action_idx').on(table.action),
  categoryIdx: index('audit_logs_category_idx').on(table.category),
  isActiveIdx: index('audit_logs_is_active_idx').on(table.isActive),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

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
