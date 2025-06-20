/**
 * Enhanced Chat API Routes
 * Provides intelligent chat responses with real data integration
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { pool } from '../db/index.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const chatMessageSchema = z.object({
  message: z.string().min(1).max(1000),
  conversationId: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })).optional().default([])
});

// Question pattern detection
const QUESTION_PATTERNS = {
  taskStatus: [
    /what tasks? (have been|were) (completed|done)/i,
    /what('s| is) (completed|done|finished)/i,
    /completed tasks/i,
    /finished work/i,
    /what('s| is) scheduled/i,
    /this week('s| tasks)?/i,
    /upcoming tasks/i
  ],
  analytics: [
    /weekly analytics/i,
    /monthly analytics/i,
    /organic traffic/i,
    /traffic (this month|last month|compared to)/i,
    /compare.*traffic/i,
    /year over year/i,
    /rankings?/i,
    /keyword performance/i
  ],
  packageDetails: [
    /what('s| is) included/i,
    /monthly (seo )?package/i,
    /my package/i,
    /platinum|gold|silver/i,
    /seo services/i
  ],
  competitorAnalysis: [
    /competitors?/i,
    /compare.*dealers?/i,
    /other dealers?/i,
    /market comparison/i,
    /how does my.*compare/i,
    /(f-?150|mustang|explorer|ford).*competitors?/i
  ],
  seoImprovement: [
    /improve.*seo/i,
    /better rankings?/i,
    /optimize.*pages?/i,
    /seo recommendations/i,
    /how (can|do) i improve/i,
    /google search console/i,
    /ga4|google analytics/i
  ]
};

/**
 * Categorize user question for intelligent routing
 */
function categorizeQuestion(input: string): string | null {
  const lowerInput = input.toLowerCase();
  
  for (const [category, patterns] of Object.entries(QUESTION_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(lowerInput))) {
      return category;
    }
  }
  
  return null;
}

/**
 * Generate task status response with real data
 */
async function generateTaskStatusResponse(dealershipId: string, userInput: string): Promise<any> {
  try {
    // Fetch real task data
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/tasks/status?dealershipId=${dealershipId}`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch task data');
    }
    
    const taskData = await response.json();
    const { taskSummary, recentCompletions } = taskData;

    if (userInput.toLowerCase().includes('completed') || userInput.toLowerCase().includes('done')) {
      const taskList = recentCompletions.map((task: any) => 
        `• **${task.post_title || task.task_type}** - Completed ${new Date(task.completion_date).toLocaleDateString()}`
      ).join('\n');
      
      return {
        content: `Here are your recently completed SEO tasks:\n\n${taskList}\n\n${taskSummary.totalCompleted} tasks completed this month. Great progress! 🎉`
      };
    }

    if (userInput.toLowerCase().includes('scheduled') || userInput.toLowerCase().includes('week')) {
      const inProgressList = taskSummary.inProgress.map((task: any) => 
        `• **${task.post_title || task.task_type}** - In Progress`
      ).join('\n');
      
      const scheduledList = taskSummary.scheduled.map((task: any) => 
        `• **${task.post_title || task.task_type}** - Scheduled`
      ).join('\n');

      return {
        content: `**Currently In Progress:**\n${inProgressList || 'No tasks in progress'}\n\n**Upcoming Tasks:**\n${scheduledList || 'No scheduled tasks'}\n\nYour SEO team is actively working on these items!`
      };
    }

    // General task overview
    return {
      content: `**Your SEO Task Overview:**\n\n**✅ Completed (${taskSummary.totalCompleted}):**\n${taskSummary.completed.map((t: any) => `• ${t.post_title || t.task_type}`).slice(0, 5).join('\n')}\n\n**🔄 In Progress (${taskSummary.totalInProgress}):**\n${taskSummary.inProgress.map((t: any) => `• ${t.post_title || t.task_type}`).join('\n')}\n\n**📅 Scheduled (${taskSummary.totalScheduled}):**\n${taskSummary.scheduled.map((t: any) => `• ${t.post_title || t.task_type}`).join('\n')}`
    };
  } catch (error) {
    logger.error('Error generating task status response', { error });
    return {
      content: 'I encountered an error fetching your task data. Please try again or contact support.'
    };
  }
}

/**
 * Generate analytics response with real data
 */
async function generateAnalyticsResponse(dealershipId: string, userInput: string): Promise<any> {
  try {
    // Fetch real analytics data
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/tasks/analytics-summary?dealershipId=${dealershipId}`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch analytics data');
    }
    
    const analyticsData = await response.json();

    if (!analyticsData.hasGA4) {
      return {
        content: `**GA4 Setup Required**\n\nTo provide analytics insights, you'll need to connect your Google Analytics 4 property.\n\n[Set up GA4 integration](${analyticsData.setupUrl})`,
        hasRequestButton: true,
        requestData: {
          type: 'ga4-setup',
          query: 'Help setting up GA4 integration for analytics tracking',
          context: { setupUrl: analyticsData.setupUrl }
        }
      };
    }

    const { analytics, period } = analyticsData;

    if (userInput.toLowerCase().includes('weekly')) {
      return {
        content: `**Weekly Analytics Summary:**\n\n📈 **Organic Traffic:** ${analytics.organicTraffic.thisMonth.toLocaleString()} visits this month\n📊 **Growth:** ${analytics.growth.traffic > 0 ? '+' : ''}${analytics.growth.traffic}% vs last month\n🎯 **Average Ranking:** Position ${analytics.rankings.averagePosition.toFixed(1)}\n\n**Top Performing Keywords:**\n${analytics.rankings.topKeywords.map((k: string) => `• ${k}`).join('\n')}`
      };
    }

    if (userInput.toLowerCase().includes('year') || userInput.toLowerCase().includes('compare')) {
      return {
        content: `**Year-over-Year Traffic Comparison:**\n\n📈 **This Month:** ${analytics.organicTraffic.thisMonth.toLocaleString()} visits\n📊 **Year-over-Year Growth:** +${analytics.organicTraffic.yearOverYear.toFixed(1)}%\n\n**Improving Keywords:**\n${analytics.rankings.improvingKeywords.map((k: string) => `• ${k}`).join('\n')}\n\nYour SEO performance is trending upward! 🚀`
      };
    }

    return {
      content: `**SEO Analytics for ${period.current}:**\n\n📈 **Organic Traffic:**\n• This month: ${analytics.organicTraffic.thisMonth.toLocaleString()} visits\n• Last month: ${analytics.organicTraffic.lastMonth.toLocaleString()} visits\n• Growth: ${analytics.growth.traffic > 0 ? '+' : ''}${analytics.growth.traffic}%\n\n🎯 **Rankings:**\n• Average position: ${analytics.rankings.averagePosition.toFixed(1)}\n• Top keywords: ${analytics.rankings.topKeywords.slice(0, 3).join(', ')}\n\n🎯 **Conversions:**\n• This month: ${analytics.conversions.thisMonth}\n• Growth: ${analytics.growth.conversions > 0 ? '+' : ''}${analytics.growth.conversions}%`
    };
  } catch (error) {
    logger.error('Error generating analytics response', { error });
    return {
      content: 'I encountered an error fetching your analytics data. Please try again or contact support.'
    };
  }
}

/**
 * Generate package details response with real data
 */
async function generatePackageResponse(dealershipId: string): Promise<any> {
  try {
    // Fetch real package data
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/tasks/package-info?dealershipId=${dealershipId}`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch package data');
    }
    
    const packageData = await response.json();
    const { dealership, package: pkg } = packageData;

    return {
      content: `**Your ${pkg.name} SEO Package for ${dealership.name}:**\n\n**Monthly Features:**\n${pkg.monthlyFeatures.map((f: string) => `✅ ${f}`).join('\n')}\n\n**Always Included:**\n${pkg.included.map((f: string) => `✅ ${f}`).join('\n')}\n\nYour package is designed to maximize ${dealership.brand} dealership visibility and drive qualified traffic to your ${dealership.targetModels.join(', ')} inventory!`
    };
  } catch (error) {
    logger.error('Error generating package response', { error });
    return {
      content: 'I encountered an error fetching your package information. Please try again or contact support.'
    };
  }
}

/**
 * Generate competitor analysis response with escalation
 */
async function generateCompetitorResponse(dealershipId: string, userInput: string): Promise<any> {
  try {
    // Fetch dealership context for competitor analysis
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/tasks/package-info?dealershipId=${dealershipId}`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch dealership data');
    }
    
    const { dealership } = await response.json();

    // Extract vehicle model if mentioned
    const mentionedModel = dealership.targetModels?.find((model: string) => 
      userInput.toLowerCase().includes(model.toLowerCase())
    );

    if (mentionedModel) {
      return {
        content: `**${mentionedModel} Market Analysis for ${dealership.name}:**\n\n🎯 **Competitive Focus Areas:**\n• Local ${mentionedModel} inventory pages\n• ${mentionedModel} comparison content\n• Service and parts optimization\n• Local search dominance in ${dealership.targetCities.join(', ')}\n\n📊 **Recent Optimizations:**\n• Updated ${mentionedModel} landing pages\n• Enhanced local search presence\n• Improved inventory feed optimization\n\nWould you like our SEO team to provide a detailed competitive analysis for ${mentionedModel} in your market area?`,
        hasRequestButton: true,
        requestData: {
          type: 'competitor-analysis',
          query: `Detailed competitive analysis for ${mentionedModel} in ${dealership.targetCities.join(', ')} market`,
          context: { model: mentionedModel, cities: dealership.targetCities, dealership: dealership.name }
        }
      };
    }

    return {
      content: `**Competitive Analysis for ${dealership.name}:**\n\n🎯 **Your Competitive Advantages:**\n• Strong ${dealership.brand} brand presence\n• Optimized for: ${dealership.targetModels.join(', ')}\n• Local market focus in ${dealership.targetCities.join(', ')}\n\n📈 **Strategic Focus:**\n• Local search optimization\n• Vehicle-specific landing pages\n• Service department visibility\n\nWould you like our team to provide a comprehensive competitive analysis with specific improvement recommendations for your market?`,
      hasRequestButton: true,
      requestData: {
        type: 'competitor-analysis',
        query: `Comprehensive competitive analysis for ${dealership.name} in ${dealership.targetCities.join(', ')} market`,
        context: { dealership: dealership.name, models: dealership.targetModels, cities: dealership.targetCities }
      }
    };
  } catch (error) {
    logger.error('Error generating competitor response', { error });
    return {
      content: 'I encountered an error fetching competitor analysis data. Please try again or contact support.'
    };
  }
}

/**
 * Generate SEO improvement response with escalation
 */
async function generateSEOImprovementResponse(dealershipId: string): Promise<any> {
  try {
    // Fetch dealership context
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/tasks/package-info?dealershipId=${dealershipId}`, {
      headers: { 'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}` }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch dealership data');
    }
    
    const { dealership } = await response.json();

    return {
      content: `**SEO Improvement Recommendations for ${dealership.name}:**\n\n🔍 **Quick Wins:**\n• Update meta descriptions for ${dealership.targetModels.join(', ')} pages\n• Enhance Google My Business optimization\n• Improve local citation consistency\n• Add customer reviews to vehicle pages\n\n📊 **Strategic Opportunities:**\n• Vehicle-specific content expansion\n• Local search optimization in ${dealership.targetCities.join(', ')}\n• Technical SEO improvements\n• Mobile user experience optimization\n\n**Custom Analysis:**\nOur SEO experts can provide a detailed audit with specific, actionable recommendations tailored to your ${dealership.brand} dealership.\n\nWould you like our team to create a custom improvement plan?`,
      hasRequestButton: true,
      requestData: {
        type: 'seo-improvement',
        query: `Custom SEO improvement plan for ${dealership.name} focusing on ${dealership.targetModels.join(', ')} and local search optimization in ${dealership.targetCities.join(', ')}`,
        context: { dealership: dealership.name, models: dealership.targetModels, cities: dealership.targetCities }
      }
    };
  } catch (error) {
    logger.error('Error generating SEO improvement response', { error });
    return {
      content: 'I encountered an error generating SEO recommendations. Please try again or contact support.'
    };
  }
}

/**
 * Process chat message with intelligent routing
 * POST /api/chat/message
 */
router.post('/message', async (req: Request, res: Response) => {
  try {
    const validation = chatMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.format()
      });
    }

    const { message, conversationId, history } = validation.data;
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Categorize the question
    const category = categorizeQuestion(message);
    let response;

    switch (category) {
      case 'taskStatus':
        response = await generateTaskStatusResponse(dealershipId, message);
        break;
      
      case 'analytics':
        response = await generateAnalyticsResponse(dealershipId, message);
        break;
      
      case 'packageDetails':
        response = await generatePackageResponse(dealershipId);
        break;
      
      case 'competitorAnalysis':
        response = await generateCompetitorResponse(dealershipId, message);
        break;
      
      case 'seoImprovement':
        response = await generateSEOImprovementResponse(dealershipId);
        break;
      
      default:
        response = {
          content: `I understand you're asking about "${message}". As your SEO assistant, I can help with:\n\n• **Task Status**: "What tasks have been completed?"\n• **Analytics**: "What are my weekly analytics?"\n• **Package Details**: "What's included in my SEO package?"\n• **Competitor Analysis**: "How does my F-150 compare to competitors?"\n• **SEO Improvements**: "How can I improve my SEO?"\n\nWhat specific area would you like to explore?`
        };
    }

    // Store conversation if conversationId provided
    if (conversationId) {
      try {
        await pool.query(
          `INSERT INTO chat_conversations (id, dealership_id, last_message, last_response, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE SET
           last_message = EXCLUDED.last_message,
           last_response = EXCLUDED.last_response,
           updated_at = EXCLUDED.updated_at`,
          [conversationId, dealershipId, message, response.content]
        );
      } catch (dbError) {
        logger.warn('Failed to store conversation', { error: dbError });
      }
    }

    res.json({
      success: true,
      response: response.content,
      hasRequestButton: response.hasRequestButton || false,
      requestData: response.requestData,
      category,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error processing chat message', { error });
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Submit escalation request from chat
 * POST /api/chat/submit-request
 */
router.post('/submit-request', async (req: Request, res: Response) => {
  try {
    const { type, query, context } = req.body;
    const dealershipId = req.session?.dealershipId || req.body.dealershipId;

    if (!dealershipId) {
      return res.status(401).json({ error: 'No dealership context' });
    }

    // Forward to task creation endpoint
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/tasks/chat-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`
      },
      body: JSON.stringify({
        type,
        description: query,
        context,
        dealershipId,
        priority: 'normal',
        source: 'chat-assistant'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to submit request');
    }

    const result = await response.json();

    res.json({
      success: true,
      message: result.message,
      requestId: result.request.id
    });

  } catch (error: any) {
    logger.error('Error submitting chat request', { error });
    res.status(500).json({
      success: false,
      message: 'There was an error submitting your request. Please try again or contact support.'
    });
  }
});

export default router;

