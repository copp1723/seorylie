import Redis from 'ioredis';
import logger from '../utils/logger';
import { monitoring } from '../services/monitoring';
import EventEmitter from 'events';

/**
 * Unified cache service that supports both Redis and in-memory fallback
 * Enhanced with H6 KPI Query Caching capabilities
 */

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Optional key prefix
  tags?: string[]; // Optional tags for dependency invalidation
  background?: boolean; // Whether to refresh in background
  priority?: 'high' | 'normal' | 'low'; // Cache priority
  kpi?: boolean; // Whether this is a KPI query (uses special TTL)
  forceRefresh?: boolean; // Force refresh even if cached
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
  type: 'redis' | 'memory';
  connected: boolean;
  info?: any;
  kpiQueries?: {
    total: number;
    cached: number;
    avgResponseTime: number;
    sub50ms: number;
    sub50msPercentage: string;
  };
  backgroundRefreshes?: number;
  etlInvalidations?: number;
}

interface CacheConfig {
  ttl: number;
  kpiTtl: number; // Special TTL for KPI queries
  type: 'redis' | 'memory';
  prefix?: string;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  backgroundRefresh: boolean;
  warmingInterval: number; // Interval for cache warming in ms
}

interface CacheItem<T> {
  value: T;
  expires: number;
  tags?: string[];
  lastRefreshed?: number;
  computeTime?: number; // Time taken to compute the value
  kpi?: boolean;
}

// Event types for cache events
export enum CacheEventType {
  SET = 'set',
  DELETE = 'delete',
  CLEAR = 'clear',
  INVALIDATE_TAG = 'invalidate_tag',
  INVALIDATE_PATTERN = 'invalidate_pattern',
  ETL_EVENT = 'etl_event',
  BACKGROUND_REFRESH = 'background_refresh',
  WARMING = 'warming'
}

// Cache events for monitoring and coordination
interface CacheEvent {
  type: CacheEventType;
  key?: string;
  pattern?: string;
  tag?: string;
  etlSource?: string;
  etlEvent?: string;
}

// Pending computation tracker to prevent duplicate work
interface PendingComputation<T> {
  promise: Promise<T>;
  timestamp: number;
}

class UnifiedCacheService extends EventEmitter {
  private redis: Redis | null = null;
  private redisSub: Redis | null = null; // Separate connection for pub/sub
  private memoryCache = new Map<string, CacheItem<any>>();
  private pendingComputations = new Map<string, PendingComputation<any>>();
  private warmedKeys = new Set<string>();
  private warmingTimer: NodeJS.Timeout | null = null;
  
  private stats = {
    hits: 0,
    misses: 0,
    operations: 0,
    kpiQueries: {
      total: 0,
      cached: 0,
      responseTimes: [] as number[],
      sub50ms: 0
    },
    backgroundRefreshes: 0,
    etlInvalidations: 0
  };

  private config: CacheConfig = {
    ttl: 3600, // 1 hour default
    kpiTtl: 30, // 30 seconds for KPI queries
    type: 'memory',
    prefix: 'rylie:',
    backgroundRefresh: true,
    warmingInterval: 60000 // 1 minute
  };

  constructor() {
    super();
    this.initializeCache();
    this.setupEventListeners();
  }

  private async initializeCache(): Promise<void> {
    try {
      // Try to initialize Redis if configuration is available
      if (process.env.REDIS_HOST && !process.env.SKIP_REDIS) {
        const redisConfig = {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          lazyConnect: true
        };

        this.redis = new Redis(redisConfig);
        
        // Separate connection for pub/sub to avoid blocking
        this.redisSub = new Redis(redisConfig);

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

        // Setup Redis pub/sub for cache invalidation events
        this.setupRedisPubSub();
        
        // Start cache warming scheduler if enabled
        this.startCacheWarming();

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
   * Setup Redis pub/sub for cache invalidation events
   */
  private setupRedisPubSub(): void {
    if (!this.redisSub) return;

    const channel = `${this.config.prefix}cache_events`;
    
    this.redisSub.subscribe(channel, (err) => {
      if (err) {
        logger.error('Failed to subscribe to Redis cache events', err);
        return;
      }
      logger.info(`Subscribed to Redis cache events on channel: ${channel}`);
    });

    this.redisSub.on('message', (channel, message) => {
      try {
        const event: CacheEvent = JSON.parse(message);
        logger.debug('Received cache event from Redis', { channel, event });
        
        switch (event.type) {
          case CacheEventType.DELETE:
            if (event.key) this.memoryCache.delete(event.key);
            break;
          case CacheEventType.CLEAR:
            this.memoryCache.clear();
            break;
          case CacheEventType.INVALIDATE_PATTERN:
            if (event.pattern) this.invalidateMemoryPattern(event.pattern);
            break;
          case CacheEventType.INVALIDATE_TAG:
            if (event.tag) this.invalidateMemoryTag(event.tag);
            break;
          case CacheEventType.ETL_EVENT:
            if (event.etlSource && event.etlEvent) {
              this.handleEtlEvent(event.etlSource, event.etlEvent);
            }
            break;
        }
        
        // Forward the event to local listeners
        this.emit(event.type, event);
        
      } catch (error) {
        logger.error('Error processing Redis cache event', error);
      }
    });
  }

  /**
   * Publish cache event to Redis
   */
  private async publishCacheEvent(event: CacheEvent): Promise<void> {
    if (this.config.type === 'redis' && this.redis) {
      try {
        const channel = `${this.config.prefix}cache_events`;
        await this.redis.publish(channel, JSON.stringify(event));
      } catch (error) {
        logger.warn('Failed to publish cache event to Redis', error);
      }
    }
    // Always emit locally
    this.emit(event.type, event);
  }

  /**
   * Setup event listeners for cache events
   */
  private setupEventListeners(): void {
    // Listen for ETL events to invalidate cache
    this.on(CacheEventType.ETL_EVENT, (event: CacheEvent) => {
      if (event.etlSource && event.etlEvent) {
        this.stats.etlInvalidations++;
        
        // Track ETL invalidations in monitoring
        monitoring.incrementCounter('cache_etl_invalidations_total', {
          source: event.etlSource,
          event: event.etlEvent
        });
      }
    });

    // Listen for background refresh events
    this.on(CacheEventType.BACKGROUND_REFRESH, () => {
      this.stats.backgroundRefreshes++;
      
      // Track background refreshes in monitoring
      monitoring.incrementCounter('cache_background_refreshes_total');
    });
  }

  /**
   * Handle ETL events from final_watchdog or other sources
   */
  public async handleEtlEvent(source: string, event: string): Promise<void> {
    logger.info('Handling ETL event for cache invalidation', { source, event });
    
    // Increment ETL invalidation counter
    this.stats.etlInvalidations++;
    
    // Track in monitoring
    monitoring.incrementCounter('cache_etl_invalidations_total', {
      source,
      event
    });
    
    // Invalidate specific cache patterns based on ETL event
    switch (source) {
      case 'final_watchdog':
        switch (event) {
          case 'kpi_data_updated':
            // Invalidate all KPI-related caches
            await this.invalidatePattern('kpi');
            break;
          case 'inventory_updated':
            // Invalidate inventory-related caches
            await this.invalidatePattern('inventory');
            break;
          case 'leads_updated':
            // Invalidate lead-related caches
            await this.invalidatePattern('lead');
            break;
          case 'analytics_updated':
            // Invalidate analytics-related caches
            await this.invalidatePattern('analytics');
            break;
          default:
            // For unknown events, publish a general cache event
            await this.publishCacheEvent({
              type: CacheEventType.ETL_EVENT,
              etlSource: source,
              etlEvent: event
            });
        }
        break;
      
      default:
        // For unknown sources, just publish the event
        await this.publishCacheEvent({
          type: CacheEventType.ETL_EVENT,
          etlSource: source,
          etlEvent: event
        });
    }
  }

  /**
   * Start cache warming scheduler
   */
  private startCacheWarming(): void {
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }
    
    this.warmingTimer = setInterval(() => {
      this.warmCaches().catch(err => {
        logger.error('Error during cache warming', err);
      });
    }, this.config.warmingInterval);
    
    logger.info('Cache warming scheduler started', { 
      interval: this.config.warmingInterval 
    });
  }

  /**
   * Warm caches for frequently accessed keys
   */
  private async warmCaches(): Promise<void> {
    if (this.warmedKeys.size === 0) {
      return; // No keys to warm
    }
    
    logger.debug('Starting cache warming cycle', { 
      keysCount: this.warmedKeys.size 
    });
    
    const start = Date.now();
    let warmed = 0;
    
    for (const key of this.warmedKeys) {
      try {
        const exists = await this.exists(key);
        if (!exists) {
          // Key doesn't exist or expired, remove from warming set
          this.warmedKeys.delete(key);
          continue;
        }
        
        // Check if key is about to expire (within 10% of TTL)
        const item = this.memoryCache.get(key);
        if (item) {
          const now = Date.now();
          const timeLeft = item.expires - now;
          const ttl = (item.kpi ? this.config.kpiTtl : this.config.ttl) * 1000;
          
          if (timeLeft < ttl * 0.1) {
            // Key is about to expire, refresh it
            await this.refreshKey(key);
            warmed++;
          }
        }
      } catch (error) {
        logger.warn(`Failed to warm cache key: ${key}`, error);
      }
    }
    
    const duration = Date.now() - start;
    
    logger.debug('Cache warming cycle completed', { 
      warmed, 
      duration,
      totalKeys: this.warmedKeys.size 
    });
    
    // Emit warming event
    this.emit(CacheEventType.WARMING, { 
      type: CacheEventType.WARMING,
      warmed,
      duration
    });
    
    // Track in monitoring
    monitoring.incrementCounter('cache_warming_cycles_total');
    monitoring.recordHistogram('cache_warming_duration_ms', duration);
    monitoring.incrementCounter('cache_keys_warmed_total', {}, warmed);
  }

  /**
   * Refresh a specific cache key
   */
  private async refreshKey(key: string): Promise<boolean> {
    const item = this.memoryCache.get(key);
    if (!item || !item.lastRefreshed) {
      return false;
    }
    
    // If this is a computation result with a factory function, we need the original factory
    // For now, we'll just emit an event that the key needs refreshing
    this.emit(CacheEventType.BACKGROUND_REFRESH, {
      type: CacheEventType.BACKGROUND_REFRESH,
      key
    });
    
    return true;
  }

  /**
   * Register a key for cache warming
   */
  public registerForWarming(key: string): void {
    this.warmedKeys.add(key);
    logger.debug(`Registered key for cache warming: ${key}`);
  }

  /**
   * Unregister a key from cache warming
   */
  public unregisterFromWarming(key: string): void {
    this.warmedKeys.delete(key);
    logger.debug(`Unregistered key from cache warming: ${key}`);
  }

  /**
   * Get or set cache value with factory function
   * This is the core method for KPI query caching
   */
  async getOrSet<T = any>(
    key: string, 
    factory: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const fullKey = this.getFullKey(key, options.prefix);
    const isKpiQuery = options.kpi === true;
    const forceRefresh = options.forceRefresh === true;
    
    // Track KPI queries
    if (isKpiQuery) {
      this.stats.kpiQueries.total++;
      
      // Track in monitoring
      monitoring.incrementCounter('kpi_queries_total');
    }
    
    // Start timing for performance tracking
    const startTime = Date.now();
    
    try {
      // Check if we should force refresh
      if (!forceRefresh) {
        // First check if we already have a pending computation for this key
        const pending = this.pendingComputations.get(fullKey);
        if (pending && (Date.now() - pending.timestamp) < 30000) { // 30s max wait time
          // Return the pending promise to avoid duplicate work
          return pending.promise;
        }
        
        // Try to get from cache
        const cachedValue = await this.get<T>(fullKey);
        if (cachedValue !== null) {
          // For KPI queries, track performance metrics
          if (isKpiQuery) {
            const responseTime = Date.now() - startTime;
            this.stats.kpiQueries.cached++;
            this.stats.kpiQueries.responseTimes.push(responseTime);
            
            if (responseTime < 50) {
              this.stats.kpiQueries.sub50ms++;
            }
            
            // Track in monitoring
            monitoring.incrementCounter('kpi_queries_cached_total');
            monitoring.recordHistogram('kpi_query_response_time_ms', responseTime);
          }
          
          // If background refresh is enabled and this is a KPI query, check if we should refresh
          if (this.config.backgroundRefresh && isKpiQuery) {
            const item = this.memoryCache.get(fullKey);
            if (item) {
              const now = Date.now();
              const timeLeft = item.expires - now;
              const ttl = (isKpiQuery ? this.config.kpiTtl : this.config.ttl) * 1000;
              
              // If less than 50% of TTL remains, refresh in background
              if (timeLeft < ttl * 0.5) {
                // Don't await, let it happen in background
                this.backgroundRefresh(fullKey, factory, options).catch(err => {
                  logger.warn('Background refresh failed', err);
                });
              }
            }
          }
          
          return cachedValue;
        }
      }
      
      // Create a promise for this computation and store it
      const computationPromise = this.computeAndStore<T>(fullKey, factory, options);
      this.pendingComputations.set(fullKey, {
        promise: computationPromise,
        timestamp: Date.now()
      });
      
      // Execute the computation
      try {
        const result = await computationPromise;
        return result;
      } finally {
        // Clean up the pending computation
        this.pendingComputations.delete(fullKey);
      }
      
    } catch (error) {
      logger.error('Error in getOrSet', error, { key });
      
      // Remove from pending computations on error
      this.pendingComputations.delete(fullKey);
      
      // If we have a factory function, we need to execute it
      const result = await factory();
      return result;
    }
  }

  /**
   * Compute value and store in cache
   */
  private async computeAndStore<T>(
    fullKey: string, 
    factory: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const startCompute = Date.now();
    const isKpiQuery = options.kpi === true;
    
    try {
      // Execute the factory function to get the value
      const value = await factory();
      
      // Calculate compute time
      const computeTime = Date.now() - startCompute;
      
      // For KPI queries, track performance metrics
      if (isKpiQuery) {
        const responseTime = Date.now() - startCompute;
        this.stats.kpiQueries.responseTimes.push(responseTime);
        
        if (responseTime < 50) {
          this.stats.kpiQueries.sub50ms++;
        }
        
        // Track in monitoring
        monitoring.recordHistogram('kpi_query_compute_time_ms', computeTime);
      }
      
      // Store in cache
      const ttl = isKpiQuery ? this.config.kpiTtl : (options.ttl || this.config.ttl);
      await this.set(fullKey, value, { 
        ...options, 
        ttl,
        // Pass additional metadata
        computeTime,
        kpi: isKpiQuery
      });
      
      // Register for warming if it's a KPI query
      if (isKpiQuery) {
        this.registerForWarming(fullKey);
      }
      
      return value;
    } catch (error) {
      logger.error('Error computing value for cache', error, { key: fullKey });
      throw error;
    }
  }

  /**
   * Refresh a cache entry in the background
   */
  private async backgroundRefresh<T>(
    fullKey: string, 
    factory: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      logger.debug(`Starting background refresh for key: ${fullKey}`);
      
      // Track background refresh
      this.stats.backgroundRefreshes++;
      
      // Emit background refresh event
      this.emit(CacheEventType.BACKGROUND_REFRESH, {
        type: CacheEventType.BACKGROUND_REFRESH,
        key: fullKey
      });
      
      // Execute the factory function
      const startTime = Date.now();
      const value = await factory();
      const computeTime = Date.now() - startTime;
      
      // Store with the same options but update the compute time
      const ttl = options.kpi ? this.config.kpiTtl : (options.ttl || this.config.ttl);
      await this.set(fullKey, value, { 
        ...options, 
        ttl,
        computeTime,
      });
      
      logger.debug(`Background refresh completed for key: ${fullKey}`, {
        computeTime
      });
      
      // Track in monitoring
      monitoring.incrementCounter('cache_background_refreshes_total');
      monitoring.recordHistogram('cache_background_refresh_time_ms', computeTime);
      
    } catch (error) {
      logger.error('Background refresh failed', error, { key: fullKey });
      
      // Track in monitoring
      monitoring.incrementCounter('cache_background_refresh_failures_total');
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
            
            // Track in monitoring
            monitoring.incrementCounter('cache_hits_total');
            
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
        
        // Track in monitoring
        monitoring.incrementCounter('cache_hits_total');
        
        return cached.value as T;
      } else if (cached) {
        this.memoryCache.delete(fullKey); // Clean up expired entry
      }

      this.stats.misses++;
      
      // Track in monitoring
      monitoring.incrementCounter('cache_misses_total');
      
      return null;

    } catch (error) {
      logger.error('Cache get error', error, { key });
      this.stats.misses++;
      
      // Track in monitoring
      monitoring.incrementCounter('cache_errors_total', {
        operation: 'get'
      });
      
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key, options.prefix);
      const ttl = options.ttl || this.config.ttl;
      const expires = Date.now() + (ttl * 1000);
      const isKpiQuery = options.kpi === true;
      const tags = options.tags || [];
      const computeTime = options.computeTime;

      // Create cache item with metadata
      const cacheItem: CacheItem<any> = { 
        value, 
        expires,
        tags,
        lastRefreshed: Date.now(),
        computeTime,
        kpi: isKpiQuery
      };
      
      // Always store in memory cache as backup
      this.memoryCache.set(fullKey, cacheItem);

      // Try Redis if available
      if (this.config.type === 'redis' && this.redis) {
        try {
          // Store the value
          await this.redis.setex(fullKey, ttl, JSON.stringify(value));
          
          // If tags are provided, store tag associations
          if (tags.length > 0) {
            for (const tag of tags) {
              const tagKey = `${this.config.prefix}tag:${tag}`;
              await this.redis.sadd(tagKey, fullKey);
              // Set expiry on tag key to avoid memory leaks
              await this.redis.expire(tagKey, ttl * 2); // 2x TTL for tags
            }
          }
          
          // If it's a KPI query, add to KPI set
          if (isKpiQuery) {
            const kpiSetKey = `${this.config.prefix}kpi_keys`;
            await this.redis.sadd(kpiSetKey, fullKey);
          }
          
          this.cleanupMemoryCache(); // Periodic cleanup
          
          // Publish cache event
          await this.publishCacheEvent({
            type: CacheEventType.SET,
            key: fullKey
          });
          
          return true;
        } catch (error) {
          logger.warn('Redis set failed, value stored in memory only', error);
        }
      }

      this.cleanupMemoryCache();
      
      // Track in monitoring
      monitoring.incrementCounter('cache_sets_total', {
        type: isKpiQuery ? 'kpi' : 'standard'
      });
      
      return true;

    } catch (error) {
      logger.error('Cache set error', error, { key });
      
      // Track in monitoring
      monitoring.incrementCounter('cache_errors_total', {
        operation: 'set'
      });
      
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
          // Get tags associated with this key before deleting
          const item = this.memoryCache.get(fullKey);
          const tags = item?.tags || [];
          
          // Delete the key
          await this.redis.del(fullKey);
          
          // Remove from tag sets
          for (const tag of tags) {
            const tagKey = `${this.config.prefix}tag:${tag}`;
            await this.redis.srem(tagKey, fullKey);
          }
          
          // Remove from KPI set if applicable
          if (item?.kpi) {
            const kpiSetKey = `${this.config.prefix}kpi_keys`;
            await this.redis.srem(kpiSetKey, fullKey);
          }
          
          // Remove from warming set
          this.warmedKeys.delete(fullKey);
          
          // Publish cache event
          await this.publishCacheEvent({
            type: CacheEventType.DELETE,
            key: fullKey
          });
          
        } catch (error) {
          logger.warn('Redis delete failed', error);
        }
      }
      
      // Track in monitoring
      monitoring.incrementCounter('cache_deletes_total');

      return true;

    } catch (error) {
      logger.error('Cache delete error', error, { key });
      
      // Track in monitoring
      monitoring.incrementCounter('cache_errors_total', {
        operation: 'delete'
      });
      
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
            this.warmedKeys.delete(key);
          }
        }

        // Clear matching entries from Redis
        if (this.config.type === 'redis' && this.redis) {
          try {
            const keys = await this.redis.keys(`${fullPrefix}*`);
            if (keys.length > 0) {
              await this.redis.del(...keys);
              
              // Remove from KPI set if applicable
              const kpiSetKey = `${this.config.prefix}kpi_keys`;
              for (const key of keys) {
                await this.redis.srem(kpiSetKey, key);
              }
            }
            
            // Publish cache event
            await this.publishCacheEvent({
              type: CacheEventType.CLEAR,
              pattern: fullPrefix
            });
            
          } catch (error) {
            logger.warn('Redis clear failed', error);
          }
        }
      } else {
        // Clear all
        this.memoryCache.clear();
        this.warmedKeys.clear();

        if (this.config.type === 'redis' && this.redis) {
          try {
            await this.redis.flushdb();
            
            // Publish cache event
            await this.publishCacheEvent({
              type: CacheEventType.CLEAR
            });
            
          } catch (error) {
            logger.warn('Redis flush failed', error);
          }
        }
      }
      
      // Track in monitoring
      monitoring.incrementCounter('cache_clears_total', {
        prefix: prefix || 'all'
      });

      return true;

    } catch (error) {
      logger.error('Cache clear error', error);
      
      // Track in monitoring
      monitoring.incrementCounter('cache_errors_total', {
        operation: 'clear'
      });
      
      return false;
    }
  }

  /**
   * Invalidate cache entries by tag
   */
  async invalidateTag(tag: string): Promise<boolean> {
    try {
      logger.info(`Invalidating cache entries with tag: ${tag}`);
      
      // Invalidate in Redis
      if (this.config.type === 'redis' && this.redis) {
        try {
          const tagKey = `${this.config.prefix}tag:${tag}`;
          
          // Get all keys with this tag
          const keys = await this.redis.smembers(tagKey);
          
          if (keys.length > 0) {
            // Delete all the keys
            await this.redis.del(...keys);
            
            // Remove from KPI set if applicable
            const kpiSetKey = `${this.config.prefix}kpi_keys`;
            for (const key of keys) {
              await this.redis.srem(kpiSetKey, key);
              
              // Remove from memory cache and warming set
              this.memoryCache.delete(key);
              this.warmedKeys.delete(key);
            }
            
            // Delete the tag set itself
            await this.redis.del(tagKey);
          }
          
          // Publish cache event
          await this.publishCacheEvent({
            type: CacheEventType.INVALIDATE_TAG,
            tag
          });
          
        } catch (error) {
          logger.warn('Redis tag invalidation failed', error);
        }
      }
      
      // Invalidate in memory cache
      this.invalidateMemoryTag(tag);
      
      // Track in monitoring
      monitoring.incrementCounter('cache_tag_invalidations_total', {
        tag
      });
      
      return true;
    } catch (error) {
      logger.error('Tag invalidation failed', error, { tag });
      
      // Track in monitoring
      monitoring.incrementCounter('cache_errors_total', {
        operation: 'invalidate_tag'
      });
      
      return false;
    }
  }

  /**
   * Invalidate memory cache entries by tag
   */
  private invalidateMemoryTag(tag: string): void {
    let count = 0;
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.tags && item.tags.includes(tag)) {
        this.memoryCache.delete(key);
        this.warmedKeys.delete(key);
        count++;
      }
    }
    
    logger.debug(`Invalidated ${count} memory cache entries with tag: ${tag}`);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: string, options: { prefix?: string } = {}): Promise<boolean> {
    try {
      const fullPattern = this.getFullKey(pattern, options.prefix);
      logger.info(`Invalidating cache entries matching pattern: ${fullPattern}`);
      
      // Invalidate in Redis
      if (this.config.type === 'redis' && this.redis) {
        try {
          const keys = await this.redis.keys(`*${fullPattern}*`);
          
          if (keys.length > 0) {
            // Delete all the keys
            await this.redis.del(...keys);
            
            // Remove from KPI set if applicable
            const kpiSetKey = `${this.config.prefix}kpi_keys`;
            for (const key of keys) {
              await this.redis.srem(kpiSetKey, key);
            }
          }
          
          // Publish cache event
          await this.publishCacheEvent({
            type: CacheEventType.INVALIDATE_PATTERN,
            pattern: fullPattern
          });
          
        } catch (error) {
          logger.warn('Redis pattern invalidation failed', error);
        }
      }
      
      // Invalidate in memory cache
      this.invalidateMemoryPattern(fullPattern);
      
      // Track in monitoring
      monitoring.incrementCounter('cache_pattern_invalidations_total', {
        pattern: fullPattern
      });
      
      return true;
    } catch (error) {
      logger.error('Pattern invalidation failed', error, { pattern });
      
      // Track in monitoring
      monitoring.incrementCounter('cache_errors_total', {
        operation: 'invalidate_pattern'
      });
      
      return false;
    }
  }

  /**
   * Invalidate memory cache entries matching a pattern
   */
  private invalidateMemoryPattern(pattern: string): void {
    let count = 0;
    
    for (const key of this.memoryCache.keys()) {
      if (key.includes(pattern)) {
        this.memoryCache.delete(key);
        this.warmedKeys.delete(key);
        count++;
      }
    }
    
    logger.debug(`Invalidated ${count} memory cache entries matching pattern: ${pattern}`);
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
    
    // Calculate KPI query statistics
    const kpiTotal = this.stats.kpiQueries.total;
    const kpiResponseTimes = this.stats.kpiQueries.responseTimes;
    const avgResponseTime = kpiResponseTimes.length > 0
      ? kpiResponseTimes.reduce((sum, time) => sum + time, 0) / kpiResponseTimes.length
      : 0;
    const sub50msPercentage = kpiTotal > 0
      ? ((this.stats.kpiQueries.sub50ms / kpiTotal) * 100).toFixed(2)
      : '0.00';

    return {
      size: this.memoryCache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: `${hitRate}%`,
      type: this.config.type,
      connected: this.config.type === 'redis' ? !!this.redis : true,
      kpiQueries: {
        total: kpiTotal,
        cached: this.stats.kpiQueries.cached,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        sub50ms: this.stats.kpiQueries.sub50ms,
        sub50msPercentage: `${sub50msPercentage}%`
      },
      backgroundRefreshes: this.stats.backgroundRefreshes,
      etlInvalidations: this.stats.etlInvalidations
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
        const kpiKeysCount = await this.redis.scard(`${this.config.prefix}kpi_keys`);
        
        return {
          ...stats,
          redis: {
            info: redisInfo,
            connected: true,
            kpiKeysCount
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
        this.warmedKeys.delete(key);
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
        this.warmedKeys.delete(entries[i][0]);
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
      // Stop cache warming
      if (this.warmingTimer) {
        clearInterval(this.warmingTimer);
        this.warmingTimer = null;
      }
      
      if (this.redis) {
        await this.redis.quit();
        logger.info('Redis cache connection closed');
      }
      
      if (this.redisSub) {
        await this.redisSub.quit();
        logger.info('Redis subscription connection closed');
      }
      
      this.memoryCache.clear();
      this.warmedKeys.clear();
      logger.info('Cache service shutdown complete');
    } catch (error) {
      logger.error('Error during cache service shutdown', error);
    }
  }
}

// Helper function for creating cache keys
export function createCacheKey(...parts: (string | number | object)[]): string {
  return parts.filter(p => p !== null && p !== undefined)
    .map(p => typeof p === 'object' ? JSON.stringify(p) : String(p))
    .join(':');
}

// Export singleton instance
export const cacheService = new UnifiedCacheService();
export type { UnifiedCacheService }
export type { CacheOptions, CacheStats }
export { CacheEventType }
