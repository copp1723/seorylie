import { Router } from 'express';
import { Pool } from 'pg';
import { logger } from '../../utils/errors';

const router = Router();

// Use environment variable for API key
const API_KEY = process.env.SEO_WORKS_API_KEY || 'e7fcafb5d36ded4c9fb2fdc84b055357f15e00b4730c5c73597b64a7b90fc115';

// Create database pool
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// SEOWerks task webhook endpoint
router.post('/task', async (req, res) => {
  try {
    // Validate API key
    if (req.headers['x-api-key'] !== API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const { id, task_type, status, completion_notes, post_title, post_url, payload } = req.body;
    
    // Validate required fields
    if (!id || !task_type || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['id', 'task_type', 'status'] 
      });
    }

    // Log the incoming task
    logger.info('SEOWerks task received', {
      taskId: id,
      taskType: task_type,
      status,
      hasPostTitle: !!post_title,
      hasPostUrl: !!post_url
    });

    // For now, just acknowledge receipt
    // TODO: Implement database storage when table is created
    if (process.env.DATABASE_URL) {
      try {
        await pool.query(
          `INSERT INTO seoworks_tasks 
           (id, task_type, status, completion_notes, post_title, post_url, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id)
           DO UPDATE SET 
             status = $3,
             completion_notes = $4,
             post_title = $5,
             post_url = $6,
             payload = $7,
             updated_at = NOW()`,
          [id, task_type, status, completion_notes || null, post_title || null, post_url || null, payload || null]
        );
      } catch (dbError) {
        // Log but don't fail - table might not exist yet
        logger.warn('Database write failed - table may not exist', { error: dbError });
      }
    }

    res.json({ 
      success: true,
      message: 'Task received',
      taskId: id
    });
  } catch (error) {
    logger.error('SEOWerks task error', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SEOWerks health check
router.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok',
    service: 'seoworks',
    timestamp: new Date().toISOString()
  });
});

// Weekly rollup endpoint (placeholder for Jeff)
router.get('/weekly-rollup', async (req, res) => {
  const { startDate, endDate, clientId } = req.query;
  
  res.json({
    status: 'success',
    data: {
      message: 'Weekly rollup endpoint - coming soon',
      parameters: { startDate, endDate, clientId },
      note: 'This will aggregate completed tasks for the specified period'
    }
  });
});

export default router;