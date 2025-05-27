import express from 'express';
import { OpenAI } from 'openai';
import { z } from 'zod';
import logger from '../utils/logger';

const router = express.Router();

// Initialize OpenAI with graceful fallback
let openai: OpenAI | null = null;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && apiKey !== 'sk-actualOpenAIKeyHere') {
    openai = new OpenAI({ apiKey });
  } else {
    console.warn('OpenAI API key not configured - test system prompt will be disabled');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI in test-system-prompt:', error);
  openai = null;
}

// Validation schema for the request body
const promptTestSchema = z.object({
  systemPrompt: z.string(),
  customerMessage: z.string()
});

router.post('/api/test-system-prompt', async (req, res) => {
  try {
    if (!openai) {
      logger.error('OpenAI not initialized for test system prompt');
      return res.status(503).json({ 
        error: 'Service unavailable', 
        message: 'OpenAI API key is not configured. Please contact the administrator.'
      });
    }

    // Validate the request body
    const validatedData = promptTestSchema.parse(req.body);
    const { systemPrompt, customerMessage } = validatedData;

    logger.info('Testing system prompt', {
      messageLength: customerMessage.length
    });
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: customerMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const response = completion.choices[0].message.content;
    
    // Return the AI's response
    return res.status(200).json({
      response,
      usage: completion.usage
    });
  } catch (error) {
    logger.error('Error testing system prompt', { 
      error: (error instanceof Error) ? error.message : 'Unknown error',
      stack: (error instanceof Error) ? error.stack : undefined
    });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    
    return res.status(500).json({ error: 'Failed to test system prompt', message: (error instanceof Error) ? error.message : 'Unknown error' });
  }
});

export default router;