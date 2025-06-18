import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { seoWorksChatService } from '../services/seoworks-chat-service';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// Chat endpoints require authentication
router.use(authMiddleware);

/**
 * Get greeting and suggested questions
 */
router.get('/api/seoworks/chat/init', async (req: Request, res: Response) => {
  try {
    const dealershipId = req.user?.tenantId || req.query.dealershipId as string;

    const [greeting, suggestedQuestions] = await Promise.all([
      seoWorksChatService.generateGreeting(dealershipId),
      seoWorksChatService.getSuggestedQuestions(dealershipId),
    ]);

    res.json({
      greeting,
      suggestedQuestions,
    });
  } catch (error) {
    console.error('Error initializing chat:', error);
    res.status(500).json({ error: 'Failed to initialize chat' });
  }
});

/**
 * Process a chat message
 */
router.post('/api/seoworks/chat/message', async (req: Request, res: Response) => {
  try {
    const { message, conversationId, history = [] } = req.body;
    const dealershipId = req.user?.tenantId || req.body.dealershipId;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Process the message
    const result = await seoWorksChatService.processMessage(
      message,
      dealershipId,
      history
    );

    // Store conversation in database if conversationId provided
    if (conversationId) {
      await supabaseAdmin
        .from('chat_conversations')
        .upsert({
          id: conversationId,
          dealership_id: dealershipId,
          user_id: req.user?.id,
          last_message: message,
          last_response: result.response,
          updated_at: new Date().toISOString(),
        });
    }

    res.json({
      response: result.response,
      context: result.context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Get conversation history
 */
router.get('/api/seoworks/chat/history/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const dealershipId = req.user?.tenantId;

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('dealership_id', dealershipId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;