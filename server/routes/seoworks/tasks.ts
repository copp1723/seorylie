import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db/index.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/errors.js';

const router = Router();

// API key middleware
const validateApiKey = (req: Request, res: Response, next: Function) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.SEO_WORKS_API_KEY;

  if (!expectedKey) {
    logger.error('SEO_WORKS_API_KEY not configured');
    return res.status(500).json({ error: 'API key not configured' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    logger.warn('Invalid SEOWerks API key attempt');
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Task webhook schema
const taskWebhookSchema = z.object({
  id: z.string(),
  task_type: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  dealership_id: z.string().optional(),
  completion_notes: z.string().optional(),
  post_title: z.string().optional(),
  post_url: z.string().optional(),
  payload: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

// Health check endpoint (no auth required)
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'SEOWerks Integration',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint for Jeff (with auth)
router.post('/test', validateApiKey, (req: Request, res: Response) => {
  logger.info('SEOWerks test endpoint called', { body: req.body });
  
  res.json({
    status: 'success',
    message: 'SEOWerks test endpoint working correctly',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// Main task webhook endpoint
router.post('/task', validateApiKey, async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = taskWebhookSchema.parse(req.body);
    
    logger.info('SEOWerks task webhook received', {
      taskId: validatedData.id,
      taskType: validatedData.task_type,
      status: validatedData.status
    });

    // Store in database
    const query = `
      INSERT INTO seoworks_tasks (
        id, task_type, status, dealership_id, 
        completion_notes, post_title, post_url, 
        payload, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 
        COALESCE($9::timestamptz, NOW()), 
        COALESCE($10::timestamptz, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        task_type = EXCLUDED.task_type,
        status = EXCLUDED.status,
        dealership_id = EXCLUDED.dealership_id,
        completion_notes = EXCLUDED.completion_notes,
        post_title = EXCLUDED.post_title,
        post_url = EXCLUDED.post_url,
        payload = EXCLUDED.payload,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [
      validatedData.id,
      validatedData.task_type,
      validatedData.status,
      validatedData.dealership_id || null,
      validatedData.completion_notes || null,
      validatedData.post_title || null,
      validatedData.post_url || null,
      validatedData.payload || null,
      validatedData.created_at || null,
      validatedData.updated_at || null
    ];

    const result = await pool.query(query, values);
    const savedTask = result.rows[0];

    logger.info('SEOWerks task saved successfully', {
      taskId: savedTask.id,
      status: savedTask.status
    });

    res.json({
      status: 'success',
      message: 'Task received and stored',
      task: {
        id: savedTask.id,
        status: savedTask.status,
        updated_at: savedTask.updated_at
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('SEOWerks webhook validation error', { 
        errors: error.errors,
        body: req.body 
      });
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }

    logger.error('SEOWerks webhook error', { error });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process task webhook'
    });
  }
});

// Get task status endpoint
router.get('/task/:taskId', validateApiKey, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    const query = 'SELECT * FROM seoworks_tasks WHERE id = $1';
    const result = await pool.query(query, [taskId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Task not found',
        taskId
      });
    }
    
    res.json({
      status: 'success',
      task: result.rows[0]
    });
    
  } catch (error) {
    logger.error('Error fetching task', { error, taskId: req.params.taskId });
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// List tasks endpoint (with pagination)
router.get('/tasks', validateApiKey, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;
    const dealershipId = req.query.dealership_id as string;
    
    let query = 'SELECT * FROM seoworks_tasks WHERE 1=1';
    const values: any[] = [];
    let paramCount = 0;
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      values.push(status);
    }
    
    if (dealershipId) {
      paramCount++;
      query += ` AND dealership_id = $${paramCount}`;
      values.push(dealershipId);
    }
    
    query += ` ORDER BY updated_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    values.push(limit, offset);
    
    const result = await pool.query(query, values);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM seoworks_tasks WHERE 1=1';
    const countValues: any[] = [];
    paramCount = 0;
    
    if (status) {
      paramCount++;
      countQuery += ` AND status = $${paramCount}`;
      countValues.push(status);
    }
    
    if (dealershipId) {
      paramCount++;
      countQuery += ` AND dealership_id = $${paramCount}`;
      countValues.push(dealershipId);
    }
    
    const countResult = await pool.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0].count);
    
    res.json({
      status: 'success',
      tasks: result.rows,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    });
    
  } catch (error) {
    logger.error('Error listing tasks', { error });
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Weekly rollup endpoint (placeholder for future implementation)
router.get('/weekly-rollup', validateApiKey, (req: Request, res: Response) => {
  const { startDate, endDate, clientId } = req.query;
  
  logger.info('Weekly rollup requested', { startDate, endDate, clientId });
  
  res.json({
    status: 'success',
    message: 'Weekly rollup endpoint - implementation coming soon',
    parameters: {
      startDate,
      endDate,
      clientId
    }
  });
});

export default router;