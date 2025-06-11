/**
 * @file Admin API Routes - OPTIMIZED
 * @description System administration with shared utilities and lean code
 */

import { Router, Response } from 'express';
import { requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../utils/types';
import { sendSuccess, sendError, logUserAction } from '../utils/responses';
import { createLogger } from '../utils/logger';
import { mockData, getFilteredData } from '../utils/mockData';

const router = Router();
const logger = createLogger('admin-api');

router.use(requireRole(['admin']));

/**
 * GET /api/admin/system/health - System health
 */
router.get('/system/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: { status: 'healthy', responseTime: '15ms' },
        redis: { status: 'healthy', responseTime: '3ms' },
        aiProxy: { status: 'healthy', processed: 1247 },
        authentication: { status: 'healthy', activeUsers: 23 }
      },
      metrics: {
        totalRequests: 15847,
        activeClients: 156,
        activeAgencies: 12,
        pendingTasks: 34,
        completedTasksToday: 89,
        systemUptime: '72h 15m',
        memoryUsage: '67%',
        cpuUsage: '23%'
      }
    };

    logUserAction('System health check performed', req.user!, {
      systemStatus: health.status
    });

    sendSuccess(res, health);

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve system health', {
      error,
      userId: req.user?.id,
      action: 'System health check failed'
    });
  }
});

/**
 * GET /api/admin/users - Get all users
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, status, search } = req.query;
    const filteredUsers = getFilteredData(mockData.users, { role, status });

    logUserAction('Admin users list accessed', req.user!, {
      totalUsers: filteredUsers.length,
      filters: { role, status, search }
    });

    sendSuccess(res, filteredUsers, undefined, {
      total: filteredUsers.length,
      filters: { role, status, search }
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve users', {
      error,
      userId: req.user?.id,
      action: 'Admin users retrieval failed'
    });
  }
});

/**
 * GET /api/admin/tasks - Get all system tasks
 */
router.get('/tasks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, agency, client } = req.query;
    
    // Mock admin task data (with full visibility)
    const adminTasks = [
      {
        taskId: 'task_1',
        type: 'blog',
        status: 'completed',
        clientId: 'user_1',
        clientEmail: 'client1@dealership.com',
        agencyId: 'user_2',
        agencyEmail: 'agency1@seopartner.com',
        tenantName: 'Metro Auto Dealership',
        createdAt: '2025-06-07T10:00:00Z',
        completedAt: '2025-06-08T14:30:00Z',
        deadline: '2025-06-10T17:00:00Z',
        completionTime: '1.4 days'
      }
    ];

    const filteredTasks = getFilteredData(adminTasks, { status, type, agency, client });

    logUserAction('Admin tasks overview accessed', req.user!, {
      totalTasks: filteredTasks.length,
      filters: { status, type, agency, client }
    });

    sendSuccess(res, filteredTasks, undefined, {
      total: filteredTasks.length,
      filters: { status, type, agency, client }
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve tasks', {
      error,
      userId: req.user?.id,
      action: 'Admin tasks retrieval failed'
    });
  }
});

/**
 * GET /api/admin/audit - System audit logs
 */
router.get('/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, action, userId } = req.query;
    const filteredLogs = getFilteredData(mockData.auditLogs, { action, userId });

    logUserAction('Admin audit logs accessed', req.user!, {
      logCount: filteredLogs.length,
      filters: { startDate, endDate, action, userId }
    });

    sendSuccess(res, filteredLogs, undefined, {
      total: filteredLogs.length,
      filters: { startDate, endDate, action, userId }
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve audit logs', {
      error,
      userId: req.user?.id,
      action: 'Admin audit logs retrieval failed'
    });
  }
});

/**
 * POST /api/admin/users/:userId/status - Update user status
 */
router.post('/users/:userId/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'Invalid status', undefined, { validStatuses });
    }

    logUserAction('Admin user status update', req.user!, {
      targetUserId: userId,
      newStatus: status,
      reason: reason || 'No reason provided'
    });

    sendSuccess(res, {
      userId,
      status,
      reason: reason || null,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.id
    }, `User status updated to: ${status}`);

  } catch (error) {
    sendError(res, 500, 'Failed to update user status', {
      error,
      userId: req.user?.id,
      action: 'Admin user status update failed',
      details: { targetUserId: req.params.userId }
    });
  }
});

/**
 * GET /api/admin/analytics - System analytics
 */
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30d' } = req.query;

    const analytics = {
      period,
      generated: new Date().toISOString(),
      overview: {
        totalClients: 156,
        activeClients: 134,
        totalAgencies: 12,
        activeAgencies: 11,
        totalRequests: 2847,
        completedTasks: 2654,
        avgCompletionTime: '2.3 days',
        clientSatisfaction: 4.6
      },
      trends: {
        newClients: [5, 8, 12, 6, 9, 11, 7],
        taskCompletions: [23, 31, 28, 35, 29, 33, 27],
        responseTime: [2.1, 2.3, 1.9, 2.5, 2.2, 2.0, 2.4]
      },
      taskTypes: { blog: 45, page: 30, gbp: 15, maintenance: 10 },
      agencyPerformance: [
        {
          agencyId: 'agency_1',
          name: 'SEO Pro Agency',
          tasksCompleted: 234,
          avgCompletionTime: '2.1 days',
          satisfaction: 4.8
        },
        {
          agencyId: 'agency_2',
          name: 'Digital Marketing Experts',
          tasksCompleted: 189,
          avgCompletionTime: '2.5 days',
          satisfaction: 4.5
        }
      ]
    };

    logUserAction('Admin analytics accessed', req.user!, { period });

    sendSuccess(res, analytics);

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve analytics', {
      error,
      userId: req.user?.id,
      action: 'Admin analytics retrieval failed'
    });
  }
});

export { router as adminRoutes };