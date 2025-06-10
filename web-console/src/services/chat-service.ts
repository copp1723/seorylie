/**
 * Enhanced Chat Service for Dealership SEO Assistant
 * Handles intelligent question routing, data integration, and request escalation
 */

import { getMockClientData, type ClientData } from './seowerks-integration';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  isLoading?: boolean;
  hasRequestButton?: boolean;
  requestData?: {
    type: string;
    query: string;
    context?: any;
  };
}

export interface ChatResponse {
  content: string;
  hasRequestButton?: boolean;
  requestData?: {
    type: string;
    query: string;
    context?: any;
  };
}

/**
 * Question categories for intelligent routing
 */
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
 * Analyze user input to determine question category
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
 * Generate task status response
 */
function generateTaskStatusResponse(clientData: ClientData, userInput: string): ChatResponse {
  const { recentTasks } = clientData;
  const completedTasks = recentTasks.filter(task => task.status === 'completed');
  const scheduledTasks = recentTasks.filter(task => task.status === 'scheduled');
  const inProgressTasks = recentTasks.filter(task => task.status === 'in-progress');

  if (userInput.toLowerCase().includes('completed') || userInput.toLowerCase().includes('done')) {
    const taskList = completedTasks.map(task => 
      `• **${task.title}** - Completed ${task.completedDate}`
    ).join('\n');
    
    return {
      content: `Here are your recently completed SEO tasks:\n\n${taskList}\n\n${completedTasks.length} tasks completed this month. Great progress! 🎉`
    };
  }

  if (userInput.toLowerCase().includes('scheduled') || userInput.toLowerCase().includes('week')) {
    const taskList = scheduledTasks.map(task => 
      `• **${task.title}** - Scheduled for ${task.scheduledDate}`
    ).join('\n');
    
    const progressList = inProgressTasks.map(task => 
      `• **${task.title}** - In Progress`
    ).join('\n');

    return {
      content: `**Upcoming Tasks:**\n${taskList}\n\n**Currently In Progress:**\n${progressList}\n\nYour SEO team is actively working on these items!`
    };
  }

  // General task overview
  return {
    content: `**Your SEO Task Overview:**\n\n**✅ Completed (${completedTasks.length}):**\n${completedTasks.map(t => `• ${t.title}`).join('\n')}\n\n**🔄 In Progress (${inProgressTasks.length}):**\n${inProgressTasks.map(t => `• ${t.title}`).join('\n')}\n\n**📅 Scheduled (${scheduledTasks.length}):**\n${scheduledTasks.map(t => `• ${t.title}`).join('\n')}`
  };
}

/**
 * Generate analytics response
 */
function generateAnalyticsResponse(clientData: ClientData, userInput: string): ChatResponse {
  const { analytics, dealerName } = clientData;
  const { organicTraffic, rankings } = analytics;

  if (userInput.toLowerCase().includes('weekly')) {
    return {
      content: `**Weekly Analytics Summary for ${dealerName}:**\n\n📈 **Organic Traffic:** ${organicTraffic.thisMonth.toLocaleString()} visits this month\n📊 **Growth:** +${((organicTraffic.thisMonth - organicTraffic.lastMonth) / organicTraffic.lastMonth * 100).toFixed(1)}% vs last month\n🎯 **Average Ranking:** Position ${rankings.averagePosition}\n\n**Top Performing Keywords:**\n${rankings.topKeywords.map(k => `• ${k}`).join('\n')}`
    };
  }

  if (userInput.toLowerCase().includes('year') || userInput.toLowerCase().includes('compare')) {
    return {
      content: `**Year-over-Year Traffic Comparison:**\n\n📈 **This Month:** ${organicTraffic.thisMonth.toLocaleString()} visits\n📊 **Year-over-Year Growth:** +${organicTraffic.yearOverYear}%\n\n**Improving Keywords:**\n${rankings.improvingKeywords.map(k => `• ${k}`).join('\n')}\n\nYour SEO performance is trending upward! 🚀`
    };
  }

  return {
    content: `**${dealerName} SEO Analytics:**\n\n📈 **Organic Traffic:**\n• This month: ${organicTraffic.thisMonth.toLocaleString()} visits\n• Last month: ${organicTraffic.lastMonth.toLocaleString()} visits\n• Growth: +${((organicTraffic.thisMonth - organicTraffic.lastMonth) / organicTraffic.lastMonth * 100).toFixed(1)}%\n\n🎯 **Rankings:**\n• Average position: ${rankings.averagePosition}\n• Top keywords: ${rankings.topKeywords.slice(0, 3).join(', ')}`
  };
}

/**
 * Generate package details response
 */
function generatePackageResponse(clientData: ClientData): ChatResponse {
  const { package: pkg, dealerName } = clientData;
  
  const packageFeatures = {
    PLATINUM: [
      "✅ 8 optimized landing pages per month",
      "✅ 4 blog posts with local SEO focus", 
      "✅ Weekly technical SEO audits",
      "✅ Competitor analysis and monitoring",
      "✅ Google Ads integration and optimization",
      "✅ Priority support and monthly strategy calls"
    ],
    GOLD: [
      "✅ 5 optimized landing pages per month",
      "✅ 2 blog posts with local SEO focus",
      "✅ Bi-weekly technical SEO audits", 
      "✅ Monthly competitor analysis",
      "✅ Google My Business optimization",
      "✅ Standard support with quarterly reviews"
    ],
    SILVER: [
      "✅ 3 optimized landing pages per month",
      "✅ 1 blog post with local SEO focus",
      "✅ Monthly technical SEO audits",
      "✅ Basic competitor monitoring",
      "✅ Google My Business setup",
      "✅ Email support with monthly reports"
    ]
  };

  return {
    content: `**Your ${pkg} SEO Package for ${dealerName}:**\n\n${packageFeatures[pkg].join('\n')}\n\nYour package is designed to maximize your dealership's online visibility and drive qualified traffic to your inventory!`
  };
}

/**
 * Generate competitor analysis response with escalation option
 */
function generateCompetitorResponse(clientData: ClientData, userInput: string): ChatResponse {
  const { targetVehicleModels, targetDealers, dealerName, mainBrand } = clientData;
  
  // Extract vehicle model if mentioned
  const mentionedModel = targetVehicleModels.find(model => 
    userInput.toLowerCase().includes(model.toLowerCase())
  );

  if (mentionedModel) {
    return {
      content: `**${mentionedModel} Market Analysis for ${dealerName}:**\n\n🎯 **Your Target Competitors:**\n${targetDealers.map(d => `• ${d}`).join('\n')}\n\n📊 **Current Focus Areas:**\n• Local ${mentionedModel} inventory pages\n• ${mentionedModel} comparison content\n• Service and parts optimization\n\n**Recent Actions:**\n• Optimized your ${mentionedModel} landing page\n• Created local search content\n• Updated inventory feeds\n\nWould you like our SEO team to dive deeper into your ${mentionedModel} competitive positioning and provide custom recommendations?`,
      hasRequestButton: true,
      requestData: {
        type: 'competitor-analysis',
        query: `Detailed competitive analysis for ${mentionedModel} against ${targetDealers.join(', ')}`,
        context: { model: mentionedModel, competitors: targetDealers }
      }
    };
  }

  return {
    content: `**Competitive Analysis for ${dealerName}:**\n\n🎯 **Your Main Competitors:**\n${targetDealers.map(d => `• ${d}`).join('\n')}\n\n📈 **Your Competitive Advantages:**\n• Strong ${mainBrand} brand presence\n• Optimized for: ${targetVehicleModels.join(', ')}\n• Local market focus\n\nWould you like our team to provide a detailed competitive analysis with specific improvement recommendations?`,
    hasRequestButton: true,
    requestData: {
      type: 'competitor-analysis',
      query: `Comprehensive competitive analysis for ${dealerName} vs ${targetDealers.join(', ')}`,
      context: { competitors: targetDealers, models: targetVehicleModels }
    }
  };
}

/**
 * Generate SEO improvement response with escalation
 */
function generateSEOImprovementResponse(clientData: ClientData, _userInput: string): ChatResponse {
  const { dealerName, targetVehicleModels } = clientData;
  
  return {
    content: `**SEO Improvement Recommendations for ${dealerName}:**\n\n🔍 **Quick Wins:**\n• Update meta descriptions for ${targetVehicleModels.join(', ')} pages\n• Add customer reviews to vehicle pages\n• Optimize local business listings\n\n📊 **Based on your data:**\n• Google Search Console shows opportunities in local search\n• GA4 indicates strong mobile traffic potential\n• Recent page speed improvements are showing results\n\n**Next Steps:**\nOur SEO experts can provide a detailed audit with specific, actionable recommendations tailored to your dealership.\n\nWould you like our team to review your current performance and create a custom improvement plan?`,
    hasRequestButton: true,
    requestData: {
      type: 'seo-improvement',
      query: `Custom SEO improvement plan for ${dealerName} focusing on ${targetVehicleModels.join(', ')} and local search optimization`,
      context: { dealership: dealerName, models: targetVehicleModels }
    }
  };
}

/**
 * Main chat response generator
 */
export async function generateChatResponse(userInput: string): Promise<ChatResponse> {
  const clientData = getMockClientData();
  const category = categorizeQuestion(userInput);

  switch (category) {
    case 'taskStatus':
      return generateTaskStatusResponse(clientData, userInput);
    
    case 'analytics':
      return generateAnalyticsResponse(clientData, userInput);
    
    case 'packageDetails':
      return generatePackageResponse(clientData);
    
    case 'competitorAnalysis':
      return generateCompetitorResponse(clientData, userInput);
    
    case 'seoImprovement':
      return generateSEOImprovementResponse(clientData, userInput);
    
    default:
      return {
        content: `I understand you're asking about "${userInput}". As your SEO assistant, I can help with:\n\n• **Task Status**: "What tasks have been completed?"\n• **Analytics**: "What are my weekly analytics?"\n• **Package Details**: "What's included in my SEO package?"\n• **Competitor Analysis**: "How does my F-150 compare to competitors?"\n• **SEO Improvements**: "How can I improve my SEO?"\n\nWhat specific area would you like to explore?`
      };
  }
}

/**
 * Submit escalation request to SEO team
 */
export async function submitSEORequest(requestData: {
  type: string;
  query: string;
  context?: any;
}): Promise<{ success: boolean; message: string; requestId?: string }> {
  try {
    // In production, this would call your API
    const response = await fetch('/api/client/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: requestData.type,
        description: requestData.query,
        context: requestData.context,
        priority: 'normal',
        source: 'chat-assistant'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'Your request has been submitted to our SEO team. You\'ll receive a response within 24 hours.',
        requestId: data.requestId
      };
    } else {
      throw new Error('Failed to submit request');
    }
  } catch (error) {
    console.error('Error submitting SEO request:', error);
    return {
      success: false,
      message: 'There was an error submitting your request. Please try again or contact support.'
    };
  }
}
