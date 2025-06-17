import express from 'express';
import { z } from 'zod';
import { ga4MultiTenantService } from '../services/ga4-multi-tenant-service.js';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const dateRangeSchema = z.object({
  days: z.number().min(1).max(365).optional().default(30)
});

const customReportSchema = z.object({
  dateRanges: z.array(z.object({
    startDate: z.string(),
    endDate: z.string()
  })),
  dimensions: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  limit: z.number().min(1).max(1000).optional()
});

/**
 * Get SEO metrics overview
 * GET /api/ga4/reports/seo-metrics
 */
router.get('/seo-metrics', async (req, res) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const dealershipId = req.session?.dealershipId || req.query.dealershipId as string;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const metrics = await ga4MultiTenantService.getSEOMetrics(dealershipId, days);
    
    res.json({
      success: true,
      dealershipId,
      period: `${days} days`,
      data: metrics
    });

  } catch (error: any) {
    logger.error('Error fetching SEO metrics', { error });
    
    if (error.message.includes('No active GA4 property')) {
      return res.status(404).json({ 
        error: 'No GA4 property configured',
        setup_url: '/api/ga4/onboarding-instructions'
      });
    }
    
    res.status(500).json({ error: 'Failed to fetch SEO metrics' });
  }
});

/**
 * Get organic traffic data
 * GET /api/ga4/reports/organic-traffic
 */
router.get('/organic-traffic', async (req, res) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const dealershipId = req.session?.dealershipId || req.query.dealershipId as string;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const traffic = await ga4MultiTenantService.getOrganicTraffic(dealershipId, days);
    
    res.json({
      success: true,
      dealershipId,
      period: `${days} days`,
      data: traffic
    });

  } catch (error: any) {
    logger.error('Error fetching organic traffic', { error });
    res.status(500).json({ error: 'Failed to fetch organic traffic data' });
  }
});

/**
 * Get top landing pages
 * GET /api/ga4/reports/landing-pages
 */
router.get('/landing-pages', async (req, res) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const dealershipId = req.session?.dealershipId || req.query.dealershipId as string;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const pages = await ga4MultiTenantService.getTopLandingPages(dealershipId, days);
    
    res.json({
      success: true,
      dealershipId,
      period: `${days} days`,
      data: pages
    });

  } catch (error: any) {
    logger.error('Error fetching landing pages', { error });
    res.status(500).json({ error: 'Failed to fetch landing pages data' });
  }
});

/**
 * Run custom report
 * POST /api/ga4/reports/custom
 */
router.post('/custom', async (req, res) => {
  try {
    const validation = customReportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.format()
      });
    }

    const dealershipId = req.session?.dealershipId || req.body.dealershipId;
    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const report = await ga4MultiTenantService.runReport({
      dealershipId,
      reportType: 'custom',
      ...validation.data
    });
    
    res.json({
      success: true,
      dealershipId,
      data: report
    });

  } catch (error: any) {
    logger.error('Error running custom report', { error });
    res.status(500).json({ error: 'Failed to run custom report' });
  }
});

/**
 * Get API usage statistics
 * GET /api/ga4/reports/usage
 */
router.get('/usage', async (req, res) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const dealershipId = req.session?.dealershipId || req.query.dealershipId as string;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    const usage = await ga4MultiTenantService.getUsageStats(dealershipId, days);
    
    res.json({
      success: true,
      dealershipId,
      period: `${days} days`,
      usage
    });

  } catch (error: any) {
    logger.error('Error fetching usage stats', { error });
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

/**
 * Clear cache for dealership
 * POST /api/ga4/reports/clear-cache
 */
router.post('/clear-cache', async (req, res) => {
  try {
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    await ga4MultiTenantService.clearCache(dealershipId);
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });

  } catch (error: any) {
    logger.error('Error clearing cache', { error });
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * Get available dimensions and metrics
 * GET /api/ga4/reports/metadata
 */
router.get('/metadata', async (req, res) => {
  res.json({
    dimensions: [
      { name: 'date', displayName: 'Date', description: 'The date of the session' },
      { name: 'sessionDefaultChannelGroup', displayName: 'Default Channel Group', description: 'Channel grouping like Organic Search, Direct, etc.' },
      { name: 'sessionSourceMedium', displayName: 'Source / Medium', description: 'The source and medium of the session' },
      { name: 'landingPage', displayName: 'Landing Page', description: 'The first page in a session' },
      { name: 'country', displayName: 'Country', description: 'Country of users' },
      { name: 'city', displayName: 'City', description: 'City of users' },
      { name: 'deviceCategory', displayName: 'Device Category', description: 'Desktop, mobile, or tablet' },
      { name: 'browser', displayName: 'Browser', description: 'Browser used by visitors' }
    ],
    metrics: [
      { name: 'sessions', displayName: 'Sessions', description: 'Total number of sessions' },
      { name: 'totalUsers', displayName: 'Users', description: 'Total number of users' },
      { name: 'newUsers', displayName: 'New Users', description: 'Number of new users' },
      { name: 'screenPageViews', displayName: 'Page Views', description: 'Total page views' },
      { name: 'averageSessionDuration', displayName: 'Avg Session Duration', description: 'Average time spent per session' },
      { name: 'bounceRate', displayName: 'Bounce Rate', description: 'Percentage of single-page sessions' },
      { name: 'engagementRate', displayName: 'Engagement Rate', description: 'Percentage of engaged sessions' },
      { name: 'conversions', displayName: 'Conversions', description: 'Total conversions' }
    ]
  });
});

export default router;