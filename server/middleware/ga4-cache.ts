import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

// Simple in-memory cache for GA4 data
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for most data
const REALTIME_CACHE_TTL = 30 * 1000; // 30 seconds for real-time data

export function ga4Cache(options?: { ttl?: number; realtime?: boolean }) {
  const ttl = options?.realtime ? REALTIME_CACHE_TTL : (options?.ttl || CACHE_TTL);

  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = createHash('md5')
      .update(req.originalUrl)
      .update(JSON.stringify(req.query))
      .digest('hex');

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', ttl.toString());
      return res.json(cached.data);
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function(data: any) {
      cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-TTL', ttl.toString());

      return originalJson(data);
    };

    next();
  };
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 2) {
      cache.delete(key);
    }
  }
}, 60 * 1000); // Clean every minute

// Export cache clear function for testing or manual clearing
export function clearGA4Cache() {
  cache.clear();
}