/**
 * @file Agency API Routes - OPTIMIZED
 * @description Agency-facing endpoints with complete anonymization and lean code
 */

import { Router, Response } from 'express';
import { requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../utils/types';
import { sendSuccess, sendError, generateId, logUserAction } from '../utils/responses';
import { createLogger } from '../utils/logger';
import { mockData, getFilteredData } from '../utils/mockData';

const router = Router();
const logger = createLogger('agency-api');

router.use(requireRole(['agency']));

/**
 * GET /api/agency/tasks - Get anonymized tasks
 */
router.get('/tasks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, priority } = req.query;
    const filteredTasks = getFilteredData(mockData.tasks, { status, type, priority });

    const summary = {
      assigned: mockData.tasks.filter(t => t.status === 'assigned').length,
      in_progress: mockData.tasks.filter(t => t.status === 'in_progress').length,
      completed: mockData.tasks.filter(t => t.status === 'completed').length,
      overdue: mockData.tasks.filter(t => new Date(t.deadline!) < new Date()).length
    };

    logUserAction('Agency tasks retrieved', req.user!, {
      totalTasks: filteredTasks.length,
      filters: { status, type, priority }
    });

    sendSuccess(res, filteredTasks, undefined, {
      total: filteredTasks.length,
      filters: { status, type, priority },
      summary
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve tasks', {
      error,
      userId: req.user?.id,
      action: 'Agency tasks retrieval failed'
    });
  }
});

/**
 * GET /api/agency/task/:taskId - Get task details
 */
router.get('/task/:taskId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = mockData.tasks.find(t => t.taskId === taskId);

    if (!task) {
      return sendError(res, 404, 'Task not found');
    }

    // Enhanced task with detailed info (still anonymized)
    const detailedTask = {
      ...task,
      deliverables: [
        'SEO-optimized content',
        'Meta title and description',
        'Suggested internal linking strategy',
        'Featured image recommendations'
      ],
      messages: [
        {
          id: 'msg_task_1',
          content: `Task assigned: Create ${task.type}`,
          timestamp: task.assignedAt,
          type: 'system'
        }
      ]
    };

    logUserAction('Agency task details retrieved', req.user!, {
      taskId,
      taskType: task.type
    });

    sendSuccess(res, detailedTask);

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve task details', {
      error,
      userId: req.user?.id,
      action: 'Agency task details retrieval failed',
      details: { taskId: req.params.taskId }
    });
  }
});

/**
 * POST /api/agency/task/:taskId/respond - Agency task response
 */
router.post('/task/:taskId/respond', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { message, status, files, deliverable } = req.body;

    if (!message?.trim()) {
      return sendError(res, 400, 'Response message is required');
    }

    const response = {
      id: generateId('resp'),
      taskId,
      agencyId: req.user?.id,
      message: message.trim(),
      status: status || 'updated',
      files: files || [],
      deliverable: deliverable || null,
      timestamp: new Date().toISOString(),
      processedByAI: req.processedByAI
    };

    logUserAction('Agency task response submitted', req.user!, {
      responseId: response.id,
      taskId,
      newStatus: status,
      hasFiles: files?.length > 0,
      hasDeliverable: !!deliverable
    });

    sendSuccess(res, {
      responseId: response.id,
      taskId,
      status: response.status,
      timestamp: response.timestamp
    }, 'Your response has been submitted and will be processed');

  } catch (error) {
    sendError(res, 500, 'Failed to submit response', {
      error,
      userId: req.user?.id,
      action: 'Agency task response failed',
      details: { taskId: req.params.taskId }
    });
  }
});

/**
 * POST /api/agency/task/:taskId/status - Update task status
 */
router.post('/task/:taskId/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['assigned', 'in_progress', 'review', 'completed', 'on_hold'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'Invalid status', undefined, { validStatuses });
    }

    logUserAction('Agency task status updated', req.user!, {
      taskId,
      newStatus: status,
      hasNotes: !!notes
    });

    sendSuccess(res, {
      taskId,
      status,
      updatedAt: new Date().toISOString(),
      notes: notes || null
    }, `Task status updated to: ${status}`);

  } catch (error) {
    sendError(res, 500, 'Failed to update task status', {
      error,
      userId: req.user?.id,
      action: 'Agency task status update failed',
      details: { taskId: req.params.taskId }
    });
  }
});

/**
 * GET /api/agency/dashboard - Agency dashboard
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const dashboard = {
      tasksSummary: {
        total: 15,
        assigned: 3,
        in_progress: 7,
        review: 2,
        completed: 3,
        overdue: 1
      },
      deadlines: { today: 2, thisWeek: 5, nextWeek: 4, later: 4 },
      performance: {
        completionRate: 92,
        averageDeliveryTime: '2.3 days',
        clientSatisfaction: 4.7,
        tasksCompletedThisMonth: 28
      },
      recentActivity: [
        {
          id: 'activity_1',
          type: 'task_completed',
          description: 'Blog post delivered for client_abc123',
          timestamp: '2025-06-08T14:30:00Z'
        },
        {
          id: 'activity_2',
          type: 'task_assigned',
          description: 'New page creation task assigned',
          timestamp: '2025-06-08T10:15:00Z'
        }
      ]
    };

    logUserAction('Agency dashboard accessed', req.user!, {
      totalTasks: dashboard.tasksSummary.total
    });

    sendSuccess(res, dashboard, undefined, {
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve dashboard data', {
      error,
      userId: req.user?.id,
      action: 'Agency dashboard retrieval failed'
    });
  }
});

export { router as agencyRoutes };