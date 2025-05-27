/**
 * Redis configuration for the Rylie AI platform
 *
 * This file provides Redis client setup for job queues and caching
 */
import Redis from 'ioredis';
import logger from './logger';

// Use environment variables or default to localhost for development
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
const REDIS_TLS = process.env.REDIS_TLS === 'true';

// Default Redis options with development-friendly settings
const redisOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  tls: REDIS_TLS ? {} : undefined,
  retryStrategy: (times: number) => {
    // In development, limit retries to prevent log spam
    if (process.env.NODE_ENV !== 'production' && times > 5) {
      logger.warn('Redis retry limit reached in development mode, stopping retries');
      return null; // Stop retrying
    }

    // More gentle retry strategy with exponential backoff and cap
    const delay = Math.min(Math.pow(2, times) * 100, 10000); // Max 10s between retries
    logger.info(`Redis connection retry in ${delay}ms (attempt ${times})`);
    return delay;
  },
  enableOfflineQueue: false, // Disable in development to prevent hanging
  maxRetriesPerRequest: process.env.NODE_ENV === 'production' ? 10 : 3, // Fewer retries in dev
  connectTimeout: 5000, // Shorter timeout in development
  reconnectOnError: (err: Error) => {
    // In development, don't reconnect on ECONNREFUSED
    if (process.env.NODE_ENV !== 'production' && err.message.includes('ECONNREFUSED')) {
      return false;
    }

    const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
    return targetErrors.some(e => err.message.includes(e));
  },
  lazyConnect: true // Only connect when actually needed
};

// Create Redis client with error handling
const createRedisClient = () => {
  const client = new Redis({
    ...redisOptions,
    host: '0.0.0.0',
  });

  client.on('connect', () => {
    logger.info('Redis client connected successfully');
  });

  client.on('error', (err) => {
    logger.error('Redis client error', err);

    // Check if error is a connection refusal and we're in development
    if (err.message && err.message.includes('ECONNREFUSED') && process.env.NODE_ENV !== 'production') {
      logger.warn('Redis connection refused - using in-memory fallback for development');
      // The fallback mechanism is implemented in the queue modules
    }
  });

  client.on('reconnecting', (delay) => {
    logger.info(`Redis client reconnecting in ${delay}ms`);
  });

  return client;
};

// Singleton Redis client for the application
let redisClient: Redis.Redis | null = null;

// Function to get or create a Redis client
export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

// Function to check if Redis is available
export const isRedisAvailable = async (): Promise<boolean> => {
  // Skip Redis if explicitly set in environment
  if (process.env.SKIP_REDIS === 'true') {
    logger.info('Redis connections skipped due to SKIP_REDIS=true environment setting');
    return false;
  }

  try {
    if (!redisClient) {
      redisClient = createRedisClient();
    }

    // Simple ping check
    await redisClient.ping();
    return true;
  } catch (err) {
    logger.warn('Redis availability check failed', err);
    return false;
  }
};

// Function to gracefully close Redis connection
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed gracefully');
    } catch (err) {
      logger.error('Error closing Redis connection', err);
      // Force disconnect if quit fails
      if (redisClient) {
        redisClient.disconnect();
        redisClient = null;
      }
    }
  }
};

// Fallback in-memory store for development environments
export class InMemoryStore {
  private store: Map<string, any> = new Map();

  async get(key: string): Promise<any> {
    return this.store.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    this.store.set(key, value);

    if (ttl) {
      setTimeout(() => {
        this.store.delete(key);
      }, ttl * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async flushall(): Promise<void> {
    this.store.clear();
  }
}

// In-memory store singleton instance
const memoryStore = new InMemoryStore();

// Get appropriate store based on Redis availability
export const getStore = async () => {
  if (await isRedisAvailable()) {
    return getRedisClient();
  }

  logger.warn('Using in-memory store fallback instead of Redis');
  return memoryStore;
};

export default {
  getRedisClient,
  isRedisAvailable,
  closeRedisConnection,
  getStore,
  InMemoryStore
};