import { z } from 'zod';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import type { PgTable } from 'drizzle-orm/pg-core';

/**
 * Enhanced Schema Mappers with Dual-Case Support
 * 
 * This module provides comprehensive mapping utilities to handle the transition
 * from mixed naming conventions to a standardized snake_case (DB) -> camelCase (TS) pattern.
 * 
 * Features:
 * - Accepts both snake_case and camelCase during transition period
 * - Provides deprecation warnings for wrong-case usage
 * - Auto-maps database schema to TypeScript-friendly formats
 * - Type-safe transformations with full intellisense support
 */

// ===== CORE CASE CONVERSION UTILITIES =====

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function isPascalCase(str: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

export function isSnakeCase(str: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(str);
}

export function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

// ===== OBJECT KEY TRANSFORMATION =====

export function keysToCamelCase<T extends Record<string, any>>(
  obj: T,
  options: { strict?: boolean; warn?: boolean } = {}
): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const { strict = false, warn = true } = options;
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    
    // Warn about mixed case usage during transition
    if (warn && !isSnakeCase(key) && key !== camelKey) {
      console.warn(`[DEPRECATION] Key '${key}' should use snake_case convention. Use '${toSnakeCase(key)}' instead.`);
    }
    
    // Handle nested objects recursively
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = keysToCamelCase(value, options);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map(item => 
        typeof item === 'object' ? keysToCamelCase(item, options) : item
      );
    } else {
      result[camelKey] = value;
    }
  }
  
  return result;
}

export function keysToSnakeCase<T extends Record<string, any>>(
  obj: T,
  options: { strict?: boolean; warn?: boolean } = {}
): any {
  if (!obj || typeof obj !== 'object') return obj;
  
  const { strict = false, warn = true } = options;
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    
    // Warn about mixed case usage during transition
    if (warn && !isCamelCase(key) && key !== snakeKey) {
      console.warn(`[DEPRECATION] Key '${key}' should use camelCase convention. Use '${toCamelCase(key)}' instead.`);
    }
    
    // Handle nested objects recursively
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[snakeKey] = keysToSnakeCase(value, options);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map(item => 
        typeof item === 'object' ? keysToSnakeCase(item, options) : item
      );
    } else {
      result[snakeKey] = value;
    }
  }
  
  return result;
}

// ===== DUAL-CASE ZOD SCHEMA UTILITIES =====

/**
 * Creates a Zod schema that accepts both naming conventions temporarily
 * and transforms to the target case (camelCase for API, snake_case for DB)
 */
export function createDualCaseSchema<T extends z.ZodRawShape>(
  shape: T,
  options: { 
    targetCase?: 'camel' | 'snake',
    strict?: boolean,
    deprecationWarnings?: boolean
  } = {}
) {
  const { targetCase = 'camel', strict = false, deprecationWarnings = true } = options;
  const baseSchema = z.object(shape);
  
  return z.preprocess((data: any) => {
    if (!data || typeof data !== 'object') return data;
    
    // Transform keys based on target case
    if (targetCase === 'camel') {
      return keysToCamelCase(data, { strict, warn: deprecationWarnings });
    } else {
      return keysToSnakeCase(data, { strict, warn: deprecationWarnings });
    }
  }, baseSchema);
}

/**
 * Creates a transitional schema that accepts either case but outputs camelCase
 * with automatic stripping of deprecated variants
 */
export function createTransitionalSchema<TShape extends z.ZodRawShape>(
  shape: TShape,
  deprecatedKeys: Record<string, string> = {} // old_key -> newKey mapping
) {
  const baseSchema = z.object(shape);
  
  return z.preprocess((data: any) => {
    if (!data || typeof data !== 'object') return data;
    
    const transformed: any = {};
    
    // Handle each key in the input data
    for (const [inputKey, value] of Object.entries(data)) {
      const camelKey = toCamelCase(inputKey);
      const snakeKey = toSnakeCase(inputKey);
      
      // Check if this is a deprecated key mapping
      if (deprecatedKeys[inputKey]) {
        console.warn(`[DEPRECATION] Key '${inputKey}' is deprecated. Use '${deprecatedKeys[inputKey]}' instead.`);
        transformed[deprecatedKeys[inputKey]] = value;
        continue;
      }
      
      // Handle snake_case -> camelCase transformation
      if (isSnakeCase(inputKey)) {
        transformed[camelKey] = value;
      } 
      // Handle camelCase (already correct)
      else if (isCamelCase(inputKey)) {
        transformed[inputKey] = value;
      }
      // Handle mixed or unknown cases
      else {
        console.warn(`[NAMING] Unexpected key format '${inputKey}'. Converting to camelCase: '${camelKey}'`);
        transformed[camelKey] = value;
      }
    }
    
    return transformed;
  }, baseSchema);
}

// ===== ENHANCED DRIZZLE SCHEMA HELPERS =====

/**
 * Enhanced createSelectSchema that auto-maps snake_case DB columns to camelCase TS keys
 */
export function createSelectSchemaWithMapping<TTable extends PgTable>(
  table: TTable,
  options: {
    enableTransitionalSupport?: boolean;
    deprecationWarnings?: boolean;
    exclude?: string[];
  } = {}
) {
  const { enableTransitionalSupport = true, deprecationWarnings = true, exclude = [] } = options;
  
  // Get the base Drizzle schema
  const baseSchema = createSelectSchema(table);
  
  if (!enableTransitionalSupport) {
    // Standard mapping without dual-case support
    return baseSchema.transform(data => keysToCamelCase(data, { warn: deprecationWarnings }));
  }
  
  // Enhanced schema with dual-case support
  return z.preprocess((data: any) => {
    if (!data || typeof data !== 'object') return data;
    
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip excluded keys
      if (exclude.includes(key)) continue;
      
      const camelKey = toCamelCase(key);
      
      // Warn about usage of wrong case during transition
      if (deprecationWarnings && !isSnakeCase(key) && key !== camelKey) {
        console.warn(`[SCHEMA-DEPRECATION] Database key '${key}' should be snake_case. Expected: '${toSnakeCase(key)}'`);
      }
      
      transformed[camelKey] = value;
    }
    
    return transformed;
  }, baseSchema);
}

/**
 * Enhanced createInsertSchema that accepts both cases and converts to snake_case for DB
 */
export function createInsertSchemaWithMapping<TTable extends PgTable>(
  table: TTable,
  options: {
    enableTransitionalSupport?: boolean;
    deprecationWarnings?: boolean;
    exclude?: string[];
    omit?: (keyof TTable['_']['columns'])[];
  } = {}
) {
  const { enableTransitionalSupport = true, deprecationWarnings = true, exclude = [], omit = [] } = options;
  
  // Get the base Drizzle schema with omissions
  let baseSchema = createInsertSchema(table);
  if (omit.length > 0) {
    const omitObj = omit.reduce((acc, key) => ({ ...acc, [key]: true }), {});
    baseSchema = baseSchema.omit(omitObj);
  }
  
  if (!enableTransitionalSupport) {
    // Standard validation without dual-case support
    return baseSchema;
  }
  
  // Enhanced schema with dual-case support
  return z.preprocess((data: any) => {
    if (!data || typeof data !== 'object') return data;
    
    const transformed: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      // Skip excluded keys
      if (exclude.includes(key)) continue;
      
      const snakeKey = toSnakeCase(key);
      
      // Accept both camelCase input and snake_case (with warnings)
      if (isCamelCase(key)) {
        // Input is camelCase, convert to snake_case for DB
        transformed[snakeKey] = value;
      } else if (isSnakeCase(key)) {
        // Input is already snake_case (direct DB format)
        if (deprecationWarnings) {
          console.warn(`[API-DEPRECATION] Input key '${key}' should be camelCase. Use '${toCamelCase(key)}' instead.`);
        }
        transformed[key] = value;
      } else {
        // Handle mixed or unknown cases
        console.warn(`[NAMING] Unexpected input format '${key}'. Converting to snake_case: '${snakeKey}'`);
        transformed[snakeKey] = value;
      }
    }
    
    return transformed;
  }, baseSchema);
}

// ===== TYPE UTILITIES =====

/**
 * Utility type to convert snake_case keys to camelCase
 */
export type CamelCaseKeys<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer A}_${infer B}`
      ? `${A}${Capitalize<CamelCaseKeys<{ [P in B]: any }>[B]>}`
      : K
    : K]: T[K];
};

/**
 * Utility type to convert camelCase keys to snake_case
 */
export type SnakeCaseKeys<T> = {
  [K in keyof T as K extends string
    ? K extends `${infer A}${infer B}`
      ? B extends Uncapitalize<B>
        ? `${A}${B}`
        : `${A}_${Uncapitalize<B>}`
      : K
    : K]: T[K];
};

// ===== DEPRECATION HELPERS =====

/**
 * Creates a deprecation-aware wrapper for transitional API endpoints
 */
export function createDeprecationWrapper<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  transform: (input: TInput) => TOutput,
  deprecationMessage?: string
) {
  return {
    validate: (data: unknown) => {
      const result = schema.safeParse(data);
      
      if (!result.success) {
        throw new Error(`Validation failed: ${result.error.message}`);
      }
      
      if (deprecationMessage) {
        console.warn(`[DEPRECATION] ${deprecationMessage}`);
      }
      
      return transform(result.data);
    }
  };
}

// ===== EXPORT CONVENIENCE FUNCTIONS =====

/**
 * Quick utility to create a fully-mapped Drizzle schema pair
 */
export function createMappedSchemas<TTable extends PgTable>(
  table: TTable,
  options: {
    deprecationWarnings?: boolean;
    transitionalSupport?: boolean;
    omitFromInsert?: (keyof TTable['_']['columns'])[];
  } = {}
) {
  const { deprecationWarnings = true, transitionalSupport = true, omitFromInsert = [] } = options;
  
  return {
    select: createSelectSchemaWithMapping(table, {
      enableTransitionalSupport: transitionalSupport,
      deprecationWarnings
    }),
    insert: createInsertSchemaWithMapping(table, {
      enableTransitionalSupport: transitionalSupport,
      deprecationWarnings,
      omit: omitFromInsert
    })
  };
}
