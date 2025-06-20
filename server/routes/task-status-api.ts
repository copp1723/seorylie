/**
 * Task Status API Routes
 * Provides endpoints for chat assistant to fetch dealership task status and analytics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const dealershipQuerySchema = z.object({
  dealershipId: z.string().optional(),
  timeframe: z.enum(['week', 'month', 'quarter']).optional().default('month')
});

/**
 * Get task completion status for chat assistant
 * GET /api/tasks/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const validation = dealershipQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.format()
      });
    }

    const dealershipId = validation.data.dealershipId || req.session?.dealershipId;
    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Get task counts by status
    const taskStatusQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        array_agg(
          json_build_object(
            'id', id,
            'task_type', task_type,
            'post_title', post_title,
            'completion_date', completion_date,
            'created_at', created_at
          ) ORDER BY updated_at DESC
        ) FILTER (WHERE status IN ('completed', 'in_progress')) as tasks
      FROM seoworks_tasks 
      WHERE dealership_id = $1 
        AND created_at >= NOW() - INTERVAL '1 month'
      GROUP BY status
    `;

    const taskResult = await pool.query(taskStatusQuery, [dealershipId]);

    // Process results into chat-friendly format
    const taskData = {
      completed: [],
      inProgress: [],
      scheduled: [],
      totalCompleted: 0,
      totalInProgress: 0,
      totalScheduled: 0
    };

    taskResult.rows.forEach(row => {
      const count = parseInt(row.count);
      switch (row.status) {
        case 'completed':
          taskData.completed = (row.tasks || []).slice(0, 10); // Limit for chat
          taskData.totalCompleted = count;
          break;
        case 'in_progress':
          taskData.inProgress = (row.tasks || []).slice(0, 5);
          taskData.totalInProgress = count;
          break;
        case 'pending':
          taskData.scheduled = (row.tasks || []).slice(0, 5);
          taskData.totalScheduled = count;
          break;
      }
    });

    // Get recent completions for detailed responses
    const recentCompletionsQuery = `
      SELECT 
        task_type,
        post_title,
        post_url,
        completion_date,
        completion_notes
      FROM seoworks_tasks 
      WHERE dealership_id = $1 
        AND status = 'completed'
        AND completion_date >= NOW() - INTERVAL '7 days'
      ORDER BY completion_date DESC
      LIMIT 5
    `;

    const recentResult = await pool.query(recentCompletionsQuery, [dealershipId]);

    res.json({
      success: true,
      dealershipId,
      taskSummary: taskData,
      recentCompletions: recentResult.rows,
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error fetching task status', { error, dealershipId: req.query.dealershipId });
    res.status(500).json({ error: 'Failed to fetch task status' });
  }
});

/**
 * Get analytics summary for chat assistant
 * GET /api/tasks/analytics-summary
 */
router.get('/analytics-summary', async (req: Request, res: Response) => {
  try {
    const dealershipId = req.query.dealershipId || req.session?.dealershipId;
    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Get GA4 property for this dealership
    const propertyQuery = `
      SELECT property_id, property_name 
      FROM ga4_properties 
      WHERE dealership_id = $1 AND is_active = true
      LIMIT 1
    `;

    const propertyResult = await pool.query(propertyQuery, [dealershipId]);
    const property = propertyResult.rows[0];

    if (!property) {
      return res.json({
        success: true,
        hasGA4: false,
        message: 'GA4 property not configured',
        setupUrl: '/api/ga4/onboarding-instructions'
      });
    }

    // Mock analytics data (replace with actual GA4 service call)
    const currentMonth = new Date();
    const lastMonth = subMonths(currentMonth, 1);

    const mockAnalytics = {
      organicTraffic: {
        thisMonth: 3420 + Math.floor(Math.random() * 500),
        lastMonth: 2890 + Math.floor(Math.random() * 300),
        yearOverYear: 15.3 + Math.random() * 10
      },
      rankings: {
        averagePosition: 3.2 + Math.random() * 2,
        topKeywords: [
          'used cars near me',
          'ford dealership',
          'auto financing',
          'car service center',
          'vehicle maintenance'
        ],
        improvingKeywords: [
          'certified pre-owned',
          'auto repair shop',
          'car loans'
        ]
      },
      conversions: {
        thisMonth: 45 + Math.floor(Math.random() * 20),
        lastMonth: 38 + Math.floor(Math.random() * 15)
      }
    };

    // Calculate growth percentages
    const trafficGrowth = ((mockAnalytics.organicTraffic.thisMonth - mockAnalytics.organicTraffic.lastMonth) / mockAnalytics.organicTraffic.lastMonth * 100).toFixed(1);
    const conversionGrowth = ((mockAnalytics.conversions.thisMonth - mockAnalytics.conversions.lastMonth) / mockAnalytics.conversions.lastMonth * 100).toFixed(1);

    res.json({
      success: true,
      dealershipId,
      hasGA4: true,
      propertyId: property.property_id,
      analytics: {
        ...mockAnalytics,
        growth: {
          traffic: parseFloat(trafficGrowth),
          conversions: parseFloat(conversionGrowth)
        }
      },
      period: {
        current: format(currentMonth, 'MMMM yyyy'),
        previous: format(lastMonth, 'MMMM yyyy')
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error fetching analytics summary', { error });
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

/**
 * Get SEO package details for chat assistant
 * GET /api/tasks/package-info
 */
router.get('/package-info', async (req: Request, res: Response) => {
  try {
    const dealershipId = req.query.dealershipId || req.session?.dealershipId;
    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Get dealership package info
    const dealershipQuery = `
      SELECT 
        business_name,
        package,
        main_brand,
        target_cities,
        target_vehicle_models
      FROM seoworks_onboarding_submissions 
      WHERE id = $1
    `;

    const dealershipResult = await pool.query(dealershipQuery, [dealershipId]);
    const dealership = dealershipResult.rows[0];

    if (!dealership) {
      return res.status(404).json({ error: 'Dealership not found' });
    }

    // Package feature definitions
    const packageFeatures = {
      PLATINUM: {
        name: 'Platinum',
        monthlyFeatures: [
          '8 optimized landing pages per month',
          '4 blog posts with local SEO focus',
          'Weekly technical SEO audits',
          'Competitor analysis and monitoring',
          'Google Ads integration and optimization',
          'Priority support and monthly strategy calls'
        ],
        included: [
          'Google My Business optimization',
          'Schema markup implementation',
          'Local citation building',
          'Review management',
          'Performance tracking and reporting'
        ]
      },
      GOLD: {
        name: 'Gold',
        monthlyFeatures: [
          '5 optimized landing pages per month',
          '2 blog posts with local SEO focus',
          'Bi-weekly technical SEO audits',
          'Monthly competitor analysis',
          'Google My Business optimization',
          'Standard support with quarterly reviews'
        ],
        included: [
          'Basic schema markup',
          'Local SEO optimization',
          'Monthly performance reports',
          'Keyword tracking',
          'Technical SEO fixes'
        ]
      },
      SILVER: {
        name: 'Silver',
        monthlyFeatures: [
          '3 optimized landing pages per month',
          '1 blog post with local SEO focus',
          'Monthly technical SEO audits',
          'Basic competitor monitoring',
          'Google My Business setup',
          'Email support with monthly reports'
        ],
        included: [
          'On-page SEO optimization',
          'Basic local SEO',
          'Monthly reporting',
          'Keyword research',
          'Basic technical fixes'
        ]
      }
    };

    const packageInfo = packageFeatures[dealership.package as keyof typeof packageFeatures] || packageFeatures.GOLD;

    res.json({
      success: true,
      dealership: {
        name: dealership.business_name,
        brand: dealership.main_brand,
        targetCities: dealership.target_cities || [],
        targetModels: dealership.target_vehicle_models || []
      },
      package: {
        tier: dealership.package,
        ...packageInfo
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error fetching package info', { error });
    res.status(500).json({ error: 'Failed to fetch package information' });
  }
});

/**
 * Submit SEO request from chat assistant
 * POST /api/tasks/chat-request
 */
router.post('/chat-request', async (req: Request, res: Response) => {
  try {
    const { type, description, priority = 'normal', context } = req.body;
    const dealershipId = req.body.dealershipId || req.session?.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    if (!type || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: type and description' 
      });
    }

    const requestId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store the request in database
    const insertQuery = `
      INSERT INTO seo_requests (
        id, dealership_id, type, description, priority, 
        source, context, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const values = [
      requestId,
      dealershipId,
      type,
      description,
      priority,
      'chat-assistant',
      JSON.stringify(context || {}),
      'pending'
    ];

    const result = await pool.query(insertQuery, values);
    const savedRequest = result.rows[0];

    logger.info('SEO request created from chat', {
      requestId,
      dealershipId,
      type,
      source: 'chat-assistant'
    });

    res.status(201).json({
      success: true,
      request: {
        id: savedRequest.id,
        type: savedRequest.type,
        description: savedRequest.description,
        priority: savedRequest.priority,
        status: savedRequest.status,
        createdAt: savedRequest.created_at
      },
      message: 'Request submitted successfully. Our SEO team will review this and get back to you within 24 hours.'
    });

  } catch (error: any) {
    logger.error('Error creating chat request', { error });
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

export default router;

