/**
 * Agent Orchestration Routes
 * 
 * Provides API endpoints for the agent orchestration system, enabling cross-service
 * workflows that combine analytics (Watchdog) and automation (VIN Agent) capabilities.
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { agentOrchestrator, AgentType, ServiceType, WorkflowDefinition } from '../services/agent-orchestrator';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/error-codes';
import { isAuthenticated } from '../middleware/authentication';
import { isAdmin } from '../middleware/auth';
import { asyncHandler } from '../utils/error-handler';

const router = express.Router();

/**
 * @api {post} /api/agents/execute Execute a workflow
 * @apiName ExecuteWorkflow
 * @apiGroup AgentOrchestration
 * @apiDescription Executes a cross-service workflow, orchestrating operations between analytics and automation services
 * 
 * @apiParam {String} workflowId ID of the workflow to execute
 * @apiParam {String} agentId ID of the agent executing the workflow
 * @apiParam {String} agentType Type of agent (e.g., SALES_ANALYTICS, INVENTORY_AUTOMATION)
 * @apiParam {Object} parameters Parameters required for the workflow
 * @apiParam {String} [userId] ID of the user initiating the workflow
 * @apiParam {String} [dealershipId] ID of the dealership context
 * @apiParam {Object} [options] Additional options for execution
 * 
 * @apiSuccess {String} executionId Unique ID for tracking the workflow execution
 * @apiSuccess {String} workflowId ID of the executed workflow
 * @apiSuccess {String} status Status of the workflow execution (accepted, rejected, completed, failed)
 * @apiSuccess {String} startTime Timestamp when the workflow started
 * 
 * @apiError (400) BadRequest Invalid request parameters
 * @apiError (401) Unauthorized Authentication required
 * @apiError (404) NotFound Workflow not found
 * @apiError (500) ServerError Internal server error
 */
router.post('/execute', [
  isAuthenticated,
  body('workflowId').isString().notEmpty().withMessage('Workflow ID is required'),
  body('agentId').isString().notEmpty().withMessage('Agent ID is required'),
  body('agentType').isIn(Object.values(AgentType)).withMessage('Invalid agent type'),
  body('parameters').isObject().withMessage('Parameters must be an object'),
  body('userId').optional().isString(),
  body('dealershipId').optional().isString(),
  body('options').optional().isObject()
], asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ResponseHelper.validationError(res, errors.array());
  }
  
  try {
    const { workflowId, agentId, agentType, parameters, userId, dealershipId, options } = req.body;
    
    logger.info(`Workflow execution request: ${workflowId}`, {
      workflowId,
      agentId,
      agentType,
      userId,
      dealershipId
    });
    
    // Execute workflow
    const result = await agentOrchestrator.executeWorkflow({
      workflowId,
      agentId,
      agentType,
      parameters,
      userId: userId || req.user?.id,
      dealershipId,
      options
    });
    
    if (result.status === 'rejected') {
      return ResponseHelper.error(res, {
        message: result.error?.message || 'Workflow execution rejected',
        code: result.error?.code || 'EXECUTION_REJECTED',
        status: 400
      });
    }
    
    return ResponseHelper.success(res, result, 'Workflow execution started');
    
  } catch (error) {
    logger.error('Error executing workflow', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return ResponseHelper.error(res, error);
  }
}));

/**
 * @api {get} /api/agents/workflows List available workflows
 * @apiName ListWorkflows
 * @apiGroup AgentOrchestration
 * @apiDescription Lists all available workflows, optionally filtered by agent type
 * 
 * @apiParam {String} [agentType] Filter workflows by agent type
 * 
 * @apiSuccess {Array} workflows List of available workflows
 * @apiSuccess {String} workflows.id Workflow ID
 * @apiSuccess {String} workflows.name Workflow name
 * @apiSuccess {String} workflows.description Workflow description
 * 
 * @apiError (401) Unauthorized Authentication required
 * @apiError (500) ServerError Internal server error
 */
router.get('/workflows', [
  isAuthenticated,
  query('agentType').optional().isIn(Object.values(AgentType)).withMessage('Invalid agent type')
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const agentType = req.query.agentType as AgentType | undefined;
    
    const workflows = agentOrchestrator.listWorkflows(agentType);
    
    return ResponseHelper.success(res, { workflows }, 'Available workflows retrieved');
    
  } catch (error) {
    logger.error('Error listing workflows', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return ResponseHelper.error(res, error);
  }
}));

/**
 * @api {get} /api/agents/execution/:id Get workflow execution status
 * @apiName GetExecutionStatus
 * @apiGroup AgentOrchestration
 * @apiDescription Gets the current status of a workflow execution
 * 
 * @apiParam {String} id Execution ID
 * 
 * @apiSuccess {String} executionId Unique ID for tracking the workflow execution
 * @apiSuccess {String} workflowId ID of the executed workflow
 * @apiSuccess {String} status Status of the workflow execution (accepted, rejected, completed, failed)
 * @apiSuccess {String} startTime Timestamp when the workflow started
 * @apiSuccess {String} [endTime] Timestamp when the workflow ended (if completed or failed)
 * @apiSuccess {Object} [results] Results of the workflow (if completed)
 * @apiSuccess {Object} [error] Error details (if failed)
 * 
 * @apiError (401) Unauthorized Authentication required
 * @apiError (404) NotFound Execution not found
 * @apiError (500) ServerError Internal server error
 */
router.get('/execution/:id', [
  isAuthenticated,
  param('id').isString().notEmpty().withMessage('Execution ID is required')
], asyncHandler(async (req: Request, res: Response) => {
  try {
    const executionId = req.params.id;
    
    const status = agentOrchestrator.getWorkflowStatus(executionId);
    
    if (!status) {
      return ResponseHelper.notFound(res, 'Workflow execution not found');
    }
    
    return ResponseHelper.success(res, status, 'Workflow execution status retrieved');
    
  } catch (error) {
    logger.error('Error getting workflow execution status', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return ResponseHelper.error(res, error);
  }
}));

/**
 * @api {post} /api/agents/services/analytics Direct analytics service call
 * @apiName CallAnalyticsService
 * @apiGroup AgentOrchestration
 * @apiDescription Makes a direct call to the analytics service (Watchdog)
 * 
 * @apiParam {String} [uploadId] ID of the uploaded data to analyze
 * @apiParam {Array} [metrics] Metrics to analyze
 * @apiParam {Object} [filters] Filters to apply to the data
 * @apiParam {Object} [timeRange] Time range for the analysis
 * @apiParam {Object} [options] Additional options for the analysis
 * 
 * @apiSuccess {Boolean} success Whether the call was successful
 * @apiSuccess {Array} [insights] Insights generated from the analysis
 * @apiSuccess {Object} [meta] Metadata about the analysis
 * 
 * @apiError (400) BadRequest Invalid request parameters
 * @apiError (401) Unauthorized Authentication required
 * @apiError (500) ServerError Internal server error
 */
router.post('/services/analytics', [
  isAuthenticated,
  body().isObject().withMessage('Request body must be an object')
], asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info('Direct analytics service call', {
      parameters: JSON.stringify(req.body)
    });
    
    const result = await agentOrchestrator.callAnalyticsService(req.body);
    
    if (!result.success) {
      return ResponseHelper.error(res, {
        message: result.error?.message || 'Analytics service call failed',
        code: result.error?.code || 'ANALYTICS_ERROR',
        status: 400
      });
    }
    
    return ResponseHelper.success(res, result, 'Analytics service call successful');
    
  } catch (error) {
    logger.error('Error calling analytics service', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return ResponseHelper.error(res, error);
  }
}));

/**
 * @api {post} /api/agents/services/automation Direct automation service call
 * @apiName CallAutomationService
 * @apiGroup AgentOrchestration
 * @apiDescription Makes a direct call to the automation service (VIN Agent)
 * 
 * @apiParam {String} operation Operation to perform
 * @apiParam {Object} parameters Parameters for the operation
 * 
 * @apiSuccess {Boolean} success Whether the call was successful
 * @apiSuccess {Object} [data] Data returned from the automation service
 * @apiSuccess {Object} [meta] Metadata about the operation
 * 
 * @apiError (400) BadRequest Invalid request parameters
 * @apiError (401) Unauthorized Authentication required
 * @apiError (500) ServerError Internal server error
 */
router.post('/services/automation', [
  isAuthenticated,
  body('operation').isString().notEmpty().withMessage('Operation is required'),
  body('parameters').isObject().withMessage('Parameters must be an object')
], asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ResponseHelper.validationError(res, errors.array());
  }
  
  try {
    const { operation, parameters } = req.body;
    
    logger.info(`Direct automation service call: ${operation}`, {
      operation,
      parameters: JSON.stringify(parameters)
    });
    
    const result = await agentOrchestrator.callAutomationService(operation, parameters);
    
    if (!result.success) {
      return ResponseHelper.error(res, {
        message: result.error?.message || 'Automation service call failed',
        code: result.error?.code || 'AUTOMATION_ERROR',
        status: 400
      });
    }
    
    return ResponseHelper.success(res, result, 'Automation service call successful');
    
  } catch (error) {
    logger.error('Error calling automation service', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return ResponseHelper.error(res, error);
  }
}));

/**
 * @api {post} /api/agents/workflows/register Register a custom workflow
 * @apiName RegisterWorkflow
 * @apiGroup AgentOrchestration
 * @apiDescription Registers a custom workflow definition (admin only)
 * 
 * @apiParam {String} id Workflow ID
 * @apiParam {String} name Workflow name
 * @apiParam {String} description Workflow description
 * @apiParam {Array} steps Workflow steps
 * @apiParam {Array} supportedAgentTypes Agent types supported by this workflow
 * @apiParam {Object} [errorHandling] Error handling configuration
 * 
 * @apiSuccess {Boolean} success Whether the registration was successful
 * @apiSuccess {String} message Success message
 * @apiSuccess {Object} workflow Registered workflow details
 * 
 * @apiError (400) BadRequest Invalid request parameters
 * @apiError (401) Unauthorized Authentication required
 * @apiError (403) Forbidden Admin access required
 * @apiError (500) ServerError Internal server error
 */
router.post('/workflows/register', [
  isAuthenticated,
  isAdmin,
  body('id').isString().notEmpty().withMessage('Workflow ID is required'),
  body('name').isString().notEmpty().withMessage('Workflow name is required'),
  body('description').isString().notEmpty().withMessage('Workflow description is required'),
  body('steps').isArray().notEmpty().withMessage('Workflow steps are required'),
  body('supportedAgentTypes').isArray().notEmpty().withMessage('Supported agent types are required'),
  body('errorHandling').optional().isObject()
], asyncHandler(async (req: Request, res: Response) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ResponseHelper.validationError(res, errors.array());
  }
  
  try {
    const workflowDefinition = req.body as WorkflowDefinition;
    
    // Validate steps
    for (const step of workflowDefinition.steps) {
      if (!step.id || !step.name || !step.service || !step.operation || !step.parameters) {
        return ResponseHelper.error(res, {
          message: 'Invalid workflow step definition',
          code: 'INVALID_WORKFLOW_STEP',
          status: 400
        });
      }
      
      // Validate service type
      if (!Object.values(ServiceType).includes(step.service as ServiceType)) {
        return ResponseHelper.error(res, {
          message: `Invalid service type: ${step.service}`,
          code: 'INVALID_SERVICE_TYPE',
          status: 400
        });
      }
    }
    
    // Validate agent types
    for (const agentType of workflowDefinition.supportedAgentTypes) {
      if (!Object.values(AgentType).includes(agentType as AgentType)) {
        return ResponseHelper.error(res, {
          message: `Invalid agent type: ${agentType}`,
          code: 'INVALID_AGENT_TYPE',
          status: 400
        });
      }
    }
    
    // Register workflow
    agentOrchestrator.registerWorkflow(workflowDefinition);
    
    logger.info(`Custom workflow registered: ${workflowDefinition.name} (${workflowDefinition.id})`, {
      workflowId: workflowDefinition.id,
      userId: req.user?.id
    });
    
    return ResponseHelper.success(res, { workflow: workflowDefinition }, 'Workflow registered successfully');
    
  } catch (error) {
    logger.error('Error registering workflow', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return ResponseHelper.error(res, error);
  }
}));

/**
 * @api {get} /api/agents/status Service health and status
 * @apiName GetServiceStatus
 * @apiGroup AgentOrchestration
 * @apiDescription Gets the health and status of the agent orchestration service and its dependencies
 * 
 * @apiSuccess {String} status Overall status of the service (healthy, degraded, unhealthy)
 * @apiSuccess {Object} services Status of dependent services
 * @apiSuccess {Object} services.analytics Status of the analytics service
 * @apiSuccess {Object} services.automation Status of the automation service
 * @apiSuccess {Object} metrics Performance metrics
 * 
 * @apiError (500) ServerError Internal server error
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check analytics service health
    let analyticsStatus = 'unknown';
    try {
      const analyticsHealth = await agentOrchestrator.callAnalyticsService({ operation: 'health' });
      analyticsStatus = analyticsHealth.success ? 'healthy' : 'degraded';
    } catch (error) {
      analyticsStatus = 'unhealthy';
      logger.error('Error checking analytics service health', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Check automation service health
    let automationStatus = 'unknown';
    try {
      const automationHealth = await agentOrchestrator.callAutomationService('health', {});
      automationStatus = automationHealth.success ? 'healthy' : 'degraded';
    } catch (error) {
      automationStatus = 'unhealthy';
      logger.error('Error checking automation service health', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Determine overall status
    let overallStatus = 'healthy';
    if (analyticsStatus === 'unhealthy' || automationStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (analyticsStatus === 'degraded' || automationStatus === 'degraded') {
      overallStatus = 'degraded';
    }
    
    // Get available workflows count
    const workflows = agentOrchestrator.listWorkflows();
    
    const status = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        analytics: {
          status: analyticsStatus,
          endpoint: process.env.WATCHDOG_API_URL || 'http://localhost:8000'
        },
        automation: {
          status: automationStatus,
          endpoint: process.env.VIN_AGENT_API_URL || 'http://localhost:5000'
        }
      },
      metrics: {
        availableWorkflows: workflows.length,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      version: '1.0.0'
    };
    
    return res.status(overallStatus === 'healthy' ? 200 : 503).json(status);
    
  } catch (error) {
    logger.error('Error getting service status', {
      error: error instanceof Error ? error.message : String(error)
    });
    
    return ResponseHelper.error(res, error);
  }
}));

export default router;
