import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { OpenAI } from 'openai';
import logger from '../utils/logger';

const router = Router();

// Define a simpler schema for the prompt test
const simplePromptSchema = z.object({
  prompt: z.string(),
  customerMessage: z.string()
});

// Initialize OpenAI with graceful fallback
let openai: OpenAI | null = null;
try {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey && !apiKey.startsWith('sk-dummy') && !apiKey.includes('placeholder')) {
    openai = new OpenAI({ apiKey });
  } else {
    console.warn('OpenAI API key not configured - simple prompt test will be disabled');
  }
} catch (error) {
  console.error('Failed to initialize OpenAI in simple-prompt-test:', error);
  openai = null;
}

/**
 * Simple prompt test endpoint that works without authentication
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    // Check if OpenAI is available
    if (!openai) {
      logger.error('OpenAI not initialized for prompt testing');
      return res.status(503).json({ 
        error: 'Service unavailable', 
        message: 'OpenAI API key is not configured. Please contact the administrator.'
      });
    }

    // Validate request data
    const { prompt, customerMessage } = simplePromptSchema.parse(req.body);
    
    logger.info('Testing prompt', { customerMessage });
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: customerMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const aiResponse = completion.choices[0].message.content || '';
    
    res.json({
      success: true,
      processedPrompt: prompt,
      aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Prompt test error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data', 
        details: error.errors 
      });
    }
    
    // Check for OpenAI-specific errors
    if (error.response?.status === 401) {
      return res.status(401).json({ 
        error: 'OpenAI API key is invalid',
        message: 'The API key provided is invalid or revoked.'
      });
    }
    
    // Return a generic error response
    res.status(500).json({ 
      error: 'Failed to test prompt',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

export default router;