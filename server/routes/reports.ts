/**
 * @file Reports API Routes - OPTIMIZED
 * @description Automated reporting with shared utilities and lean code
 */

import { Router, Response } from 'express';
import { requireRole } from '../middleware/auth';
import { AuthenticatedRequest } from '../utils/types';
import { sendSuccess, sendError, generateId, logUserAction } from '../utils/responses';
import { createLogger } from '../utils/logger';
import { mockData } from '../utils/mockData';

const router = Router();
const logger = createLogger('reports-api');

/**
 * GET /api/reports/client - Branded client reports
 */
router.get('/client', requireRole(['client']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30d', type = 'overview' } = req.query;

    const reports = mockData.reports.map(report => ({
      ...report,
      branding: req.tenantBranding
    }));

    logUserAction('Client reports accessed', req.user!, {
      period,
      type,
      reportCount: reports.length
    });

    sendSuccess(res, reports, undefined, {
      period,
      type,
      generatedAt: new Date().toISOString(),
      branding: req.tenantBranding
    });

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve reports', {
      error,
      userId: req.user?.id,
      action: 'Client reports retrieval failed'
    }, { branding: req.tenantBranding });
  }
});

/**
 * GET /api/reports/agency - Agency performance reports
 */
router.get('/agency', requireRole(['agency']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { period = '30d' } = req.query;

    const reports = {
      agencyId: req.user?.id,
      period,
      generatedAt: new Date().toISOString(),
      performance: {
        tasksCompleted: 42,
        avgCompletionTime: '2.1 days',
        clientSatisfaction: 4.7,
        onTimeDelivery: '94%',
        qualityScore: 4.6
      },
      clientResults: [
        {
          anonymizedClient: 'client_abc123',
          tenantType: 'automotive_dealership',
          tasksCompleted: 8,
          avgResults: {
            trafficIncrease: '+15%',
            rankingImprovement: '+3.2 positions',
            conversionImprovement: '+12%'
          }
        },
        {
          anonymizedClient: 'client_def456',
          tenantType: 'service_business',
          tasksCompleted: 12,
          avgResults: {
            trafficIncrease: '+22%',
            rankingImprovement: '+5.1 positions',
            conversionImprovement: '+18%'
          }
        }
      ],
      taskBreakdown: { blog: 18, page: 15, gbp: 6, maintenance: 3 },
      trends: {
        completionTimes: [2.3, 2.1, 1.9, 2.4, 2.0, 2.2, 1.8],
        satisfaction: [4.5, 4.6, 4.8, 4.7, 4.6, 4.9, 4.7]
      }
    };

    logUserAction('Agency reports accessed', req.user!, {
      period,
      tasksCompleted: reports.performance.tasksCompleted
    });

    sendSuccess(res, reports);

  } catch (error) {
    sendError(res, 500, 'Failed to retrieve agency reports', {
      error,
      userId: req.user?.id,
      action: 'Agency reports retrieval failed'
    });
  }
});

/**
 * POST /api/reports/generate - Generate new report
 */
router.post('/generate', requireRole(['admin', 'agency']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType, clientId, period, format = 'json' } = req.body;

    if (!reportType || !clientId) {
      return sendError(res, 400, 'Report type and client ID are required');
    }

    const reportId = generateId('report');

    logUserAction('Report generation requested', req.user!, {
      reportId,
      reportType,
      clientId,
      period,
      format
    });

    sendSuccess(res, {
      reportId,
      status: 'generating',
      estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      reportType,
      period,
      format
    }, 'Report generation started');

  } catch (error) {
    sendError(res, 500, 'Failed to generate report', {
      error,
      userId: req.user?.id,
      action: 'Report generation failed'
    });
  }
});

/**
 * GET /api/reports/status/:reportId - Check report status
 */
router.get('/status/:reportId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportId } = req.params;

    const reportStatus = {
      reportId,
      status: 'completed',
      progress: 100,
      generatedAt: new Date().toISOString(),
      downloadUrl: `/api/reports/download/${reportId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    logUserAction('Report status checked', req.user!, {
      reportId,
      status: reportStatus.status
    });

    sendSuccess(res, reportStatus);

  } catch (error) {
    sendError(res, 500, 'Failed to check report status', {
      error,
      userId: req.user?.id,
      action: 'Report status check failed',
      details: { reportId: req.params.reportId }
    });
  }
});

/**
 * GET /api/reports/download/:reportId - Download report
 */
router.get('/download/:reportId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportId } = req.params;

    logUserAction('Report download requested', req.user!, { reportId });

    sendSuccess(res, {
      reportId,
      note: 'In production, this would stream the actual report file'
    }, 'Report download functionality will be implemented with file storage');

  } catch (error) {
    sendError(res, 500, 'Failed to download report', {
      error,
      userId: req.user?.id,
      action: 'Report download failed',
      details: { reportId: req.params.reportId }
    });
  }
});

/**
 * POST /api/reports/schedule - Schedule automated reports
 */
router.post('/schedule', requireRole(['admin', 'client']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType, frequency, recipients, clientId } = req.body;

    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly'];
    if (!validFrequencies.includes(frequency)) {
      return sendError(res, 400, 'Invalid frequency', undefined, { validFrequencies });
    }

    const scheduleId = generateId('schedule');

    logUserAction('Report schedule created', req.user!, {
      scheduleId,
      reportType,
      frequency,
      clientId: clientId || req.user?.tenantId
    });

    sendSuccess(res, {
      scheduleId,
      reportType,
      frequency,
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: 'active'
    }, 'Report schedule created successfully');

  } catch (error) {
    sendError(res, 500, 'Failed to create report schedule', {
      error,
      userId: req.user?.id,
      action: 'Report schedule creation failed'
    });
  }
});

export { router as reportRoutes };