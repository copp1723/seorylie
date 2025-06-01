import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { AdfService } from '../services/adf-service';
import { AdfParser } from '../services/adf-parser';
import logger from '../utils/logger';
import db from '../db';
import { eq, desc, and, gte, or, like, count } from 'drizzle-orm';
import { adfLeads, adfEmailQueue, adfProcessingLogs } from '../../shared/index';
import { validateBodySize, validateContentType } from '../middleware/validation';
import rateLimit from 'express-rate-limit';
import { prometheusMetricsService } from '../services/prometheus-metrics';
// import { dealershipEmailConfigs } from '../../shared/schema-resolver'; // Commented out - table doesn't exist

const router = Router();

// ADF Lead Ingestion Rate Limiter (30 requests per minute per IP)
const adfLeadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'ADF lead ingestion rate limit exceeded',
    message: 'Maximum 30 requests per minute allowed',
    retryAfter: '60 seconds'
  },
  keyGenerator: (req) => req.ip, // Rate limit by IP address
  handler: (req, res) => {
    logger.warn('ADF lead ingestion rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    // Record rate limit metric
    prometheusMetricsService.adfRateLimitExceeded.inc({
      endpoint: '/api/adf/lead',
      ip: req.ip
    });

    res.status(429).json({
      success: false,
      error: 'ADF lead ingestion rate limit exceeded',
      message: 'Maximum 30 requests per minute allowed',
      retryAfter: '60 seconds'
    });
  }
});

// Initialize ADF parser for manual processing
const adfParser = new AdfParser();

/**
 * Determine which dealership an email belongs to
 * Used by SendGrid webhook to route emails correctly
 */
async function getDealershipFromEmail(toEmail: string, fromEmail: string): Promise<number | null> {
  try {
    // Extract domain from 'to' email (e.g., leads@adf-johndoe-motors.cleanrylie.com)
    const toDomain = toEmail.split('@')[1]?.toLowerCase();
    const fromDomain = fromEmail.split('@')[1]?.toLowerCase();

    if (!toDomain) {
      return null;
    }

    // Look up dealership by email configuration (commented out - table doesn't exist)
    const dealershipConfig = null; // TODO: Implement dealership email configs
    /*
    const dealershipConfig = await db.query.dealershipEmailConfigs.findFirst({
      where: or(
        eq(dealershipEmailConfigs.emailAddress, toEmail.toLowerCase()),
        eq(dealershipEmailConfigs.emailDomain, toDomain),
        like(dealershipEmailConfigs.emailAddress, `%@${toDomain}`)
      ),
      columns: { dealershipId: true, emailAddress: true, emailDomain: true }
    });
    */

    if (dealershipConfig) {
      logger.info('Dealership found for email', {
        dealershipId: dealershipConfig.dealershipId,
        toEmail,
        configuredEmail: dealershipConfig.emailAddress
      });
      return dealershipConfig.dealershipId;
    }

    // Fallback: Check if domain follows our SendGrid hostname pattern
    // Pattern: adf-{dealership-identifier}.cleanrylie.com
    if (toDomain.includes('.cleanrylie.com') && toDomain.startsWith('adf-')) {
      const identifier = toDomain.replace('adf-', '').replace('.cleanrylie.com', '');
      
      // Look up by domain pattern (this would need additional logic based on your setup)
      logger.info('Attempting to find dealership by domain pattern', {
        identifier,
        toDomain
      });
    }

    logger.warn('No dealership configuration found for email', {
      toEmail,
      fromEmail,
      toDomain,
      fromDomain
    });

    return null;
  } catch (error) {
    logger.error('Error determining dealership from email', {
      error: error instanceof Error ? error.message : String(error),
      toEmail,
      fromEmail
    });
    return null;
  }
}

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
    const queueSize = await db.select({ count: count() })
      .from(adfEmailQueue)
      .where(eq(adfEmailQueue.processingStatus, 'pending'));

    status.currentQueueSize = queueSize[0]?.count || 0;

    // Get total processed leads
    const totalProcessed = await db.select({ count: count() })
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
 * ADF Lead Ingestion Endpoint (ADF-W03)
 * POST /api/adf/lead
 *
 * Primary endpoint for ADF lead ingestion with comprehensive validation,
 * rate limiting, XXE protection, and Prometheus metrics.
 *
 * Features:
 * - 500KB size limit validation
 * - Rate limiting (30 req/min/IP)
 * - XXE protection via XML parser configuration
 * - V2/V1 parser fallback
 * - Prometheus metrics (adf_ingest_success_total, adf_parse_failure_total, adf_ingest_duration_seconds)
 */
router.post('/lead', [
  adfLeadRateLimiter, // Rate limiting: 30 req/min/IP
  validateContentType(['application/xml', 'text/xml', 'application/json']), // Accept XML and JSON
  validateBodySize(500 * 1024), // 500KB size limit
  body('xml').optional().isString().notEmpty(),
  body('xmlContent').optional().isString().notEmpty(),
  body('source').optional().isString().default('api'),
  body('dealershipId').optional().isInt()
], async (req: Request, res: Response) => {
  const startTime = Date.now();
  let xmlContent: string;
  let source: string = req.body.source || 'api';
  let dealershipId: string | undefined = req.body.dealershipId?.toString();

  try {
    // Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      prometheusMetricsService.adfParseFailureTotal.inc({
        dealership_id: dealershipId || 'unknown',
        error_type: 'validation_error',
        parser_version: 'validation'
      });

      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    // Extract XML content from request
    if (req.get('content-type')?.includes('xml')) {
      // Raw XML in request body
      xmlContent = req.body.toString();
    } else {
      // JSON payload with XML content
      xmlContent = req.body.xml || req.body.xmlContent;
    }

    if (!xmlContent) {
      prometheusMetricsService.adfParseFailureTotal.inc({
        dealership_id: dealershipId || 'unknown',
        error_type: 'missing_xml',
        parser_version: 'validation'
      });

      return res.status(400).json({
        success: false,
        error: 'Missing XML content',
        message: 'Provide XML content in request body or as "xml"/"xmlContent" field',
        timestamp: new Date().toISOString()
      });
    }

    // XXE Protection: XML parser is configured with secure defaults in AdfParser
    // processEntities: true with htmlEntities: true provides safe entity processing
    // ignoreNameSpace: false prevents namespace-based XXE attacks

    logger.info('ADF lead ingestion request received', {
      source,
      xmlLength: xmlContent.length,
      dealershipId,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Initialize ADF service for processing
    const adfService = new AdfService();

    // Process ADF XML with V2/V1 fallback
    const result = await adfService.processAdfXml(xmlContent, source, dealershipId);

    const processingTime = Date.now() - startTime;

    // Record processing duration metric
    prometheusMetricsService.adfIngestDurationSeconds.observe({
      dealership_id: dealershipId || 'unknown',
      parser_version: result.parserUsed || 'unknown',
      status: result.success ? 'success' : 'failure'
    }, processingTime / 1000);

    if (result.success) {
      // Record success metric
      prometheusMetricsService.adfIngestSuccessTotal.inc({
        dealership_id: dealershipId || 'unknown',
        source_provider: source,
        parser_version: result.parserUsed || 'unknown'
      });

      logger.info('ADF lead ingestion successful', {
        leadId: result.leadId,
        source,
        dealershipId,
        processingTime,
        parserUsed: result.parserUsed,
        isDuplicate: result.isDuplicate
      });

      return res.status(result.isDuplicate ? 200 : 201).json({
        success: true,
        data: {
          leadId: result.leadId,
          isDuplicate: result.isDuplicate,
          parserUsed: result.parserUsed,
          processingTime: `${processingTime}ms`
        },
        message: result.isDuplicate ? 'Duplicate lead detected' : 'ADF lead processed successfully',
        warnings: result.warnings || [],
        timestamp: new Date().toISOString()
      });
    } else {
      // Record failure metric
      prometheusMetricsService.adfParseFailureTotal.inc({
        dealership_id: dealershipId || 'unknown',
        error_type: 'processing_error',
        parser_version: result.parserUsed || 'unknown'
      });

      logger.error('ADF lead ingestion failed', {
        source,
        dealershipId,
        processingTime,
        errors: result.errors,
        parserUsed: result.parserUsed
      });

      return res.status(400).json({
        success: false,
        error: 'ADF lead processing failed',
        details: result.errors || ['Unknown processing error'],
        warnings: result.warnings || [],
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Record failure metric
    prometheusMetricsService.adfParseFailureTotal.inc({
      dealership_id: dealershipId || 'unknown',
      error_type: 'system_error',
      parser_version: 'unknown'
    });

    logger.error('ADF lead ingestion system error', {
      error: errorMessage,
      source,
      dealershipId,
      processingTime,
      ip: req.ip
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error during ADF processing',
      message: 'Please try again later or contact support',
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
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
      db.select({ count: count() })
        .from(adfLeads)
        .where(gte(adfLeads.createdAt, startDate)),

      db.select({ count: count() })
        .from(adfLeads)
        .where(and(
          eq(adfLeads.processingStatus, 'processed'),
          gte(adfLeads.createdAt, startDate)
        )),

      db.select({ count: count() })
        .from(adfLeads)
        .where(and(
          eq(adfLeads.processingStatus, 'failed'),
          gte(adfLeads.createdAt, startDate)
        )),

      db.select({ count: count() })
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

/**
 * Verify SendGrid webhook signature for security
 */
const verifySendGridSignature = (req: Request, res: Response, next: any) => {
  const signature = req.get('X-Twilio-Email-Event-Webhook-Signature');
  const timestamp = req.get('X-Twilio-Email-Event-Webhook-Timestamp');

  // In production, you should verify the signature
  // For now, we'll just log and continue
  if (signature && timestamp) {
    logger.info('SendGrid webhook signature received', {
      hasSignature: !!signature,
      timestamp
    });
  } else {
    logger.warn('SendGrid webhook received without signature - ensure webhook security is configured');
  }

  next();
};

/**
 * Middleware to handle SendGrid webhook raw body parsing
 */
const parseWebhookBody = (req: Request, res: Response, next: any) => {
  // SendGrid sends multipart/form-data, Express should handle this automatically
  // But we may need to handle large attachments
  if (req.get('content-type')?.includes('multipart/form-data')) {
    // Express with body-parser should handle this
    next();
  } else {
    res.status(400).json({ error: 'Expected multipart/form-data content type' });
  }
};

/**
 * SendGrid Inbound Parse Webhook
 * Receives emails with ADF attachments via SendGrid webhook
 * CRITICAL: Integrates with DLS dealership routing
 */
router.post('/webhook/sendgrid-inbound', verifySendGridSignature, parseWebhookBody, async (req: Request, res: Response) => {
  try {
    logger.info('Received SendGrid inbound email webhook', {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject,
      attachments: req.body.attachments || 0
    });

    // CRITICAL: Determine which dealership this email belongs to
    const dealershipId = await getDealershipFromEmail(req.body.to, req.body.from);
    
    if (!dealershipId) {
      logger.warn('No dealership found for incoming email', {
        to: req.body.to,
        from: req.body.from,
        subject: req.body.subject
      });
      return res.status(200).json({ 
        success: true, 
        message: 'Email processed but no matching dealership found' 
      });
    }

    // Extract email data from SendGrid webhook payload
    const emailData = {
      from: req.body.from,
      to: req.body.to,
      subject: req.body.subject,
      text: req.body.text,
      html: req.body.html,
      attachments: [],
      dealershipId // Add dealership context
    };

    // Process attachments looking for ADF XML files
    const attachmentCount = parseInt(req.body.attachments) || 0;
    const xmlAttachments = [];

    for (let i = 1; i <= attachmentCount; i++) {
      const attachmentInfo = req.body[`attachment-info${i}`];
      const attachmentData = req.body[`attachment${i}`];

      if (attachmentInfo && attachmentData) {
        const info = JSON.parse(attachmentInfo);

        // Check if it's an XML file (potential ADF)
        if (info.filename?.toLowerCase().endsWith('.xml') ||
            info.type?.includes('xml')) {
          xmlAttachments.push({
            filename: info.filename,
            content: Buffer.from(attachmentData, 'base64'),
            contentType: info.type,
            size: attachmentData.length
          });
        }
      }
    }

    if (xmlAttachments.length === 0) {
      logger.info('No XML attachments found in SendGrid webhook', {
        subject: emailData.subject,
        attachmentCount
      });
      return res.status(200).json({ success: true, message: 'No ADF attachments found' });
    }

    // Process each XML attachment through existing ADF system
    const results = [];
    for (const attachment of xmlAttachments) {
      try {
        const xml = attachment.content.toString('utf8');
        const result = await adfParser.parseAdfXml(xml);

        if (result.success && result.mappedLead) {
          // Add email metadata AND dealership context
          result.mappedLead.sourceEmailFrom = emailData.from;
          result.mappedLead.sourceEmailSubject = emailData.subject;
          result.mappedLead.sourceEmailId = `sendgrid-${Date.now()}-${attachment.filename}`;
          result.mappedLead.dealershipId = dealershipId; // CRITICAL: Associate with correct dealership

          // Check for duplicates
          const existingLead = await db.query.adfLeads.findFirst({
            where: eq(adfLeads.deduplicationHash, result.mappedLead.deduplicationHash!),
            columns: { id: true }
          });

          if (!existingLead) {
            // Store the lead
            const [newLead] = await db.insert(adfLeads).values(result.mappedLead as any).returning({ id: adfLeads.id });

            results.push({
              filename: attachment.filename,
              leadId: newLead.id,
              success: true,
              isDuplicate: false
            });

            logger.info('ADF lead processed from SendGrid webhook', {
              leadId: newLead.id,
              filename: attachment.filename,
              customerName: result.mappedLead.customerFullName,
              dealershipId
            });
          } else {
            results.push({
              filename: attachment.filename,
              leadId: existingLead.id,
              success: true,
              isDuplicate: true
            });
          }
        } else {
          results.push({
            filename: attachment.filename,
            success: false,
            errors: result.errors
          });
        }
      } catch (error) {
        logger.error('Error processing ADF attachment from SendGrid', {
          filename: attachment.filename,
          error: error instanceof Error ? error.message : String(error)
        });

        results.push({
          filename: attachment.filename,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Return success to SendGrid (important!)
    res.status(200).json({
      success: true,
      message: 'Email processed successfully',
      results
    });

  } catch (error) {
    logger.error('Error processing SendGrid inbound webhook', { error });

    // Still return 200 to prevent SendGrid retries for application errors
    res.status(200).json({
      success: false,
      error: 'Internal processing error'
    });
  }
});

export default router;