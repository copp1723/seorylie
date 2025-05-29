import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
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
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 100 }).notNull(),
    email: varchar("email", { length: 100 }).notNull(),
    password: varchar("password", { length: 100 }),
    role: varchar("role", { length: 50 }).default("user").notNull(),
    dealershipId: integer("dealership_id"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      emailIdx: index("email_idx").on(table.email),
      usernameIdx: index("username_idx").on(table.username),
      dealershipIdIdx: index("dealership_id_idx").on(table.dealershipId),
    };
  }
);

// Dealerships
export const dealerships = pgTable(
  "dealerships",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    subdomain: varchar("subdomain", { length: 100 }).notNull(),
    contactEmail: varchar("contact_email", { length: 100 }),
    contactPhone: varchar("contact_phone", { length: 20 }),
    address: varchar("address", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 50 }),
    zip: varchar("zip", { length: 20 }),
    country: varchar("country", { length: 50 }),
    timezone: varchar("timezone", { length: 50 }).default("America/New_York"),
    isActive: boolean("is_active").default(true).notNull(),
    settings: json("settings").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      subdomainIdx: index("subdomain_idx").on(table.subdomain),
      nameIdx: index("name_idx").on(table.name),
    };
  }
);

// Conversations
export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    subject: varchar("subject", { length: 255 }),
    status: varchar("status", { length: 50 }).default("open").notNull(),
    channel: varchar("channel", { length: 50 }).default("web").notNull(),
    userId: integer("user_id"),
    dealershipId: integer("dealership_id").notNull(),
    customerId: integer("customer_id"),
    assignedAgentId: integer("assigned_agent_id"),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      statusIdx: index("status_idx").on(table.status),
      channelIdx: index("channel_idx").on(table.channel),
      userIdIdx: index("user_id_idx").on(table.userId),
      dealershipIdIdx: index("dealership_id_idx").on(table.dealershipId),
      customerIdIdx: index("customer_id_idx").on(table.customerId),
      assignedAgentIdIdx: index("assigned_agent_id_idx").on(
        table.assignedAgentId
      ),
      lastMessageAtIdx: index("last_message_at_idx").on(table.lastMessageAt),
    };
  }
);

// Messages
export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").notNull(),
    sender: varchar("sender", { length: 100 }).notNull(),
    senderType: varchar("sender_type", { length: 50 })
      .default("user")
      .notNull(),
    content: text("content").notNull(),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      conversationIdIdx: index("conversation_id_idx").on(table.conversationId),
      senderIdx: index("sender_idx").on(table.sender),
      senderTypeIdx: index("sender_type_idx").on(table.senderType),
    };
  }
);

// Customers
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    dealershipId: integer("dealership_id").notNull(),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      emailIdx: index("customer_email_idx").on(table.email),
      phoneIdx: index("phone_idx").on(table.phone),
      dealershipIdIdx: index("customer_dealership_id_idx").on(
        table.dealershipId
      ),
      nameIdx: index("name_idx").on(table.firstName, table.lastName),
    };
  }
);

// Personas
export const personas = pgTable(
  "personas",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    promptTemplate: text("prompt_template").notNull(),
    systemPrompt: text("system_prompt"),
    dealershipId: integer("dealership_id"),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      nameIdx: index("persona_name_idx").on(table.name),
      dealershipIdIdx: index("persona_dealership_id_idx").on(
        table.dealershipId
      ),
    };
  }
);

// Persona Arguments
export const personaArguments = pgTable(
  "persona_arguments",
  {
    id: serial("id").primaryKey(),
    personaId: integer("persona_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    defaultValue: text("default_value"),
    required: boolean("required").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      personaIdIdx: index("persona_id_idx").on(table.personaId),
      nameIdx: index("argument_name_idx").on(table.name),
    };
  }
);

// Leads
export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    email: varchar("email", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    dealershipId: integer("dealership_id").notNull(),
    source: varchar("source", { length: 50 }),
    status: varchar("status", { length: 50 }).default("new").notNull(),
    assignedAgentId: integer("assigned_agent_id"),
    conversationId: integer("conversation_id"),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      emailIdx: index("lead_email_idx").on(table.email),
      phoneIdx: index("lead_phone_idx").on(table.phone),
      dealershipIdIdx: index("lead_dealership_id_idx").on(table.dealershipId),
      sourceIdx: index("source_idx").on(table.source),
      statusIdx: index("lead_status_idx").on(table.status),
      assignedAgentIdIdx: index("lead_assigned_agent_id_idx").on(
        table.assignedAgentId
      ),
      conversationIdIdx: index("lead_conversation_id_idx").on(
        table.conversationId
      ),
      nameIdx: index("lead_name_idx").on(table.firstName, table.lastName),
    };
  }
);

// Lead Notes
export const leadNotes = pgTable(
  "lead_notes",
  {
    id: serial("id").primaryKey(),
    leadId: integer("lead_id").notNull(),
    userId: integer("user_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      leadIdIdx: index("lead_id_idx").on(table.leadId),
      userIdIdx: index("note_user_id_idx").on(table.userId),
    };
  }
);

// Vehicles
export const vehicles = pgTable(
  "vehicles",
  {
    id: serial("id").primaryKey(),
    vin: varchar("vin", { length: 17 }).notNull(),
    make: varchar("make", { length: 50 }),
    model: varchar("model", { length: 50 }),
    year: integer("year"),
    trim: varchar("trim", { length: 50 }),
    dealershipId: integer("dealership_id").notNull(),
    status: varchar("status", { length: 50 }).default("available").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }),
    mileage: integer("mileage"),
    exteriorColor: varchar("exterior_color", { length: 50 }),
    interiorColor: varchar("interior_color", { length: 50 }),
    transmission: varchar("transmission", { length: 50 }),
    engine: varchar("engine", { length: 100 }),
    fuelType: varchar("fuel_type", { length: 50 }),
    bodyStyle: varchar("body_style", { length: 50 }),
    features: json("features").$type<string[]>(),
    description: text("description"),
    images: json("images").$type<string[]>(),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      vinIdx: index("vin_idx").on(table.vin),
      makeModelIdx: index("make_model_idx").on(table.make, table.model),
      dealershipIdIdx: index("vehicle_dealership_id_idx").on(
        table.dealershipId
      ),
      statusIdx: index("vehicle_status_idx").on(table.status),
      yearIdx: index("year_idx").on(table.year),
    };
  }
);

// Lead Vehicles (junction table for leads interested in vehicles)
export const leadVehicles = pgTable(
  "lead_vehicles",
  {
    leadId: integer("lead_id").notNull(),
    vehicleId: integer("vehicle_id").notNull(),
    interestLevel: varchar("interest_level", { length: 50 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.leadId, table.vehicleId] }),
      leadIdIdx: index("lead_vehicles_lead_id_idx").on(table.leadId),
      vehicleIdIdx: index("lead_vehicles_vehicle_id_idx").on(table.vehicleId),
    };
  }
);

// API Keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    userId: integer("user_id").notNull(),
    dealershipId: integer("dealership_id").notNull(),
    permissions: json("permissions").$type<string[]>(),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      keyIdx: index("key_idx").on(table.key),
      userIdIdx: index("api_user_id_idx").on(table.userId),
      dealershipIdIdx: index("api_dealership_id_idx").on(table.dealershipId),
      isActiveIdx: index("is_active_idx").on(table.isActive),
    };
  }
);

// Audit Logs
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    entityId: varchar("entity_id", { length: 50 }),
    dealershipId: integer("dealership_id"),
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: varchar("user_agent", { length: 255 }),
    details: json("details").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index("audit_user_id_idx").on(table.userId),
      actionIdx: index("action_idx").on(table.action),
      entityTypeIdx: index("entity_type_idx").on(table.entityType),
      entityIdIdx: index("entity_id_idx").on(table.entityId),
      dealershipIdIdx: index("audit_dealership_id_idx").on(table.dealershipId),
      createdAtIdx: index("audit_created_at_idx").on(table.createdAt),
    };
  }
);

// Settings
export const settings = pgTable(
  "settings",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 100 }).notNull(),
    value: json("value").notNull(),
    scope: varchar("scope", { length: 50 }).default("global").notNull(),
    scopeId: integer("scope_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      keyIdx: index("settings_key_idx").on(table.key),
      scopeIdx: index("scope_idx").on(table.scope, table.scopeId),
      uniqueKey: unique("unique_key").on(table.key, table.scope, table.scopeId),
    };
  }
);

// SMS Messages
export const smsMessages = pgTable(
  "sms_messages",
  {
    id: serial("id").primaryKey(),
    from: varchar("from", { length: 20 }).notNull(),
    to: varchar("to", { length: 20 }).notNull(),
    body: text("body").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    externalId: varchar("external_id", { length: 100 }),
    conversationId: integer("conversation_id"),
    dealershipId: integer("dealership_id").notNull(),
    metadata: json("metadata").$type<Record<string, any>>(),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      fromIdx: index("from_idx").on(table.from),
      toIdx: index("to_idx").on(table.to),
      statusIdx: index("sms_status_idx").on(table.status),
      externalIdIdx: index("external_id_idx").on(table.externalId),
      conversationIdIdx: index("sms_conversation_id_idx").on(
        table.conversationId
      ),
      dealershipIdIdx: index("sms_dealership_id_idx").on(table.dealershipId),
    };
  }
);

// Email Messages
export const emailMessages = pgTable(
  "email_messages",
  {
    id: serial("id").primaryKey(),
    from: varchar("from", { length: 255 }).notNull(),
    to: varchar("to", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    body: text("body").notNull(),
    isHtml: boolean("is_html").default(true).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    externalId: varchar("external_id", { length: 100 }),
    conversationId: integer("conversation_id"),
    dealershipId: integer("dealership_id").notNull(),
    metadata: json("metadata").$type<Record<string, any>>(),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      fromIdx: index("email_from_idx").on(table.from),
      toIdx: index("email_to_idx").on(table.to),
      subjectIdx: index("subject_idx").on(table.subject),
      statusIdx: index("email_status_idx").on(table.status),
      externalIdIdx: index("email_external_id_idx").on(table.externalId),
      conversationIdIdx: index("email_conversation_id_idx").on(
        table.conversationId
      ),
      dealershipIdIdx: index("email_dealership_id_idx").on(table.dealershipId),
    };
  }
);

// JWT Tokens
export const jwtTokens = pgTable(
  "jwt_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    token: varchar("token", { length: 500 }).notNull(),
    isRevoked: boolean("is_revoked").default(false).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      userIdIdx: index("jwt_user_id_idx").on(table.userId),
      tokenIdx: index("token_idx").on(table.token),
      isRevokedIdx: index("is_revoked_idx").on(table.isRevoked),
      expiresAtIdx: index("expires_at_idx").on(table.expiresAt),
    };
  }
);

// Prompt Templates
export const promptTemplates = pgTable(
  "prompt_templates",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    template: text("template").notNull(),
    templateType: varchar("template_type", { length: 50 })
      .default("chat")
      .notNull(),
    parameters: json("parameters").$type<Record<string, any>>(),
    dealershipId: integer("dealership_id"),
    createdBy: integer("created_by"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      nameIdx: index("template_name_idx").on(table.name),
      templateTypeIdx: index("template_type_idx").on(table.templateType),
      dealershipIdIdx: index("template_dealership_id_idx").on(
        table.dealershipId
      ),
      createdByIdx: index("created_by_idx").on(table.createdBy),
    };
  }
);

// Opt Out Records
export const optOutRecords = pgTable(
  "opt_out_records",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }),
    dealershipId: integer("dealership_id").notNull(),
    channel: varchar("channel", { length: 20 }).default("all").notNull(),
    reason: varchar("reason", { length: 255 }),
    optedOutAt: timestamp("opted_out_at").defaultNow().notNull(),
    optedInAt: timestamp("opted_in_at"),
    status: varchar("status", { length: 20 }).default("opted_out").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      phoneIdx: index("opt_out_phone_idx").on(table.phone),
      emailIdx: index("opt_out_email_idx").on(table.email),
      dealershipIdIdx: index("opt_out_dealership_id_idx").on(
        table.dealershipId
      ),
      channelIdx: index("channel_idx").on(table.channel),
      statusIdx: index("opt_out_status_idx").on(table.status),
    };
  }
);

// Vehicle Lifecycle Events
export const vehicleLifecycleEvents = pgTable(
  "vehicle_lifecycle_events",
  {
    id: serial("id").primaryKey(),
    vehicleId: integer("vehicle_id").notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    eventDate: timestamp("event_date").defaultNow().notNull(),
    userId: integer("user_id"),
    leadId: integer("lead_id"),
    customerId: integer("customer_id"),
    dealershipId: integer("dealership_id").notNull(),
    details: json("details").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      vehicleIdIdx: index("lifecycle_vehicle_id_idx").on(table.vehicleId),
      eventTypeIdx: index("event_type_idx").on(table.eventType),
      eventDateIdx: index("event_date_idx").on(table.eventDate),
      userIdIdx: index("lifecycle_user_id_idx").on(table.userId),
      leadIdIdx: index("lifecycle_lead_id_idx").on(table.leadId),
      customerIdIdx: index("lifecycle_customer_id_idx").on(table.customerId),
      dealershipIdIdx: index("lifecycle_dealership_id_idx").on(
        table.dealershipId
      ),
    };
  }
);

// Sandboxes
export const sandboxes = pgTable(
  "sandboxes",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    createdBy: integer("created_by").notNull(),
    dealershipId: integer("dealership_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    hourlyTokenLimit: integer("hourly_token_limit").default(10000),
    dailyTokenLimit: integer("daily_token_limit").default(100000),
    dailyCostLimit: decimal("daily_cost_limit", { precision: 10, scale: 2 }).default("5.0"),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      nameIdx: index("sandbox_name_idx").on(table.name),
      createdByIdx: index("sandbox_created_by_idx").on(table.createdBy),
      dealershipIdIdx: index("sandbox_dealership_id_idx").on(
        table.dealershipId
      ),
      isActiveIdx: index("sandbox_is_active_idx").on(table.isActive),
    };
  }
);

// Sandbox Sessions
export const sandboxSessions = pgTable(
  "sandbox_sessions",
  {
    id: serial("id").primaryKey(),
    sandboxId: integer("sandbox_id").notNull(),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    userId: integer("user_id"),
    status: varchar("status", { length: 20 }).default("active").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      sandboxIdIdx: index("session_sandbox_id_idx").on(table.sandboxId),
      sessionIdIdx: index("session_id_idx").on(table.sessionId),
      userIdIdx: index("session_user_id_idx").on(table.userId),
      statusIdx: index("session_status_idx").on(table.status),
      startedAtIdx: index("started_at_idx").on(table.startedAt),
    };
  }
);

// Token Usage Logs
export const tokenUsageLogs = pgTable(
  "token_usage_logs",
  {
    id: serial("id").primaryKey(),
    sandboxId: integer("sandbox_id").notNull(),
    sessionId: varchar("session_id", { length: 100 }),
    userId: integer("user_id"),
    operationType: varchar("operation_type", { length: 50 }).notNull(),
    promptTokens: integer("prompt_tokens").default(0),
    completionTokens: integer("completion_tokens").default(0),
    totalTokens: integer("total_tokens").default(0),
    cost: decimal("cost", { precision: 10, scale: 6 }).default("0"),
    model: varchar("model", { length: 50 }),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      sandboxIdIdx: index("usage_sandbox_id_idx").on(table.sandboxId),
      sessionIdIdx: index("usage_session_id_idx").on(table.sessionId),
      userIdIdx: index("usage_user_id_idx").on(table.userId),
      operationTypeIdx: index("operation_type_idx").on(table.operationType),
      createdAtIdx: index("usage_created_at_idx").on(table.createdAt),
      // Composite index for querying hourly usage
      hourlyUsageIdx: index("hourly_usage_idx").on(
        table.sandboxId,
        table.createdAt
      ),
    };
  }
);

// Tools Registry
export const tools = pgTable(
  "tools",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    type: varchar("type", { length: 50 }).default("EXTERNAL_API").notNull(),
    service: varchar("service", { length: 50 }).notNull(),
    endpoint: varchar("endpoint", { length: 255 }),
    inputSchema: json("input_schema").$type<Record<string, any>>(),
    outputSchema: json("output_schema").$type<Record<string, any>>(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      nameIdx: index("tool_name_idx").on(table.name),
      serviceIdx: index("service_idx").on(table.service),
      typeIdx: index("tool_type_idx").on(table.type),
      isActiveIdx: index("tool_is_active_idx").on(table.isActive),
    };
  }
);

// Agent Tools (junction table)
export const agentTools = pgTable(
  "agent_tools",
  {
    id: serial("id").primaryKey(),
    agentId: integer("agent_id").notNull(),
    toolId: integer("tool_id").notNull(),
    isEnabled: boolean("is_enabled").default(true).notNull(),
    parameters: json("parameters").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      agentIdIdx: index("agent_id_idx").on(table.agentId),
      toolIdIdx: index("tool_id_idx").on(table.toolId),
      uniqueAgentTool: unique("unique_agent_tool").on(
        table.agentId,
        table.toolId
      ),
    };
  }
);

// Google Ads Accounts
export const gadsAccounts = pgTable(
  "gads_accounts",
  {
    id: serial("id").primaryKey(),
    cid: varchar("cid", { length: 20 }).notNull(),
    name: varchar("name", { length: 255 }),
    currencyCode: varchar("currency_code", { length: 3 }),
    timezone: varchar("timezone", { length: 50 }),
    isManagerAccount: boolean("is_manager_account").default(false),
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token"),
    tokenExpiresAt: timestamp("token_expires_at"),
    sandboxId: integer("sandbox_id"),
    userId: integer("user_id").notNull(),
    dealershipId: integer("dealership_id").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      cidIdx: index("cid_idx").on(table.cid),
      sandboxIdIdx: index("gads_sandbox_id_idx").on(table.sandboxId),
      userIdIdx: index("gads_user_id_idx").on(table.userId),
      dealershipIdIdx: index("gads_dealership_id_idx").on(table.dealershipId),
      isActiveIdx: index("gads_is_active_idx").on(table.isActive),
      uniqueCid: unique("unique_cid").on(table.cid, table.dealershipId),
    };
  }
);

// Google Ads Campaigns
export const gadsCampaigns = pgTable(
  "gads_campaigns",
  {
    id: serial("id").primaryKey(),
    gadsAccountId: integer("gads_account_id").notNull(),
    campaignId: varchar("campaign_id", { length: 50 }),
    campaignName: varchar("campaign_name", { length: 255 }).notNull(),
    campaignType: varchar("campaign_type", { length: 50 }).default("SEARCH").notNull(),
    status: varchar("status", { length: 20 }).default("ENABLED").notNull(),
    budgetAmount: decimal("budget_amount", { precision: 10, scale: 2 }),
    isDryRun: boolean("is_dry_run").default(false).notNull(),
    createdByAgent: integer("created_by_agent"),
    metadata: json("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      gadsAccountIdIdx: index("gads_account_id_idx").on(table.gadsAccountId),
      campaignIdIdx: index("campaign_id_idx").on(table.campaignId),
      campaignNameIdx: index("campaign_name_idx").on(table.campaignName),
      statusIdx: index("campaign_status_idx").on(table.status),
      isDryRunIdx: index("is_dry_run_idx").on(table.isDryRun),
      createdByAgentIdx: index("created_by_agent_idx").on(table.createdByAgent),
    };
  }
);

// Daily Spend Logs
export const dailySpendLogs = pgTable(
  "daily_spend_logs",
  {
    id: serial("id").primaryKey(),
    cid: varchar("cid", { length: 20 }).notNull(),
    date: date("date").notNull(),
    campaignId: varchar("campaign_id", { length: 50 }),
    campaignName: varchar("campaign_name", { length: 255 }),
    impressions: integer("impressions").default(0),
    clicks: integer("clicks").default(0),
    costMicros: integer("cost_micros").default(0),
    conversions: decimal("conversions", { precision: 10, scale: 2 }).default("0"),
    conversionValueMicros: integer("conversion_value_micros").default(0),
    ctr: decimal("ctr", { precision: 5, scale: 4 }).default("0"),
    cpcMicros: integer("cpc_micros").default(0),
    roas: decimal("roas", { precision: 10, scale: 4 }).default("0"),
    cpaMicros: integer("cpa_micros").default(0),
    accountCurrencyCode: varchar("account_currency_code", { length: 3 }),
    extractedAt: timestamp("extracted_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => {
    return {
      cidDateIdx: index("daily_spend_logs_cid_date").on(table.cid, table.date),
      dateIdx: index("daily_spend_logs_date").on(table.date),
      campaignIdIdx: index("daily_spend_logs_campaign_id").on(table.campaignId),
      uniqueLog: unique("uq_daily_spend_logs_cid_campaign_date").on(table.cid, table.campaignId, table.date),
    };
  }
);

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  dealership: one(dealerships, {
    fields: [users.dealershipId],
    references: [dealerships.id],
  }),
  conversations: many(conversations),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  jwtTokens: many(jwtTokens),
  promptTemplates: many(promptTemplates),
  sandboxes: many(sandboxes),
  gadsAccounts: many(gadsAccounts),
}));

export const dealershipsRelations = relations(dealerships, ({ many }) => ({
  users: many(users),
  conversations: many(conversations),
  customers: many(customers),
  leads: many(leads),
  vehicles: many(vehicles),
  apiKeys: many(apiKeys),
  auditLogs: many(auditLogs),
  smsMessages: many(smsMessages),
  emailMessages: many(emailMessages),
  promptTemplates: many(promptTemplates),
  optOutRecords: many(optOutRecords),
  vehicleLifecycleEvents: many(vehicleLifecycleEvents),
  sandboxes: many(sandboxes),
  gadsAccounts: many(gadsAccounts),
}));

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [conversations.userId],
      references: [users.id],
    }),
    dealership: one(dealerships, {
      fields: [conversations.dealershipId],
      references: [dealerships.id],
    }),
    customer: one(customers, {
      fields: [conversations.customerId],
      references: [customers.id],
    }),
    assignedAgent: one(users, {
      fields: [conversations.assignedAgentId],
      references: [users.id],
    }),
    messages: many(messages),
    smsMessages: many(smsMessages),
    emailMessages: many(emailMessages),
  })
);

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [customers.dealershipId],
    references: [dealerships.id],
  }),
  conversations: many(conversations),
  vehicleLifecycleEvents: many(vehicleLifecycleEvents),
}));

export const personasRelations = relations(personas, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [personas.dealershipId],
    references: [dealerships.id],
  }),
  arguments: many(personaArguments),
}));

export const personaArgumentsRelations = relations(
  personaArguments,
  ({ one }) => ({
    persona: one(personas, {
      fields: [personaArguments.personaId],
      references: [personas.id],
    }),
  })
);

export const leadsRelations = relations(leads, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [leads.dealershipId],
    references: [dealerships.id],
  }),
  assignedAgent: one(users, {
    fields: [leads.assignedAgentId],
    references: [users.id],
  }),
  conversation: one(conversations, {
    fields: [leads.conversationId],
    references: [conversations.id],
  }),
  notes: many(leadNotes),
  vehicles: many(leadVehicles),
  vehicleLifecycleEvents: many(vehicleLifecycleEvents),
}));

export const leadNotesRelations = relations(leadNotes, ({ one }) => ({
  lead: one(leads, {
    fields: [leadNotes.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [leadNotes.userId],
    references: [users.id],
  }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [vehicles.dealershipId],
    references: [dealerships.id],
  }),
  leads: many(leadVehicles),
  lifecycleEvents: many(vehicleLifecycleEvents),
}));

export const leadVehiclesRelations = relations(leadVehicles, ({ one }) => ({
  lead: one(leads, {
    fields: [leadVehicles.leadId],
    references: [leads.id],
  }),
  vehicle: one(vehicles, {
    fields: [leadVehicles.vehicleId],
    references: [vehicles.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [apiKeys.dealershipId],
    references: [dealerships.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [auditLogs.dealershipId],
    references: [dealerships.id],
  }),
}));

export const smsMessagesRelations = relations(smsMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [smsMessages.conversationId],
    references: [conversations.id],
  }),
  dealership: one(dealerships, {
    fields: [smsMessages.dealershipId],
    references: [dealerships.id],
  }),
}));

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [emailMessages.conversationId],
    references: [conversations.id],
  }),
  dealership: one(dealerships, {
    fields: [emailMessages.dealershipId],
    references: [dealerships.id],
  }),
}));

export const jwtTokensRelations = relations(jwtTokens, ({ one }) => ({
  user: one(users, {
    fields: [jwtTokens.userId],
    references: [users.id],
  }),
}));

export const promptTemplatesRelations = relations(
  promptTemplates,
  ({ one }) => ({
    dealership: one(dealerships, {
      fields: [promptTemplates.dealershipId],
      references: [dealerships.id],
    }),
    createdBy: one(users, {
      fields: [promptTemplates.createdBy],
      references: [users.id],
    }),
  })
);

export const optOutRecordsRelations = relations(optOutRecords, ({ one }) => ({
  dealership: one(dealerships, {
    fields: [optOutRecords.dealershipId],
    references: [dealerships.id],
  }),
}));

export const vehicleLifecycleEventsRelations = relations(
  vehicleLifecycleEvents,
  ({ one }) => ({
    vehicle: one(vehicles, {
      fields: [vehicleLifecycleEvents.vehicleId],
      references: [vehicles.id],
    }),
    user: one(users, {
      fields: [vehicleLifecycleEvents.userId],
      references: [users.id],
    }),
    lead: one(leads, {
      fields: [vehicleLifecycleEvents.leadId],
      references: [leads.id],
    }),
    customer: one(customers, {
      fields: [vehicleLifecycleEvents.customerId],
      references: [customers.id],
    }),
    dealership: one(dealerships, {
      fields: [vehicleLifecycleEvents.dealershipId],
      references: [dealerships.id],
    }),
  })
);

export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [sandboxes.createdBy],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [sandboxes.dealershipId],
    references: [dealerships.id],
  }),
  sessions: many(sandboxSessions),
  usageLogs: many(tokenUsageLogs),
  gadsAccounts: many(gadsAccounts),
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
    usageLogs: many(tokenUsageLogs),
  })
);

export const tokenUsageLogsRelations = relations(tokenUsageLogs, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [tokenUsageLogs.sandboxId],
    references: [sandboxes.id],
  }),
  session: one(sandboxSessions, {
    fields: [tokenUsageLogs.sessionId],
    references: [sandboxSessions.sessionId],
  }),
  user: one(users, {
    fields: [tokenUsageLogs.userId],
    references: [users.id],
  }),
}));

export const toolsRelations = relations(tools, ({ many }) => ({
  agentTools: many(agentTools),
}));

export const agentToolsRelations = relations(agentTools, ({ one }) => ({
  tool: one(tools, {
    fields: [agentTools.toolId],
    references: [tools.id],
  }),
}));

export const gadsAccountsRelations = relations(gadsAccounts, ({ one, many }) => ({
  sandbox: one(sandboxes, {
    fields: [gadsAccounts.sandboxId],
    references: [sandboxes.id],
  }),
  user: one(users, {
    fields: [gadsAccounts.userId],
    references: [users.id],
  }),
  dealership: one(dealerships, {
    fields: [gadsAccounts.dealershipId],
    references: [dealerships.id],
  }),
  campaigns: many(gadsCampaigns),
  dailySpendLogs: many(dailySpendLogs, { relationName: "accountSpendLogs" }),
}));

export const gadsCampaignsRelations = relations(gadsCampaigns, ({ one }) => ({
  account: one(gadsAccounts, {
    fields: [gadsCampaigns.gadsAccountId],
    references: [gadsAccounts.id],
  }),
}));

export const dailySpendLogsRelations = relations(dailySpendLogs, ({ one }) => ({
  account: one(gadsAccounts, {
    fields: [dailySpendLogs.cid],
    references: [gadsAccounts.cid],
    relationName: "accountSpendLogs"
  }),
}));

// Zod Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertDealershipSchema = createInsertSchema(dealerships);
export const selectDealershipSchema = createSelectSchema(dealerships);

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);

export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export const insertCustomerSchema = createInsertSchema(customers);
export const selectCustomerSchema = createSelectSchema(customers);

export const insertPersonaSchema = createInsertSchema(personas);
export const selectPersonaSchema = createSelectSchema(personas);

export const insertPersonaArgumentSchema = createInsertSchema(personaArguments);
export const selectPersonaArgumentSchema = createSelectSchema(personaArguments);

export const insertLeadSchema = createInsertSchema(leads);
export const selectLeadSchema = createSelectSchema(leads);

export const insertLeadNoteSchema = createInsertSchema(leadNotes);
export const selectLeadNoteSchema = createSelectSchema(leadNotes);

export const insertVehicleSchema = createInsertSchema(vehicles);
export const selectVehicleSchema = createSelectSchema(vehicles);

export const insertLeadVehicleSchema = createInsertSchema(leadVehicles);
export const selectLeadVehicleSchema = createSelectSchema(leadVehicles);

export const insertApiKeySchema = createInsertSchema(apiKeys);
export const selectApiKeySchema = createSelectSchema(apiKeys);

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

export const insertSettingSchema = createInsertSchema(settings);
export const selectSettingSchema = createSelectSchema(settings);

export const insertSmsMessageSchema = createInsertSchema(smsMessages);
export const selectSmsMessageSchema = createSelectSchema(smsMessages);

export const insertEmailMessageSchema = createInsertSchema(emailMessages);
export const selectEmailMessageSchema = createSelectSchema(emailMessages);

export const insertJwtTokenSchema = createInsertSchema(jwtTokens);
export const selectJwtTokenSchema = createSelectSchema(jwtTokens);

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates);
export const selectPromptTemplateSchema = createSelectSchema(promptTemplates);

export const insertOptOutRecordSchema = createInsertSchema(optOutRecords);
export const selectOptOutRecordSchema = createSelectSchema(optOutRecords);

export const insertVehicleLifecycleEventSchema = createInsertSchema(
  vehicleLifecycleEvents
);
export const selectVehicleLifecycleEventSchema = createSelectSchema(
  vehicleLifecycleEvents
);

export const insertSandboxSchema = createInsertSchema(sandboxes);
export const selectSandboxSchema = createSelectSchema(sandboxes);

export const insertSandboxSessionSchema = createInsertSchema(sandboxSessions);
export const selectSandboxSessionSchema = createSelectSchema(sandboxSessions);

export const insertTokenUsageLogSchema = createInsertSchema(tokenUsageLogs);
export const selectTokenUsageLogSchema = createSelectSchema(tokenUsageLogs);

export const insertToolSchema = createInsertSchema(tools);
export const selectToolSchema = createSelectSchema(tools);

export const insertAgentToolSchema = createInsertSchema(agentTools);
export const selectAgentToolSchema = createSelectSchema(agentTools);

export const insertGadsAccountSchema = createInsertSchema(gadsAccounts);
export const selectGadsAccountSchema = createSelectSchema(gadsAccounts);

export const insertGadsCampaignSchema = createInsertSchema(gadsCampaigns);
export const selectGadsCampaignSchema = createSelectSchema(gadsCampaigns);

export const insertDailySpendLogSchema = createInsertSchema(dailySpendLogs);
export const selectDailySpendLogSchema = createSelectSchema(dailySpendLogs);

// Custom Zod Schemas
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  role: z.string(),
  dealershipId: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const dealershipSchema = z.object({
  id: z.number(),
  name: z.string(),
  subdomain: z.string(),
  contactEmail: z.string().email().nullable(),
  contactPhone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
  timezone: z.string(),
  isActive: z.boolean(),
  settings: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const conversationSchema = z.object({
  id: z.number(),
  subject: z.string().nullable(),
  status: z.string(),
  channel: z.string(),
  userId: z.number().nullable(),
  dealershipId: z.number(),
  customerId: z.number().nullable(),
  assignedAgentId: z.number().nullable(),
  lastMessageAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const messageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  sender: z.string(),
  senderType: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const customerSchema = z.object({
  id: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  dealershipId: z.number(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const personaSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  promptTemplate: z.string(),
  systemPrompt: z.string().nullable(),
  dealershipId: z.number().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const personaArgumentSchema = z.object({
  id: z.number(),
  personaId: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  defaultValue: z.string().nullable(),
  required: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const leadSchema = z.object({
  id: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  dealershipId: z.number(),
  source: z.string().nullable(),
  status: z.string(),
  assignedAgentId: z.number().nullable(),
  conversationId: z.number().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const leadNoteSchema = z.object({
  id: z.number(),
  leadId: z.number(),
  userId: z.number(),
  content: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const vehicleSchema = z.object({
  id: z.number(),
  vin: z.string(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().nullable(),
  trim: z.string().nullable(),
  dealershipId: z.number(),
  status: z.string(),
  price: z.number().nullable(),
  mileage: z.number().nullable(),
  exteriorColor: z.string().nullable(),
  interiorColor: z.string().nullable(),
  transmission: z.string().nullable(),
  engine: z.string().nullable(),
  fuelType: z.string().nullable(),
  bodyStyle: z.string().nullable(),
  features: z.array(z.string()).nullable(),
  description: z.string().nullable(),
  images: z.array(z.string()).nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const leadVehicleSchema = z.object({
  leadId: z.number(),
  vehicleId: z.number(),
  interestLevel: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const apiKeySchema = z.object({
  id: z.number(),
  key: z.string(),
  name: z.string(),
  userId: z.number(),
  dealershipId: z.number(),
  permissions: z.array(z.string()).nullable(),
  expiresAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const auditLogSchema = z.object({
  id: z.number(),
  userId: z.number().nullable(),
  action: z.string(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  dealershipId: z.number().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.record(z.any()).nullable(),
  createdAt: z.date(),
});

export const settingSchema = z.object({
  id: z.number(),
  key: z.string(),
  value: z.any(),
  scope: z.string(),
  scopeId: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const smsMessageSchema = z.object({
  id: z.number(),
  from: z.string(),
  to: z.string(),
  body: z.string(),
  status: z.string(),
  externalId: z.string().nullable(),
  conversationId: z.number().nullable(),
  dealershipId: z.number(),
  metadata: z.record(z.any()).nullable(),
  sentAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const emailMessageSchema = z.object({
  id: z.number(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  isHtml: z.boolean(),
  status: z.string(),
  externalId: z.string().nullable(),
  conversationId: z.number().nullable(),
  dealershipId: z.number(),
  metadata: z.record(z.any()).nullable(),
  sentAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const jwtTokenSchema = z.object({
  id: z.number(),
  userId: z.number(),
  token: z.string(),
  isRevoked: z.boolean(),
  expiresAt: z.date(),
  createdAt: z.date(),
});

export const promptTemplateSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  template: z.string(),
  templateType: z.string(),
  parameters: z.record(z.any()).nullable(),
  dealershipId: z.number().nullable(),
  createdBy: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const optOutRecordSchema = z.object({
  id: z.number(),
  phone: z.string(),
  email: z.string().email().nullable(),
  dealershipId: z.number(),
  channel: z.string(),
  reason: z.string().nullable(),
  optedOutAt: z.date(),
  optedInAt: z.date().nullable(),
  status: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const vehicleLifecycleEventSchema = z.object({
  id: z.number(),
  vehicleId: z.number(),
  eventType: z.string(),
  eventDate: z.date(),
  userId: z.number().nullable(),
  leadId: z.number().nullable(),
  customerId: z.number().nullable(),
  dealershipId: z.number(),
  details: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const sandboxSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  createdBy: z.number(),
  dealershipId: z.number(),
  isActive: z.boolean(),
  hourlyTokenLimit: z.number(),
  dailyTokenLimit: z.number(),
  dailyCostLimit: z.number(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const sandboxSessionSchema = z.object({
  id: z.number(),
  sandboxId: z.number(),
  sessionId: z.string(),
  userId: z.number().nullable(),
  status: z.string(),
  startedAt: z.date(),
  endedAt: z.date().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const tokenUsageLogSchema = z.object({
  id: z.number(),
  sandboxId: z.number(),
  sessionId: z.string().nullable(),
  userId: z.number().nullable(),
  operationType: z.string(),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  cost: z.number(),
  model: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
});

export const toolSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  service: z.string(),
  endpoint: z.string().nullable(),
  inputSchema: z.record(z.any()).nullable(),
  outputSchema: z.record(z.any()).nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const agentToolSchema = z.object({
  id: z.number(),
  agentId: z.number(),
  toolId: z.number(),
  isEnabled: z.boolean(),
  parameters: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const gadsAccountSchema = z.object({
  id: z.number(),
  cid: z.string(),
  name: z.string().nullable(),
  currencyCode: z.string().nullable(),
  timezone: z.string().nullable(),
  isManagerAccount: z.boolean(),
  refreshToken: z.string(),
  accessToken: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  sandboxId: z.number().nullable(),
  userId: z.number(),
  dealershipId: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const gadsCampaignSchema = z.object({
  id: z.number(),
  gadsAccountId: z.number(),
  campaignId: z.string().nullable(),
  campaignName: z.string(),
  campaignType: z.string(),
  status: z.string(),
  budgetAmount: z.number().nullable(),
  isDryRun: z.boolean(),
  createdByAgent: z.number().nullable(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const dailySpendLogSchema = z.object({
  id: z.number(),
  cid: z.string(),
  date: z.date(),
  campaignId: z.string().nullable(),
  campaignName: z.string().nullable(),
  impressions: z.number(),
  clicks: z.number(),
  costMicros: z.number(),
  conversions: z.number(),
  conversionValueMicros: z.number(),
  ctr: z.number(),
  cpcMicros: z.number(),
  roas: z.number(),
  cpaMicros: z.number(),
  accountCurrencyCode: z.string().nullable(),
  extractedAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Types
export type User = z.infer<typeof userSchema>;
export type Dealership = z.infer<typeof dealershipSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type PersonaArgument = z.infer<typeof personaArgumentSchema>;
export type Lead = z.infer<typeof leadSchema>;
export type LeadNote = z.infer<typeof leadNoteSchema>;
export type Vehicle = z.infer<typeof vehicleSchema>;
export type LeadVehicle = z.infer<typeof leadVehicleSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
export type Setting = z.infer<typeof settingSchema>;
export type SmsMessage = z.infer<typeof smsMessageSchema>;
export type EmailMessage = z.infer<typeof emailMessageSchema>;
export type JwtToken = z.infer<typeof jwtTokenSchema>;
export type PromptTemplate = z.infer<typeof promptTemplateSchema>;
export type OptOutRecord = z.infer<typeof optOutRecordSchema>;
export type VehicleLifecycleEvent = z.infer<
  typeof vehicleLifecycleEventSchema
>;
export type Sandbox = z.infer<typeof sandboxSchema>;
export type SandboxSession = z.infer<typeof sandboxSessionSchema>;
export type TokenUsageLog = z.infer<typeof tokenUsageLogSchema>;
export type Tool = z.infer<typeof toolSchema>;
export type AgentTool = z.infer<typeof agentToolSchema>;
export type GadsAccount = z.infer<typeof gadsAccountSchema>;
export type GadsCampaign = z.infer<typeof gadsCampaignSchema>;
export type DailySpendLog = z.infer<typeof dailySpendLogSchema>;

// New User
export type NewUser = z.infer<typeof insertUserSchema>;
export type NewDealership = z.infer<typeof insertDealershipSchema>;
export type NewConversation = z.infer<typeof insertConversationSchema>;
export type NewMessage = z.infer<typeof insertMessageSchema>;
export type NewCustomer = z.infer<typeof insertCustomerSchema>;
export type NewPersona = z.infer<typeof insertPersonaSchema>;
export type NewPersonaArgument = z.infer<typeof insertPersonaArgumentSchema>;
export type NewLead = z.infer<typeof insertLeadSchema>;
export type NewLeadNote = z.infer<typeof insertLeadNoteSchema>;
export type NewVehicle = z.infer<typeof insertVehicleSchema>;
export type NewLeadVehicle = z.infer<typeof insertLeadVehicleSchema>;
export type NewApiKey = z.infer<typeof insertApiKeySchema>;
export type NewAuditLog = z.infer<typeof insertAuditLogSchema>;
export type NewSetting = z.infer<typeof insertSettingSchema>;
export type NewSmsMessage = z.infer<typeof insertSmsMessageSchema>;
export type NewEmailMessage = z.infer<typeof insertEmailMessageSchema>;
export type NewJwtToken = z.infer<typeof insertJwtTokenSchema>;
export type NewPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type NewOptOutRecord = z.infer<typeof insertOptOutRecordSchema>;
export type NewVehicleLifecycleEvent = z.infer<
  typeof insertVehicleLifecycleEventSchema
>;
export type NewSandbox = z.infer<typeof insertSandboxSchema>;
export type NewSandboxSession = z.infer<typeof insertSandboxSessionSchema>;
export type NewTokenUsageLog = z.infer<typeof insertTokenUsageLogSchema>;
export type NewTool = z.infer<typeof insertToolSchema>;
export type NewAgentTool = z.infer<typeof insertAgentToolSchema>;
export type NewGadsAccount = z.infer<typeof insertGadsAccountSchema>;
export type NewGadsCampaign = z.infer<typeof insertGadsCampaignSchema>;
export type NewDailySpendLog = z.infer<typeof insertDailySpendLogSchema>;
