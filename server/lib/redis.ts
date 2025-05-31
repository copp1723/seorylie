/**
 * Redis Connection and Configuration
 * Provides Redis client initialization and connection management
 */

import Redis from 'ioredis';
import logger from '../utils/logger';

let redisClient: Redis | null = null;

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<Redis> {
  // Check if Redis should be skipped
  if (process.env.SKIP_REDIS === 'true') {
    logger.info('Redis disabled via SKIP_REDIS environment variable');
    redisClient = createMockRedisClient();
    return redisClient;
  }

  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    logger.info('Initializing Redis connection', {
      url: redisUrl.replace(/:[^:@]+@/, ':***@') // Hide password in logs
    });

    redisClient = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      enableOfflineQueue: false, // Prevent hanging when Redis is unavailable
    });

    // Set up error handlers BEFORE attempting connection
    redisClient.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
      // Don't throw here - let the application continue with fallback
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });

    redisClient.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    // Test the connection with timeout
    const pingPromise = redisClient.ping();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Redis connection timeout')), 3000);
    });

    await Promise.race([pingPromise, timeoutPromise]);

    logger.info('Redis connection established successfully');
    return redisClient;

  } catch (error) {
    logger.warn('Redis connection failed - running without Redis cache', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Clean up failed connection
    if (redisClient) {
      try {
        redisClient.disconnect();
      } catch (disconnectError) {
        // Ignore disconnect errors
      }
    }

    // Return a mock client for development if Redis is not available
    redisClient = createMockRedisClient();
    return redisClient;
  }
}

/**
 * Get the current Redis client
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}

/**
 * Create a mock Redis client for development when Redis is not available
 */
function createMockRedisClient(): Redis {
  const mockClient = {
    ping: async () => 'PONG',
    set: async () => 'OK',
    get: async () => null,
    del: async () => 0,
    exists: async () => 0,
    expire: async () => 0,
    ttl: async () => -1,
    on: () => {},
    disconnect: async () => {},
    quit: async () => {},
  } as any;

  logger.info('Using mock Redis client for development');
  return mockClient;
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis connection', {
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      redisClient = null;
    }
  }
}

export default {
  initializeRedis,
  getRedisClient,
  closeRedisConnection,
};