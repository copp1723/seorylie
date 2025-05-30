/**
 * Conversation API Routes
 * External API access to AI conversation capabilities
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { apiAuth } from '../middleware/api-auth';
import { enhancedAIService } from '../services/enhanced-ai-service';
import logger from '../utils/logger';

const router = Router();

/**
 * Generate AI conversation reply
 * @route POST /api/v1/conversation/reply
 */
router.post('/reply', 
  apiAuth('conversation:reply'),
  [
    body('customer').isObject().withMessage('Customer information is required'),
    body('conversation_history').isArray().withMessage('Conversation history must be an array'),
    body('context').isObject().withMessage('Context is required'),
    body('context.dealership_id').notEmpty().withMessage('Dealership ID is required'),
  ],
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'validation_error', 
          details: errors.array() 
        });
      }

      const { customer, conversation_history, context } = req.body;
      
      // Format conversation for AI service
      const conversationId = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const lastMessage = conversation_history[conversation_history.length - 1];
      
      if (!lastMessage || lastMessage.role !== 'customer') {
        return res.status(400).json({
          error: 'invalid_conversation',
          message: 'Last message must be from customer'
        });
      }

      // Generate AI response
      const reply = await enhancedAIService.generateResponse(
        conversationId,
        lastMessage.message,
        context.dealership_id,
        conversation_history
      );

      // Mock intent detection for now
      const intents = ['vehicle_inquiry', 'pricing_request', 'test_drive', 'financing'];
      const intent_detected = intents[Math.floor(Math.random() * intents.length)];
      
      const responseTime = Date.now() - startTime;

      logger.info('Conversation reply generated', {
        clientId: req.apiClient?.clientId,
        dealershipId: context.dealership_id,
        responseTime
      });

      return res.json({
        reply,
        confidence: 0.85 + Math.random() * 0.1, // Mock confidence 0.85-0.95
        intent_detected,
        suggested_actions: ['send_pricing', 'schedule_test_drive'],
        response_time_ms: responseTime
      });

    } catch (error) {
      logger.error('Error generating conversation reply', { error });
      
      return res.status(500).json({
        error: 'generation_failed',
        message: 'Failed to generate AI response',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }
);

export default router;
