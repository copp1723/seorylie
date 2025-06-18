/**
 * Performance Optimization Guide for RylieSEO Platform
 * 
 * This module provides caching strategies and performance optimizations
 * for branding data and chat responses.
 */

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

// ============================================
// 1. BRANDING CACHE IMPLEMENTATION
// ============================================

/**
 * Advanced branding cache with multiple storage layers
 */
export class MultiLayerBrandingCache {
  // In-memory cache (fastest)
  private memoryCache: LRUCache<string, any>;
  
  // SessionStorage cache (persists during session)
  private sessionCache: Storage | null;
  
  // IndexedDB for larger data (persists across sessions)
  private dbName = 'RylieSEO_Cache';
  private storeName = 'branding';

  constructor() {
    // Configure LRU cache with size limits
    this.memoryCache = new LRUCache({
      max: 50, // Maximum 50 items
      ttl: 1000 * 60 * 60, // 1 hour TTL
      updateAgeOnGet: true,
      sizeCalculation: (value) => JSON.stringify(value).length,
      maxSize: 5 * 1024 * 1024, // 5MB max size
    });

    // Initialize session storage
    this.sessionCache = typeof window !== 'undefined' ? window.sessionStorage : null;

    // Initialize IndexedDB
    this.initIndexedDB();
  }

  private async initIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    const request = indexedDB.open(this.dbName, 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(this.storeName)) {
        const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
        store.createIndex('expires', 'expires', { unique: false });
      }
    };
  }

  /**
   * Get branding data with fallback through cache layers
   */
  async get(key: string): Promise<any | null> {
    // 1. Check memory cache
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) {
      console.debug(`[Cache] Memory hit for ${key}`);
      return memoryResult;
    }

    // 2. Check session storage
    if (this.sessionCache) {
      const sessionData = this.sessionCache.getItem(`branding_${key}`);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          if (parsed.expires > Date.now()) {
            console.debug(`[Cache] Session hit for ${key}`);
            // Promote to memory cache
            this.memoryCache.set(key, parsed.data);
            return parsed.data;
          }
          // Expired, remove it
          this.sessionCache.removeItem(`branding_${key}`);
        } catch (e) {
          console.error('Failed to parse session cache:', e);
        }
      }
    }

    // 3. Check IndexedDB
    const dbResult = await this.getFromIndexedDB(key);
    if (dbResult) {
      console.debug(`[Cache] IndexedDB hit for ${key}`);
      // Promote to faster caches
      this.memoryCache.set(key, dbResult);
      this.setSessionCache(key, dbResult);
      return dbResult;
    }

    console.debug(`[Cache] Miss for ${key}`);
    return null;
  }

  /**
   * Set branding data in all cache layers
   */
  async set(key: string, value: any, ttlMs: number = 3600000): Promise<void> {
    const expires = Date.now() + ttlMs;

    // 1. Set in memory cache
    this.memoryCache.set(key, value);

    // 2. Set in session storage
    this.setSessionCache(key, value, expires);

    // 3. Set in IndexedDB
    await this.setIndexedDB(key, value, expires);
  }

  private setSessionCache(key: string, value: any, expires?: number) {
    if (this.sessionCache) {
      try {
        this.sessionCache.setItem(`branding_${key}`, JSON.stringify({
          data: value,
          expires: expires || Date.now() + 3600000
        }));
      } catch (e) {
        console.warn('SessionStorage full, clearing old entries');
        this.clearOldSessionEntries();
      }
    }
  }

  private async getFromIndexedDB(key: string): Promise<any | null> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const getRequest = store.get(key);

        getRequest.onsuccess = () => {
          const result = getRequest.result;
          if (result && result.expires > Date.now()) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };

        getRequest.onerror = () => resolve(null);
      };

      request.onerror = () => resolve(null);
    });
  }

  private async setIndexedDB(key: string, value: any, expires: number): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve();
        return;
      }

      const request = indexedDB.open(this.dbName);
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        store.put({ key, data: value, expires });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      };

      request.onerror = () => resolve();
    });
  }

  private clearOldSessionEntries() {
    if (!this.sessionCache) return;

    const keysToRemove: string[] = [];
    const now = Date.now();

    for (let i = 0; i < this.sessionCache.length; i++) {
      const key = this.sessionCache.key(i);
      if (key?.startsWith('branding_')) {
        try {
          const data = JSON.parse(this.sessionCache.getItem(key) || '{}');
          if (data.expires < now) {
            keysToRemove.push(key);
          }
        } catch (e) {
          keysToRemove.push(key);
        }
      }
    }

    keysToRemove.forEach(key => this.sessionCache!.removeItem(key));
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    if (this.sessionCache) {
      const keys = [];
      for (let i = 0; i < this.sessionCache.length; i++) {
        const key = this.sessionCache.key(i);
        if (key?.startsWith('branding_')) {
          keys.push(key);
        }
      }
      keys.forEach(key => this.sessionCache!.removeItem(key));
    }

    // Clear IndexedDB
    if (typeof window !== 'undefined' && window.indexedDB) {
      await indexedDB.deleteDatabase(this.dbName);
    }
  }
}

// ============================================
// 2. CHAT RESPONSE CACHE FOR OPENROUTER
// ============================================

/**
 * Intelligent chat response cache with semantic similarity
 */
export class ChatResponseCache {
  private cache: LRUCache<string, any>;
  private similarityThreshold = 0.85;

  constructor() {
    this.cache = new LRUCache({
      max: 1000, // Store up to 1000 responses
      ttl: 1000 * 60 * 60 * 24, // 24 hour TTL for chat responses
      updateAgeOnGet: true,
    });
  }

  /**
   * Generate cache key from message
   */
  private generateKey(message: string, context?: any): string {
    const normalized = message.toLowerCase().trim();
    const contextStr = context ? JSON.stringify(context) : '';
    return createHash('sha256')
      .update(normalized + contextStr)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Calculate similarity between two messages (simple implementation)
   * In production, use a proper NLP library or embeddings
   */
  private calculateSimilarity(msg1: string, msg2: string): number {
    const words1 = new Set(msg1.toLowerCase().split(/\s+/));
    const words2 = new Set(msg2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Get cached response with fuzzy matching
   */
  async get(message: string, context?: any): Promise<any | null> {
    // First try exact match
    const exactKey = this.generateKey(message, context);
    const exactMatch = this.cache.get(exactKey);
    if (exactMatch) {
      console.debug('[ChatCache] Exact match found');
      return exactMatch;
    }

    // Try fuzzy matching for similar questions
    const allEntries = Array.from(this.cache.entries());
    for (const [key, value] of allEntries) {
      if (value.message && this.calculateSimilarity(message, value.message) >= this.similarityThreshold) {
        console.debug('[ChatCache] Similar match found');
        return value.response;
      }
    }

    return null;
  }

  /**
   * Cache a response
   */
  set(message: string, response: any, context?: any): void {
    const key = this.generateKey(message, context);
    this.cache.set(key, {
      message,
      response,
      context,
      timestamp: Date.now()
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.cache.max,
      hitRate: this.cache.size > 0 ? 
        (this.cache as any).hits / ((this.cache as any).hits + (this.cache as any).misses) : 0
    };
  }
}

// ============================================
// 3. API RESPONSE INTERCEPTOR
// ============================================

/**
 * Axios interceptor for automatic caching
 */
export const setupCacheInterceptor = (axios: any, cache: ChatResponseCache) => {
  // Request interceptor
  axios.interceptors.request.use(async (config: any) => {
    // Only cache GET requests and chat POST requests
    if (config.method === 'get' || 
        (config.method === 'post' && config.url.includes('/chat'))) {
      
      const cacheKey = config.url + JSON.stringify(config.data || config.params);
      const cachedResponse = await cache.get(cacheKey);
      
      if (cachedResponse) {
        // Return cached response
        return Promise.reject({
          isCache: true,
          data: cachedResponse,
          config
        });
      }
    }
    
    return config;
  });

  // Response interceptor
  axios.interceptors.response.use(
    (response: any) => {
      // Cache successful responses
      if (response.config.method === 'get' || 
          (response.config.method === 'post' && response.config.url.includes('/chat'))) {
        
        const cacheKey = response.config.url + JSON.stringify(response.config.data || response.config.params);
        cache.set(cacheKey, response.data);
      }
      
      return response;
    },
    (error: any) => {
      // Handle cached responses
      if (error.isCache) {
        return Promise.resolve({
          data: error.data,
          status: 200,
          statusText: 'OK (Cached)',
          headers: { 'x-cache': 'HIT' },
          config: error.config
        });
      }
      
      return Promise.reject(error);
    }
  );
};

// ============================================
// 4. PERFORMANCE MONITORING
// ============================================

/**
 * Performance monitor for tracking cache effectiveness
 */
export class PerformanceMonitor {
  private metrics: Map<string, any> = new Map();

  track(operation: string, duration: number, cacheHit: boolean = false) {
    const key = `${operation}_${cacheHit ? 'hit' : 'miss'}`;
    const current = this.metrics.get(key) || { count: 0, totalDuration: 0 };
    
    this.metrics.set(key, {
      count: current.count + 1,
      totalDuration: current.totalDuration + duration,
      avgDuration: (current.totalDuration + duration) / (current.count + 1)
    });
  }

  getReport() {
    const report: any = {};
    
    this.metrics.forEach((value, key) => {
      report[key] = {
        ...value,
        avgDuration: Math.round(value.avgDuration * 100) / 100
      };
    });

    return report;
  }

  reset() {
    this.metrics.clear();
  }
}

// ============================================
// 5. USAGE RECOMMENDATIONS
// ============================================

/**
 * IMPLEMENTATION GUIDE:
 * 
 * 1. Initialize caches at app startup:
 *    const brandingCache = new MultiLayerBrandingCache();
 *    const chatCache = new ChatResponseCache();
 *    const perfMonitor = new PerformanceMonitor();
 * 
 * 2. Use in BrandingContext:
 *    const cached = await brandingCache.get(agencyId);
 *    if (!cached) {
 *      const fresh = await fetchFromSupabase();
 *      await brandingCache.set(agencyId, fresh);
 *    }
 * 
 * 3. Use in Chat component:
 *    const cached = await chatCache.get(message);
 *    if (!cached) {
 *      const response = await callOpenRouter();
 *      chatCache.set(message, response);
 *    }
 * 
 * 4. Monitor performance:
 *    const start = performance.now();
 *    const result = await operation();
 *    perfMonitor.track('branding_fetch', performance.now() - start, wasCached);
 * 
 * OPTIMIZATION TIPS:
 * 
 * - Preload agency branding on login
 * - Use React Query with the cache layer
 * - Implement request deduplication
 * - Add cache warming for popular queries
 * - Use CDN for static assets (logos, etc.)
 * - Implement progressive loading for branding
 * - Use service workers for offline support
 * - Add performance budgets and monitoring
 */

export default {
  MultiLayerBrandingCache,
  ChatResponseCache,
  PerformanceMonitor,
  setupCacheInterceptor
};
