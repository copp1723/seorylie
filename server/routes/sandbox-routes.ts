import express, { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import logger from '../utils/logger';
import { AppError, ErrorCode, ResponseHelper, asyncHandler } from '../utils/error-codes';
import { authenticateJWT } from '../middleware/auth-middleware';
import { validateRequest } from '../middleware/validation-middleware';
import { rateLimiter } from '../middleware/rate-limiter';
import { featureFlagsService, FeatureFlagNames, FlagContext } from '../services/feature-flags-service';
import { monitoringService } from '../services/monitoring';

// Redis client for storing sandbox state
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  keyPrefix: 'sandbox:'
});

// Sandbox state enum
export enum SandboxState {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
  TERMINATED = 'terminated',
  INITIALIZING = 'initializing'
}

// Sandbox metadata interface
export interface SandboxMetadata {
  id: string;
  name: string;
  userId: number;
  dealershipId: number;
  createdAt: string;
  lastActivityAt: string;
  state: SandboxState;
  pausedAt?: string;
  pausedBy?: string;
  pauseReason?: string;
  resumedAt?: string;
  resumedBy?: string;
  errorDetails?: string;
  autoPauseSettings?: {
    enabled: boolean;
    idleTimeoutMinutes: number;
    maxExecutionTimeMinutes: number;
    maxMemoryUsageMB: number;
  };
}

// Pause history entry interface
export interface PauseHistoryEntry {
  id: string;
  sandboxId: string;
  action: 'pause' | 'resume';
  timestamp: string;
  userId: number;
  userName: string;
  reason?: string;
  metadata?: Record<string, any>;
}

// Sandbox pause settings validation schema
const pauseSettingsSchema = z.object({
  autoPauseEnabled: z.boolean().optional(),
  idleTimeoutMinutes: z.number().min(1).max(1440).optional(), // 1 min to 24 hours
  maxExecutionTimeMinutes: z.number().min(1).max(1440).optional(),
  maxMemoryUsageMB: z.number().min(128).max(8192).optional() // 128MB to 8GB
});

// Bulk operation validation schema
const bulkOperationSchema = z.object({
  sandboxIds: z.array(z.string().min(1)).min(1).max(50),
  reason: z.string().optional()
});

// Tool execution validation schema
const toolExecutionSchema = z.object({
  toolId: z.string().min(1),
  parameters: z.record(z.any()).optional(),
  timeout: z.number().min(1000).max(300000).optional() // 1s to 5min
});

// Create router
const router = express.Router();

// Register metrics
monitoringService.registerCounter(
  'sandbox_operations_total',
  'Total number of sandbox operations',
  ['operation', 'status']
);

monitoringService.registerGauge(
  'sandbox_state_count',
  'Number of sandboxes in each state',
  ['state']
);

monitoringService.registerHistogram(
  'sandbox_operation_duration_seconds',
  'Duration of sandbox operations in seconds',
  ['operation'],
  [0.01, 0.05, 0.1, 0.5, 1, 5]
);

/**
 * Middleware to check if sandbox pause/resume feature is enabled
 */
const checkFeatureEnabled = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const context: FlagContext = {
    userId: req.user?.id,
    dealershipId: req.user?.dealershipId,
    environment: process.env.NODE_ENV || 'development'
  };

  const isEnabled = await featureFlagsService.isEnabled(
    FeatureFlagNames.SANDBOX_PAUSE_RESUME,
    context
  );

  if (!isEnabled) {
    throw new AppError(
      ErrorCode.NOT_IMPLEMENTED,
      'Sandbox pause/resume feature is not enabled',
      501
    );
  }

  next();
});

/**
 * Middleware to check if sandbox exists and user has access
 */
const checkSandboxAccess = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const sandboxId = req.params.id;
  
  if (!sandboxId) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      'Sandbox ID is required',
      400
    );
  }

  const sandboxData = await getSandboxMetadata(sandboxId);
  
  if (!sandboxData) {
    throw new AppError(
      ErrorCode.RECORD_NOT_FOUND,
      `Sandbox with ID ${sandboxId} not found`,
      404
    );
  }

  // Check if user has access to this sandbox
  if (req.user?.dealershipId !== sandboxData.dealershipId && !req.user?.isAdmin) {
    throw new AppError(
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      'You do not have permission to access this sandbox',
      403
    );
  }

  // Add sandbox data to request for handlers to use
  req.sandbox = sandboxData;
  next();
});

/**
 * Get sandbox metadata from Redis
 */
async function getSandboxMetadata(sandboxId: string): Promise<SandboxMetadata | null> {
  try {
    const data = await redisClient.get(`metadata:${sandboxId}`);
    if (!data) return null;
    return JSON.parse(data) as SandboxMetadata;
  } catch (error) {
    logger.error('Error retrieving sandbox metadata', { sandboxId, error });
    return null;
  }
}

/**
 * Save sandbox metadata to Redis
 */
async function saveSandboxMetadata(metadata: SandboxMetadata): Promise<boolean> {
  try {
    await redisClient.set(
      `metadata:${metadata.id}`,
      JSON.stringify(metadata),
      'EX',
      60 * 60 * 24 * 7 // 7 days expiry
    );
    return true;
  } catch (error) {
    logger.error('Error saving sandbox metadata', { sandboxId: metadata.id, error });
    return false;
  }
}

/**
 * Add entry to sandbox pause history
 */
async function addToPauseHistory(entry: PauseHistoryEntry): Promise<boolean> {
  try {
    const historyKey = `history:${entry.sandboxId}`;
    await redisClient.lpush(historyKey, JSON.stringify(entry));
    await redisClient.ltrim(historyKey, 0, 99); // Keep last 100 entries
    await redisClient.expire(historyKey, 60 * 60 * 24 * 30); // 30 days expiry
    return true;
  } catch (error) {
    logger.error('Error adding to pause history', { sandboxId: entry.sandboxId, error });
    return false;
  }
}

/**
 * Update sandbox state metrics
 */
async function updateStateMetrics(): Promise<void> {
  try {
    // Get counts of sandboxes in each state
    const keys = await redisClient.keys('metadata:*');
    const sandboxes = await Promise.all(
      keys.map(async (key) => {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) as SandboxMetadata : null;
      })
    );

    // Count sandboxes by state
    const stateCounts = sandboxes.reduce((counts, sandbox) => {
      if (sandbox) {
        counts[sandbox.state] = (counts[sandbox.state] || 0) + 1;
      }
      return counts;
    }, {} as Record<string, number>);

    // Update metrics
    Object.entries(SandboxState).forEach(([_, state]) => {
      monitoringService.setGauge('sandbox_state_count', stateCounts[state] || 0, [state]);
    });
  } catch (error) {
    logger.error('Error updating sandbox state metrics', { error });
  }
}

// Apply authentication to all routes
router.use(authenticateJWT);

// Apply feature flag check to all routes
router.use(checkFeatureEnabled);

/**
 * GET /api/sandbox
 * List all sandboxes with their states
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const startTime = process.hrtime();
  
  try {
    // Apply filtering based on query parameters
    const { state, dealershipId } = req.query;
    
    // Get all sandbox keys
    const keys = await redisClient.keys('metadata:*');
    
    // Get sandbox data
    const sandboxesData = await Promise.all(
      keys.map(async (key) => {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) as SandboxMetadata : null;
      })
    );
    
    // Filter sandboxes
    let sandboxes = sandboxesData.filter(Boolean) as SandboxMetadata[];
    
    // Filter by dealership if not admin
    if (!req.user?.isAdmin) {
      sandboxes = sandboxes.filter(s => s.dealershipId === req.user?.dealershipId);
    } 
    // Admin can filter by dealership
    else if (dealershipId && !isNaN(Number(dealershipId))) {
      sandboxes = sandboxes.filter(s => s.dealershipId === Number(dealershipId));
    }
    
    // Filter by state if provided
    if (state && Object.values(SandboxState).includes(state as SandboxState)) {
      sandboxes = sandboxes.filter(s => s.state === state);
    }
    
    // Record metrics
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['list']);
    monitoringService.incrementCounter('sandbox_operations_total', 1, ['list', 'success']);
    
    return ResponseHelper.success(res, sandboxes, 'Sandboxes retrieved successfully');
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['list']);
    monitoringService.incrementCounter('sandbox_operations_total', 1, ['list', 'error']);
    
    throw error;
  }
}));

/**
 * GET /api/sandbox/:id/status
 * Get sandbox state
 */
router.get('/:id/status', checkSandboxAccess, asyncHandler(async (req: Request, res: Response) => {
  const startTime = process.hrtime();
  const sandboxId = req.params.id;
  
  try {
    const sandboxData = req.sandbox as SandboxMetadata;
    
    // Record metrics
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['status']);
    monitoringService.incrementCounter('sandbox_operations_total', 1, ['status', 'success']);
    
    return ResponseHelper.success(res, sandboxData, 'Sandbox status retrieved successfully');
  } catch (error) {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds + nanoseconds / 1e9;
    monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['status']);
    monitoringService.incrementCounter('sandbox_operations_total', 1, ['status', 'error']);
    
    throw error;
  }
}));

/**
 * POST /api/sandbox/pause/:id
 * Pause a sandbox
 */
router.post('/pause/:id', 
  checkSandboxAccess, 
  rateLimiter({ windowMs: 60000, max: 10 }), 
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const sandboxId = req.params.id;
    const { reason } = req.body;
    
    try {
      const sandboxData = req.sandbox as SandboxMetadata;
      
      // Check if already paused
      if (sandboxData.state === SandboxState.PAUSED) {
        return ResponseHelper.success(res, sandboxData, 'Sandbox is already paused');
      }
      
      // Update sandbox state
      const updatedSandbox: SandboxMetadata = {
        ...sandboxData,
        state: SandboxState.PAUSED,
        pausedAt: new Date().toISOString(),
        pausedBy: req.user?.id.toString(),
        pauseReason: reason || 'Manual pause by user',
        lastActivityAt: new Date().toISOString()
      };
      
      // Save updated state
      await saveSandboxMetadata(updatedSandbox);
      
      // Add to history
      await addToPauseHistory({
        id: uuidv4(),
        sandboxId,
        action: 'pause',
        timestamp: updatedSandbox.pausedAt,
        userId: req.user?.id || 0,
        userName: req.user?.name || 'Unknown',
        reason: reason || 'Manual pause by user'
      });
      
      // Update metrics
      updateStateMetrics();
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['pause']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['pause', 'success']);
      
      logger.info('Sandbox paused', { 
        sandboxId, 
        userId: req.user?.id, 
        reason: reason || 'Manual pause by user' 
      });
      
      return ResponseHelper.success(res, updatedSandbox, 'Sandbox paused successfully');
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['pause']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['pause', 'error']);
      
      throw error;
    }
  })
);

/**
 * POST /api/sandbox/resume/:id
 * Resume a paused sandbox
 */
router.post('/resume/:id', 
  checkSandboxAccess, 
  rateLimiter({ windowMs: 60000, max: 10 }), 
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const sandboxId = req.params.id;
    
    try {
      const sandboxData = req.sandbox as SandboxMetadata;
      
      // Check if not paused
      if (sandboxData.state !== SandboxState.PAUSED) {
        return ResponseHelper.success(res, sandboxData, 'Sandbox is not paused');
      }
      
      // Update sandbox state
      const updatedSandbox: SandboxMetadata = {
        ...sandboxData,
        state: SandboxState.ACTIVE,
        resumedAt: new Date().toISOString(),
        resumedBy: req.user?.id.toString(),
        lastActivityAt: new Date().toISOString()
      };
      
      // Save updated state
      await saveSandboxMetadata(updatedSandbox);
      
      // Add to history
      await addToPauseHistory({
        id: uuidv4(),
        sandboxId,
        action: 'resume',
        timestamp: updatedSandbox.resumedAt,
        userId: req.user?.id || 0,
        userName: req.user?.name || 'Unknown'
      });
      
      // Update metrics
      updateStateMetrics();
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['resume']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['resume', 'success']);
      
      logger.info('Sandbox resumed', { 
        sandboxId, 
        userId: req.user?.id
      });
      
      return ResponseHelper.success(res, updatedSandbox, 'Sandbox resumed successfully');
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['resume']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['resume', 'error']);
      
      throw error;
    }
  })
);

/**
 * POST /api/sandbox/bulk/pause
 * Pause multiple sandboxes
 */
router.post('/bulk/pause', 
  validateRequest({ body: bulkOperationSchema }),
  rateLimiter({ windowMs: 60000, max: 5 }), 
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const { sandboxIds, reason } = req.body;
    
    try {
      const results: Record<string, { success: boolean; message: string }> = {};
      
      // Process each sandbox
      for (const sandboxId of sandboxIds) {
        try {
          // Get sandbox data
          const sandboxData = await getSandboxMetadata(sandboxId);
          
          if (!sandboxData) {
            results[sandboxId] = { 
              success: false, 
              message: 'Sandbox not found' 
            };
            continue;
          }
          
          // Check access
          if (req.user?.dealershipId !== sandboxData.dealershipId && !req.user?.isAdmin) {
            results[sandboxId] = { 
              success: false, 
              message: 'Insufficient permissions' 
            };
            continue;
          }
          
          // Check if already paused
          if (sandboxData.state === SandboxState.PAUSED) {
            results[sandboxId] = { 
              success: true, 
              message: 'Sandbox already paused' 
            };
            continue;
          }
          
          // Update sandbox state
          const updatedSandbox: SandboxMetadata = {
            ...sandboxData,
            state: SandboxState.PAUSED,
            pausedAt: new Date().toISOString(),
            pausedBy: req.user?.id.toString(),
            pauseReason: reason || 'Bulk pause operation',
            lastActivityAt: new Date().toISOString()
          };
          
          // Save updated state
          await saveSandboxMetadata(updatedSandbox);
          
          // Add to history
          await addToPauseHistory({
            id: uuidv4(),
            sandboxId,
            action: 'pause',
            timestamp: updatedSandbox.pausedAt,
            userId: req.user?.id || 0,
            userName: req.user?.name || 'Unknown',
            reason: reason || 'Bulk pause operation',
            metadata: { bulkOperation: true }
          });
          
          results[sandboxId] = { 
            success: true, 
            message: 'Sandbox paused successfully' 
          };
        } catch (error) {
          logger.error('Error in bulk pause operation', { sandboxId, error });
          results[sandboxId] = { 
            success: false, 
            message: 'Internal error' 
          };
        }
      }
      
      // Update metrics
      updateStateMetrics();
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['bulk_pause']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['bulk_pause', 'success']);
      
      const successCount = Object.values(results).filter(r => r.success).length;
      logger.info('Bulk sandbox pause completed', { 
        totalCount: sandboxIds.length,
        successCount,
        userId: req.user?.id
      });
      
      return ResponseHelper.success(res, results, `Paused ${successCount} of ${sandboxIds.length} sandboxes`);
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['bulk_pause']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['bulk_pause', 'error']);
      
      throw error;
    }
  })
);

/**
 * POST /api/sandbox/bulk/resume
 * Resume multiple sandboxes
 */
router.post('/bulk/resume', 
  validateRequest({ body: bulkOperationSchema }),
  rateLimiter({ windowMs: 60000, max: 5 }), 
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const { sandboxIds } = req.body;
    
    try {
      const results: Record<string, { success: boolean; message: string }> = {};
      
      // Process each sandbox
      for (const sandboxId of sandboxIds) {
        try {
          // Get sandbox data
          const sandboxData = await getSandboxMetadata(sandboxId);
          
          if (!sandboxData) {
            results[sandboxId] = { 
              success: false, 
              message: 'Sandbox not found' 
            };
            continue;
          }
          
          // Check access
          if (req.user?.dealershipId !== sandboxData.dealershipId && !req.user?.isAdmin) {
            results[sandboxId] = { 
              success: false, 
              message: 'Insufficient permissions' 
            };
            continue;
          }
          
          // Check if not paused
          if (sandboxData.state !== SandboxState.PAUSED) {
            results[sandboxId] = { 
              success: true, 
              message: 'Sandbox not paused' 
            };
            continue;
          }
          
          // Update sandbox state
          const updatedSandbox: SandboxMetadata = {
            ...sandboxData,
            state: SandboxState.ACTIVE,
            resumedAt: new Date().toISOString(),
            resumedBy: req.user?.id.toString(),
            lastActivityAt: new Date().toISOString()
          };
          
          // Save updated state
          await saveSandboxMetadata(updatedSandbox);
          
          // Add to history
          await addToPauseHistory({
            id: uuidv4(),
            sandboxId,
            action: 'resume',
            timestamp: updatedSandbox.resumedAt,
            userId: req.user?.id || 0,
            userName: req.user?.name || 'Unknown',
            metadata: { bulkOperation: true }
          });
          
          results[sandboxId] = { 
            success: true, 
            message: 'Sandbox resumed successfully' 
          };
        } catch (error) {
          logger.error('Error in bulk resume operation', { sandboxId, error });
          results[sandboxId] = { 
            success: false, 
            message: 'Internal error' 
          };
        }
      }
      
      // Update metrics
      updateStateMetrics();
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['bulk_resume']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['bulk_resume', 'success']);
      
      const successCount = Object.values(results).filter(r => r.success).length;
      logger.info('Bulk sandbox resume completed', { 
        totalCount: sandboxIds.length,
        successCount,
        userId: req.user?.id
      });
      
      return ResponseHelper.success(res, results, `Resumed ${successCount} of ${sandboxIds.length} sandboxes`);
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['bulk_resume']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['bulk_resume', 'error']);
      
      throw error;
    }
  })
);

/**
 * POST /api/sandbox/:id/tools/execute
 * Execute a tool in the sandbox (returns 423 when paused)
 */
router.post('/:id/tools/execute', 
  checkSandboxAccess,
  validateRequest({ body: toolExecutionSchema }),
  rateLimiter({ windowMs: 60000, max: 20 }), 
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const sandboxId = req.params.id;
    const { toolId, parameters, timeout } = req.body;
    
    try {
      const sandboxData = req.sandbox as SandboxMetadata;
      
      // Check if sandbox is paused - return 423 Locked
      if (sandboxData.state === SandboxState.PAUSED) {
        // Record operation metrics
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds + nanoseconds / 1e9;
        monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['tool_execute']);
        monitoringService.incrementCounter('sandbox_operations_total', 1, ['tool_execute', 'locked']);
        
        logger.info('Tool execution blocked - sandbox paused', { 
          sandboxId, 
          toolId,
          userId: req.user?.id
        });
        
        // Return 423 Locked with details
        return res.status(423).json({
          success: false,
          error: {
            code: ErrorCode.RESOURCE_LOCKED,
            message: 'Sandbox is paused. Resume the sandbox to execute tools.',
            details: {
              sandboxId,
              state: SandboxState.PAUSED,
              pausedAt: sandboxData.pausedAt,
              pauseReason: sandboxData.pauseReason
            }
          }
        });
      }
      
      // Update last activity
      sandboxData.lastActivityAt = new Date().toISOString();
      await saveSandboxMetadata(sandboxData);
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['tool_execute']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['tool_execute', 'success']);
      
      // In a real implementation, we would execute the tool here
      // For now, just return a success response
      return ResponseHelper.success(res, {
        executionId: uuidv4(),
        toolId,
        status: 'completed',
        result: { message: 'Tool execution simulated successfully' }
      }, 'Tool executed successfully');
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['tool_execute']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['tool_execute', 'error']);
      
      throw error;
    }
  })
);

/**
 * GET /api/sandbox/:id/pause-history
 * Get pause/resume history for a sandbox
 */
router.get('/:id/pause-history', 
  checkSandboxAccess, 
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const sandboxId = req.params.id;
    const { limit = '50', offset = '0' } = req.query;
    
    try {
      const historyKey = `history:${sandboxId}`;
      
      // Get history entries with pagination
      const start = parseInt(offset as string, 10);
      const end = start + parseInt(limit as string, 10) - 1;
      
      const entries = await redisClient.lrange(historyKey, start, end);
      const history = entries.map(entry => JSON.parse(entry) as PauseHistoryEntry);
      
      // Get total count
      const totalCount = await redisClient.llen(historyKey);
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['history']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['history', 'success']);
      
      return ResponseHelper.success(res, {
        history,
        pagination: {
          total: totalCount,
          limit: parseInt(limit as string, 10),
          offset: start,
          hasMore: totalCount > (start + history.length)
        }
      }, 'Pause history retrieved successfully');
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['history']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['history', 'error']);
      
      throw error;
    }
  })
);

/**
 * PUT /api/sandbox/:id/pause-settings
 * Configure auto-pause settings
 */
router.put('/:id/pause-settings', 
  checkSandboxAccess,
  validateRequest({ body: pauseSettingsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = process.hrtime();
    const sandboxId = req.params.id;
    const { 
      autoPauseEnabled, 
      idleTimeoutMinutes, 
      maxExecutionTimeMinutes,
      maxMemoryUsageMB
    } = req.body;
    
    try {
      const sandboxData = req.sandbox as SandboxMetadata;
      
      // Update auto-pause settings
      const updatedSandbox: SandboxMetadata = {
        ...sandboxData,
        autoPauseSettings: {
          enabled: autoPauseEnabled ?? sandboxData.autoPauseSettings?.enabled ?? false,
          idleTimeoutMinutes: idleTimeoutMinutes ?? sandboxData.autoPauseSettings?.idleTimeoutMinutes ?? 30,
          maxExecutionTimeMinutes: maxExecutionTimeMinutes ?? sandboxData.autoPauseSettings?.maxExecutionTimeMinutes ?? 60,
          maxMemoryUsageMB: maxMemoryUsageMB ?? sandboxData.autoPauseSettings?.maxMemoryUsageMB ?? 1024
        },
        lastActivityAt: new Date().toISOString()
      };
      
      // Save updated settings
      await saveSandboxMetadata(updatedSandbox);
      
      // Record operation metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['update_settings']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['update_settings', 'success']);
      
      logger.info('Sandbox auto-pause settings updated', { 
        sandboxId, 
        settings: updatedSandbox.autoPauseSettings,
        userId: req.user?.id
      });
      
      return ResponseHelper.success(res, updatedSandbox, 'Auto-pause settings updated successfully');
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;
      monitoringService.observeHistogram('sandbox_operation_duration_seconds', duration, ['update_settings']);
      monitoringService.incrementCounter('sandbox_operations_total', 1, ['update_settings', 'error']);
      
      throw error;
    }
  })
);

// Add type declaration for Request to include sandbox
declare global {
  namespace Express {
    interface Request {
      sandbox?: SandboxMetadata;
      user?: {
        id: number;
        name: string;
        dealershipId: number;
        isAdmin: boolean;
      };
    }
  }
}

export default router;
