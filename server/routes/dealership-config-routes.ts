import express from 'express';
import { dealershipConfigService } from '../services/dealership-config-service';
import logger from '../utils/logger';
import { z } from 'zod';
import { dealershipModes } from '../../shared/index';

const router = express.Router();

// Schema for validating mode update requests
const updateModeSchema = z.object({
  mode: z.enum(dealershipModes),
  ai_config: z.object({
    purecars_api_key: z.string().optional(),
    purecars_endpoint: z.string().optional(),
    ai_personality: z.string().optional(),
    response_delay_ms: z.number().optional(),
    escalation_triggers: z.array(z.string()).optional(),
  }).optional(),
  agent_config: z.object({
    enabled_channels: z.array(z.string()).optional(),
    auto_assignment: z.boolean().optional(),
    working_hours: z.object({
      timezone: z.string().optional(),
      schedule: z.record(z.object({
        start: z.string(),
        end: z.string(),
        enabled: z.boolean()
      })).optional()
    }).optional(),
    escalation_rules: z.object({
      response_time_minutes: z.number().optional(),
      max_queue_size: z.number().optional(),
      priority_routing: z.boolean().optional()
    }).optional(),
    templates: z.object({
      greeting_message: z.string().optional(),
      away_message: z.string().optional(),
      queue_message: z.string().optional()
    }).optional()
  }).optional()
});

/**
 * Get current operation mode for a dealership
 */
router.get('/mode', async (req, res) => {
  try {
    // Get dealership ID from query parameter, request body, or default to 1 for testing
    const dealershipId = Number(req.query.dealershipId) || 
                        (req.session as any).dealershipId || 
                        1;
    
    const mode = await dealershipConfigService.getDealershipMode(dealershipId);
    
    res.json({
      success: true,
      mode
    });
  } catch (error) {
    logger.error('Error getting dealership mode', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get dealership mode'
    });
  }
});

/**
 * Get full configuration for a dealership
 */
router.get('/config', async (req, res) => {
  try {
    // Get dealership ID from query parameter, request body, or default to 1 for testing
    const dealershipId = Number(req.query.dealershipId) || 
                        (req.session as any).dealershipId || 
                        1;
    
    const config = await dealershipConfigService.getDealershipConfig(dealershipId);
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    logger.error('Error getting dealership config', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get dealership configuration'
    });
  }
});

/**
 * Update operation mode for a dealership
 */
router.post('/mode', async (req, res) => {
  try {
    // Get dealership ID from query parameter, request body, or default to 1 for testing
    const dealershipId = Number(req.body.dealershipId) || 
                        (req.session as any).dealershipId || 
                        1;
    
    // Validate request body
    const validation = updateModeSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.format()
      });
    }
    
    const { mode, ai_config, agent_config } = validation.data;
    
    // Update mode with appropriate config
    await dealershipConfigService.updateDealershipMode(dealershipId, mode, {
      ai_config,
      agent_config
    });
    
    res.json({
      success: true,
      message: `Dealership mode updated to ${mode}`
    });
  } catch (error) {
    logger.error('Error updating dealership mode', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update dealership mode'
    });
  }
});

/**
 * Check if dealership is operating within working hours
 * (used by chat system to determine availability)
 */
router.get('/working-hours/status', async (req, res) => {
  try {
    // Get dealership ID from query parameter, request body, or default to 1 for testing
    const dealershipId = Number(req.query.dealershipId) || 
                        (req.session as any).dealershipId || 
                        1;
    
    // Check if dealership is in direct agent mode
    const isDirectMode = await dealershipConfigService.isDirectAgentMode(dealershipId);
    
    if (!isDirectMode) {
      // In Rylie AI mode, we're always available
      return res.json({
        success: true,
        available: true,
        mode: 'rylie_ai'
      });
    }
    
    // Check if within working hours
    const isWithinWorkingHours = await dealershipConfigService.isWithinWorkingHours(dealershipId);
    
    // Get current working hours
    const workingHours = await dealershipConfigService.getAgentWorkingHours(dealershipId);
    
    res.json({
      success: true,
      available: isWithinWorkingHours,
      mode: 'direct_agent',
      workingHours
    });
    
  } catch (error) {
    logger.error('Error checking working hours status', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
});

export default router;