/**
 * Google Ads API Routes
 * 
 * Provides endpoints for Google Ads integration, including OAuth authentication,
 * account management, and campaign creation.
 */

import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adsApiService, AdsApiError, AuthenticationError, SearchCampaignParams } from '../services/ads-api-service';
import { db } from '../db';
import { gadsAccounts, gadsCampaigns } from '../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/authentication';
import { validateRequest } from '../middleware/validation';
import { promClient } from '../observability/metrics';

// Initialize router
const router = express.Router();

// Define metrics for monitoring
const routeMetrics = {
  requestCounter: new promClient.Counter({
    name: 'ads_routes_requests_total',
    help: 'Total number of requests to ads routes',
    labelNames: ['route', 'method', 'status']
  }),
  requestDuration: new promClient.Histogram({
    name: 'ads_routes_request_duration_seconds',
    help: 'Duration of ads route requests in seconds',
    labelNames: ['route', 'method'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  })
};

// Middleware to track metrics
const trackMetrics = (route: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Record request count
    routeMetrics.requestCounter.labels(route, req.method, '').inc();
    
    // Track response status
    const originalSend = res.send;
    res.send = function(body) {
      routeMetrics.requestCounter.labels(route, req.method, res.statusCode.toString()).inc();
      routeMetrics.requestDuration.labels(route, req.method).observe((Date.now() - startTime) / 1000);
      return originalSend.call(this, body);
    };
    
    next();
  };
};

// Error handling middleware
const handleAdsApiError = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AuthenticationError) {
    logger.warn('Google Ads authentication error', { error: err.message, path: req.path });
    return res.status(401).json({ 
      error: 'authentication_error',
      message: err.message,
      details: err.details
    });
  }
  
  if (err instanceof AdsApiError) {
    logger.error('Google Ads API error', { 
      error: err.message, 
      code: err.code, 
      path: req.path 
    });
    
    let statusCode = 500;
    switch (err.code) {
      case 'NOT_FOUND':
        statusCode = 404;
        break;
      case 'RATE_LIMIT_ERROR':
        statusCode = 429;
        break;
      case 'AUTHENTICATION_ERROR':
        statusCode = 401;
        break;
      case 'VALIDATION_ERROR':
        statusCode = 400;
        break;
      default:
        statusCode = 500;
    }
    
    return res.status(statusCode).json({
      error: err.code.toLowerCase(),
      message: err.message,
      details: err.details
    });
  }
  
  next(err);
};

// Validation schemas
const authUrlSchema = z.object({
  userId: z.number().int().positive(),
  dealershipId: z.number().int().positive().optional(),
  sandboxId: z.number().int().positive().optional(),
  state: z.string().optional()
});

const callbackSchema = z.object({
  code: z.string(),
  state: z.string()
});

const sandboxUpdateSchema = z.object({
  sandboxId: z.number().int().positive().nullable()
});

const campaignCreateSchema = z.object({
  accountId: z.string(),
  campaignName: z.string().min(1).max(255),
  budget: z.object({
    amount: z.number().positive(),
    deliveryMethod: z.enum(['STANDARD', 'ACCELERATED']).optional()
  }),
  bidStrategy: z.object({
    type: z.enum(['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE', 'TARGET_CPA', 'TARGET_ROAS', 'MANUAL_CPC']),
    targetCpa: z.number().positive().optional(),
    targetRoas: z.number().positive().optional()
  }).optional(),
  startDate: z.string().regex(/^\d{8}$/).optional(), // YYYYMMDD format
  endDate: z.string().regex(/^\d{8}$/).optional(), // YYYYMMDD format
  networkSettings: z.object({
    targetGoogleSearch: z.boolean().optional(),
    targetSearchNetwork: z.boolean().optional(),
    targetContentNetwork: z.boolean().optional(),
    targetPartnerSearchNetwork: z.boolean().optional()
  }).optional(),
  locations: z.array(z.object({
    id: z.number().int().positive(),
    negative: z.boolean().optional()
  })).optional(),
  languages: z.array(z.number().int().positive()).optional(),
  isDryRun: z.boolean().optional().default(false),
  sandboxId: z.number().int().positive().optional()
});

/**
 * POST /ads/auth/url
 * Generate OAuth URL for Google Ads authentication
 */
router.post(
  '/auth/url',
  authenticate,
  validateRequest(authUrlSchema),
  trackMetrics('/ads/auth/url'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, dealershipId, sandboxId, state } = req.body;
      
      // Generate OAuth URL
      const authUrl = adsApiService.getAuthUrl(userId, dealershipId, sandboxId, state);
      
      res.json({ url: authUrl });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /ads/auth/callback
 * Handle OAuth callback from Google
 */
router.get(
  '/auth/callback',
  validateRequest(callbackSchema, 'query'),
  trackMetrics('/ads/auth/callback'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state } = req.query as { code: string, state: string };
      
      // Handle callback
      const account = await adsApiService.handleCallback(code, state);
      
      // Redirect to a success page with the account ID
      res.redirect(`/ads/auth/success?accountId=${account.id}`);
    } catch (error) {
      // Redirect to error page
      const errorMessage = encodeURIComponent((error instanceof Error) ? error.message : 'Unknown error');
      res.redirect(`/ads/auth/error?message=${errorMessage}`);
    }
  }
);

/**
 * GET /ads/accounts
 * List Google Ads accounts for a user
 */
router.get(
  '/accounts',
  authenticate,
  trackMetrics('/ads/accounts'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = parseInt(req.query.userId as string);
      const dealershipId = req.query.dealershipId ? parseInt(req.query.dealershipId as string) : undefined;
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: 'invalid_user_id', message: 'User ID is required' });
      }
      
      // Get accounts
      const accounts = await adsApiService.listAccounts(userId, dealershipId);
      
      res.json({ accounts });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /ads/accounts/:id
 * Get Google Ads account details
 */
router.get(
  '/accounts/:id',
  authenticate,
  trackMetrics('/ads/accounts/:id'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = parseInt(req.params.id);
      
      if (isNaN(accountId)) {
        return res.status(400).json({ error: 'invalid_account_id', message: 'Invalid account ID' });
      }
      
      // Get account from database
      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.id, accountId)
      });
      
      if (!account) {
        return res.status(404).json({ error: 'account_not_found', message: 'Account not found' });
      }
      
      res.json(account);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /ads/accounts/:id
 * Unlink Google Ads account
 */
router.delete(
  '/accounts/:id',
  authenticate,
  trackMetrics('/ads/accounts/:id'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = parseInt(req.params.id);
      
      if (isNaN(accountId)) {
        return res.status(400).json({ error: 'invalid_account_id', message: 'Invalid account ID' });
      }
      
      // Check if account exists
      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.id, accountId)
      });
      
      if (!account) {
        return res.status(404).json({ error: 'account_not_found', message: 'Account not found' });
      }
      
      // Delete account
      await db.delete(gadsAccounts).where(eq(gadsAccounts.id, accountId));
      
      res.json({ success: true, message: 'Account unlinked successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /ads/accounts/:id/sandbox
 * Update sandbox association for a Google Ads account
 */
router.put(
  '/accounts/:id/sandbox',
  authenticate,
  validateRequest(sandboxUpdateSchema),
  trackMetrics('/ads/accounts/:id/sandbox'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = parseInt(req.params.id);
      const { sandboxId } = req.body;
      
      if (isNaN(accountId)) {
        return res.status(400).json({ error: 'invalid_account_id', message: 'Invalid account ID' });
      }
      
      // Check if account exists
      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.id, accountId)
      });
      
      if (!account) {
        return res.status(404).json({ error: 'account_not_found', message: 'Account not found' });
      }
      
      // Update sandbox association
      const [updatedAccount] = await db.update(gadsAccounts)
        .set({
          sandboxId,
          updatedAt: new Date()
        })
        .where(eq(gadsAccounts.id, accountId))
        .returning();
      
      res.json(updatedAccount);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /ads/accounts/:id/refresh
 * Refresh Google Ads account details
 */
router.post(
  '/accounts/:id/refresh',
  authenticate,
  trackMetrics('/ads/accounts/:id/refresh'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = parseInt(req.params.id);
      
      if (isNaN(accountId)) {
        return res.status(400).json({ error: 'invalid_account_id', message: 'Invalid account ID' });
      }
      
      // Refresh account details
      const account = await adsApiService.getAccountDetails(accountId);
      
      res.json(account);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /ads/campaigns
 * Create a Google Ads campaign
 */
router.post(
  '/campaigns',
  authenticate,
  validateRequest(campaignCreateSchema),
  trackMetrics('/ads/campaigns'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaignParams: SearchCampaignParams = req.body;
      
      // Create campaign
      const campaign = await adsApiService.createSearchCampaign(campaignParams);
      
      res.status(201).json(campaign);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /ads/campaigns
 * List campaigns for an account
 */
router.get(
  '/campaigns',
  authenticate,
  trackMetrics('/ads/campaigns'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
      
      if (accountId && isNaN(accountId)) {
        return res.status(400).json({ error: 'invalid_account_id', message: 'Invalid account ID' });
      }
      
      // Get campaigns from database
      let query = db.select().from(gadsCampaigns);
      
      if (accountId) {
        query = query.where(eq(gadsCampaigns.gadsAccountId, accountId));
      }
      
      const campaigns = await query;
      
      res.json({ campaigns });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /ads/campaigns/:id
 * Get campaign details
 */
router.get(
  '/campaigns/:id',
  authenticate,
  trackMetrics('/ads/campaigns/:id'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaignId = parseInt(req.params.id);
      
      if (isNaN(campaignId)) {
        return res.status(400).json({ error: 'invalid_campaign_id', message: 'Invalid campaign ID' });
      }
      
      // Get campaign from database
      const campaign = await db.query.gadsCampaigns.findFirst({
        where: eq(gadsCampaigns.id, campaignId)
      });
      
      if (!campaign) {
        return res.status(404).json({ error: 'campaign_not_found', message: 'Campaign not found' });
      }
      
      res.json(campaign);
    } catch (error) {
      next(error);
    }
  }
);

// Apply error handling middleware
router.use(handleAdsApiError);

export default router;
