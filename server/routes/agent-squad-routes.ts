import express from 'express';
import { hybridAIService } from '../services/hybrid-ai-service.js';
import { initializeAgentSquad, isAgentSquadReady } from '../services/agentSquad/index';
import logger from '../utils/logger.js';
import { authenticateSession } from '../middleware/auth.js';

const router = express.Router();

/**
 * Initialize Agent Squad for a dealership
 * POST /api/agent-squad/initialize
 */
router.post('/initialize', authenticateSession, async (req, res) => {
  try {
    const { dealershipId, enabled = true } = req.body;
    
    if (!dealershipId) {
      return res.status(400).json({
        success: false,
        error: 'Dealership ID is required'
      });
    }

    // Initialize Agent Squad
    const initialized = initializeAgentSquad({
      enabled,
      openaiApiKey: process.env.OPENAI_API_KEY,
      fallbackToOriginal: true
    });

    if (!initialized) {
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize Agent Squad - check OpenAI API key'
      });
    }

    logger.info('Agent Squad initialized via API', { dealershipId, enabled });

    res.json({
      success: true,
      message: 'Agent Squad initialized successfully',
      ready: isAgentSquadReady()
    });

  } catch (error) {
    logger.error('Agent Squad initialization failed', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Test Agent Squad with a sample message
 * POST /api/agent-squad/test
 */
router.post('/test', authenticateSession, async (req, res) => {
  try {
    const { message, dealershipId } = req.body;
    
    if (!message || !dealershipId) {
      return res.status(400).json({
        success: false,
        error: 'Message and dealership ID are required'
      });
    }

    if (!isAgentSquadReady()) {
      return res.status(503).json({
        success: false,
        error: 'Agent Squad is not initialized'
      });
    }

    // Test Agent Squad routing
    const result = await hybridAIService.generateResponse({
      dealershipId,
      conversationId: `test_${Date.now()}`,
      prompt: message,
      context: { 
        test: true,
        customerInfo: { name: 'Test Customer' }
      }
    });

    logger.info('Agent Squad test completed', { 
      dealershipId, 
      success: result.success,
      usedAgentSquad: result.usedAgentSquad,
      selectedAgent: result.selectedAgent
    });

    res.json({
      success: true,
      result: {
        response: result.content,
        selectedAgent: result.selectedAgent,
        usedAgentSquad: result.usedAgentSquad,
        confidence: result.confidence,
        fallbackReason: result.fallbackReason
      }
    });

  } catch (error) {
    logger.error('Agent Squad test failed', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get Agent Squad status and health
 * GET /api/agent-squad/status
 */
router.get('/status', authenticateSession, async (req, res) => {
  try {
    const healthStatus = await hybridAIService.getHealthStatus();
    const config = hybridAIService.getConfig();

    res.json({
      success: true,
      status: {
        ready: isAgentSquadReady(),
        health: healthStatus,
        config: {
          useAgentSquad: config.useAgentSquad,
          fallbackToOriginal: config.fallbackToOriginal
        }
      }
    });

  } catch (error) {
    logger.error('Agent Squad status check failed', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Update Agent Squad configuration
 * PUT /api/agent-squad/config
 */
router.put('/config', authenticateSession, async (req, res) => {
  try {
    const { useAgentSquad, fallbackToOriginal } = req.body;

    hybridAIService.updateConfig({
      useAgentSquad: useAgentSquad !== undefined ? useAgentSquad : undefined,
      fallbackToOriginal: fallbackToOriginal !== undefined ? fallbackToOriginal : undefined
    });

    logger.info('Agent Squad configuration updated', { 
      useAgentSquad, 
      fallbackToOriginal 
    });

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      config: hybridAIService.getConfig()
    });

  } catch (error) {
    logger.error('Agent Squad config update failed', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;