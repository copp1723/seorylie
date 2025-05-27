import { Router, Request, Response } from 'express';
import { agentDashboardService, AgentStatus, HandoverStatus } from '../services/agent-dashboard-service';
import { validateBody, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import logger from '../utils/logger';

const router = Router();

// Validation schemas
const agentIdSchema = z.object({
  agentId: z.string().uuid()
});

const updateStatusSchema = z.object({
  status: z.enum(['online', 'busy', 'away', 'offline'])
});

const claimHandoverSchema = z.object({
  handoverId: z.string().uuid(),
  agentId: z.string().uuid()
});

const updateHandoverSchema = z.object({
  status: z.enum(['in_progress', 'resolved', 'escalated']),
  notes: z.string().optional()
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  isInternal: z.boolean().default(false)
});

const conversationQuerySchema = z.object({
  status: z.enum(['pending', 'claimed', 'in_progress', 'resolved', 'escalated']).optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional()
});

const notificationQuerySchema = z.object({
  unreadOnly: z.string().transform(val => val === 'true').optional(),
  limit: z.string().transform(val => parseInt(val) || 50).optional()
});

/**
 * @swagger
 * tags:
 *   - name: Agent Dashboard
 *     description: Agent dashboard and conversation management endpoints
 */

/**
 * @swagger
 * /api/agent/dashboard/{agentId}:
 *   get:
 *     summary: Get agent dashboard summary
 *     description: Retrieve dashboard summary including active conversations, pending handovers, and notifications
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Agent UUID
 *     responses:
 *       200:
 *         description: Agent dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     agentId:
 *                       type: string
 *                     displayName:
 *                       type: string
 *                     status:
 *                       type: string
 *                     activeConversations:
 *                       type: integer
 *                     pendingHandovers:
 *                       type: integer
 *                     unreadNotifications:
 *                       type: integer
 *       404:
 *         description: Agent not found
 */
router.get('/dashboard/:agentId', async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;

    const dashboard = await agentDashboardService.getAgentDashboard(agentId);
    
    if (!dashboard) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found'
      });
    }

    res.json({
      success: true,
      data: dashboard
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get agent dashboard', err, { agentId: req.params.agentId });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get agent dashboard'
    });
  }
});

/**
 * @swagger
 * /api/agent/{agentId}/conversations:
 *   get:
 *     summary: Get escalated conversations for agent
 *     description: Retrieve conversations that have been escalated to human agents
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, claimed, in_progress, resolved, escalated]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of escalated conversations
 */
router.get('/:agentId/conversations', 
  validateQuery(conversationQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { status, limit } = req.query as any;

      const conversations = await agentDashboardService.getEscalatedConversations(
        agentId,
        status as HandoverStatus,
        limit
      );

      res.json({
        success: true,
        data: conversations,
        count: conversations.length
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get escalated conversations', err, {
        agentId: req.params.agentId
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get escalated conversations'
      });
    }
  }
);

/**
 * @swagger
 * /api/agent/handover/claim:
 *   post:
 *     summary: Claim a conversation handover
 *     description: Agent claims an available handover to start handling the conversation
 *     tags: [Agent Dashboard]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               handoverId:
 *                 type: string
 *                 format: uuid
 *               agentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Handover claimed successfully
 *       400:
 *         description: Handover no longer available
 *       409:
 *         description: Handover already claimed
 */
router.post('/handover/claim',
  validateBody(claimHandoverSchema),
  async (req: Request, res: Response) => {
    try {
      const { handoverId, agentId } = req.body;

      const success = await agentDashboardService.claimHandover(handoverId, agentId);

      res.json({
        success,
        message: 'Handover claimed successfully'
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to claim handover', err, req.body);
      
      if (err.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Handover not found'
        });
      }
      
      if (err.message.includes('no longer available') || err.message.includes('already claimed')) {
        return res.status(409).json({
          success: false,
          error: err.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to claim handover'
      });
    }
  }
);

/**
 * @swagger
 * /api/agent/handover/{handoverId}/status:
 *   put:
 *     summary: Update handover status
 *     description: Update the status of a handover (in_progress, resolved, escalated)
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: handoverId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [in_progress, resolved, escalated]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.put('/handover/:handoverId/status',
  validateBody(updateHandoverSchema),
  async (req: Request, res: Response) => {
    try {
      const { handoverId } = req.params;
      const { status, notes } = req.body;
      
      // Get agent ID from session/auth context
      const agentId = req.headers['x-agent-id'] as string; // This would come from auth middleware
      
      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: 'Agent ID not found in request'
        });
      }

      await agentDashboardService.updateHandoverStatus(handoverId, agentId, status, notes);

      res.json({
        success: true,
        message: 'Handover status updated successfully'
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update handover status', err, {
        handoverId: req.params.handoverId,
        body: req.body
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to update handover status'
      });
    }
  }
);

/**
 * @swagger
 * /api/agent/conversation/{conversationId}/message:
 *   post:
 *     summary: Send message in conversation
 *     description: Agent sends a message or internal note in a conversation
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               isInternal:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Message sent successfully
 */
router.post('/conversation/:conversationId/message',
  validateBody(sendMessageSchema),
  async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const { content, isInternal } = req.body;
      
      const agentId = req.headers['x-agent-id'] as string;
      
      if (!agentId) {
        return res.status(401).json({
          success: false,
          error: 'Agent ID not found in request'
        });
      }

      await agentDashboardService.sendMessage(agentId, conversationId, content, isInternal);

      res.json({
        success: true,
        message: 'Message sent successfully'
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send agent message', err, {
        conversationId: req.params.conversationId,
        body: req.body
      });
      
      if (err.message.includes('does not have access')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied to this conversation'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  }
);

/**
 * @swagger
 * /api/agent/{agentId}/status:
 *   put:
 *     summary: Update agent status
 *     description: Update agent availability status (online, busy, away, offline)
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [online, busy, away, offline]
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.put('/:agentId/status',
  validateBody(updateStatusSchema),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { status } = req.body;

      await agentDashboardService.updateAgentStatus(agentId, status as AgentStatus);

      res.json({
        success: true,
        message: 'Agent status updated successfully'
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to update agent status', err, {
        agentId: req.params.agentId,
        status: req.body.status
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to update agent status'
      });
    }
  }
);

/**
 * @swagger
 * /api/agent/{agentId}/notifications:
 *   get:
 *     summary: Get agent notifications
 *     description: Retrieve notifications for an agent
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/:agentId/notifications',
  validateQuery(notificationQuerySchema),
  async (req: Request, res: Response) => {
    try {
      const { agentId } = req.params;
      const { unreadOnly, limit } = req.query as any;

      const notifications = await agentDashboardService.getAgentNotifications(
        agentId,
        unreadOnly,
        limit
      );

      res.json({
        success: true,
        data: notifications,
        count: notifications.length
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to get agent notifications', err, {
        agentId: req.params.agentId
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to get notifications'
      });
    }
  }
);

/**
 * @swagger
 * /api/agent/notification/{notificationId}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: Mark a specific notification as read
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.put('/notification/:notificationId/read', async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const agentId = req.headers['x-agent-id'] as string;
    
    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Agent ID not found in request'
      });
    }

    await agentDashboardService.markNotificationAsRead(notificationId, agentId);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to mark notification as read', err, {
      notificationId: req.params.notificationId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * @swagger
 * /api/agent/conversation/{conversationId}/history:
 *   get:
 *     summary: Get conversation history
 *     description: Get complete conversation history including agent notes
 *     tags: [Agent Dashboard]
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Conversation history with agent notes
 */
router.get('/conversation/:conversationId/history', async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.conversationId);
    const agentId = req.headers['x-agent-id'] as string;
    
    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: 'Agent ID not found in request'
      });
    }

    const history = await agentDashboardService.getConversationHistory(conversationId, agentId);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get conversation history', err, {
      conversationId: req.params.conversationId
    });
    
    if (err.message.includes('does not have access')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this conversation'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get conversation history'
    });
  }
});

export default router;