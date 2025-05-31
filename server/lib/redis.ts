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
    });

    // Test the connection
    await redisClient.ping();
    
    logger.info('Redis connection established successfully');
    
    // Set up error handlers
    redisClient.on('error', (error) => {
      logger.error('Redis connection error', { error: error.message });
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

    return redisClient;
  } catch (error) {
    logger.warn('Redis connection failed - running without Redis cache', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Return a mock client for development if Redis is not available
    return createMockRedisClient();
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