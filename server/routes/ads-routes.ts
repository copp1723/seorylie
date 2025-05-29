/**
 * Google Ads API Routes
 * 
 * Provides endpoints for Google Ads integration, including OAuth flow,
 * account management, and campaign creation.
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { adsApiService, SearchCampaignParams } from '../services/ads-api-service';
import { gadsAccounts, gadsCampaigns } from '../../shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { authenticate } from '../middleware/authentication';
import { validate } from '../middleware/validation';

const router = Router();

// Validation schemas
const authUrlSchema = z.object({
  userId: z.number().int().positive(),
  dealershipId: z.number().int().positive().optional(),
  sandboxId: z.number().int().positive().optional(),
  state: z.string().optional(),
});

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

const accountIdSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

const sandboxAssociationSchema = z.object({
  sandboxId: z.number().int().positive().nullable(),
});

const campaignQuerySchema = z.object({
  accountId: z.string().optional(),
  limit: z.string().transform((val) => parseInt(val)).optional(),
  offset: z.string().transform((val) => parseInt(val)).optional(),
  sortBy: z.enum(['createdAt', 'campaignName', 'status', 'budgetAmount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const searchCampaignSchema = z.object({
  accountId: z.string(),
  campaignName: z.string().min(1).max(255),
  budget: z.object({
    amount: z.number().positive(),
    deliveryMethod: z.enum(['STANDARD', 'ACCELERATED']).optional(),
  }),
  bidStrategy: z.object({
    type: z.enum([
      'MAXIMIZE_CONVERSIONS',
      'MAXIMIZE_CONVERSION_VALUE',
      'TARGET_CPA',
      'TARGET_ROAS',
      'MANUAL_CPC',
    ]),
    targetCpa: z.number().positive().optional(),
    targetRoas: z.number().positive().optional(),
  }).optional(),
  startDate: z.string().regex(/^\d{8}$/).optional(), // YYYYMMDD format
  endDate: z.string().regex(/^\d{8}$/).optional(), // YYYYMMDD format
  networkSettings: z.object({
    targetGoogleSearch: z.boolean().optional(),
    targetSearchNetwork: z.boolean().optional(),
    targetContentNetwork: z.boolean().optional(),
    targetPartnerSearchNetwork: z.boolean().optional(),
  }).optional(),
  locations: z.array(z.object({
    id: z.number().int().positive(),
    negative: z.boolean().optional(),
  })).optional(),
  languages: z.array(z.number().int().positive()).optional(),
  isDryRun: z.boolean().optional(),
  sandboxId: z.number().int().positive().optional(),
});

// Middleware to check if user has access to account
const checkAccountAccess = async (req: any, res: any, next: any) => {
  try {
    const accountId = parseInt(req.params.id);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has access to this account
    const account = await db.query.gadsAccounts.findFirst({
      where: eq(gadsAccounts.id, accountId),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Check if user owns this account or is part of the same dealership
    if (account.userId !== userId) {
      // Check if user belongs to the same dealership
      const userDealership = await db.query.users.findFirst({
        where: eq(db.users.id, userId),
        columns: { dealershipId: true },
      });

      if (!userDealership?.dealershipId || userDealership.dealershipId !== account.dealershipId) {
        return res.status(403).json({ error: 'You do not have access to this account' });
      }
    }

    // Add account to request for use in route handlers
    req.account = account;
    next();
  } catch (error) {
    logger.error('Error checking account access', { error, accountId: req.params.id });
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Generate OAuth URL for Google Ads authentication
 * POST /api/ads/auth/url
 */
router.post('/auth/url', authenticate(), validate(authUrlSchema), async (req, res) => {
  try {
    const { userId, dealershipId, sandboxId, state } = req.body;

    // Generate OAuth URL
    const authUrl = adsApiService.getAuthUrl(userId, dealershipId, sandboxId, state);

    res.json({ url: authUrl });
  } catch (error) {
    logger.error('Error generating OAuth URL', { error });
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

/**
 * Handle OAuth callback from Google
 * GET /api/ads/auth/callback
 */
router.get('/auth/callback', validate(callbackSchema, 'query'), async (req, res) => {
  try {
    const { code, state } = req.query as { code: string; state: string };

    // Handle OAuth callback
    const account = await adsApiService.handleCallback(code, state);

    // Redirect to success page
    res.redirect(`/ads/auth/success?accountId=${account.id}`);
  } catch (error) {
    logger.error('Error handling OAuth callback', { error });
    res.redirect('/ads/auth/error?message=' + encodeURIComponent('Authentication failed'));
  }
});

/**
 * List Google Ads accounts for a user
 * GET /api/ads/accounts
 */
router.get('/accounts', authenticate(), async (req, res) => {
  try {
    const userId = req.user?.id;
    const dealershipId = req.query.dealershipId ? parseInt(req.query.dealershipId as string) : undefined;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get accounts from database
    const accounts = await adsApiService.listAccounts(userId, dealershipId);

    res.json({ accounts });
  } catch (error) {
    logger.error('Error listing Google Ads accounts', { error });
    res.status(500).json({ error: 'Failed to list Google Ads accounts' });
  }
});

/**
 * Get Google Ads account details
 * GET /api/ads/accounts/:id
 */
router.get('/accounts/:id', authenticate(), validate(accountIdSchema, 'params'), checkAccountAccess, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);

    // Get account details from Google Ads API
    const account = await adsApiService.getAccountDetails(accountId);

    res.json(account);
  } catch (error) {
    logger.error('Error getting account details', { error, accountId: req.params.id });
    
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.status(500).json({ error: 'Failed to get account details' });
  }
});

/**
 * Unlink Google Ads account
 * DELETE /api/ads/accounts/:id
 */
router.delete('/accounts/:id', authenticate(), validate(accountIdSchema, 'params'), checkAccountAccess, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);

    // Delete account from database
    await db.delete(gadsAccounts).where(eq(gadsAccounts.id, accountId));

    res.json({ success: true, message: 'Account unlinked successfully' });
  } catch (error) {
    logger.error('Error unlinking account', { error, accountId: req.params.id });
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

/**
 * Refresh Google Ads account details
 * POST /api/ads/accounts/:id/refresh
 */
router.post('/accounts/:id/refresh', authenticate(), validate(accountIdSchema, 'params'), checkAccountAccess, async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);

    // Refresh account details from Google Ads API
    const account = await adsApiService.getAccountDetails(accountId);

    res.json(account);
  } catch (error) {
    logger.error('Error refreshing account', { error, accountId: req.params.id });
    
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.status(500).json({ error: 'Failed to refresh account details' });
  }
});

/**
 * Associate Google Ads account with sandbox
 * PUT /api/ads/accounts/:id/sandbox
 */
router.put('/accounts/:id/sandbox', 
  authenticate(), 
  validate(accountIdSchema, 'params'), 
  validate(sandboxAssociationSchema), 
  checkAccountAccess, 
  async (req, res) => {
    try {
      const accountId = parseInt(req.params.id);
      const { sandboxId } = req.body;

      // Update account in database
      const [updatedAccount] = await db.update(gadsAccounts)
        .set({
          sandboxId,
          updatedAt: new Date()
        })
        .where(eq(gadsAccounts.id, accountId))
        .returning();

      if (!updatedAccount) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json(updatedAccount);
    } catch (error) {
      logger.error('Error associating account with sandbox', { error, accountId: req.params.id });
      res.status(500).json({ error: 'Failed to associate account with sandbox' });
    }
  }
);

/**
 * Create a search campaign
 * POST /api/ads/campaigns
 */
router.post('/campaigns', authenticate(), validate(searchCampaignSchema), async (req, res) => {
  try {
    const campaignParams: SearchCampaignParams = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has access to this account
    const account = await db.query.gadsAccounts.findFirst({
      where: and(
        eq(gadsAccounts.cid, campaignParams.accountId),
        eq(gadsAccounts.userId, userId)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found or you do not have access' });
    }

    // Create campaign
    const campaign = await adsApiService.createSearchCampaign({
      ...campaignParams,
      sandboxId: campaignParams.sandboxId || account.sandboxId
    });

    res.json(campaign);
  } catch (error) {
    logger.error('Error creating search campaign', { error });
    
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    if (error.code === 'RATE_LIMIT_ERROR') {
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }
    
    res.status(500).json({ error: 'Failed to create search campaign: ' + error.message });
  }
});

/**
 * List campaigns
 * GET /api/ads/campaigns
 */
router.get('/campaigns', authenticate(), validate(campaignQuerySchema, 'query'), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { 
      accountId, 
      limit = 20, 
      offset = 0, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query as {
      accountId?: string;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    };

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Build query
    let query = db.select().from(gadsCampaigns)
      .innerJoin(gadsAccounts, eq(gadsCampaigns.gadsAccountId, gadsAccounts.id))
      .where(eq(gadsAccounts.userId, userId))
      .limit(limit)
      .offset(offset);

    // Add account filter if specified
    if (accountId) {
      query = query.where(eq(gadsAccounts.cid, accountId));
    }

    // Add sorting
    if (sortOrder === 'asc') {
      query = query.orderBy(asc(gadsCampaigns[sortBy as keyof typeof gadsCampaigns]));
    } else {
      query = query.orderBy(desc(gadsCampaigns[sortBy as keyof typeof gadsCampaigns]));
    }

    // Execute query
    const campaigns = await query;

    // Get total count for pagination
    const countQuery = db.select({ count: db.sql<number>`count(*)` })
      .from(gadsCampaigns)
      .innerJoin(gadsAccounts, eq(gadsCampaigns.gadsAccountId, gadsAccounts.id))
      .where(eq(gadsAccounts.userId, userId));

    if (accountId) {
      countQuery.where(eq(gadsAccounts.cid, accountId));
    }

    const [{ count }] = await countQuery;

    res.json({
      campaigns,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });
  } catch (error) {
    logger.error('Error listing campaigns', { error });
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

export default router;
