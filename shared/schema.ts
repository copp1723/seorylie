import { relations } from "drizzle-orm";
import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  timestamp, 
  boolean, 
  integer, 
  primaryKey, 
  json,
  unique
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Dealerships table
export const dealerships = pgTable('dealerships', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 255 }).notNull().unique(),
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 255 }),
  address: text('address'),
  city: varchar('city', { length: 255 }),
  state: varchar('state', { length: 255 }),
  zip: varchar('zip', { length: 255 }),
  country: varchar('country', { length: 255 }).default('USA'),
  timezone: varchar('timezone', { length: 255 }).default('America/New_York'),
  isActive: boolean('is_active').default(true),
  mode: varchar('mode', { length: 50 }).default('rylie_ai'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  firstName: varchar('first_name', { length: 255 }),
  lastName: varchar('last_name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('user'),
  dealershipId: integer('dealership_id').references(() => dealerships.id),
  isActive: boolean('is_active').default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Conversations table
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  subject: varchar('subject', { length: 255 }),
  status: varchar('status', { length: 50 }).default('active'),
  channel: varchar('channel', { length: 50 }).default('web'),
  dealershipId: integer('dealership_id').references(() => dealerships.id),
  customerId: integer('customer_id'),
  assignedAgentId: integer('assigned_agent_id').references(() => users.id),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversationId: integer('conversation_id').references(() => conversations.id).notNull(),
  senderId: integer('sender_id'),
  senderType: varchar('sender_type', { length: 50 }).default('user'),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  isRead: boolean('is_read').default(false),
  metadata: json('metadata')
});

// Personas table
export const personas = pgTable('personas', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  promptTemplate: text('prompt_template').notNull(),
  systemMessage: text('system_message'),
  dealershipId: integer('dealership_id').references(() => dealerships.id),
  createdBy: integer('created_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Tools table
export const tools = pgTable('tools', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  service: varchar('service', { length: 255 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  method: varchar('method', { length: 50 }).default('POST'),
  input_schema: json('input_schema'),
  output_schema: json('output_schema'),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

// Agent tools table
export const agent_tools = pgTable('agent_tools', {
  id: serial('id').primaryKey(),
  agent_id: varchar('agent_id', { length: 255 }).notNull(),
  tool_id: integer('tool_id').references(() => tools.id).notNull(),
  permissions: json('permissions'),
  config_override: json('config_override'),
  is_enabled: boolean('is_enabled').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

// Sandboxes table
export const sandboxes = pgTable('sandboxes', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  dealership_id: integer('dealership_id').references(() => dealerships.id),
  owner_id: integer('owner_id').references(() => users.id),
  token_limit_per_hour: integer('token_limit_per_hour').notNull().default(10000),
  token_limit_per_day: integer('token_limit_per_day').notNull().default(100000),
  current_hourly_usage: integer('current_hourly_usage').default(0),
  current_daily_usage: integer('current_daily_usage').default(0),
  usage_reset_hour: timestamp('usage_reset_hour').defaultNow(),
  usage_reset_day: timestamp('usage_reset_day').defaultNow(),
  is_active: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

// Sandbox sessions table
export const sandbox_sessions = pgTable('sandbox_sessions', {
  id: serial('id').primaryKey(),
  sandbox_id: integer('sandbox_id').references(() => sandboxes.id).notNull(),
  session_id: varchar('session_id', { length: 255 }).notNull().unique(),
  user_id: integer('user_id').references(() => users.id),
  websocket_channel: varchar('websocket_channel', { length: 255 }).notNull(),
  is_active: boolean('is_active').default(true),
  last_activity: timestamp('last_activity').defaultNow(),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow()
});

// Token usage logs table
export const token_usage_logs = pgTable('token_usage_logs', {
  id: serial('id').primaryKey(),
  sandbox_id: integer('sandbox_id').references(() => sandboxes.id).notNull(),
  session_id: varchar('session_id', { length: 255 }),
  operation_type: varchar('operation_type', { length: 100 }).notNull(),
  tokens_used: integer('tokens_used').notNull(),
  request_id: varchar('request_id', { length: 255 }),
  created_at: timestamp('created_at').defaultNow()
});

// Relations
export const dealershipsRelations = relations(dealerships, ({ many }) => ({
  users: many(users),
  conversations: many(conversations),
  personas: many(personas),
  sandboxes: many(sandboxes)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [users.dealershipId],
    references: [dealerships.id]
  }),
  assignedConversations: many(conversations),
  createdPersonas: many(personas),
  ownedSandboxes: many(sandboxes)
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [conversations.dealershipId],
    references: [dealerships.id]
  }),
  assignedAgent: one(users, {
    fields: [conversations.assignedAgentId],
    references: [users.id]
  }),
  messages: many(messages)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  })
}));

export const personasRelations = relations(personas, ({ one }) => ({
  dealership: one(dealerships, {
    fields: [personas.dealershipId],
    references: [dealerships.id]
  }),
  creator: one(users, {
    fields: [personas.createdBy],
    references: [users.id]
  })
}));

export const toolsRelations = relations(tools, ({ many }) => ({
  agentTools: many(agent_tools)
}));

export const agentToolsRelations = relations(agent_tools, ({ one }) => ({
  tool: one(tools, {
    fields: [agent_tools.tool_id],
    references: [tools.id]
  })
}));

export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [sandboxes.dealership_id],
    references: [dealerships.id]
  }),
  owner: one(users, {
    fields: [sandboxes.owner_id],
    references: [users.id]
  }),
  sessions: many(sandbox_sessions),
  usageLogs: many(token_usage_logs)
}));

export const sandboxSessionsRelations = relations(sandbox_sessions, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [sandbox_sessions.sandbox_id],
    references: [sandboxes.id]
  }),
  user: one(users, {
    fields: [sandbox_sessions.user_id],
    references: [users.id]
  })
}));

export const tokenUsageLogsRelations = relations(token_usage_logs, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [token_usage_logs.sandbox_id],
    references: [sandboxes.id]
  })
}));

// Zod schemas
export const insertDealershipSchema = createInsertSchema(dealerships);
export const selectDealershipSchema = createSelectSchema(dealerships);

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export const insertPersonaSchema = createInsertSchema(personas);
export const selectPersonaSchema = createSelectSchema(personas);

export const insertToolSchema = createInsertSchema(tools);
export const selectToolSchema = createSelectSchema(tools);

export const insertAgentToolSchema = createInsertSchema(agent_tools);
export const selectAgentToolSchema = createSelectSchema(agent_tools);

export const insertSandboxSchema = createInsertSchema(sandboxes);
export const selectSandboxSchema = createSelectSchema(sandboxes);

export const insertSandboxSessionSchema = createInsertSchema(sandbox_sessions);
export const selectSandboxSessionSchema = createSelectSchema(sandbox_sessions);

export const insertTokenUsageLogSchema = createInsertSchema(token_usage_logs);
export const selectTokenUsageLogSchema = createSelectSchema(token_usage_logs);

// Custom Zod schemas
export const DealershipModeSchema = z.enum(['rylie_ai', 'direct_agent', 'hybrid']);
export type DealershipMode = z.infer<typeof DealershipModeSchema>;

// Types
export type Dealership = z.infer<typeof selectDealershipSchema>;
export type InsertDealership = z.infer<typeof insertDealershipSchema>;

export type User = z.infer<typeof selectUserSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Conversation = z.infer<typeof selectConversationSchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = z.infer<typeof selectMessageSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Persona = z.infer<typeof selectPersonaSchema>;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

export type Tool = z.infer<typeof selectToolSchema>;
export type InsertTool = z.infer<typeof insertToolSchema>;

export type AgentTool = z.infer<typeof selectAgentToolSchema>;
export type InsertAgentTool = z.infer<typeof insertAgentToolSchema>;

export type Sandbox = z.infer<typeof selectSandboxSchema>;
export type InsertSandbox = z.infer<typeof insertSandboxSchema>;

export type SandboxSession = z.infer<typeof selectSandboxSessionSchema>;
export type InsertSandboxSession = z.infer<typeof insertSandboxSessionSchema>;

export type TokenUsageLog = z.infer<typeof selectTokenUsageLogSchema>;
export type InsertTokenUsageLog = z.infer<typeof insertTokenUsageLogSchema>;
