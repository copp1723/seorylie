/**
 * API Routes for Conversation Orchestrator Management
 * 
 * Provides REST endpoints for managing and monitoring the advanced conversation
 * orchestrator, including conversation status, metrics, and admin operations.
 */

import { Router } from 'express';
import { z } from 'zod';
import { conversationOrchestrator } from '../services/conversation-orchestrator';
import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

// Validation schemas
const conversationIdSchema = z.string().uuid();
const dealershipIdSchema = z.number().int().positive();

const createConversationSchema = z.object({
  leadId: z.string(),
  dealershipId: z.number().int().positive(),
  metadata: z.object({
    source: z.string(),
    vehicleInterest: z.string().optional(),
    customerInfo: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional()
    }),
    timing: z.string().optional(),
    sessionData: z.record(z.any()).optional()
  }),
  maxTurns: z.number().int().min(1).max(10).optional(),
  aiModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  priority: z.number().int().min(0).max(100).optional()
});

const updateConversationSchema = z.object({
  state: z.enum(['active', 'paused', 'completed', 'escalated', 'failed']).optional(),
  maxTurns: z.number().int().min(1).max(10).optional(),
  priority: z.number().int().min(0).max(100).optional()
});

/**
 * GET /api/conversations/orchestrator/health
 * Get orchestrator health status
 */
router.get('/health', async (req, res) => {
  try {
    const health = await conversationOrchestrator.getHealthStatus();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get orchestrator health', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get health status',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/conversations/orchestrator/metrics
 * Get orchestrator performance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const dealershipId = req.query.dealership_id ? parseInt(req.query.dealership_id as string) : undefined;
    const hours = req.query.hours ? parseInt(req.query.hours as string) : 24;

    // Get performance summary from metrics collector
    const metricsCollector = (conversationOrchestrator as any).metricsCollector;
    const summary = await metricsCollector.getPerformanceSummary(dealershipId, hours);

    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get orchestrator metrics', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/conversations/orchestrator/metrics/prometheus
 * Get Prometheus-format metrics
 */
router.get('/metrics/prometheus', async (req, res) => {
  try {
    const metricsCollector = (conversationOrchestrator as any).metricsCollector;
    const metrics = await metricsCollector.getPrometheusMetrics();

    res.set('Content-Type', 'text/plain');
    res.send(metrics);

  } catch (error) {
    logger.error('Failed to get Prometheus metrics', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get Prometheus metrics'
    });
  }
});

/**
 * GET /api/conversations/:id/status
 * Get detailed conversation status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const conversationId = conversationIdSchema.parse(req.params.id);

    const result = await db.execute(sql`
      SELECT 
        c.*,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at
      FROM conversations_v2 c
      LEFT JOIN conversation_messages_v2 m ON c.id = m.conversation_id
      WHERE c.id = ${conversationId}
      GROUP BY c.id
    `);

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    const conversation = result.rows[0] as any;

    // Get recent messages
    const messagesResult = await db.execute(sql`
      SELECT id, role, content, turn_number, metadata, created_at
      FROM conversation_messages_v2
      WHERE conversation_id = ${conversationId}
      ORDER BY turn_number ASC, created_at ASC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        id: conversation.id,
        leadId: conversation.lead_id,
        dealershipId: conversation.dealership_id,
        currentTurn: conversation.current_turn,
        maxTurns: conversation.max_turns,
        state: conversation.state,
        priority: conversation.priority,
        aiModel: conversation.ai_model,
        temperature: conversation.temperature,
        metadata: conversation.metadata,
        messageCount: parseInt(conversation.message_count),
        lastActivity: conversation.last_activity,
        lastMessageAt: conversation.last_message_at,
        completedAt: conversation.completed_at,
        escalatedAt: conversation.escalated_at,
        escalationReason: conversation.escalation_reason,
        createdAt: conversation.created_at,
        messages: messagesResult.rows.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          turnNumber: msg.turn_number,
          metadata: msg.metadata,
          createdAt: msg.created_at
        }))
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID format'
      });
    }

    logger.error('Failed to get conversation status', {
      conversationId: req.params.id,
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get conversation status'
    });
  }
});

/**
 * GET /api/conversations
 * List conversations with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const dealershipId = req.query.dealership_id ? parseInt(req.query.dealership_id as string) : undefined;
    const state = req.query.state as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    let whereClause = sql`WHERE 1=1`;
    
    if (dealershipId) {
      whereClause = sql`${whereClause} AND dealership_id = ${dealershipId}`;
    }
    
    if (state) {
      whereClause = sql`${whereClause} AND state = ${state}`;
    }

    const result = await db.execute(sql`
      SELECT 
        c.id,
        c.lead_id,
        c.dealership_id,
        c.current_turn,
        c.max_turns,
        c.state,
        c.priority,
        c.ai_model,
        c.last_activity,
        c.completed_at,
        c.escalated_at,
        c.created_at,
        COUNT(m.id) as message_count
      FROM conversations_v2 c
      LEFT JOIN conversation_messages_v2 m ON c.id = m.conversation_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.last_activity DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count for pagination
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM conversations_v2 c
      ${whereClause}
    `);

    const total = parseInt((countResult.rows[0] as any).total);

    res.json({
      success: true,
      data: {
        conversations: result.rows.map((row: any) => ({
          id: row.id,
          leadId: row.lead_id,
          dealershipId: row.dealership_id,
          currentTurn: row.current_turn,
          maxTurns: row.max_turns,
          state: row.state,
          priority: row.priority,
          aiModel: row.ai_model,
          messageCount: parseInt(row.message_count),
          lastActivity: row.last_activity,
          completedAt: row.completed_at,
          escalatedAt: row.escalated_at,
          createdAt: row.created_at
        })),
        pagination: {
          total,
          limit,
          offset,
          hasNext: offset + limit < total,
          hasPrev: offset > 0
        }
      }
    });

  } catch (error) {
    logger.error('Failed to list conversations', {
      error: error instanceof Error ? error.message : String(error),
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list conversations'
    });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation (for testing/admin)
 */
router.post('/', async (req, res) => {
  try {
    const data = createConversationSchema.parse(req.body);

    // Create conversation context
    const context = {
      leadId: data.leadId,
      conversationId: crypto.randomUUID(),
      dealershipId: data.dealershipId,
      currentTurn: 0,
      maxTurns: data.maxTurns || 2,
      metadata: data.metadata,
      history: [],
      state: 'active' as const,
      aiModel: data.aiModel || 'gpt-3.5-turbo',
      temperature: data.temperature || 0.7,
      priority: data.priority || 0
    };

    // Store in database
    await db.execute(sql`
      INSERT INTO conversations_v2 (
        id, lead_id, dealership_id, current_turn, max_turns, state,
        ai_model, temperature, metadata, priority, created_at, updated_at
      ) VALUES (
        ${context.conversationId}, ${context.leadId}, ${context.dealershipId},
        ${context.currentTurn}, ${context.maxTurns}, ${context.state},
        ${context.aiModel}, ${context.temperature}, ${JSON.stringify(context.metadata)},
        ${context.priority}, NOW(), NOW()
      )
    `);

    // Emit to Redis stream for processing
    if (req.body.autoStart !== false) {
      const redis = await import('../lib/redis').then(m => m.getRedisClient());
      if (redis) {
        await redis.xadd(
          'adf.lead.created',
          '*',
          'data', JSON.stringify({
            id: data.leadId,
            dealership_id: data.dealershipId,
            source: data.metadata.source,
            customer: data.metadata.customerInfo,
            vehicle: { model: data.metadata.vehicleInterest },
            metadata: data.metadata.sessionData
          }),
          'timestamp', Date.now(),
          'source', 'api'
        );
      }
    }

    res.status(201).json({
      success: true,
      data: {
        conversationId: context.conversationId,
        leadId: context.leadId,
        dealershipId: context.dealershipId,
        state: context.state,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    logger.error('Failed to create conversation', {
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation settings
 */
router.patch('/:id', async (req, res) => {
  try {
    const conversationId = conversationIdSchema.parse(req.params.id);
    const updates = updateConversationSchema.parse(req.body);

    const setClauses = [];
    const values = [];

    if (updates.state) {
      setClauses.push('state = ?');
      values.push(updates.state);
    }
    if (updates.maxTurns) {
      setClauses.push('max_turns = ?');
      values.push(updates.maxTurns);
    }
    if (updates.priority !== undefined) {
      setClauses.push('priority = ?');
      values.push(updates.priority);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid updates provided'
      });
    }

    setClauses.push('updated_at = NOW()');

    await db.execute(sql.raw(`
      UPDATE conversations_v2 
      SET ${setClauses.join(', ')}
      WHERE id = '${conversationId}'
    `));

    res.json({
      success: true,
      data: {
        conversationId,
        updated: updates,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }

    logger.error('Failed to update conversation', {
      conversationId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update conversation'
    });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Add a message to conversation (for testing/simulation)
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const conversationId = conversationIdSchema.parse(req.params.id);
    const { role, content, turnNumber } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        error: 'Role and content are required'
      });
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role. Must be user, assistant, or system'
      });
    }

    const messageId = crypto.randomUUID();

    await db.execute(sql`
      INSERT INTO conversation_messages_v2 (
        id, conversation_id, role, content, turn_number, metadata, created_at, updated_at
      ) VALUES (
        ${messageId}, ${conversationId}, ${role}, ${content}, 
        ${turnNumber || 1}, ${JSON.stringify(req.body.metadata || {})}, NOW(), NOW()
      )
    `);

    // Update conversation last activity
    await db.execute(sql`
      UPDATE conversations_v2 
      SET last_activity = NOW(), updated_at = NOW()
      WHERE id = ${conversationId}
    `);

    res.status(201).json({
      success: true,
      data: {
        messageId,
        conversationId,
        role,
        content,
        turnNumber: turnNumber || 1,
        createdAt: new Date().toISOString()
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID format'
      });
    }

    logger.error('Failed to add message to conversation', {
      conversationId: req.params.id,
      error: error instanceof Error ? error.message : String(error),
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

/**
 * GET /api/conversations/orchestrator/queue
 * Get queue status and job information
 */
router.get('/orchestrator/queue', async (req, res) => {
  try {
    // Get queue jobs from database
    const result = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(EXTRACT(EPOCH FROM (NOW() - created_at))) as avg_age_seconds
      FROM conversation_queue_jobs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY status
      ORDER BY status
    `);

    const queueStats = result.rows.reduce((acc: any, row: any) => {
      acc[row.status] = {
        count: parseInt(row.count),
        avgAgeSeconds: parseFloat(row.avg_age_seconds) || 0
      };
      return acc;
    }, {});

    // Get recent jobs
    const recentJobsResult = await db.execute(sql`
      SELECT 
        id, conversation_id, turn_number, job_type, status, 
        attempts, error_message, created_at, started_at, completed_at
      FROM conversation_queue_jobs
      ORDER BY created_at DESC
      LIMIT 20
    `);

    res.json({
      success: true,
      data: {
        stats: queueStats,
        recentJobs: recentJobsResult.rows.map((job: any) => ({
          id: job.id,
          conversationId: job.conversation_id,
          turnNumber: job.turn_number,
          jobType: job.job_type,
          status: job.status,
          attempts: job.attempts,
          errorMessage: job.error_message,
          createdAt: job.created_at,
          startedAt: job.started_at,
          completedAt: job.completed_at
        }))
      }
    });

  } catch (error) {
    logger.error('Failed to get queue status', {
      error: error instanceof Error ? error.message : String(error)
    });

    res.status(500).json({
      success: false,
      error: 'Failed to get queue status'
    });
  }
});

export default router;