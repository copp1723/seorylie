import express from 'express';
import { db } from '../db';
import { sandboxes, sandboxSessions, tokenUsageLogs } from '../../shared/schema';
import { z } from 'zod';
import { auth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

// Validation schemas
const createSandboxSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  token_limit_per_hour: z.number().int().positive().default(10000),
  token_limit_per_day: z.number().int().positive().default(50000),
  is_active: z.boolean().default(true)
});

const updateSandboxSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  token_limit_per_hour: z.number().int().positive().optional(),
  token_limit_per_day: z.number().int().positive().optional(),
  is_active: z.boolean().optional()
});

const createSessionSchema = z.object({
  userId: z.number().int().positive(),
  metadata: z.record(z.any()).optional()
});

// Initialize router
const router = express.Router();

/**
 * @route   GET /api/sandboxes
 * @desc    Get all sandboxes for the authenticated user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    // Get all sandboxes for this user
    const userSandboxes = await db.select({
      id: sandboxes.id,
      name: sandboxes.name,
      description: sandboxes.description,
      token_limit_per_hour: sandboxes.tokenLimitPerHour,
      token_limit_per_day: sandboxes.tokenLimitPerDay,
      current_hourly_usage: sandboxes.currentHourlyUsage,
      current_daily_usage: sandboxes.currentDailyUsage,
      is_active: sandboxes.isActive,
      created_at: sandboxes.createdAt,
      updated_at: sandboxes.updatedAt
    })
    .from(sandboxes)
    .where(eq(sandboxes.userId, userId))
    .orderBy(desc(sandboxes.createdAt));
    
    return res.status(200).json({
      success: true,
      sandboxes: userSandboxes
    });
  } catch (error) {
    logger.error('Error fetching sandboxes:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sandboxes'
    });
  }
});

/**
 * @route   POST /api/sandboxes
 * @desc    Create a new sandbox
 * @access  Private
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    // Validate request body
    const validationResult = createSandboxSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    const { name, description, token_limit_per_hour, token_limit_per_day, is_active } = validationResult.data;
    
    // Create new sandbox
    const [newSandbox] = await db.insert(sandboxes)
      .values({
        name,
        description,
        userId,
        tokenLimitPerHour: token_limit_per_hour,
        tokenLimitPerDay: token_limit_per_day,
        currentHourlyUsage: 0,
        currentDailyUsage: 0,
        isActive: is_active,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({
        id: sandboxes.id,
        name: sandboxes.name,
        description: sandboxes.description,
        token_limit_per_hour: sandboxes.tokenLimitPerHour,
        token_limit_per_day: sandboxes.tokenLimitPerDay,
        current_hourly_usage: sandboxes.currentHourlyUsage,
        current_daily_usage: sandboxes.currentDailyUsage,
        is_active: sandboxes.isActive,
        created_at: sandboxes.createdAt,
        updated_at: sandboxes.updatedAt
      });
    
    return res.status(201).json({
      success: true,
      sandbox: newSandbox
    });
  } catch (error) {
    logger.error('Error creating sandbox:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create sandbox'
    });
  }
});

/**
 * @route   GET /api/sandboxes/:id
 * @desc    Get sandbox details
 * @access  Private
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sandboxId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(sandboxId)) {
      return res.status(400).json({ success: false, error: 'Invalid sandbox ID' });
    }
    
    // Get sandbox details
    const [sandbox] = await db.select({
      id: sandboxes.id,
      name: sandboxes.name,
      description: sandboxes.description,
      token_limit_per_hour: sandboxes.tokenLimitPerHour,
      token_limit_per_day: sandboxes.tokenLimitPerDay,
      current_hourly_usage: sandboxes.currentHourlyUsage,
      current_daily_usage: sandboxes.currentDailyUsage,
      is_active: sandboxes.isActive,
      created_at: sandboxes.createdAt,
      updated_at: sandboxes.updatedAt
    })
    .from(sandboxes)
    .where(
      and(
        eq(sandboxes.id, sandboxId),
        eq(sandboxes.userId, userId)
      )
    );
    
    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      sandbox
    });
  } catch (error) {
    logger.error(`Error fetching sandbox ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sandbox details'
    });
  }
});

/**
 * @route   PUT /api/sandboxes/:id
 * @desc    Update sandbox
 * @access  Private
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sandboxId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(sandboxId)) {
      return res.status(400).json({ success: false, error: 'Invalid sandbox ID' });
    }
    
    // Validate request body
    const validationResult = updateSandboxSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    // Check if sandbox exists and belongs to user
    const [existingSandbox] = await db.select({ id: sandboxes.id })
      .from(sandboxes)
      .where(
        and(
          eq(sandboxes.id, sandboxId),
          eq(sandboxes.userId, userId)
        )
      );
    
    if (!existingSandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found'
      });
    }
    
    // Update sandbox
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (validationResult.data.name !== undefined) {
      updateData.name = validationResult.data.name;
    }
    
    if (validationResult.data.description !== undefined) {
      updateData.description = validationResult.data.description;
    }
    
    if (validationResult.data.token_limit_per_hour !== undefined) {
      updateData.tokenLimitPerHour = validationResult.data.token_limit_per_hour;
    }
    
    if (validationResult.data.token_limit_per_day !== undefined) {
      updateData.tokenLimitPerDay = validationResult.data.token_limit_per_day;
    }
    
    if (validationResult.data.is_active !== undefined) {
      updateData.isActive = validationResult.data.is_active;
    }
    
    const [updatedSandbox] = await db.update(sandboxes)
      .set(updateData)
      .where(
        and(
          eq(sandboxes.id, sandboxId),
          eq(sandboxes.userId, userId)
        )
      )
      .returning({
        id: sandboxes.id,
        name: sandboxes.name,
        description: sandboxes.description,
        token_limit_per_hour: sandboxes.tokenLimitPerHour,
        token_limit_per_day: sandboxes.tokenLimitPerDay,
        current_hourly_usage: sandboxes.currentHourlyUsage,
        current_daily_usage: sandboxes.currentDailyUsage,
        is_active: sandboxes.isActive,
        created_at: sandboxes.createdAt,
        updated_at: sandboxes.updatedAt
      });
    
    return res.status(200).json({
      success: true,
      sandbox: updatedSandbox
    });
  } catch (error) {
    logger.error(`Error updating sandbox ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update sandbox'
    });
  }
});

/**
 * @route   DELETE /api/sandboxes/:id
 * @desc    Delete sandbox
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sandboxId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(sandboxId)) {
      return res.status(400).json({ success: false, error: 'Invalid sandbox ID' });
    }
    
    // Check if sandbox exists and belongs to user
    const [existingSandbox] = await db.select({ id: sandboxes.id })
      .from(sandboxes)
      .where(
        and(
          eq(sandboxes.id, sandboxId),
          eq(sandboxes.userId, userId)
        )
      );
    
    if (!existingSandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found'
      });
    }
    
    // Delete sandbox sessions first (cascade delete would be better in production)
    await db.delete(sandboxSessions)
      .where(eq(sandboxSessions.sandboxId, sandboxId));
    
    // Delete sandbox
    await db.delete(sandboxes)
      .where(
        and(
          eq(sandboxes.id, sandboxId),
          eq(sandboxes.userId, userId)
        )
      );
    
    return res.status(200).json({
      success: true,
      message: 'Sandbox deleted successfully'
    });
  } catch (error) {
    logger.error(`Error deleting sandbox ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete sandbox'
    });
  }
});

/**
 * @route   POST /api/sandboxes/:id/sessions
 * @desc    Create sandbox session
 * @access  Private
 */
router.post('/:id/sessions', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sandboxId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(sandboxId)) {
      return res.status(400).json({ success: false, error: 'Invalid sandbox ID' });
    }
    
    // Validate request body
    const validationResult = createSessionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }
    
    // Check if sandbox exists and belongs to user
    const [existingSandbox] = await db.select({
      id: sandboxes.id,
      isActive: sandboxes.isActive
    })
    .from(sandboxes)
    .where(
      and(
        eq(sandboxes.id, sandboxId),
        eq(sandboxes.userId, userId)
      )
    );
    
    if (!existingSandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found'
      });
    }
    
    if (!existingSandbox.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Sandbox is inactive'
      });
    }
    
    // Generate session ID and WebSocket channel
    const sessionId = `sess_${uuidv4()}`;
    const websocketChannel = `/ws/sandbox/${sandboxId}/${sessionId}`;
    
    // Create new session
    const [newSession] = await db.insert(sandboxSessions)
      .values({
        sandboxId,
        sessionId,
        userId: validationResult.data.userId,
        metadata: validationResult.data.metadata || {},
        websocketChannel,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({
        id: sandboxSessions.id,
        sandboxId: sandboxSessions.sandboxId,
        sessionId: sandboxSessions.sessionId,
        userId: sandboxSessions.userId,
        websocketChannel: sandboxSessions.websocketChannel,
        isActive: sandboxSessions.isActive,
        createdAt: sandboxSessions.createdAt
      });
    
    return res.status(201).json({
      success: true,
      session: {
        sandboxId: newSession.sandboxId,
        sessionId: newSession.sessionId,
        websocketChannel: newSession.websocketChannel
      }
    });
  } catch (error) {
    logger.error(`Error creating sandbox session for sandbox ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create sandbox session'
    });
  }
});

/**
 * @route   GET /api/sandboxes/:id/usage
 * @desc    Get sandbox usage statistics
 * @access  Private
 */
router.get('/:id/usage', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sandboxId = parseInt(req.params.id);
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (isNaN(sandboxId)) {
      return res.status(400).json({ success: false, error: 'Invalid sandbox ID' });
    }
    
    // Check if sandbox exists and belongs to user
    const [existingSandbox] = await db.select({
      id: sandboxes.id,
      current_hourly_usage: sandboxes.currentHourlyUsage,
      current_daily_usage: sandboxes.currentDailyUsage,
      token_limit_per_hour: sandboxes.tokenLimitPerHour,
      token_limit_per_day: sandboxes.tokenLimitPerDay
    })
    .from(sandboxes)
    .where(
      and(
        eq(sandboxes.id, sandboxId),
        eq(sandboxes.userId, userId)
      )
    );
    
    if (!existingSandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found'
      });
    }
    
    // Get hourly usage for the past 24 hours
    const hourlyUsage = await db.execute(sql`
      SELECT 
        date_trunc('hour', created_at) as hour,
        SUM(tokens_used) as tokens
      FROM ${tokenUsageLogs}
      WHERE 
        sandbox_id = ${sandboxId} AND
        created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY date_trunc('hour', created_at)
      ORDER BY hour DESC
    `);
    
    // Get daily usage for the past 7 days
    const dailyUsage = await db.execute(sql`
      SELECT 
        date_trunc('day', created_at) as day,
        SUM(tokens_used) as tokens
      FROM ${tokenUsageLogs}
      WHERE 
        sandbox_id = ${sandboxId} AND
        created_at >= NOW() - INTERVAL '7 days'
      GROUP BY date_trunc('day', created_at)
      ORDER BY day DESC
    `);
    
    // Get usage by operation type
    const usageByOperation = await db.execute(sql`
      SELECT 
        operation_type,
        SUM(tokens_used) as tokens
      FROM ${tokenUsageLogs}
      WHERE 
        sandbox_id = ${sandboxId} AND
        created_at >= NOW() - INTERVAL '7 days'
      GROUP BY operation_type
      ORDER BY tokens DESC
    `);
    
    // Get recent usage logs
    const recentLogs = await db.select({
      id: tokenUsageLogs.id,
      operation_type: tokenUsageLogs.operationType,
      tokens_used: tokenUsageLogs.tokensUsed,
      session_id: tokenUsageLogs.sessionId,
      created_at: tokenUsageLogs.createdAt
    })
    .from(tokenUsageLogs)
    .where(eq(tokenUsageLogs.sandboxId, sandboxId))
    .orderBy(desc(tokenUsageLogs.createdAt))
    .limit(20);
    
    return res.status(200).json({
      success: true,
      usage: {
        current: {
          hourly: existingSandbox.current_hourly_usage,
          daily: existingSandbox.current_daily_usage
        },
        limits: {
          hourly: existingSandbox.token_limit_per_hour,
          daily: existingSandbox.token_limit_per_day
        },
        hourly_usage: hourlyUsage,
        daily_usage: dailyUsage,
        usage_by_operation: usageByOperation,
        recent_logs: recentLogs
      }
    });
  } catch (error) {
    logger.error(`Error fetching sandbox usage for sandbox ${req.params.id}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch sandbox usage statistics'
    });
  }
});

export default router;
