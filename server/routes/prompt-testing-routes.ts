import { Router } from 'express';
import db from "../db";
import { personas } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { generateAIResponse, generateResponseAnalysis, generateHandoverDossier } from '../services/openai';
import { enhancedConversationService } from '../services/enhanced-conversation-service';
import logger from '../utils/logger';
import { authenticationMiddleware } from '../middleware/authentication';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticationMiddleware);

// Test a prompt with variables and real AI
router.post('/test', async (req, res) => {
  try {
    // Check if user is authenticated (supports both session and development bypass)
    if (!req.session?.userId && !req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { prompt, variables, customerMessage, dealershipId, includeInventory } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Process the prompt template with variables
    let processedPrompt = prompt;
    
    if (variables && typeof variables === 'object') {
      // Replace template variables (e.g., {{variable_name}})
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processedPrompt = processedPrompt.replace(regex, String(value));
      });
    }

    // Use real AI response with inventory integration
    const testMessage = customerMessage || "Hello, I'm interested in learning more about your vehicles.";
    const aiResponse = await generateAIResponse(
      processedPrompt,
      testMessage,
      includeInventory ? dealershipId : undefined
    );

    // Generate response analysis
    const analysis = await generateResponseAnalysis(processedPrompt, testMessage);

    logger.info('Prompt test completed', {
      userId: req.session.userId,
      promptLength: prompt.length,
      includeInventory,
      dealershipId
    });

    res.json({
      success: true,
      processedPrompt,
      aiResponse,
      testMessage,
      analysis,
      includeInventory: includeInventory || false,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Prompt test error:', error);
    res.status(500).json({ 
      error: 'Failed to test prompt',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

// Preview persona with test message
router.post('/preview-persona', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { personaId, testMessage, dealershipId, includeInventory } = req.body;
    
    if (!personaId) {
      return res.status(400).json({ error: 'Persona ID is required' });
    }

    // Get persona details
    const persona = await db
      .select()
      .from(personas)
      .where(eq(personas.id, personaId))
      .limit(1);

    if (persona.length === 0) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    const personaData = persona[0];

    // Process prompt template with persona arguments
    let processedPrompt = personaData.promptTemplate;
    if (personaData.arguments && typeof personaData.arguments === 'object') {
      Object.entries(personaData.arguments).forEach(([key, value]) => {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processedPrompt = processedPrompt.replace(regex, String(value));
      });
    }

    // Generate AI response
    const customerMessage = testMessage || "Hello, I'm interested in learning more about your vehicles.";
    const aiResponse = await generateAIResponse(
      processedPrompt,
      customerMessage,
      includeInventory ? dealershipId : undefined
    );

    logger.info('Persona preview completed', {
      personaId,
      personaName: personaData.name,
      includeInventory,
      dealershipId
    });

    res.json({
      success: true,
      persona: {
        id: personaData.id,
        name: personaData.name,
        promptTemplate: personaData.promptTemplate,
        arguments: personaData.arguments
      },
      processedPrompt,
      testMessage: customerMessage,
      aiResponse,
      includeInventory: includeInventory || false,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Persona preview error:', error);
    res.status(500).json({ 
      error: 'Failed to preview persona',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

// Get personas for current dealership
router.get('/personas', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { dealershipId } = req.query;
    
    if (!dealershipId) {
      return res.status(400).json({ error: 'Dealership ID is required' });
    }

    const personaList = await db
      .select({
        id: personas.id,
        name: personas.name,
        isDefault: personas.isDefault,
        promptTemplate: personas.promptTemplate,
        arguments: personas.arguments,
        createdAt: personas.created_at,
        updatedAt: personas.updated_at
      })
      .from(personas)
      .where(eq(personas.dealershipId, parseInt(dealershipId as string)))
      .orderBy(personas.name);

    res.json({
      personas: personaList
    });

  } catch (error: any) {
    logger.error('Error fetching personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

// Generate handover dossier
router.post('/generate-handover', async (req, res) => {
  try {
    // Check if user is authenticated (supports both session and development bypass)
    if (!req.session?.userId && !req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { conversationHistory, customerScenario } = req.body;
    
    if (!conversationHistory && !customerScenario) {
      return res.status(400).json({ error: 'Conversation history or customer scenario is required' });
    }

    // Format conversation history as a string if it's an array
    let conversationText = '';
    if (Array.isArray(conversationHistory)) {
      conversationText = conversationHistory.map((msg: any) => 
        `${msg.role === 'customer' ? 'Customer' : 'Assistant'}: ${msg.content}`
      ).join('\n');
    } else {
      conversationText = conversationHistory || customerScenario;
    }

    // Generate handover dossier
    const handoverDossier = await generateHandoverDossier(conversationText, customerScenario || conversationText);

    logger.info('Handover dossier generated', {
      userId: req.session?.userId || req.user?.userId,
      conversationLength: conversationText.length
    });

    res.json({
      success: true,
      handoverDossier,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Handover generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate handover dossier',
      message: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : 'Internal server error'
    });
  }
});

export default router;