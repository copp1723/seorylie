/**
 * Global type definitions for the CI environment
 * Ensures TypeScript compilation succeeds in CI
 */

// Mock external module declarations for CI
declare module 'pg' {
  export class Pool {
    constructor(config?: any);
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
    connect(): Promise<any>;
  }
  
  export class Client {
    constructor(config?: any);
    query(text: string, params?: any[]): Promise<any>;
    end(): Promise<void>;
    connect(): Promise<void>;
  }
}

declare module 'redis' {
  export function createClient(options?: any): any;
}

declare module 'winston' {
  export function createLogger(options?: any): any;
  export const format: any;
  export const transports: any;
}

declare module 'express-rate-limit' {
  export default function rateLimit(options?: any): any;
}

declare module 'drizzle-orm/pg-core' {
  export function pgTable(name: string, columns: any): any;
  export function serial(name?: string): any;
  export function varchar(name?: string, config?: any): any;
  export function text(name?: string): any;
  export function timestamp(name?: string, config?: any): any;
  export function boolean(name?: string): any;
  export function json(name?: string): any;
  export function integer(name?: string): any;
}

declare module 'drizzle-orm' {
  export function drizzle(client: any, config?: any): any;
  export function eq(column: any, value: any): any;
  export function and(...conditions: any[]): any;
  export function or(...conditions: any[]): any;
}

// Global environment variables
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    DATABASE_URL?: string;
    DB_HOST?: string;
    DB_PORT?: string;
    DB_USER?: string;
    DB_PASSWORD?: string;
    DB_NAME?: string;
    JWT_SECRET?: string;
    REDIS_URL?: string;
    OPENAI_API_KEY?: string;
  }
}

// Jest global types for testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
      toHaveBeenCalledBefore(mock: jest.MockInstance<any, any>): R;
    }
  }
}

export {};
