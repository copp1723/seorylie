import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  decimal,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Import base schema tables from shared/schema.ts
import {
  users,
  conversations,
  dealerships as baseDealerships,
  // Import other tables as needed
} from "../shared/schema";

// Define v1 schema
const v1 = {
  // Re-export base tables
  users,
  conversations,
  dealerships: baseDealerships,

  // Define v1 vehicles table (basic structure)
  vehicles: pgTable(
    "vehicles",
    {
      id: serial("id").primaryKey(),
      dealershipId: integer("dealership_id").notNull(),
      vin: varchar("vin", { length: 17 }),
      make: varchar("make", { length: 100 }),
      model: varchar("model", { length: 100 }),
      year: integer("year"),
      trim: varchar("trim", { length: 100 }),
      exteriorColor: varchar("exterior_color", { length: 100 }),
      interiorColor: varchar("interior_color", { length: 100 }),
      mileage: integer("mileage"),
      price: decimal("price", { precision: 10, scale: 2 }),
      msrp: decimal("msrp", { precision: 10, scale: 2 }),
      status: varchar("status", { length: 50 }).default("available"),
      description: text("description"),
      features: json("features").$type<string[]>(),
      images: json("images").$type<string[]>(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => {
      return {
        vinIdx: index("vin_idx").on(table.vin),
        dealershipIdIdx: index("v1_dealership_id_idx").on(table.dealershipId),
        statusIdx: index("v1_status_idx").on(table.status),
      };
    },
  ),
};

// Define v2 schema with enhanced tables
const v2 = {
  // Re-export base tables that don't change
  users,
  conversations,

  // Enhanced dealerships table with dual-mode fields
  dealerships: pgTable(
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

      // Enhanced v2 fields
      operationMode: varchar("operation_mode", { length: 50 }).default(
        "rylie_ai",
      ),
      aiConfig: jsonb("ai_config").default({}),
      agentConfig: jsonb("agent_config").default({}),
      leadRouting: jsonb("lead_routing").default({}),

      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => {
      return {
        subdomainIdx: index("subdomain_idx").on(table.subdomain),
        nameIdx: index("name_idx").on(table.name),
        operationModeIdx: index("dealerships_operation_mode_idx").on(
          table.operationMode,
        ),
      };
    },
  ),

  // Enhanced vehicles table with additional fields for dual-mode functionality
  vehicles: pgTable(
    "vehicles",
    {
      id: serial("id").primaryKey(),
      dealershipId: integer("dealership_id").notNull(),
      vin: varchar("vin", { length: 17 }),
      make: varchar("make", { length: 100 }),
      model: varchar("model", { length: 100 }),
      year: integer("year"),
      trim: varchar("trim", { length: 100 }),
      exteriorColor: varchar("exterior_color", { length: 100 }),
      interiorColor: varchar("interior_color", { length: 100 }),
      mileage: integer("mileage"),
      price: decimal("price", { precision: 10, scale: 2 }),
      msrp: decimal("msrp", { precision: 10, scale: 2 }),
      status: varchar("status", { length: 50 }).default("available"),
      description: text("description"),
      features: json("features").$type<string[]>(),
      images: json("images").$type<string[]>(),

      // Enhanced fields for v2 schema
      operationMode: varchar("operation_mode", { length: 50 }).default(
        "rylie_ai",
      ),
      aiConfig: jsonb("ai_config").default({}),
      leadScore: integer("lead_score").default(50),
      lifecycleStage: varchar("lifecycle_stage", { length: 50 }).default("new"),
      lastInteractionAt: timestamp("last_interaction_at"),
      viewCount: integer("view_count").default(0),
      inquiryCount: integer("inquiry_count").default(0),
      testDriveCount: integer("test_drive_count").default(0),
      recommendationScore: integer("recommendation_score"),
      customAttributes: jsonb("custom_attributes").default({}),

      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => {
      return {
        vinIdx: index("vin_idx").on(table.vin),
        dealershipIdIdx: index("v2_dealership_id_idx").on(table.dealershipId),
        statusIdx: index("v2_status_idx").on(table.status),
        lifecycleIdx: index("lifecycle_stage_idx").on(table.lifecycleStage),
        operationModeIdx: index("operation_mode_idx").on(table.operationMode),
      };
    },
  ),
};

// Define TypeScript types for both schema versions
export type SchemaVersions = {
  v1: typeof v1;
  v2: typeof v2;
};

// Export schema versions
export const schemaVersions: SchemaVersions = {
  v1,
  v2,
};

// Export individual versions for direct imports
export const v1Schema = v1;
export const v2Schema = v2;

// Export default schema versions object
export default schemaVersions;
