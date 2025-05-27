import { pgTable, serial, text, varchar, timestamp, boolean, integer, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
// Import everything from the main schema
import * as schema from './schema';

// Re-export all schema elements
export const dealerships = schema.dealerships;
export const users = schema.users;
export const vehicles = schema.vehicles;
export const personas = schema.personas;
export const apiKeys = schema.apiKeys;
export const magicLinkInvitations = schema.magicLinkInvitations;
export const sessions = schema.sessions;
export const reportSchedules = schema.reportSchedules;
export const userRoles = schema.userRoles;

// Re-export all insert schemas
export const insertDealershipSchema = schema.insertDealershipSchema;
export const insertUserSchema = schema.insertUserSchema;
export const insertVehicleSchema = schema.insertVehicleSchema;
export const insertPersonaSchema = schema.insertPersonaSchema;
export const insertApiKeySchema = schema.insertApiKeySchema;
export const insertMagicLinkInvitationSchema = schema.insertMagicLinkInvitationSchema;

// Re-export all types
export type UserRole = schema.UserRole;
export type Dealership = schema.Dealership;
export type InsertDealership = schema.InsertDealership;
export type User = schema.User;
export type InsertUser = schema.InsertUser;
export type Vehicle = schema.Vehicle;
export type InsertVehicle = schema.InsertVehicle;
export type Persona = schema.Persona;
export type InsertPersona = schema.InsertPersona;
export type ApiKey = schema.ApiKey;
export type InsertApiKey = schema.InsertApiKey;
export type MagicLinkInvitation = schema.MagicLinkInvitation;
export type InsertMagicLinkInvitation = schema.InsertMagicLinkInvitation;

// Customers table for tracking customer information
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  dealershipId: integer('dealership_id').notNull().references(() => dealerships.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
});

// Create schemas for insert operations
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, created_at: true, updated_at: true });

// Establish relationships
export const customersRelations = relations(customers, ({ one, many }) => ({
  dealership: one(dealerships, {
    fields: [customers.dealershipId],
    references: [dealerships.id],
  }),
  // Note: conversations relation will be defined in lead-management-schema.ts to avoid circular imports
}));

// Export types
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;