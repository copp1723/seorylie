import { pgTable, serial, text, varchar, timestamp, boolean, integer, json, unique, foreignKey, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Dealership mode configuration
export const dealershipModes = ['rylie_ai', 'direct_agent'] as const;
export type DealershipMode = typeof dealershipModes[number];

// Communication channels for direct agent mode
export const communicationChannels = ['chat', 'email', 'sms', 'phone'] as const;
export type CommunicationChannel = typeof communicationChannels[number];

// ===== Base Tables =====

// Dealerships table - the core of our multi-tenant system
export const dealerships = pgTable('dealerships', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 100 }).notNull().unique(),
  contact_email: varchar('contact_email', { length: 255 }).notNull(),
  contact_phone: varchar('contact_phone', { length: 50 }),
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 50 }),
  zip: varchar('zip', { length: 20 }),
  website: varchar('website', { length: 255 }),
  description: text('description'),
  // Branding fields
  logo_url: varchar('logo_url', { length: 255 }),
  primary_color: varchar('primary_color', { length: 20 }).default('#000000'),
  secondary_color: varchar('secondary_color', { length: 20 }).default('#ffffff'),
  accent_color: varchar('accent_color', { length: 20 }).default('#4f46e5'),
  font_family: varchar('font_family', { length: 100 }).default('Inter, system-ui, sans-serif'),
  // Persona settings
  persona_name: varchar('persona_name', { length: 100 }).default('Rylie'),
  persona_tone: varchar('persona_tone', { length: 50 }).default('friendly'), // friendly, professional, casual, formal
  persona_template: text('persona_template'), // Base persona template to use
  welcome_message: text('welcome_message'), // Custom welcome message for new conversations
  // Mode configuration
  operation_mode: varchar('operation_mode', { length: 50 }).$type<DealershipMode>().default('rylie_ai'),
  // AI Configuration (for Rylie AI mode)
  ai_config: json('ai_config').$type<{
    purecars_api_key?: string;
    purecars_endpoint?: string;
    ai_personality?: string;
    response_delay_ms?: number;
    escalation_triggers?: string[];
  }>().default({}),
  // Direct Agent Configuration (for Direct Agent mode)
  agent_config: json('agent_config').$type<{
    enabled_channels: CommunicationChannel[];
    auto_assignment: boolean;
    working_hours: {
      timezone: string;
      schedule: Record<string, { start: string; end: string; enabled: boolean }>;
    };
    escalation_rules: {
      response_time_minutes: number;
      max_queue_size: number;
      priority_routing: boolean;
    };
    templates: {
      greeting_message?: string;
      away_message?: string;
      queue_message?: string;
    };
  }>().default({
    enabled_channels: ['chat', 'email'],
    auto_assignment: false,
    working_hours: {
      timezone: 'America/New_York',
      schedule: {
        monday: { start: '09:00', end: '17:00', enabled: true },
        tuesday: { start: '09:00', end: '17:00', enabled: true },
        wednesday: { start: '09:00', end: '17:00', enabled: true },
        thursday: { start: '09:00', end: '17:00', enabled: true },
        friday: { start: '09:00', end: '17:00', enabled: true },
        saturday: { start: '10:00', end: '16:00', enabled: true },
        sunday: { start: '12:00', end: '16:00', enabled: false }
      }
    },
    escalation_rules: {
      response_time_minutes: 5,
      max_queue_size: 10,
      priority_routing: true
    },
    templates: {}
  }),
  // Lead routing configuration
  lead_routing: json('lead_routing').$type<{
    auto_create_leads: boolean;
    default_lead_source: string;
    lead_assignment_strategy: 'round_robin' | 'least_busy' | 'skill_based' | 'manual';
    scoring_enabled: boolean;
    follow_up_automation: boolean;
  }>().default({
    auto_create_leads: true,
    default_lead_source: 'website_chat',
    lead_assignment_strategy: 'round_robin',
    scoring_enabled: true,
    follow_up_automation: true
  }),
  // Operational settings
  active: boolean('active').default(true),
  settings: json('settings').$type<Record<string, any>>().default({}),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// User roles enum
export const userRoles = ['super_admin', 'dealership_admin', 'manager', 'user'] as const;
export type UserRole = typeof userRoles[number];

// Users table with dealership_id foreign key
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }),
  name: varchar('name', { length: 255 }),
  role: varchar('role', { length: 50 }).$type<UserRole>().default('user'),
  dealership_id: integer('dealership_id').references(() => dealerships.id, { onDelete: 'set null' }),
  is_verified: boolean('is_verified').default(false),
  verification_token: varchar('verification_token', { length: 255 }),
  reset_token: varchar('reset_token', { length: 255 }),
  reset_token_expiry: timestamp('reset_token_expiry'),
  last_login: timestamp('last_login'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, table => ({
  dealershipIdx: index('user_dealership_idx').on(table.dealership_id),
  emailIdx: index('user_email_idx').on(table.email),
}));

// API Keys table
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 255 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
});

// Personas table
export const personas = pgTable('personas', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  isDefault: boolean('is_default').default(false),
  promptTemplate: text('prompt_template').notNull(),
  arguments: json('arguments').$type<Record<string, any>>().default({}),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// Vehicle inventory table
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  vin: varchar('vin', { length: 17 }).notNull(),
  stockNumber: varchar('stock_number', { length: 50 }),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  trim: varchar('trim', { length: 100 }),
  bodyStyle: varchar('body_style', { length: 100 }),
  extColor: varchar('ext_color', { length: 100 }),
  intColor: varchar('int_color', { length: 100 }),
  exteriorColor: varchar('exterior_color', { length: 100 }), // Alternative naming
  condition: varchar('condition', { length: 50 }).default('New'),
  price: integer('price'), // Current price (can be different from salePrice)
  mileage: integer('mileage'),
  engine: varchar('engine', { length: 255 }),
  transmission: varchar('transmission', { length: 100 }),
  drivetrain: varchar('drivetrain', { length: 100 }),
  fuelType: varchar('fuel_type', { length: 50 }),
  fuelEconomy: integer('fuel_economy'),
  msrp: integer('msrp'),
  salePrice: integer('sale_price'),
  status: varchar('status', { length: 50 }).default('Available'),
  certified: boolean('certified').default(false),
  description: text('description'),
  features: json('features').$type<string[]>().default([]),
  categoryTags: json('category_tags').$type<string[]>().default([]),
  images: json('images').$type<string[]>().default([]),
  videoUrl: varchar('video_url', { length: 255 }),
  isActive: boolean('is_active').default(true),
  lastSeen: timestamp('last_seen').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, table => ({
  uniqueVin: unique('unique_vin').on(table.dealershipId, table.vin),
  dealershipIdx: index('vehicle_dealership_idx').on(table.dealershipId),
}));

// Magic link invitations table
export const magicLinkInvitations = pgTable('magic_link_invitations', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').references(() => dealerships.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).$type<UserRole>().default('user'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  used: boolean('used').default(false),
  usedAt: timestamp('used_at'),
  invitedBy: integer('invited_by').references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, table => ({
  dealershipIdx: index('invitation_dealership_idx').on(table.dealershipId),
}));

// Sessions table for express-session
export const sessions = pgTable('sessions', {
  sid: varchar('sid', { length: 255 }).primaryKey(),
  sess: json('sess').notNull(),
  expire: timestamp('expire').notNull(),
});

export const reportSchedules = pgTable('report_schedules', {
  id: serial('id').primaryKey(),
  active: boolean('active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// Tools table - registry of available tools for agents
export const tools = pgTable('tools', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  service: varchar('service', { length: 255 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 50 }).default('POST').notNull(),
  input_schema: json('input_schema'),
  output_schema: json('output_schema'),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  serviceIdx: index('idx_tools_service').on(table.service),
  categoryIdx: index('idx_tools_category').on(table.category),
}));

// Agent tools table - maps agents to their available tools
export const agent_tools = pgTable('agent_tools', {
  id: serial('id').primaryKey(),
  agent_id: varchar('agent_id', { length: 255 }).notNull(),
  tool_id: integer('tool_id').notNull().references(() => tools.id, { onDelete: 'cascade' }),
  permissions: json('permissions'),
  config_override: json('config_override'),
  is_enabled: boolean('is_enabled').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, table => ({
  agentIdx: index('idx_agent_tools_agent_id').on(table.agent_id),
  uniqueAgentTool: unique('idx_agent_tools_unique').on(table.agent_id, table.tool_id),
}));

// ===== Relations =====

export const dealershipsRelations = relations(dealerships, ({ many }) => ({
  users: many(users),
  vehicles: many(vehicles),
  personas: many(personas),
  apiKeys: many(apiKeys),
  magicLinkInvitations: many(magicLinkInvitations),
}));

export const usersRelations = relations(users, ({ one }) => ({
  dealership: one(dealerships, {
    fields: [users.dealership_id],
    references: [dealerships.id],
  }),
}));

export const magicLinkInvitationsRelations = relations(magicLinkInvitations, ({ one }) => ({
  dealership: one(dealerships, {
    fields: [magicLinkInvitations.dealershipId],
    references: [dealerships.id],
  }),
  invitedByUser: one(users, {
    fields: [magicLinkInvitations.invitedBy],
    references: [users.id],
  }),
}));

export const toolsRelations = relations(tools, ({ many }) => ({
  agent_tools: many(agent_tools),
}));

export const agentToolsRelations = relations(agent_tools, ({ one }) => ({
  tool: one(tools, {
    fields: [agent_tools.tool_id],
    references: [tools.id],
  }),
}));

// ===== Zod Schemas =====

export const insertDealershipSchema = createInsertSchema(dealerships).omit({ id: true, created_at: true, updated_at: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, created_at: true, updated_at: true });
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ id: true, created_at: true, updated_at: true });
export const insertPersonaSchema = createInsertSchema(personas).omit({ id: true, created_at: true, updated_at: true });
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, created_at: true });
export const insertMagicLinkInvitationSchema = createInsertSchema(magicLinkInvitations).omit({ id: true, createdAt: true });
export const insertToolSchema = createInsertSchema(tools).omit({ id: true, created_at: true, updated_at: true });
export const insertAgentToolSchema = createInsertSchema(agent_tools).omit({ id: true, created_at: true, updated_at: true });

// Types
export type Dealership = typeof dealerships.$inferSelect;
export type InsertDealership = z.infer<typeof insertDealershipSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

export type MagicLinkInvitation = typeof magicLinkInvitations.$inferSelect;
export type InsertMagicLinkInvitation = z.infer<typeof insertMagicLinkInvitationSchema>;

export type Tool = typeof tools.$inferSelect;
export type InsertTool = z.infer<typeof insertToolSchema>;

export type AgentTool = typeof agent_tools.$inferSelect;
export type InsertAgentTool = z.infer<typeof insertAgentToolSchema>;

// Type exports
export type { DealershipMode, CommunicationChannel, UserRole };

// Re-export prompt experiment types
export { 
  type PromptExperiment, 
  type PromptVariant, 
  type ExperimentVariant,
  type CustomerInsight,
  type ResponseSuggestion,
  type PromptExperimentData
} from './prompt-experiment-schema';
