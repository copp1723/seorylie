// Simple in-memory cache implementation with proper TypeScript types
interface CacheItem<T> {
  value: T;
  expiry: number | null;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: string;
}

class MemoryCache {
  private cache: Map<string, CacheItem<any>>;
  private hits: number;
  private misses: number;

  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      this.misses++;
      return null;
    }

    if (item.expiry && item.expiry < Date.now()) {
      this.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return item.value as T;
  }

  set<T>(key: string, value: T, ttl: number = 3600000): void {
    const expiry = ttl > 0 ? Date.now() + ttl : null;

    this.cache.set(key, {
      value,
      expiry,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total) * 100 : 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate.toFixed(2)}%`,
    };
  }
}

// Create a singleton instance
const memoryCache = new MemoryCache();

// Export functions for compatibility with tests
export const getFromCache = <T>(key: string, namespace?: string): T | null => {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  return memoryCache.get<T>(fullKey);
};

export const setInCache = <T>(
  key: string,
  value: T,
  ttl?: number,
  namespace?: string,
): void => {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  memoryCache.set(fullKey, value, ttl || 3600000);
};

export const removeFromCache = (key: string, namespace?: string): boolean => {
  const fullKey = namespace ? `${namespace}:${key}` : key;
  return memoryCache.delete(fullKey);
};

export const clearAllCache = (): void => {
  memoryCache.clear();
};

export const clearNamespaceCache = (namespace: string): number => {
  let count = 0;
  const prefix = `${namespace}:`;

  for (const key of Array.from(memoryCache["cache"].keys())) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      count++;
    }
  }

  return count;
};

export const getCacheStats = (): CacheStats => {
  return memoryCache.getStats();
};

export const shutdownCache = async (): Promise<void> => {
  memoryCache.clear();
  console.log("Cache cleared successfully");
  return Promise.resolve();
};

export default memoryCache;
