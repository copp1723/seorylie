/**
 * External API Flags Routes
 * 
 * API endpoints for managing external API integration feature flags
 * 
 * @file server/routes/external-api-flags-routes.ts
 */

import { Router, Request, Response } from 'express';
import { 
  ExternalAPIFlags, 
  isExternalAPIEnabled, 
  enableExternalAPI, 
  disableExternalAPI, 
  getExternalAPIStatus 
} from '../services/external-api-flags';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/external-api-flags
 * Retrieves status of all external API integration flags
 * @returns {Object} Object containing status of all external API flags
 * @throws {500} Internal Server Error - If operation fails
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = getExternalAPIStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get external API flags status', { error: err.message });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get external API flags status',
      message: 'An error occurred while retrieving external API flags status'
    });
  }
});

/**
 * GET /api/external-api-flags/:flag
 * Retrieves status of a specific external API integration flag
 * @param {string} flag - The external API flag name
 * @returns {Object} Object containing status of the specified external API flag
 * @throws {400} Bad Request - If flag name is invalid
 * @throws {500} Internal Server Error - If operation fails
 */
router.get('/:flag', async (req: Request, res: Response) => {
  try {
    const { flag } = req.params;
    
    // Validate flag name
    if (!Object.values(ExternalAPIFlags).includes(flag as ExternalAPIFlags)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid flag name',
        message: `Flag '${flag}' is not a valid external API flag`
      });
    }
    
    const isEnabled = isExternalAPIEnabled(flag as ExternalAPIFlags);
    
    res.json({
      success: true,
      data: {
        flag,
        enabled: isEnabled
      }
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get external API flag status', { 
      error: err.message,
      flag: req.params.flag
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get external API flag status',
      message: 'An error occurred while retrieving external API flag status'
    });
  }
});

/**
 * POST /api/external-api-flags/:flag/enable
 * Enables a specific external API integration flag
 * @param {string} flag - The external API flag name
 * @returns {Object} Object containing updated status of the specified external API flag
 * @throws {400} Bad Request - If flag name is invalid
 * @throws {500} Internal Server Error - If operation fails
 */
router.post('/:flag/enable', async (req: Request, res: Response) => {
  try {
    const { flag } = req.params;
    
    // Validate flag name
    if (!Object.values(ExternalAPIFlags).includes(flag as ExternalAPIFlags)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid flag name',
        message: `Flag '${flag}' is not a valid external API flag`
      });
    }
    
    const result = enableExternalAPI(flag as ExternalAPIFlags);
    
    if (result) {
      logger.info(`External API flag '${flag}' enabled`, { 
        userId: req.session?.user?.id || 'system'
      });
      
      res.json({
        success: true,
        data: {
          flag,
          enabled: true
        },
        message: `External API '${flag}' has been enabled`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to enable external API flag',
        message: `Failed to enable external API '${flag}'`
      });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to enable external API flag', { 
      error: err.message,
      flag: req.params.flag
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to enable external API flag',
      message: 'An error occurred while enabling external API flag'
    });
  }
});

/**
 * POST /api/external-api-flags/:flag/disable
 * Disables a specific external API integration flag
 * @param {string} flag - The external API flag name
 * @param {string} reason - Reason for disabling the API
 * @returns {Object} Object containing updated status of the specified external API flag
 * @throws {400} Bad Request - If flag name is invalid or reason is missing
 * @throws {500} Internal Server Error - If operation fails
 */
router.post('/:flag/disable', async (req: Request, res: Response) => {
  try {
    const { flag } = req.params;
    const { reason } = req.body;
    
    // Validate flag name
    if (!Object.values(ExternalAPIFlags).includes(flag as ExternalAPIFlags)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid flag name',
        message: `Flag '${flag}' is not a valid external API flag`
      });
    }
    
    // Require reason for disabling
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required',
        message: 'A reason must be provided when disabling an external API'
      });
    }
    
    const result = disableExternalAPI(flag as ExternalAPIFlags, reason);
    
    if (result) {
      logger.warn(`External API flag '${flag}' disabled`, { 
        userId: req.session?.user?.id || 'system',
        reason
      });
      
      res.json({
        success: true,
        data: {
          flag,
          enabled: false,
          reason
        },
        message: `External API '${flag}' has been disabled`
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to disable external API flag',
        message: `Failed to disable external API '${flag}'`
      });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to disable external API flag', { 
      error: err.message,
      flag: req.params.flag
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to disable external API flag',
      message: 'An error occurred while disabling external API flag'
    });
  }
});

export default router;