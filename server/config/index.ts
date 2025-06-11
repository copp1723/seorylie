/**
 * Server configuration exports
 * Centralizes all configuration for easy access
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('seorylie_test'),
  JWT_SECRET: z.string().default('test-jwt-secret'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  OPENAI_API_KEY: z.string().optional(),
});

// Parse and validate environment
const env = envSchema.parse(process.env);

export const config = {
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  DATABASE_URL: env.DATABASE_URL || `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
  DB_HOST: env.DB_HOST,
  DB_PORT: env.DB_PORT,
  DB_USER: env.DB_USER,
  DB_PASSWORD: env.DB_PASSWORD,
  DB_NAME: env.DB_NAME,
  JWT_SECRET: env.JWT_SECRET,
  REDIS_URL: env.REDIS_URL,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  
  // Derived configs
  IS_PRODUCTION: env.NODE_ENV === 'production',
  IS_DEVELOPMENT: env.NODE_ENV === 'development',
  IS_TEST: env.NODE_ENV === 'test',
};

export default config;
