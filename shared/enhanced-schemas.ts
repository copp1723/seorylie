/**
 * Enhanced Schema Definitions with Dual-Case Support
 * 
 * This file demonstrates the refactored approach to handling naming mismatches
 * between database schema (snake_case) and TypeScript interfaces (camelCase).
 * 
 * Features:
 * - Accepts both naming variants during transition period
 * - Provides deprecation warnings for wrong-case usage  
 * - Auto-maps snake_case DB columns to camelCase TS keys
 * - Type-safe transformations with full intellisense support
 * - Phase-out mechanism for deprecated variants
 */

import { z } from 'zod';
import { 
  createSelectSchemaWithMapping,
  createInsertSchemaWithMapping,
  createMappedSchemas,
  createTransitionalSchema,
  createDeprecationWrapper,
  type CamelCaseKeys,
  type SnakeCaseKeys
} from './schema-mappers';

// Import base table definitions
import { 
  users, 
  dealerships, 
  conversations, 
  messages, 
  customers,
  personas,
  vehicles,
  leads
} from './schema';

// ===== ENHANCED SCHEMA DEFINITIONS =====

/**
 * Users Schema with enhanced dual-case support
 */
export const enhancedUserSchemas = createMappedSchemas(users, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

// Create transitional schema for user creation that handles legacy field names
export const createUserSchema = createTransitionalSchema(
  {
    username: z.string().min(1),
    name: z.string().min(1).optional(),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['admin', 'user', 'agent']).default('user'),
    dealershipId: z.number().optional(),
    isActive: z.boolean().default(true)
  },
  {
    // Legacy field mappings that will be deprecated
    'user_name': 'username',
    'email_address': 'email',
    'dealership_id': 'dealershipId',
    'is_active': 'isActive'
  }
);

/**
 * Dealerships Schema with enhanced mapping
 */
export const enhancedDealershipSchemas = createMappedSchemas(dealerships, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const createDealershipSchema = createTransitionalSchema(
  {
    name: z.string().min(1),
    subdomain: z.string().min(1),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().default('US'),
    timezone: z.string().default('America/New_York'),
    isActive: z.boolean().default(true),
    settings: z.record(z.any()).optional()
  },
  {
    // Legacy mappings
    'contact_email': 'contactEmail',
    'contact_phone': 'contactPhone',
    'is_active': 'isActive'
  }
);

/**
 * Conversations Schema with dual-case support
 */
export const enhancedConversationSchemas = createMappedSchemas(conversations, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt', 'lastMessageAt']
});

export const createConversationSchema = createTransitionalSchema(
  {
    subject: z.string().optional(),
    status: z.enum(['open', 'closed', 'pending']).default('open'),
    channel: z.enum(['web', 'email', 'sms', 'phone']).default('web'),
    userId: z.number().optional(),
    dealershipId: z.number(),
    customerId: z.number().optional(),
    assignedAgentId: z.number().optional()
  },
  {
    // Legacy mappings
    'user_id': 'userId',
    'dealership_id': 'dealershipId',
    'customer_id': 'customerId',
    'assigned_agent_id': 'assignedAgentId'
  }
);

/**
 * Messages Schema with enhanced validation
 */
export const enhancedMessageSchemas = createMappedSchemas(messages, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const createMessageSchema = createTransitionalSchema(
  {
    conversationId: z.number(),
    sender: z.string().min(1),
    senderType: z.enum(['user', 'agent', 'system', 'ai']).default('user'),
    content: z.string().min(1),
    metadata: z.record(z.any()).optional()
  },
  {
    // Legacy mappings
    'conversation_id': 'conversationId',
    'sender_type': 'senderType'
  }
);

/**
 * Customers Schema with transitional support
 */
export const enhancedCustomerSchemas = createMappedSchemas(customers, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

export const createCustomerSchema = createTransitionalSchema(
  {
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    dealershipId: z.number(),
    metadata: z.record(z.any()).optional()
  },
  {
    // Legacy mappings
    'first_name': 'firstName',
    'last_name': 'lastName',
    'dealership_id': 'dealershipId'
  }
);

// ===== API RESPONSE SCHEMAS WITH CAMELCASE OUTPUT =====

/**
 * API response schemas that always return camelCase regardless of DB format
 */
export const apiUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.string(),
  dealershipId: z.number().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiDealershipSchema = z.object({
  id: z.number(),
  name: z.string(),
  subdomain: z.string(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  country: z.string().nullable(),
  timezone: z.string(),
  isActive: z.boolean(),
  settings: z.record(z.any()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiConversationSchema = z.object({
  id: z.number(),
  subject: z.string().nullable(),
  status: z.string(),
  channel: z.string(),
  userId: z.number().nullable(),
  dealershipId: z.number(),
  customerId: z.number().nullable(),
  assignedAgentId: z.number().nullable(),
  lastMessageAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiMessageSchema = z.object({
  id: z.number(),
  conversationId: z.number(),
  sender: z.string(),
  senderType: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const apiCustomerSchema = z.object({
  id: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  dealershipId: z.number(),
  metadata: z.record(z.any()).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ===== DEPRECATION WRAPPERS FOR TRANSITIONAL ENDPOINTS =====

/**
 * Wrapper for legacy user endpoints that still use snake_case
 */
export const legacyUserWrapper = createDeprecationWrapper(
  enhancedUserSchemas.select,
  (user) => user,
  'Legacy user endpoint with snake_case is deprecated. Use camelCase API endpoints instead.'
);

/**
 * Wrapper for legacy dealership endpoints
 */
export const legacyDealershipWrapper = createDeprecationWrapper(
  enhancedDealershipSchemas.select,
  (dealership) => dealership,
  'Legacy dealership endpoint with snake_case is deprecated. Use camelCase API endpoints instead.'
);

// ===== TYPE EXPORTS =====

// Enhanced type definitions that are camelCase-friendly
export type EnhancedUser = z.infer<typeof apiUserSchema>;
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = Partial<CreateUserRequest>;

export type EnhancedDealership = z.infer<typeof apiDealershipSchema>;
export type CreateDealershipRequest = z.infer<typeof createDealershipSchema>;
export type UpdateDealershipRequest = Partial<CreateDealershipRequest>;

export type EnhancedConversation = z.infer<typeof apiConversationSchema>;
export type CreateConversationRequest = z.infer<typeof createConversationSchema>;
export type UpdateConversationRequest = Partial<CreateConversationRequest>;

export type EnhancedMessage = z.infer<typeof apiMessageSchema>;
export type CreateMessageRequest = z.infer<typeof createMessageSchema>;

export type EnhancedCustomer = z.infer<typeof apiCustomerSchema>;
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;

// ===== VALIDATION HELPERS =====

/**
 * Helper function to validate and transform data for database insertion
 */
export function validateForDatabase<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  entityName: string
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => 
      `${issue.path.join('.')}: ${issue.message}`
    ).join(', ');
    
    throw new Error(`Invalid ${entityName} data: ${errors}`);
  }
  
  return result.data;
}

/**
 * Helper function to transform database results to API format
 */
export function transformForAPI<TDB, TAPI>(
  dbResult: TDB,
  apiSchema: z.ZodSchema<TAPI>
): TAPI {
  // First transform snake_case to camelCase if needed
  const transformed = Object.keys(dbResult as any).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
    acc[camelKey] = (dbResult as any)[key];
    return acc;
  }, {} as any);
  
  // Then validate the transformed result
  const result = apiSchema.safeParse(transformed);

  if (!result.success) {
    console.error('API transformation failed:', result.error);
    throw new Error('Failed to transform database result to API format');
  }

  return result.data;
}

// ===== MIGRATION UTILITIES =====

/**
 * Utility to check if an object uses deprecated snake_case keys
 */
const DEPRECATED_KEYS = new Set([
  'user_name', 'email_address', 'dealership_id', 'is_active',
  'contact_email', 'contact_phone', 'user_id', 'customer_id',
  'assigned_agent_id', 'conversation_id', 'sender_type',
  'first_name', 'last_name'
]);

export function hasDeprecatedKeys(obj: Record<string, any>): boolean {
  return Object.keys(obj).some(key => DEPRECATED_KEYS.has(key));
}

/**
 * Utility to generate migration warnings for API consumers
 */
export function generateMigrationWarning(
  endpoint: string,
  deprecatedKeys: string[]
): string {
  return `[API-MIGRATION] Endpoint ${endpoint} received deprecated keys: ${deprecatedKeys.join(', ')}. ` +
    `Please update to use camelCase equivalents. Support for snake_case will be removed in v2.0.0.`;
}

// ===== EXAMPLE USAGE AND DOCUMENTATION =====

/**
 * Example usage of the enhanced schemas:
 * 
 * // For API endpoints (always camelCase output):
 * const userResponse = transformForAPI(dbUser, apiUserSchema);
 * 
 * // For database operations (accepts both cases):
 * const userData = validateForDatabase(createUserSchema, requestBody, 'user');
 * 
 * // For legacy endpoints (with deprecation warnings):
 * const legacyUser = legacyUserWrapper.validate(snakeCaseData);
 * 
 * // For new schema-aware operations:
 * const newUser = enhancedUserSchemas.insert.parse(camelCaseData);
 * const userList = enhancedUserSchemas.select.parse(dbResults);
 */

export default {
  // Schema pairs
  users: enhancedUserSchemas,
  dealerships: enhancedDealershipSchemas,
  conversations: enhancedConversationSchemas,
  messages: enhancedMessageSchemas,
  customers: enhancedCustomerSchemas,
  
  // Creation schemas
  createUser: createUserSchema,
  createDealership: createDealershipSchema,
  createConversation: createConversationSchema,
  createMessage: createMessageSchema,
  createCustomer: createCustomerSchema,
  
  // API schemas
  apiUser: apiUserSchema,
  apiDealership: apiDealershipSchema,
  apiConversation: apiConversationSchema,
  apiMessage: apiMessageSchema,
  apiCustomer: apiCustomerSchema,
  
  // Legacy wrappers
  legacy: {
    user: legacyUserWrapper,
    dealership: legacyDealershipWrapper
  },
  
  // Utilities
  validateForDatabase,
  transformForAPI,
  hasDeprecatedKeys,
  generateMigrationWarning
};
