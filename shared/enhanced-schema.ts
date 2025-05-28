import * as schema from './schema';

// Re‑export tables
export const dealerships = schema.dealerships;
export const users = schema.users;
export const vehicles = schema.vehicles;
export const personas = schema.personas;
export const apiKeys = schema.apiKeys;
export const magicLinkInvitations = schema.magicLinkInvitations;
export const dealershipVariables = schema.dealershipVariables;
export const sessions = schema.sessions;
export const reportSchedules = schema.reportSchedules;
export const userRoles = schema.userRoles;

// Re‑export insert schemas
export const insertDealershipSchema = schema.insertDealershipSchema;
export const insertUserSchema = schema.insertUserSchema;
export const insertVehicleSchema = schema.insertVehicleSchema;
export const insertPersonaSchema = schema.insertPersonaSchema;
export const insertApiKeySchema = schema.insertApiKeySchema;
export const insertMagicLinkInvitationSchema = schema.insertMagicLinkInvitationSchema;
export const insertDealershipVariableSchema = schema.insertDealershipVariableSchema;

// Re‑export types
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
export type DealershipVariable = schema.DealershipVariable;
export type InsertDealershipVariable = schema.InsertDealershipVariable;
