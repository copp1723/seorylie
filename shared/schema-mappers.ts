import { z } from 'zod';

// Runtime case conversion utilities
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Transform object keys between cases
export function keysToCamelCase<T extends Record<string, any>>(obj: T): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value;
  }
  return result;
}

export function keysToSnakeCase<T extends Record<string, any>>(obj: T): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

// Zod transformer that accepts both naming conventions
export function createDualCaseSchema<T extends z.ZodRawShape>(shape: T) {
  const baseSchema = z.object(shape);
  
  return baseSchema.transform((data) => {
    // Convert snake_case keys to camelCase
    const transformed: any = {};
    for (const [key, value] of Object.entries(data)) {
      const camelKey = toCamelCase(key);
      transformed[camelKey] = value;
    }
    return transformed;
  }).or(baseSchema); // Accept either format during transition
}

// Enhanced Drizzle schema helpers
export function createSelectSchemaWithMapping<T>(table: T) {
  // This would integrate with Drizzle's createSelectSchema
  // Implementation depends on your specific Drizzle setup
  return createDualCaseSchema({} as any); // Placeholder
}

export function createInsertSchemaWithMapping<T>(table: T) {
  // This would integrate with Drizzle's createInsertSchema  
  // Implementation depends on your specific Drizzle setup
  return createDualCaseSchema({} as any); // Placeholder
}