/**
 * Database schema definitions using Drizzle ORM
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  decimal,
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// User roles enum
export const userRolesEnum = pgEnum('user_role', [
  'admin',
  'manager',
  'agent',
  'customer',
]);

// Conversation status enum
export const conversationStatusEnum = pgEnum('conversation_status', [
  'active',
  'closed',
  'archived',
]);

// Channel type enum
export const channelTypeEnum = pgEnum('channel_type', [
  'web',
  'sms',
  'email',
  'voice',
]);

// Message type enum
export const messageTypeEnum = pgEnum('message_type', [
  'user',
  'assistant',
  'system',
]);

// Handover status enum
export const handoverStatusEnum = pgEnum('handover_status', [
  'pending',
  'accepted',
  'rejected',
  'completed',
]);

// Escalation reason enum
export const escalationReasonEnum = pgEnum('escalation_reason', [
  'customer_request',
  'complex_issue',
  'sensitive_topic',
  'technical_error',
  'other',
]);

// Agent squad status enum
export const agentSquadStatusEnum = pgEnum('agent_squad_status', [
  'active',
  'paused',
  'archived',
]);

// Agent type enum
export const agentTypeEnum = pgEnum('agent_type', [
  'SALES',
  'SUPPORT',
  'GENERAL',
  'SPECIALIST',
  'CUSTOM',
]);

// Agent execution status enum
export const agentExecutionStatusEnum = pgEnum('agent_execution_status', [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

// Tool type enum
export const toolTypeEnum = pgEnum('tool_type', [
  'ANALYTICS',
  'AUTOMATION',
  'COMMUNICATION',
  'DATA_PROCESSING',
  'EXTERNAL_API',
  'CUSTOM',
]);

// Users table
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 100 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }),
    role: userRolesEnum('role').default('customer'),
    dealershipId: integer('dealership_id'),
    isActive: boolean('is_active').default(true),
    lastLogin: timestamp('last_login'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    metadata: json('metadata'),
  },
  (table) => {
    return {
      emailIdx: index('email_idx').on(table.email),
      dealershipIdIdx: index('dealership_id_idx').on(table.dealershipId),
    };
  }
);

// Dealerships table
export const dealerships = pgTable(
  'dealerships',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    subdomain: varchar('subdomain', { length: 100 }).unique(),
    contactEmail: varchar('contact_email', { length: 255 }),
    contactPhone: varchar('contact_phone', { length: 50 }),
    address: varchar('address', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 50 }),
    zipCode: varchar('zip_code', { length: 20 }),
    country: varchar('country', { length: 100 }),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    settings: json('settings'),
  },
  (table) => {
    return {
      nameIdx: index('name_idx').on(table.name),
      subdomainIdx: index('subdomain_idx').on(table.subdomain),
    };
  }
);

// Conversations table
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    subject: varchar('subject', { length: 255 }),
    status: conversationStatusEnum('status').default('active'),
    channel: channelTypeEnum('channel').default('web'),
    customerId: integer('customer_id').references(() => users.id),
    agentId: integer('agent_id').references(() => users.id),
    dealershipId: integer('dealership_id').references(() => dealerships.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    metadata: json('metadata'),
  },
  (table) => {
    return {
      customerIdIdx: index('customer_id_idx').on(table.customerId),
      agentIdIdx: index('agent_id_idx').on(table.agentId),
      dealershipIdIdx: index('dealership_id_idx').on(table.dealershipId),
      statusIdx: index('status_idx').on(table.status),
    };
  }
);

// Messages table
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    type: messageTypeEnum('type').default('user'),
    content: text('content').notNull(),
    senderId: integer('sender_id').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    metadata: json('metadata'),
  },
  (table) => {
    return {
      conversationIdIdx: index('conversation_id_idx').on(table.conversationId),
      senderIdIdx: index('sender_id_idx').on(table.senderId),
      createdAtIdx: index('created_at_idx').on(table.createdAt),
    };
  }
);

// Handovers table
export const handovers = pgTable(
  'handovers',
  {
    id: serial('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id),
    fromAgentId: integer('from_agent_id').references(() => users.id),
    toAgentId: integer('to_agent_id').references(() => users.id),
    status: handoverStatusEnum('status').default('pending'),
    reason: escalationReasonEnum('reason'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => {
    return {
      conversationIdIdx: index('handover_conversation_id_idx').on(
        table.conversationId
      ),
      fromAgentIdIdx: index('from_agent_id_idx').on(table.fromAgentId),
      toAgentIdIdx: index('to_agent_id_idx').on(table.toAgentId),
      statusIdx: index('handover_status_idx').on(table.status),
    };
  }
);

// Agent squad table
export const agentSquad = pgTable(
  'agent_squad',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: agentSquadStatusEnum('status').default('active'),
    dealershipId: integer('dealership_id').references(() => dealerships.id),
    createdBy: integer('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    config: json('config'),
  },
  (table) => {
    return {
      nameIdx: index('agent_squad_name_idx').on(table.name),
      statusIdx: index('agent_squad_status_idx').on(table.status),
      dealershipIdIdx: index('agent_squad_dealership_id_idx').on(
        table.dealershipId
      ),
    };
  }
);

// Agent table
export const agents = pgTable(
  'agents',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: agentTypeEnum('type').default('GENERAL'),
    squadId: integer('squad_id').references(() => agentSquad.id),
    createdBy: integer('created_by').references(() => users.id),
    dealershipId: integer('dealership_id').references(() => dealerships.id),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    prompt: text('prompt'),
    config: json('config'),
  },
  (table) => {
    return {
      nameIdx: index('agent_name_idx').on(table.name),
      typeIdx: index('agent_type_idx').on(table.type),
      squadIdIdx: index('squad_id_idx').on(table.squadId),
      dealershipIdIdx: index('agent_dealership_id_idx').on(table.dealershipId),
    };
  }
);

// Agent executions table
export const agentExecutions = pgTable(
  'agent_executions',
  {
    id: serial('id').primaryKey(),
    agentId: integer('agent_id')
      .notNull()
      .references(() => agents.id),
    conversationId: uuid('conversation_id').references(() => conversations.id),
    status: agentExecutionStatusEnum('status').default('PENDING'),
    startedAt: timestamp('started_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    input: text('input'),
    output: text('output'),
    error: text('error'),
    metadata: json('metadata'),
  },
  (table) => {
    return {
      agentIdIdx: index('execution_agent_id_idx').on(table.agentId),
      conversationIdIdx: index('execution_conversation_id_idx').on(
        table.conversationId
      ),
      statusIdx: index('execution_status_idx').on(table.status),
      startedAtIdx: index('started_at_idx').on(table.startedAt),
    };
  }
);

// Sandboxes table
export const sandboxes = pgTable(
  'sandboxes',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    createdBy: integer('created_by').references(() => users.id),
    dealershipId: integer('dealership_id').references(() => dealerships.id),
    isActive: boolean('is_active').default(true),
    hourlyTokenLimit: integer('hourly_token_limit').default(10000),
    dailyTokenLimit: integer('daily_token_limit').default(100000),
    dailyCostLimit: decimal('daily_cost_limit', { precision: 10, scale: 2 }).default('5.00'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    config: json('config'),
  },
  (table) => {
    return {
      nameIdx: index('sandbox_name_idx').on(table.name),
      createdByIdx: index('sandbox_created_by_idx').on(table.createdBy),
      dealershipIdIdx: index('sandbox_dealership_id_idx').on(table.dealershipId),
    };
  }
);

// Sandbox sessions table
export const sandboxSessions = pgTable(
  'sandbox_sessions',
  {
    id: serial('id').primaryKey(),
    sandboxId: integer('sandbox_id')
      .notNull()
      .references(() => sandboxes.id),
    userId: integer('user_id').references(() => users.id),
    sessionId: varchar('session_id', { length: 255 }).notNull(),
    isActive: boolean('is_active').default(true),
    startedAt: timestamp('started_at').defaultNow(),
    endedAt: timestamp('ended_at'),
    metadata: json('metadata'),
  },
  (table) => {
    return {
      sandboxIdIdx: index('session_sandbox_id_idx').on(table.sandboxId),
      userIdIdx: index('session_user_id_idx').on(table.userId),
      sessionIdIdx: index('session_id_idx').on(table.sessionId),
    };
  }
);

// Token usage logs table
export const tokenUsageLogs = pgTable(
  'token_usage_logs',
  {
    id: serial('id').primaryKey(),
    sandboxId: integer('sandbox_id')
      .notNull()
      .references(() => sandboxes.id),
    sessionId: integer('session_id').references(() => sandboxSessions.id),
    timestamp: timestamp('timestamp').defaultNow(),
    promptTokens: integer('prompt_tokens').default(0),
    completionTokens: integer('completion_tokens').default(0),
    totalTokens: integer('total_tokens').default(0),
    estimatedCost: decimal('estimated_cost', { precision: 10, scale: 6 }).default('0'),
    model: varchar('model', { length: 100 }),
    operation: varchar('operation', { length: 100 }),
    metadata: json('metadata'),
  },
  (table) => {
    return {
      sandboxIdIdx: index('usage_sandbox_id_idx').on(table.sandboxId),
      sessionIdIdx: index('usage_session_id_idx').on(table.sessionId),
      timestampIdx: index('usage_timestamp_idx').on(table.timestamp),
    };
  }
);

// Google Ads accounts table
export const gadsAccounts = pgTable(
  'gads_accounts',
  {
    id: serial('id').primaryKey(),
    cid: varchar('cid', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }),
    currencyCode: varchar('currency_code', { length: 10 }),
    timezone: varchar('timezone', { length: 100 }),
    isManagerAccount: boolean('is_manager_account').default(false),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    tokenExpiresAt: timestamp('token_expires_at'),
    sandboxId: integer('sandbox_id').references(() => sandboxes.id),
    userId: integer('user_id').notNull().references(() => users.id),
    dealershipId: integer('dealership_id').references(() => dealerships.id),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => {
    return {
      cidIdx: index('idx_gads_accounts_cid').on(table.cid),
      userIdIdx: index('idx_gads_accounts_user_id').on(table.userId),
      sandboxIdIdx: index('idx_gads_accounts_sandbox_id').on(table.sandboxId),
      dealershipIdIdx: index('idx_gads_accounts_dealership_id').on(table.dealershipId),
      cidUserUnique: unique('gads_accounts_cid_user_unique').on(table.cid, table.userId),
    };
  }
);

// Google Ads campaigns table
export const gadsCampaigns = pgTable(
  'gads_campaigns',
  {
    id: serial('id').primaryKey(),
    gadsAccountId: integer('gads_account_id')
      .notNull()
      .references(() => gadsAccounts.id),
    campaignId: varchar('campaign_id', { length: 255 }).notNull(),
    campaignName: varchar('campaign_name', { length: 255 }).notNull(),
    campaignType: varchar('campaign_type', { length: 50 }),
    status: varchar('status', { length: 50 }),
    budgetAmount: decimal('budget_amount', { precision: 12, scale: 2 }),
    isDryRun: boolean('is_dry_run').default(false),
    createdByAgent: varchar('created_by_agent', { length: 255 }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => {
    return {
      campaignIdIdx: index('idx_gads_campaigns_campaign_id').on(table.campaignId),
      gadsAccountIdIdx: index('idx_gads_campaigns_gads_account_id').on(table.gadsAccountId),
      statusIdx: index('idx_gads_campaigns_status').on(table.status),
      accountCampaignUnique: unique('gads_campaigns_account_campaign_unique').on(table.gadsAccountId, table.campaignId),
    };
  }
);

// Tools table
export const tools = pgTable(
  'tools',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    type: toolTypeEnum('type').default('CUSTOM'),
    service: varchar('service', { length: 255 }).notNull(),
    endpoint: varchar('endpoint', { length: 255 }).notNull(),
    inputSchema: json('input_schema'),
    outputSchema: json('output_schema'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    config: json('config'),
  },
  (table) => {
    return {
      nameIdx: index('tool_name_idx').on(table.name),
      typeIdx: index('tool_type_idx').on(table.type),
      serviceIdx: index('tool_service_idx').on(table.service),
    };
  }
);

// Agent tools table
export const agentTools = pgTable(
  'agent_tools',
  {
    id: serial('id').primaryKey(),
    agentId: integer('agent_id')
      .notNull()
      .references(() => agents.id),
    toolId: integer('tool_id')
      .notNull()
      .references(() => tools.id),
    isEnabled: boolean('is_enabled').default(true),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    config: json('config'),
  },
  (table) => {
    return {
      agentIdIdx: index('agent_tools_agent_id_idx').on(table.agentId),
      toolIdIdx: index('agent_tools_tool_id_idx').on(table.toolId),
      agentToolUnique: unique('agent_tool_unique').on(table.agentId, table.toolId),
    };
  }
);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  conversations: many(conversations, { foreignKey: 'customerId' }),
  messages: many(messages, { foreignKey: 'senderId' }),
  handoversFrom: many(handovers, { foreignKey: 'fromAgentId' }),
  handoversTo: many(handovers, { foreignKey: 'toAgentId' }),
  dealership: one(dealerships, {
    fields: [users.dealershipId],
    references: [dealerships.id],
  }),
  createdAgentSquads: many(agentSquad, { foreignKey: 'createdBy' }),
  createdAgents: many(agents, { foreignKey: 'createdBy' }),
  createdSandboxes: many(sandboxes, { foreignKey: 'createdBy' }),
  sandboxSessions: many(sandboxSessions, { foreignKey: 'userId' }),
  gadsAccounts: many(gadsAccounts, { foreignKey: 'userId' }),
}));

export const dealershipsRelations = relations(dealerships, ({ many }) => ({
  users: many(users, { foreignKey: 'dealershipId' }),
  conversations: many(conversations, { foreignKey: 'dealershipId' }),
  agentSquads: many(agentSquad, { foreignKey: 'dealershipId' }),
  agents: many(agents, { foreignKey: 'dealershipId' }),
  sandboxes: many(sandboxes, { foreignKey: 'dealershipId' }),
  gadsAccounts: many(gadsAccounts, { foreignKey: 'dealershipId' }),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    customer: one(users, {
      fields: [conversations.customerId],
      references: [users.id],
    }),
    agent: one(users, {
      fields: [conversations.agentId],
      references: [users.id],
    }),
    dealership: one(dealerships, {
      fields: [conversations.dealershipId],
      references: [dealerships.id],
    }),
    messages: many(messages, { foreignKey: 'conversationId' }),
    handovers: many(handovers, { foreignKey: 'conversationId' }),
    agentExecutions: many(agentExecutions, { foreignKey: 'conversationId' }),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export const handoversRelations = relations(handovers, ({ one }) => ({
  conversation: one(conversations, {
    fields: [handovers.conversationId],
    references: [conversations.id],
  }),
  fromAgent: one(users, {
    fields: [handovers.fromAgentId],
    references: [users.id],
  }),
  toAgent: one(users, {
    fields: [handovers.toAgentId],
    references: [users.id],
  }),
}));

export const agentSquadRelations = relations(agentSquad, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [agentSquad.dealershipId],
    references: [dealerships.id],
  }),
  creator: one(users, {
    fields: [agentSquad.createdBy],
    references: [users.id],
  }),
  agents: many(agents, { foreignKey: 'squadId' }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  squad: one(agentSquad, {
    fields: [agents.squadId],
    references: [agentSquad.id],
  }),
  creator: one(users, {
    fields: [agents.createdBy],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [agents.dealershipId],
    references: [dealerships.id],
  }),
  executions: many(agentExecutions, { foreignKey: 'agentId' }),
  tools: many(agentTools, { foreignKey: 'agentId' }),
}));

export const agentExecutionsRelations = relations(
  agentExecutions,
  ({ one }) => ({
    agent: one(agents, {
      fields: [agentExecutions.agentId],
      references: [agents.id],
    }),
    conversation: one(conversations, {
      fields: [agentExecutions.conversationId],
      references: [conversations.id],
    }),
  })
);

export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  creator: one(users, {
    fields: [sandboxes.createdBy],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [sandboxes.dealershipId],
    references: [dealerships.id],
  }),
  sessions: many(sandboxSessions, { foreignKey: 'sandboxId' }),
  usageLogs: many(tokenUsageLogs, { foreignKey: 'sandboxId' }),
  gadsAccounts: many(gadsAccounts, { foreignKey: 'sandboxId' }),
}));

export const sandboxSessionsRelations = relations(
  sandboxSessions,
  ({ one, many }) => ({
    sandbox: one(sandboxes, {
      fields: [sandboxSessions.sandboxId],
      references: [sandboxes.id],
    }),
    user: one(users, {
      fields: [sandboxSessions.userId],
      references: [users.id],
    }),
    usageLogs: many(tokenUsageLogs, { foreignKey: 'sessionId' }),
  })
);

export const tokenUsageLogsRelations = relations(
  tokenUsageLogs,
  ({ one }) => ({
    sandbox: one(sandboxes, {
      fields: [tokenUsageLogs.sandboxId],
      references: [sandboxes.id],
    }),
    session: one(sandboxSessions, {
      fields: [tokenUsageLogs.sessionId],
      references: [sandboxSessions.id],
    }),
  })
);

export const gadsAccountsRelations = relations(gadsAccounts, ({ one, many }) => ({
  user: one(users, {
    fields: [gadsAccounts.userId],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [gadsAccounts.dealershipId],
    references: [dealerships.id],
  }),
  sandbox: one(sandboxes, {
    fields: [gadsAccounts.sandboxId],
    references: [sandboxes.id],
  }),
  campaigns: many(gadsCampaigns, { foreignKey: 'gadsAccountId' }),
}));

export const gadsCampaignsRelations = relations(gadsCampaigns, ({ one }) => ({
  account: one(gadsAccounts, {
    fields: [gadsCampaigns.gadsAccountId],
    references: [gadsAccounts.id],
  }),
}));

export const toolsRelations = relations(tools, ({ many }) => ({
  agentTools: many(agentTools, { foreignKey: 'toolId' }),
}));

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  agent: one(agents, {
    fields: [agentTools.agentId],
    references: [agents.id],
  }),
  tool: one(tools, {
    fields: [agentTools.toolId],
    references: [tools.id],
  }),
}));

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertDealershipSchema = createInsertSchema(dealerships);
export const selectDealershipSchema = createSelectSchema(dealerships);

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export const insertHandoverSchema = createInsertSchema(handovers);
export const selectHandoverSchema = createSelectSchema(handovers);

export const insertAgentSquadSchema = createInsertSchema(agentSquad);
export const selectAgentSquadSchema = createSelectSchema(agentSquad);

export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);

export const insertAgentExecutionSchema = createInsertSchema(agentExecutions);
export const selectAgentExecutionSchema = createSelectSchema(agentExecutions);

export const insertSandboxSchema = createInsertSchema(sandboxes);
export const selectSandboxSchema = createSelectSchema(sandboxes);

export const insertSandboxSessionSchema = createInsertSchema(sandboxSessions);
export const selectSandboxSessionSchema = createSelectSchema(sandboxSessions);

export const insertTokenUsageLogSchema = createInsertSchema(tokenUsageLogs);
export const selectTokenUsageLogSchema = createSelectSchema(tokenUsageLogs);

export const insertGadsAccountSchema = createInsertSchema(gadsAccounts);
export const selectGadsAccountSchema = createSelectSchema(gadsAccounts);

export const insertGadsCampaignSchema = createInsertSchema(gadsCampaigns);
export const selectGadsCampaignSchema = createSelectSchema(gadsCampaigns);

export const insertToolSchema = createInsertSchema(tools);
export const selectToolSchema = createSelectSchema(tools);

export const insertAgentToolSchema = createInsertSchema(agentTools);
export const selectAgentToolSchema = createSelectSchema(agentTools);

// Custom Zod schemas with additional validation
export const userSchema = z.object({
  id: z.number().optional(),
  username: z.string().min(3).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255).optional(),
  role: z.enum(['admin', 'manager', 'agent', 'customer']).default('customer'),
  dealershipId: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
  lastLogin: z.date().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const dealershipSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  subdomain: z.string().min(3).max(100).optional().nullable(),
  contactEmail: z.string().email().max(255).optional().nullable(),
  contactPhone: z.string().max(50).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(50).optional().nullable(),
  zipCode: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  settings: z.record(z.any()).optional().nullable(),
});

export const conversationSchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().max(255).optional().nullable(),
  status: z
    .enum(['active', 'closed', 'archived'])
    .default('active'),
  channel: z
    .enum(['web', 'sms', 'email', 'voice'])
    .default('web'),
  customerId: z.number().optional().nullable(),
  agentId: z.number().optional().nullable(),
  dealershipId: z.number().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const messageSchema = z.object({
  id: z.string().uuid().optional(),
  conversationId: z.string().uuid(),
  type: z
    .enum(['user', 'assistant', 'system'])
    .default('user'),
  content: z.string().min(1),
  senderId: z.number().optional().nullable(),
  createdAt: z.date().optional(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const handoverSchema = z.object({
  id: z.number().optional(),
  conversationId: z.string().uuid(),
  fromAgentId: z.number().optional().nullable(),
  toAgentId: z.number().optional().nullable(),
  status: z
    .enum(['pending', 'accepted', 'rejected', 'completed'])
    .default('pending'),
  reason: z
    .enum([
      'customer_request',
      'complex_issue',
      'sensitive_topic',
      'technical_error',
      'other',
    ])
    .optional()
    .nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const agentSquadSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  status: z
    .enum(['active', 'paused', 'archived'])
    .default('active'),
  dealershipId: z.number().optional().nullable(),
  createdBy: z.number().optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  config: z.record(z.any()).optional().nullable(),
});

export const agentSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  type: z
    .enum(['SALES', 'SUPPORT', 'GENERAL', 'SPECIALIST', 'CUSTOM'])
    .default('GENERAL'),
  squadId: z.number().optional().nullable(),
  createdBy: z.number().optional().nullable(),
  dealershipId: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  prompt: z.string().optional().nullable(),
  config: z.record(z.any()).optional().nullable(),
});

export const agentExecutionSchema = z.object({
  id: z.number().optional(),
  agentId: z.number(),
  conversationId: z.string().uuid().optional().nullable(),
  status: z
    .enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'])
    .default('PENDING'),
  startedAt: z.date().optional(),
  completedAt: z.date().optional().nullable(),
  input: z.string().optional().nullable(),
  output: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const sandboxSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  createdBy: z.number().optional().nullable(),
  dealershipId: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
  hourlyTokenLimit: z.number().int().positive().default(10000),
  dailyTokenLimit: z.number().int().positive().default(100000),
  dailyCostLimit: z.number().positive().default(5.0),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  config: z.record(z.any()).optional().nullable(),
});

export const sandboxSessionSchema = z.object({
  id: z.number().optional(),
  sandboxId: z.number(),
  userId: z.number().optional().nullable(),
  sessionId: z.string().min(1).max(255),
  isActive: z.boolean().default(true),
  startedAt: z.date().optional(),
  endedAt: z.date().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const tokenUsageLogSchema = z.object({
  id: z.number().optional(),
  sandboxId: z.number(),
  sessionId: z.number().optional().nullable(),
  timestamp: z.date().optional(),
  promptTokens: z.number().int().nonnegative().default(0),
  completionTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
  estimatedCost: z.number().nonnegative().default(0),
  model: z.string().max(100).optional().nullable(),
  operation: z.string().max(100).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export const gadsAccountSchema = z.object({
  id: z.number().optional(),
  cid: z.string().min(1).max(255),
  name: z.string().max(255).optional().nullable(),
  currencyCode: z.string().max(10).optional().nullable(),
  timezone: z.string().max(100).optional().nullable(),
  isManagerAccount: z.boolean().default(false),
  refreshToken: z.string().optional().nullable(),
  accessToken: z.string().optional().nullable(),
  tokenExpiresAt: z.date().optional().nullable(),
  sandboxId: z.number().optional().nullable(),
  userId: z.number(),
  dealershipId: z.number().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const gadsCampaignSchema = z.object({
  id: z.number().optional(),
  gadsAccountId: z.number(),
  campaignId: z.string().min(1).max(255),
  campaignName: z.string().min(1).max(255),
  campaignType: z.string().max(50).optional().nullable(),
  status: z.string().max(50).optional().nullable(),
  budgetAmount: z.number().optional().nullable(),
  isDryRun: z.boolean().default(false),
  createdByAgent: z.string().max(255).optional().nullable(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const toolSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  type: z
    .enum([
      'ANALYTICS',
      'AUTOMATION',
      'COMMUNICATION',
      'DATA_PROCESSING',
      'EXTERNAL_API',
      'CUSTOM',
    ])
    .default('CUSTOM'),
  service: z.string().min(1).max(255),
  endpoint: z.string().min(1).max(255),
  inputSchema: z.record(z.any()).optional().nullable(),
  outputSchema: z.record(z.any()).optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  config: z.record(z.any()).optional().nullable(),
});

export const agentToolSchema = z.object({
  id: z.number().optional(),
  agentId: z.number(),
  toolId: z.number(),
  isEnabled: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  config: z.record(z.any()).optional().nullable(),
});

// TypeScript types
export type User = z.infer<typeof userSchema>;
export type Dealership = z.infer<typeof dealershipSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Handover = z.infer<typeof handoverSchema>;
export type AgentSquad = z.infer<typeof agentSquadSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type AgentExecution = z.infer<typeof agentExecutionSchema>;
export type Sandbox = z.infer<typeof sandboxSchema>;
export type SandboxSession = z.infer<typeof sandboxSessionSchema>;
export type TokenUsageLog = z.infer<typeof tokenUsageLogSchema>;
export type GadsAccount = z.infer<typeof gadsAccountSchema>;
export type GadsCampaign = z.infer<typeof gadsCampaignSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type AgentTool = z.infer<typeof agentToolSchema>;
