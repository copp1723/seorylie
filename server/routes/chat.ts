// File: /server/routes/chat.ts
// Purpose: Handles chat interactions with OpenRouter API for Q&A responses in the RylieSEO platform.
// Detects task creation intent and suggests options to the frontend for dynamic button display.
// Deployment Note for Render: Ensure 'axios' is in package.json for API calls. Set OPEN_ROUTER in Render environment variables.
// Include this route in your main app file (e.g., server/index.js) with `app.use('/api/chat', require('./routes/chat'));`.
// Render will deploy this as part of the Node.js service; ensure internet access for OpenRouter API calls.

import express from 'express';
import axios from 'axios';
const router = express.Router();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPEN_ROUTER || '';

// POST /api/chat/message - Send user message to OpenRouter and detect task intent
router.post('/message', async (req, res) => {
  const { message, conversationHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  if (!OPENROUTER_API_KEY) {
    console.error('OpenRouter API key is not set in environment variables');
    return res.status(500).json({ error: 'Chat service is not configured properly' });
  }

  // Simple intent detection for task creation based on keywords
  const lowerMessage = message.toLowerCase();
  const isTaskIntent = lowerMessage.includes('create') || 
                      lowerMessage.includes('build') || 
                      lowerMessage.includes('page') || 
                      lowerMessage.includes('blog') || 
                      lowerMessage.includes('gbp') || 
                      lowerMessage.includes('post');

  // Customize system prompt based on intent detection
  const systemPrompt = isTaskIntent 
    ? "You are an SEO assistant. Answer the user's question and suggest creating a task if relevant. End with: 'Would you like to create a task for this? I can help with options like Landing Page, Blog Post, or GBP Post.'"
    : "You are an SEO assistant. Answer the user's question about SEO concisely and helpfully.";

  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: 'claude-3-opus-20240229', // Or another suitable model from OpenRouter; adjust based on cost/performance needs
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: message },
        ],
        temperature: 0.7, // Adjust for creativity vs. accuracy as needed
        max_tokens: 500, // Limit response length for performance
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout to prevent hanging
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    // Return task suggestion flag and options if intent detected
    const suggestTask = isTaskIntent ? {
      taskSuggestion: true,
      taskOptions: ['landing_page', 'blog_post', 'gbp_post'],
    } : { taskSuggestion: false };

    return res.json({ response: aiResponse, ...suggestTask });
  } catch (error) {
    console.error('OpenRouter API error:', error.message || error);
    return res.status(500).json({ error: 'Failed to get response from chat API. Please try again.' });
  }
});

export default router;