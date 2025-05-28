import { Router } from 'express';
import { cacheMiddleware, clearCacheMiddleware } from '../middleware/cache-middleware';
import { asyncHandler } from '../utils/error-handler';
import db from '../db';
import logger from '../utils/logger';
import { cacheService } from '../services/unified-cache-service';

const router = Router();

// Get cache stats - useful for monitoring
router.get('/cache/stats', asyncHandler(async (req, res) => {
  const stats = await cacheService.getStats();
  res.json({
    success: true,
    stats
  });
}));

// Clear cache - useful for testing and admin operations
router.post('/cache/clear', asyncHandler(async (req, res) => {
  const { prefix } = req.body;
  await cacheService.clear(prefix);
  res.json({
    success: true,
    message: `Cache cleared${prefix ? ` for prefix: ${prefix}` : ''}`
  });
}));

// Example of a cached API endpoint (dealership list)
// Cache for 5 minutes (300 seconds)
router.get('/cache-demo', cacheMiddleware({ ttl: 300 }), asyncHandler(async (req, res) => {
  logger.info('Fetching performance-optimized cache demo data');

  // Simulate database delay (in production, this would be a real query)
  const startTime = Date.now();
  await new Promise<void>((resolve: () => void) => setTimeout(resolve, 300)); // 300ms delay to simulate DB query

  // Create mock dealerships for demonstration
  const dealerships = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    name: `Dealership ${i + 1}`,
    subdomain: `dealer${i + 1}`,
    contact_email: `contact@dealer${i + 1}.com`,
    contact_phone: `555-${100 + i}`,
    address: `${1000 + i} Main Street`,
    city: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
    state: ['NY', 'CA', 'IL', 'TX', 'AZ'][i % 5],
    created_at: new Date(Date.now() - i * 86400000).toISOString()
  }));

  const duration = Date.now() - startTime;
  logger.info(`Generated ${dealerships.length} demo items in ${duration}ms`);

  res.json({
    success: true,
    data: dealerships,
    meta: {
      count: dealerships.length,
      databaseTime: `${duration}ms`,
      cacheInfo: {
        status: 'active',
        type: 'in-memory',
        ttl: '300 seconds'
      }
    }
  });
}));

// Example of a cached API endpoint with parameters
router.get('/cache-demo/:id', cacheMiddleware({ ttl: 180 }), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, limit = 20 } = req.query;

  logger.info('Fetching cached demo data with parameters', { id, category });

  // Simulate database delay
  const startTime = Date.now();
  await new Promise<void>((resolve: () => void) => setTimeout(resolve, 500)); // 500ms delay to simulate complex DB query

  // Create demo items for demonstration
  const items = Array.from({ length: Math.min(Number(limit), 20) }, (_, i) => ({
    id: i + 1,
    parent_id: Number(id),
    name: `Item ${i + 1}`,
    category: category || ['electronics', 'furniture', 'clothing'][i % 3],
    price: Math.floor(Math.random() * 1000) + 50,
    created_at: new Date(Date.now() - i * 86400000).toISOString(),
    rating: (Math.random() * 5).toFixed(1)
  }));

  const duration = Date.now() - startTime;
  logger.info(`Generated ${items.length} demo items in ${duration}ms`);

  res.json({
    success: true,
    data: items,
    meta: {
      count: items.length,
      processingTime: `${duration}ms`,
      id,
      category: category || 'all',
      cacheInfo: {
        status: 'active',
        type: 'in-memory',
        ttl: '180 seconds'
      }
    }
  });
}));

// Example of clearing cache when data changes
router.post('/cache-demo/clear/:pattern',
  clearCacheMiddleware('demo'),  // Clear all demo caches
  asyncHandler(async (req, res) => {
    const { pattern } = req.params;

    logger.info('Clearing cache with pattern', { pattern });

    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success
    res.status(200).json({
      success: true,
      message: `Cache with pattern '${pattern}' cleared successfully`,
      timestamp: new Date().toISOString(),
      cacheStatus: {
        cleared: true,
        pattern: pattern || 'demo',
        type: 'in-memory',
        notes: 'Cache invalidation applied, subsequent requests will fetch fresh data'
      }
    });
  })
);

// Health check endpoint to verify cache service is working
router.get('/cache/health', asyncHandler(async (req, res) => {
  const isHealthy = await cacheService.healthCheck();

  res.json({
    success: true,
    cache: {
      service: isHealthy ? 'redis' : 'memory',
      status: 'available'
    }
  });
}));

export default router;