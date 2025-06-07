import OpenAI from 'openai';
import logger from '../utils/logger';

const apiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (apiKey && apiKey.trim() !== '') {
  openai = new OpenAI({ apiKey });
  logger.info('AIService initialized');
} else {
  logger.warn('OPENAI_API_KEY not configured - AIService disabled');
}

export async function generateResponse(prompt: string): Promise<string> {
  if (!openai) {
    logger.warn('AI request skipped - service disabled');
    return 'AI service unavailable';
  }
  try {
    const start = Date.now();
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }]
    });
    const answer = resp.choices[0]?.message?.content || '';
    logger.info('AI response generated', { latencyMs: Date.now() - start });
    return answer;
  } catch (error) {
    logger.error('AI request failed', { error });
    return 'AI error';
  }
}
