import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AdfService } from '../services/adf-service';
import { AdfParser } from '../services/adf-parser';
import logger from '../utils/logger';
import db from '../db';
import { eq, desc, and, gte } from 'drizzle-orm';
// import { adfLeads, adfEmailQueue, adfProcessingLogs } from '../../shared/adf-schema';
import { leads as adfLeads } from '../../shared/schema';

const router = Router();

// Initialize ADF parser for manual processing
const adfParser = new AdfParser();

/**
 * Get ADF service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // This would normally come from a singleton ADF service instance
    const status = {
      isRunning: true, // Would check actual service status
      emailListenerConnected: true, // Would check actual email listener
      totalLeadsProcessed: 0, // Would query database
      lastProcessedLead: null, // Would query database
      currentQueueSize: 0 // Would query database
    };

    // Get actual queue size
    const queueSize = await db.select({ count: db.count() })
      .from(adfEmailQueue)
      .where(eq(adfEmailQueue.processingStatus, 'pending'));

    status.currentQueueSize = queueSize[0]?.count || 0;

    // Get total processed leads
    const totalProcessed = await db.select({ count: db.count() })
      .from(adfLeads);

    status.totalLeadsProcessed = totalProcessed[0]?.count || 0;

    // Get last processed lead
    const lastLead = await db.query.adfLeads.findFirst({
      orderBy: [desc(adfLeads.processedAt)],
      columns: { processedAt: true }
    });

    status.lastProcessedLead = lastLead?.processedAt || null;

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting ADF service status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

/**
 * Get recent ADF leads with optional filtering
 */
router.get('/leads', [
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('dealershipId').optional().isInt(),
  query('status').optional().isString(),
  query('since').optional().isISO8601()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const dealershipId = req.query.dealershipId ? parseInt(req.query.dealershipId as string) : undefined;
    const status = req.query.status as string;
    const since = req.query.since ? new Date(req.query.since as string) : undefined;

    let whereConditions = [];

    if (dealershipId) {
      whereConditions.push(eq(adfLeads.dealershipId, dealershipId));
    }

    if (status) {
      whereConditions.push(eq(adfLeads.leadStatus, status as any));
    }

    if (since) {
      whereConditions.push(gte(adfLeads.createdAt, since));
    }

    const leads = await db.query.adfLeads.findMany({
      where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
      orderBy: [desc(adfLeads.createdAt)],
      limit,
      with: {
        dealership: {
          columns: { id: true, name: true }
        }
      }
    });

    res.json({
      success: true,
      data: leads,
      meta: {
        count: leads.length,
        limit
      }
    });
  } catch (error) {
    logger.error('Error fetching ADF leads', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leads'
    });
  }
});

/**
 * Get specific ADF lead by ID
 */
router.get('/leads/:id', [
  param('id').isInt()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const leadId = parseInt(req.params.id);

    const lead = await db.query.adfLeads.findFirst({
      where: eq(adfLeads.id, leadId),
      with: {
        dealership: {
          columns: { id: true, name: true }
        },
        processingLogs: {
          orderBy: [desc(adfProcessingLogs.createdAt)]
        }
      }
    });

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    res.json({
      success: true,
      data: lead
    });
  } catch (error) {
    logger.error('Error fetching ADF lead', { error, leadId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch lead'
    });
  }
});

/**
 * Update ADF lead status
 */
router.patch('/leads/:id/status', [
  param('id').isInt(),
  body('status').isIn(['new', 'contacted', 'qualified', 'unqualified', 'closed']),
  body('notes').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const leadId = parseInt(req.params.id);
    const { status, notes } = req.body;

    // Check if lead exists
    const existingLead = await db.query.adfLeads.findFirst({
      where: eq(adfLeads.id, leadId),
      columns: { id: true, leadStatus: true }
    });

    if (!existingLead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Update lead status
    await db.update(adfLeads)
      .set({
        leadStatus: status,
        updatedAt: new Date()
      })
      .where(eq(adfLeads.id, leadId));

    // Log the status change
    await db.insert(adfProcessingLogs).values({
      adfLeadId: leadId,
      processStep: 'status_update',
      status: 'success',
      message: `Status updated from ${existingLead.leadStatus} to ${status}`,
      errorDetails: { notes, updatedBy: 'api' }
    });

    logger.info('ADF lead status updated', { leadId, oldStatus: existingLead.leadStatus, newStatus: status, notes });

    res.json({
      success: true,
      message: 'Lead status updated successfully'
    });
  } catch (error) {
    logger.error('Error updating ADF lead status', { error, leadId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to update lead status'
    });
  }
});

/**
 * Manually process ADF XML content
 */
router.post('/process-xml', [
  body('xmlContent').isString().notEmpty(),
  body('source').optional().isString(),
  body('emailFrom').optional().isEmail(),
  body('subject').optional().isString()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { xmlContent, source, emailFrom, subject } = req.body;

    // Parse and process the ADF XML
    const result = await adfParser.parseAdfXml(xmlContent);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'ADF XML parsing failed',
        details: result.errors
      });
    }

    // Store the lead if parsing was successful
    if (result.mappedLead) {
      // Add metadata
      result.mappedLead.sourceEmailFrom = emailFrom;
      result.mappedLead.sourceEmailSubject = subject;
      result.mappedLead.sourceEmailId = `manual-${Date.now()}-${source || 'api'}`;

      // Check for duplicates
      const existingLead = await db.query.adfLeads.findFirst({
        where: eq(adfLeads.deduplicationHash, result.mappedLead.deduplicationHash!),
        columns: { id: true }
      });

      if (existingLead) {
        return res.json({
          success: true,
          isDuplicate: true,
          leadId: existingLead.id,
          message: 'Duplicate lead detected',
          warnings: result.warnings
        });
      }

      // Store the lead
      const [newLead] = await db.insert(adfLeads).values(result.mappedLead as any).returning({ id: adfLeads.id });

      logger.info('Manual ADF XML processed successfully', {
        leadId: newLead.id,
        source,
        customerName: result.mappedLead.customerFullName
      });

      res.json({
        success: true,
        isDuplicate: false,
        leadId: newLead.id,
        message: 'ADF lead processed successfully',
        warnings: result.warnings
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to extract lead data from ADF XML'
      });
    }
  } catch (error) {
    logger.error('Error processing manual ADF XML', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to process ADF XML'
    });
  }
});

/**
 * Get processing statistics
 */
router.get('/stats', [
  query('timeframe').optional().isIn(['hour', 'day', 'week'])
], async (req: Request, res: Response) => {
  try {
    const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week') || 'day';

    const now = new Date();
    let startDate = new Date();

    switch (timeframe) {
      case 'hour':
        startDate.setHours(now.getHours() - 1);
        break;
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
    }

    // Get statistics
    const [totalLeads, processedLeads, failedLeads, emailsInQueue] = await Promise.all([
      db.select({ count: db.count() })
        .from(adfLeads)
        .where(gte(adfLeads.createdAt, startDate)),

      db.select({ count: db.count() })
        .from(adfLeads)
        .where(and(
          eq(adfLeads.processingStatus, 'processed'),
          gte(adfLeads.createdAt, startDate)
        )),

      db.select({ count: db.count() })
        .from(adfLeads)
        .where(and(
          eq(adfLeads.processingStatus, 'failed'),
          gte(adfLeads.createdAt, startDate)
        )),

      db.select({ count: db.count() })
        .from(adfEmailQueue)
        .where(eq(adfEmailQueue.processingStatus, 'pending'))
    ]);

    // Get recent errors
    const recentErrors = await db.query.adfProcessingLogs.findMany({
      where: and(
        eq(adfProcessingLogs.status, 'error'),
        gte(adfProcessingLogs.createdAt, startDate)
      ),
      orderBy: [desc(adfProcessingLogs.createdAt)],
      limit: 10,
      columns: { message: true, createdAt: true }
    });

    const stats = {
      timeframe,
      totalLeads: totalLeads[0]?.count || 0,
      processedLeads: processedLeads[0]?.count || 0,
      failedLeads: failedLeads[0]?.count || 0,
      emailsInQueue: emailsInQueue[0]?.count || 0,
      successRate: totalLeads[0]?.count ?
        ((processedLeads[0]?.count || 0) / totalLeads[0].count * 100).toFixed(2) + '%' :
        '0%',
      recentErrors: recentErrors.map(error => ({
        message: error.message,
        timestamp: error.createdAt
      }))
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching ADF statistics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * Get email processing queue
 */
router.get('/queue', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'processed', 'failed', 'quarantined'])
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as string;

    let whereCondition = undefined;
    if (status) {
      whereCondition = eq(adfEmailQueue.processingStatus, status as any);
    }

    const queueEntries = await db.query.adfEmailQueue.findMany({
      where: whereCondition,
      orderBy: [desc(adfEmailQueue.createdAt)],
      limit,
      with: {
        resultingLead: {
          columns: { id: true, customerFullName: true, leadStatus: true }
        }
      }
    });

    res.json({
      success: true,
      data: queueEntries,
      meta: {
        count: queueEntries.length,
        limit
      }
    });
  } catch (error) {
    logger.error('Error fetching email queue', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email queue'
    });
  }
});

/**
 * Retry failed email processing
 */
router.post('/queue/:id/retry', [
  param('id').isInt()
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const queueId = parseInt(req.params.id);

    // Check if queue entry exists and is retryable
    const queueEntry = await db.query.adfEmailQueue.findFirst({
      where: eq(adfEmailQueue.id, queueId),
      columns: { id: true, processingStatus: true, processingAttempts: true, maxRetries: true }
    });

    if (!queueEntry) {
      return res.status(404).json({
        success: false,
        error: 'Queue entry not found'
      });
    }

    if (queueEntry.processingAttempts >= queueEntry.maxRetries) {
      return res.status(400).json({
        success: false,
        error: `Maximum retry attempts (${queueEntry.maxRetries}) exceeded`
      });
    }

    // Reset processing status to pending for retry
    await db.update(adfEmailQueue)
      .set({
        processingStatus: 'pending',
        processingAttempts: queueEntry.processingAttempts + 1,
        updatedAt: new Date()
      })
      .where(eq(adfEmailQueue.id, queueId));

    logger.info('Email processing retry initiated', { queueId, attempt: queueEntry.processingAttempts + 1 });

    res.json({
      success: true,
      message: 'Retry initiated successfully'
    });
  } catch (error) {
    logger.error('Error initiating retry', { error, queueId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to initiate retry'
    });
  }
});

export default router;