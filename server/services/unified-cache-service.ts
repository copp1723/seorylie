import Redis from 'ioredis';
import logger from '../utils/logger';

/**
 * Unified cache service that supports both Redis and in-memory fallback
 * Eliminates circular dependency by combining both implementations
 */

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Optional key prefix
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
  type: 'redis' | 'memory';
  connected: boolean;
  info?: any;
}

interface CacheConfig {
  ttl: number;
  type: 'redis' | 'memory';
  prefix?: string;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

class UnifiedCacheService {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, { value: any; expires: number }>();
  private stats = {
    hits: 0,
    misses: 0,
    operations: 0
  };

  private config: CacheConfig = {
    ttl: 3600, // 1 hour default
    type: 'memory',
    prefix: 'rylie:'
  };

  constructor() {
    this.initializeCache();
  }

  private async initializeCache(): Promise<void> {
    try {
      // Try to initialize Redis if configuration is available
      if (process.env.REDIS_HOST && !process.env.SKIP_REDIS) {
        this.redis = new Redis({
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        });

        // Test Redis connection
        await this.redis.ping();
        this.config.type = 'redis';
        logger.info('Redis cache service initialized');

        // Handle Redis errors gracefully
        this.redis.on('error', (error) => {
          logger.error('Redis connection error, falling back to memory cache', error);
          this.config.type = 'memory';
        });

        this.redis.on('connect', () => {
          logger.info('Redis cache connected');
          this.config.type = 'redis';
        });

        this.redis.on('close', () => {
          logger.warn('Redis cache disconnected, using memory cache');
          this.config.type = 'memory';
        });

      } else {
        logger.info('Redis not configured, using in-memory cache');
        this.config.type = 'memory';
      }
    } catch (error) {
      logger.warn('Failed to connect to Redis, falling back to memory cache', error);
      this.config.type = 'memory';
      this.redis = null;
    }
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);

      if (this.config.type === 'redis' && this.redis) {
        try {
          const value = await this.redis.get(fullKey);
          if (value !== null) {
            this.stats.hits++;
            return JSON.parse(value) as T;
          }
        } catch (error) {
          logger.warn('Redis get failed, trying memory cache', error);
          // Fall through to memory cache
        }
      }

      // Memory cache lookup
      const cached = this.memoryCache.get(fullKey);
      if (cached && cached.expires > Date.now()) {
        this.stats.hits++;
        return cached.value as T;
      } else if (cached) {
        this.memoryCache.delete(fullKey); // Clean up expired entry
      }

      this.stats.misses++;
      return null;

    } catch (error) {
      logger.error('Cache get error', error, { key });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options?.prefix);
      const ttl = options?.ttl || this.config.ttl;
      const expires = Date.now() + (ttl * 1000);

      // Always store in memory cache as backup
      this.memoryCache.set(fullKey, { value, expires });

      // Try Redis if available
      if (this.config.type === 'redis' && this.redis) {
        try {
          await this.redis.setex(fullKey, ttl, JSON.stringify(value));
          this.cleanupMemoryCache(); // Periodic cleanup
          return true;
        } catch (error) {
          logger.warn('Redis set failed, value stored in memory only', error);
        }
      }

      this.cleanupMemoryCache();
      return true;

    } catch (error) {
      logger.error('Cache set error', error, { key });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, prefix?: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, prefix);

      // Remove from memory cache
      this.memoryCache.delete(fullKey);

      // Remove from Redis if available
      if (this.config.type === 'redis' && this.redis) {
        try {
          await this.redis.del(fullKey);
        } catch (error) {
          logger.warn('Redis delete failed', error);
        }
      }

      return true;

    } catch (error) {
      logger.error('Cache delete error', error, { key });
      return false;
    }
  }

  /**
   * Clear all cache entries with optional prefix
   */
  async clear(prefix?: string): Promise<boolean> {
    try {
      if (prefix) {
        const fullPrefix = this.getFullKey('', prefix);

        // Clear matching entries from memory cache
        for (const key of this.memoryCache.keys()) {
          if (key.startsWith(fullPrefix)) {
            this.memoryCache.delete(key);
          }
        }

        // Clear matching entries from Redis
        if (this.config.type === 'redis' && this.redis) {
          try {
            const keys = await this.redis.keys(`${fullPrefix}*`);
            if (keys.length > 0) {
              await this.redis.del(...keys);
            }
          } catch (error) {
            logger.warn('Redis clear failed', error);
          }
        }
      } else {
        // Clear all
        this.memoryCache.clear();

        if (this.config.type === 'redis' && this.redis) {
          try {
            await this.redis.flushdb();
          } catch (error) {
            logger.warn('Redis flush failed', error);
          }
        }
      }

      return true;

    } catch (error) {
      logger.error('Cache clear error', error);
      return false;
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<boolean> {
    return this.clear(pattern);
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);

      // Check Redis first
      if (this.config.type === 'redis' && this.redis) {
        try {
          const exists = await this.redis.exists(fullKey);
          if (exists) return true;
        } catch (error) {
          logger.warn('Redis exists check failed', error);
        }
      }

      // Check memory cache
      const cached = this.memoryCache.get(fullKey);
      return !!(cached && cached.expires > Date.now());

    } catch (error) {
      logger.error('Cache exists error', error, { key });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalOps = this.stats.hits + this.stats.misses;
    const hitRate = totalOps > 0 ? ((this.stats.hits / totalOps) * 100).toFixed(2) : '0.00';

    return {
      size: this.memoryCache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      type: this.config.type,
      connected: this.config.type === 'redis' ? !!this.redis : true
    };
  }

  /**
   * Get cache info including Redis info if available
   */
  async getInfo(): Promise<any> {
    const stats = this.getStats();

    if (this.config.type === 'redis' && this.redis) {
      try {
        const redisInfo = await this.redis.info();
        return {
          ...stats,
          redis: {
            info: redisInfo,
            connected: true
          }
        };
      } catch (error) {
        logger.warn('Failed to get Redis info', error);
      }
    }

    return stats;
  }

  /**
   * Test cache functionality
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const testKey = 'health_check_test';
      const testValue = { timestamp: Date.now() };

      // Test set operation
      const setResult = await this.set(testKey, testValue, { ttl: 10 });
      if (!setResult) {
        return {
          status: 'unhealthy',
          details: { error: 'Failed to set test value' }
        };
      }

      // Test get operation
      const getValue = await this.get(testKey);
      if (!getValue || getValue.timestamp !== testValue.timestamp) {
        return {
          status: 'unhealthy',
          details: { error: 'Failed to retrieve test value' }
        };
      }

      // Test delete operation
      await this.delete(testKey);

      const stats = this.getStats();
      return {
        status: 'healthy',
        details: stats
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : String(error) }
      };
    }
  }

  // Private helper methods
  private getFullKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.config.prefix || '';
    return `${keyPrefix}${key}`;
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expires <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired memory cache entries', { cleaned });
    }

    // Prevent memory cache from growing too large
    if (this.memoryCache.size > 10000) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].expires - b[1].expires);

      // Remove oldest 20% of entries
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries[i][0]);
      }

      logger.info('Memory cache size limit reached, cleaned up oldest entries', {
        removed: toRemove,
        remaining: this.memoryCache.size
      });
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
        logger.info('Redis cache connection closed');
      }
      this.memoryCache.clear();
      logger.info('Cache service shutdown complete');
    } catch (error) {
      logger.error('Error during cache service shutdown', error);
    }
  }
}

// Helper function for creating cache keys
export function createCacheKey(...parts: (string | number)[]): string {
  return parts.filter(p => p !== null && p !== undefined).join(':');
}

// Export singleton instance
export const cacheService = new UnifiedCacheService();
export { UnifiedCacheService };
export type { CacheOptions, CacheStats };