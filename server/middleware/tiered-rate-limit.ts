
import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { db } from "../db";
import { dealerships } from '../../shared/index';
import { eq } from 'drizzle-orm';

// Rate limit tiers based on dealership size/plan
const RATE_LIMIT_TIERS = {
  small: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
  },
  medium: {
    windowMs: 15 * 60 * 1000,
    max: 300,
  },
  enterprise: {
    windowMs: 15 * 60 * 1000,
    max: 1000,
  }
};

// Helper to get dealership tier from request
async function getDealershipTier(req: Request): Promise<'small' | 'medium' | 'enterprise'> {
  try {
    const dealershipId = parseInt(req.headers['x-dealership-id'] as string);
    if (!dealershipId) return 'small';

    const [dealership] = await db
      .select()
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId))
      .limit(1);

    // You can extend this logic based on your dealership attributes
    if (!dealership) return 'small';
    
    // Example logic - can be modified based on your business rules
    if (dealership.name.includes('Enterprise')) return 'enterprise';
    if (dealership.name.includes('Premium')) return 'medium';
    return 'small';
  } catch (error) {
    return 'small'; // Default to most restrictive tier
  }
}

// Dynamic rate limiter that adapts based on dealership tier
export const dynamicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: async (req) => {
    const tier = await getDealershipTier(req);
    return RATE_LIMIT_TIERS[tier].max;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Rate limit exceeded. Please try again later.',
  keyGenerator: (req) => {
    // Use combination of IP and dealership ID for more granular control
    return `${req.ip}-${req.headers['x-dealership-id'] || 'default'}`;
  }
});

// Special limiter for high-value operations
export const premiumFeatureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: async (req) => {
    const tier = await getDealershipTier(req);
    return tier === 'enterprise' ? 100 : tier === 'medium' ? 50 : 20;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Premium feature rate limit exceeded.'
});
