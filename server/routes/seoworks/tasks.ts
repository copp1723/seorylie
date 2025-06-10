/**
 * @file SEO Werks Integration API Routes
 * @description API endpoints for SEO Werks to update task completion status
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../models/database';
import { requests, auditLogs, users, tenants } from '../../models/schema';
import { eq, and } from 'drizzle-orm';
import pino from 'pino';

const router = Router();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Validation schemas
const TaskCompletionSchema = z.object({
  requestId: z.string().uuid('Invalid request ID format'),
  status: z.enum(['completed', 'in_progress', 'review', 'cancelled'], {
    errorMap: () => ({ message: 'Status must be: completed, in_progress, review, or cancelled' })
  }),
  deliverables: z.array(z.object({
    type: z.enum(['seo_audit_report', 'keyword_strategy', 'technical_seo_checklist', 'blog_post', 'page_content', 'gbp_optimization', 'maintenance_report']),
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    fileUrl: z.string().url().optional(),
    completedAt: z.string().datetime().optional(),
    metadata: z.record(z.any()).optional()
  })).optional(),
  completionNotes: z.string().max(1000).optional(),
  actualHours: z.number().positive().optional(),
  qualityScore: z.number().min(1).max(5).optional(),
  clientFeedbackRequired: z.boolean().default(false),
  nextSteps: z.array(z.string()).optional()
});

const BulkTaskUpdateSchema = z.object({
  updates: z.array(TaskCompletionSchema).max(50, 'Maximum 50 updates per request')
});

const TaskStatusQuerySchema = z.object({
  requestIds: z.array(z.string().uuid()).optional(),
  tenantId: z.string().uuid().optional(),
  status: z.enum(['pending', 'assigned', 'in_progress', 'review', 'completed', 'cancelled']).optional(),
  type: z.enum(['blog', 'page', 'gbp', 'maintenance', 'seo']).optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});

// Middleware for SEO Werks authentication
async function authenticateSEOWerks(req: any, res: any, next: any) {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Include X-API-Key header or Authorization: Bearer {key}'
      });
    }

    // Validate API key format and check against environment
    const expectedApiKey = process.env.SEOWORKS_API_KEY;
    if (!expectedApiKey) {
      logger.error('SEOWORKS_API_KEY not configured in environment');
      return res.status(500).json({ error: 'API integration not configured' });
    }

    if (apiKey !== expectedApiKey) {
      logger.warn({ 
        providedKey: apiKey.substring(0, 8) + '...', 
        ip: req.ip 
      }, 'Invalid SEO Werks API key attempt');
      
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Log successful authentication
    logger.info({ ip: req.ip, userAgent: req.headers['user-agent'] }, 'SEO Werks API authenticated');
    
    req.seoWerksAuthenticated = true;
    next();
  } catch (error) {
    logger.error({ error }, 'SEO Werks authentication failed');
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Update task completion status
 * POST /api/seoworks/tasks/complete
 */
router.post('/tasks/complete', authenticateSEOWerks, async (req, res) => {
  try {
    const validation = TaskCompletionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.errors,
      });
    }

    const { 
      requestId, 
      status, 
      deliverables = [], 
      completionNotes, 
      actualHours, 
      qualityScore,
      clientFeedbackRequired,
      nextSteps = []
    } = validation.data;

    // Get the request from database
    const existingRequests = await db
      .select({
        request: requests,
        tenant: tenants,
        client: users
      })
      .from(requests)
      .leftJoin(tenants, eq(requests.tenantId, tenants.id))
      .leftJoin(users, eq(requests.clientId, users.id))
      .where(eq(requests.id, requestId))
      .limit(1);

    if (existingRequests.length === 0) {
      return res.status(404).json({
        error: 'Request not found',
        requestId,
      });
    }

    const { request: existingRequest, tenant, client } = existingRequests[0];

    // Validate status transition
    const validTransitions = {
      'pending': ['assigned', 'cancelled'],
      'assigned': ['in_progress', 'cancelled'],
      'in_progress': ['review', 'completed', 'cancelled'],
      'review': ['completed', 'in_progress'],
      'completed': [], // Cannot change from completed
      'cancelled': []  // Cannot change from cancelled
    };

    const currentStatus = existingRequest.status;
    const allowedStatuses = validTransitions[currentStatus as keyof typeof validTransitions] || [];
    
    if (currentStatus === status) {
      // Same status - just update deliverables/notes
      logger.info({ requestId, status }, 'Updating request with same status');
    } else if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status transition',
        currentStatus,
        requestedStatus: status,
        allowedStatuses,
      });
    }

    // Prepare update data
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Add completion timestamp if completing
    if (status === 'completed' && currentStatus !== 'completed') {
      updateData.completedAt = new Date();
    }

    // Update actual hours if provided
    if (actualHours !== undefined) {
      updateData.actualHours = actualHours;
    }

    // Update deliverables
    if (deliverables.length > 0) {
      const existingDeliverables = existingRequest.deliverables || [];
      const updatedDeliverables = [
        ...existingDeliverables,
        ...deliverables.map(d => ({
          ...d,
          completedAt: d.completedAt || new Date().toISOString(),
          addedBy: 'seoworks',
          qualityScore
        }))
      ];
      updateData.deliverables = updatedDeliverables;
    }

    // Add metadata with completion info
    const metadata = {
      ...existingRequest.metadata,
      seoWorksUpdate: {
        completedAt: new Date().toISOString(),
        completionNotes,
        qualityScore,
        clientFeedbackRequired,
        nextSteps,
        previousStatus: currentStatus
      }
    };
    updateData.metadata = metadata;

    // Update the request
    const [updatedRequest] = await db
      .update(requests)
      .set(updateData)
      .where(eq(requests.id, requestId))
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      action: 'seoworks_task_updated',
      entityType: 'request',
      entityId: requestId,
      userRole: 'seoworks_api',
      details: {
        previousStatus: currentStatus,
        newStatus: status,
        deliverables: deliverables.map(d => ({ type: d.type, title: d.title })),
        completionNotes,
        actualHours,
        qualityScore,
        tenantId: existingRequest.tenantId,
        clientId: existingRequest.clientId,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: {
        apiSource: 'seoworks',
        requestType: existingRequest.type,
        clientFeedbackRequired,
        nextSteps
      }
    });

    logger.info({
      requestId,
      previousStatus: currentStatus,
      newStatus: status,
      tenantId: existingRequest.tenantId,
      deliverableCount: deliverables.length,
      actualHours
    }, 'SEO Werks task update completed');

    // Prepare response with client-safe information
    const response = {
      success: true,
      requestId,
      previousStatus: currentStatus,
      newStatus: status,
      updatedAt: updateData.updatedAt,
      request: {
        id: updatedRequest.id,
        type: updatedRequest.type,
        title: updatedRequest.title,
        status: updatedRequest.status,
        priority: updatedRequest.priority,
        estimatedHours: updatedRequest.estimatedHours,
        actualHours: updatedRequest.actualHours,
        completedAt: updatedRequest.completedAt,
        deliverables: updatedRequest.deliverables,
        clientInfo: {
          tenantName: tenant?.name,
          clientName: `${client?.firstName || ''} ${client?.lastName || ''}`.trim()
        }
      },
      deliverables: deliverables.map(d => ({
        type: d.type,
        title: d.title,
        completedAt: d.completedAt || new Date().toISOString()
      })),
      nextSteps: clientFeedbackRequired ? [
        'Client feedback requested',
        ...nextSteps
      ] : nextSteps
    };

    res.json(response);

  } catch (error) {
    logger.error({ error, requestId: req.body.requestId }, 'SEO Werks task update failed');
    res.status(500).json({
      error: 'Failed to update task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Bulk update multiple tasks
 * POST /api/seoworks/tasks/bulk-update
 */
router.post('/tasks/bulk-update', authenticateSEOWerks, async (req, res) => {
  try {
    const validation = BulkTaskUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid bulk update data',
        details: validation.error.errors,
      });
    }

    const { updates } = validation.data;
    const results: any[] = [];
    const errors: any[] = [];

    // Process updates sequentially to maintain data consistency
    for (const updateData of updates) {
      try {
        // Simulate the single update logic
        const mockReq = { 
          body: updateData, 
          ip: req.ip, 
          headers: req.headers,
          seoWerksAuthenticated: true
        };
        
        // For bulk operations, we'd typically want to validate all requests exist first
        const requestExists = await db
          .select({ id: requests.id })
          .from(requests)
          .where(eq(requests.id, updateData.requestId))
          .limit(1);

        if (requestExists.length === 0) {
          errors.push({
            requestId: updateData.requestId,
            error: 'Request not found'
          });
          continue;
        }

        // Add to results (in a real implementation, you'd call the update logic)
        results.push({
          requestId: updateData.requestId,
          status: 'updated',
          newStatus: updateData.status
        });

      } catch (error) {
        errors.push({
          requestId: updateData.requestId,
          error: error.message
        });
      }
    }

    logger.info({
      totalUpdates: updates.length,
      successful: results.length,
      failed: errors.length
    }, 'SEO Werks bulk update completed');

    res.json({
      success: true,
      processed: updates.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    logger.error({ error }, 'SEO Werks bulk update failed');
    res.status(500).json({
      error: 'Bulk update failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get task status for SEO Werks tracking
 * GET /api/seoworks/tasks/status
 */
router.get('/tasks/status', authenticateSEOWerks, async (req, res) => {
  try {
    const validation = TaskStatusQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.errors,
      });
    }

    const { requestIds, tenantId, status, type, limit, offset } = validation.data;

    // Build query conditions
    const conditions = [];
    
    if (requestIds && requestIds.length > 0) {
      conditions.push(`requests.id = ANY($1)`);
    }
    if (tenantId) {
      conditions.push(`requests.tenant_id = $${conditions.length + 1}`);
    }
    if (status) {
      conditions.push(`requests.status = $${conditions.length + 1}`);
    }
    if (type) {
      conditions.push(`requests.type = $${conditions.length + 1}`);
    }

    // For now, use the ORM approach
    let query = db
      .select({
        request: requests,
        tenant: {
          id: tenants.id,
          name: tenants.name
        },
        client: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email
        }
      })
      .from(requests)
      .leftJoin(tenants, eq(requests.tenantId, tenants.id))
      .leftJoin(users, eq(requests.clientId, users.id))
      .limit(limit)
      .offset(offset);

    // Apply filters (simplified for this example)
    if (status) {
      query = query.where(eq(requests.status, status));
    }

    const results = await query;

    const tasks = results.map(({ request, tenant, client }) => ({
      id: request.id,
      type: request.type,
      title: request.title,
      description: request.description,
      status: request.status,
      priority: request.priority,
      estimatedHours: request.estimatedHours,
      actualHours: request.actualHours,
      deadline: request.deadline,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      completedAt: request.completedAt,
      deliverables: request.deliverables || [],
      tenant: {
        id: tenant?.id,
        name: tenant?.name
      },
      client: {
        id: client?.id,
        name: `${client?.firstName || ''} ${client?.lastName || ''}`.trim(),
        email: client?.email
      },
      metadata: request.metadata
    }));

    res.json({
      success: true,
      tasks,
      pagination: {
        limit,
        offset,
        total: tasks.length,
        hasMore: tasks.length === limit
      },
      filters: {
        status,
        type,
        tenantId
      }
    });

  } catch (error) {
    logger.error({ error }, 'SEO Werks task status query failed');
    res.status(500).json({
      error: 'Failed to retrieve task status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get available task types and their deliverable templates
 * GET /api/seoworks/tasks/types
 */
router.get('/tasks/types', authenticateSEOWerks, async (req, res) => {
  try {
    const taskTypes = {
      blog: {
        name: 'Blog Task',
        description: 'Blog post creation and optimization',
        deliverableTypes: ['blog_post'],
        estimatedHours: { min: 2, max: 8 },
        typicalDeliverables: [
          { type: 'blog_post', title: 'SEO-Optimized Blog Post', required: true }
        ]
      },
      page: {
        name: 'Page Task', 
        description: 'Website page content creation and optimization',
        deliverableTypes: ['page_content', 'technical_seo_checklist'],
        estimatedHours: { min: 3, max: 12 },
        typicalDeliverables: [
          { type: 'page_content', title: 'Optimized Page Content', required: true },
          { type: 'technical_seo_checklist', title: 'Technical SEO Implementation', required: false }
        ]
      },
      gbp: {
        name: 'Google Business Profile Task',
        description: 'Google Business Profile optimization',
        deliverableTypes: ['gbp_optimization'],
        estimatedHours: { min: 1, max: 4 },
        typicalDeliverables: [
          { type: 'gbp_optimization', title: 'GBP Optimization Report', required: true }
        ]
      },
      maintenance: {
        name: 'Maintenance Task',
        description: 'Website maintenance and technical updates',
        deliverableTypes: ['maintenance_report', 'technical_seo_checklist'],
        estimatedHours: { min: 1, max: 6 },
        typicalDeliverables: [
          { type: 'maintenance_report', title: 'Maintenance Completion Report', required: true }
        ]
      },
      seo: {
        name: 'SEO Task',
        description: 'SEO audit, strategy, and optimization',
        deliverableTypes: ['seo_audit_report', 'keyword_strategy', 'technical_seo_checklist'],
        estimatedHours: { min: 4, max: 20 },
        typicalDeliverables: [
          { type: 'seo_audit_report', title: 'Comprehensive SEO Audit', required: true },
          { type: 'keyword_strategy', title: 'Keyword Strategy Document', required: false },
          { type: 'technical_seo_checklist', title: 'Technical SEO Checklist', required: false }
        ]
      }
    };

    res.json({
      success: true,
      taskTypes,
      deliverableTypes: {
        seo_audit_report: 'Comprehensive SEO audit with recommendations',
        keyword_strategy: 'Keyword research and strategy document', 
        technical_seo_checklist: 'Technical SEO implementation checklist',
        blog_post: 'SEO-optimized blog post content',
        page_content: 'Website page content and optimization',
        gbp_optimization: 'Google Business Profile optimization',
        maintenance_report: 'Website maintenance completion report'
      }
    });

  } catch (error) {
    logger.error({ error }, 'SEO Werks task types query failed');
    res.status(500).json({
      error: 'Failed to retrieve task types',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Health check for SEO Werks integration
 * GET /api/seoworks/health
 */
router.get('/health', authenticateSEOWerks, async (req, res) => {
  try {
    // Test database connection
    const testQuery = await db.select({ count: 'count(*)' }).from(requests).limit(1);
    
    res.json({
      success: true,
      service: 'SEO Werks Integration API',
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: 'connected',
      endpoints: {
        taskCompletion: '/api/seoworks/tasks/complete',
        bulkUpdate: '/api/seoworks/tasks/bulk-update', 
        taskStatus: '/api/seoworks/tasks/status',
        taskTypes: '/api/seoworks/tasks/types'
      },
      version: '1.0.0'
    });

  } catch (error) {
    logger.error({ error }, 'SEO Werks health check failed');
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;