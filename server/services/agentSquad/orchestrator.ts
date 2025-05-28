import { AgentSquad, OpenAIAgent, OpenAIClassifier, InMemoryChatStorage } from 'agent-squad';
import type { ConversationMessage } from 'agent-squad';
import logger from '../../utils/logger';
import { 
  searchInventory, 
  getVehicleDetails, 
  getInventorySummary, 
  inventoryFunctionDefinitions 
} from './inventory-functions';
import { createRylieRetriever, type RylieRetrieverOptions } from './rylie-retriever';
import { advancedRoutingEngine, type RoutingDecision, type SentimentAnalysis } from './advanced-routing';
import { client } from '../../db';

interface RylieAgentSquadConfig {
  openaiApiKey: string;
  defaultDealershipId?: number;
  enableAnalytics?: boolean;
  enableAdvancedRouting?: boolean;
  fallbackToGeneral?: boolean;
}

interface AgentSquadAnalytics {
  dealershipId: number;
  conversationId: string;
  messageId?: string;
  selectedAgent: string;
  classificationConfidence: number;
  responseTimeMs: number;
  escalatedToHuman: boolean;
  escalationReason?: string;
  customerSatisfactionScore?: number;
}

export class RylieAgentSquad {
  private orchestrator: AgentSquad;
  private storage: InMemoryChatStorage;
  private classifier: OpenAIClassifier;
  private retriever: any; // Will be set per dealership
  private config: RylieAgentSquadConfig;
  private analyticsEnabled: boolean;
  
  constructor(config: RylieAgentSquadConfig) {
    this.config = {
      enableAnalytics: true,
      enableAdvancedRouting: true,
      fallbackToGeneral: true,
      ...config
    };
    this.analyticsEnabled = this.config.enableAnalytics ?? true;
    this.storage = new InMemoryChatStorage();
    this.orchestrator = new AgentSquad({ storage: this.storage });
    
    // Initialize classifier for intent routing
    this.classifier = new OpenAIClassifier({
      apiKey: config.openaiApiKey,
      model: 'gpt-4o-mini', // Using faster model for classification
      examples: this.getAutomotiveClassificationExamples()
    });
    
    // Initialize automotive-specific agents with enhanced capabilities
    this.initializeAgents(this.config);
    
    logger.info('RylieAgentSquad initialized with enhanced automotive agents', {
      analyticsEnabled: this.analyticsEnabled,
      advancedRouting: this.config.enableAdvancedRouting
    });
  }
  
  private getAutomotiveClassificationExamples() {
    return [
      {
        userMessage: "I'm looking for a red Honda Civic",
        agentName: "inventory-agent",
        reason: "Customer is searching for specific vehicle inventory"
      },
      {
        userMessage: "What financing options do you have?",
        agentName: "finance-agent", 
        reason: "Customer inquiry about financing and payment options"
      },
      {
        userMessage: "I need to schedule a service appointment",
        agentName: "service-agent",
        reason: "Customer wants to book vehicle service or maintenance"
      },
      {
        userMessage: "What's my trade-in value?",
        agentName: "trade-agent",
        reason: "Customer asking about vehicle trade-in valuation"
      },
      {
        userMessage: "Can I schedule a test drive?",
        agentName: "sales-agent",
        reason: "Customer ready for sales interaction and test drive"
      },
      {
        userMessage: "Hi there, just browsing",
        agentName: "general-agent",
        reason: "General inquiry or greeting without specific intent"
      }
    ];
  }
  
  private initializeAgents(config: RylieAgentSquadConfig) {
    // Create function handlers for inventory operations
    const functionHandlers = this.createFunctionHandlers();

    // General Sales Assistant - Primary entry point
    const generalAgent = new OpenAIAgent({
      name: 'general-agent',
      description: 'Friendly general automotive assistant for initial customer interactions',
      instructions: `You are Rylie, a helpful automotive assistant. Greet customers warmly and help them get started. 
      Keep responses conversational and guide them toward specific needs (inventory, financing, service, etc.).
      Always be friendly and professional, representing the dealership's brand.
      Use the available functions to help customers with specific requests.`,
      apiKey: config.openaiApiKey,
      model: 'gpt-4o',
      functions: [inventoryFunctionDefinitions[2]], // getInventorySummary for general overview
      functionHandlers: {
        getInventorySummary: functionHandlers.getInventorySummary
      }
    });
    
    // Inventory Specialist - Vehicle search and details with full function calling
    const inventoryAgent = new OpenAIAgent({
      name: 'inventory-agent', 
      description: 'Specialist in vehicle inventory, features, and availability with direct database access',
      instructions: `You are an expert automotive inventory specialist with access to real-time inventory data.
      
      CAPABILITIES:
      - Search inventory using searchInventory() function based on customer criteria
      - Get detailed vehicle information using getVehicleDetails() function  
      - Provide inventory overview using getInventorySummary() function
      
      GUIDELINES:
      - Always use functions to provide accurate, up-to-date information
      - Ask clarifying questions to refine search criteria
      - Present vehicle options clearly with key details (price, mileage, features)
      - Suggest similar alternatives when exact matches aren't available
      - Encourage test drives and schedule visits when customers show interest
      - Be specific about availability and mention stock numbers when provided`,
      apiKey: config.openaiApiKey,
      model: 'gpt-4o',
      functions: inventoryFunctionDefinitions,
      functionHandlers: functionHandlers
    });
    
    // Finance Specialist - Loans, leases, payments
    const financeAgent = new OpenAIAgent({
      name: 'finance-agent',
      description: 'Expert in automotive financing options and payment calculations', 
      instructions: `You are a knowledgeable automotive finance specialist. Help customers understand:
      - Loan vs lease options
      - Payment calculations and terms
      - Credit requirements and pre-approval process
      - Trade-in impact on financing
      Be helpful but always recommend speaking with our finance team for final approval and rates.`,
      apiKey: config.openaiApiKey,
      model: 'gpt-4o'
    });
    
    // Service Specialist - Maintenance and repairs
    const serviceAgent = new OpenAIAgent({
      name: 'service-agent',
      description: 'Automotive service and maintenance specialist',
      instructions: `You are an automotive service specialist. Help customers with:
      - Service appointment scheduling
      - Maintenance recommendations based on mileage/age
      - Common repair questions and estimates
      - Warranty information
      Always emphasize the importance of regular maintenance and certified technicians.`,
      apiKey: config.openaiApiKey,
      model: 'gpt-4o'
    });
    
    // Trade-in Specialist - Vehicle valuation
    const tradeAgent = new OpenAIAgent({
      name: 'trade-agent',
      description: 'Vehicle trade-in and valuation specialist',
      instructions: `You are a trade-in valuation specialist. Help customers understand:
      - Factors affecting trade-in value (condition, mileage, market demand)
      - Required documentation for trade-in process
      - How trade-ins work with financing
      Always recommend an in-person appraisal for accurate valuation.`,
      apiKey: config.openaiApiKey,
      model: 'gpt-4o'
    });
    
    // Sales Specialist - Test drives and closing
    const salesAgent = new OpenAIAgent({
      name: 'sales-agent',
      description: 'Sales specialist for test drives and purchase process',
      instructions: `You are a sales specialist focused on helping customers take the next step:
      - Schedule test drives and showroom visits
      - Explain the purchase process
      - Handle objections and concerns
      - Connect customers with sales team when they're ready
      Be consultative, not pushy. Focus on finding the right fit for the customer.`,
      apiKey: config.openaiApiKey,
      model: 'gpt-4o'
    });
    
    // Add all agents to orchestrator
    this.orchestrator.addAgent(generalAgent);
    this.orchestrator.addAgent(inventoryAgent);
    this.orchestrator.addAgent(financeAgent);
    this.orchestrator.addAgent(serviceAgent);
    this.orchestrator.addAgent(tradeAgent);
    this.orchestrator.addAgent(salesAgent);
    
    // Set classifier
    this.orchestrator.setClassifier(this.classifier);
    
    logger.info('Initialized 6 automotive specialist agents with enhanced capabilities');
  }

  /**
   * Create function handlers that will be called by OpenAI agents
   */
  private createFunctionHandlers() {
    return {
      searchInventory: async (params: any, context?: any) => {
        try {
          const dealershipId = context?.dealershipId || this.config.defaultDealershipId;
          if (!dealershipId) {
            throw new Error('Dealership ID required for inventory search');
          }

          logger.info('Function call: searchInventory', { params, dealershipId });
          
          const result = await searchInventory({
            dealershipId,
            ...params
          });

          return JSON.stringify(result);
        } catch (error) {
          logger.error('searchInventory function failed', { error, params });
          return JSON.stringify({ 
            success: false, 
            error: 'Unable to search inventory at this time' 
          });
        }
      },

      getVehicleDetails: async (params: any, context?: any) => {
        try {
          const dealershipId = context?.dealershipId || this.config.defaultDealershipId;
          if (!dealershipId) {
            throw new Error('Dealership ID required for vehicle details');
          }

          logger.info('Function call: getVehicleDetails', { params, dealershipId });

          const result = await getVehicleDetails(dealershipId, params.identifier);
          return JSON.stringify(result);
        } catch (error) {
          logger.error('getVehicleDetails function failed', { error, params });
          return JSON.stringify({ 
            success: false, 
            error: 'Unable to get vehicle details at this time' 
          });
        }
      },

      getInventorySummary: async (params: any, context?: any) => {
        try {
          const dealershipId = context?.dealershipId || this.config.defaultDealershipId;
          if (!dealershipId) {
            throw new Error('Dealership ID required for inventory summary');
          }

          logger.info('Function call: getInventorySummary', { params, dealershipId });

          const result = await getInventorySummary(dealershipId);
          return JSON.stringify(result);
        } catch (error) {
          logger.error('getInventorySummary function failed', { error, params });
          return JSON.stringify({ 
            success: false, 
            error: 'Unable to get inventory summary at this time' 
          });
        }
      }
    };
  }
  
  async routeMessage(
    message: string,
    userId: string,
    sessionId: string,
    context?: Record<string, any>
  ) {
    const startTime = Date.now();
    let routingDecision: RoutingDecision | null = null;
    let sentiment: SentimentAnalysis | null = null;
    
    try {
      logger.info(`Routing message for user ${userId}, session ${sessionId}: ${message.substring(0, 100)}...`);
      
      // Set up retriever for this dealership if available
      if (context?.dealershipId && !this.retriever) {
        this.retriever = createRylieRetriever({
          dealershipId: context.dealershipId,
          includeVehicleData: true,
          includeDealershipInfo: true,
          includePersonaData: true
        });
        this.orchestrator.addRetriever(this.retriever);
        logger.info('Rylie retriever initialized for dealership', { dealershipId: context.dealershipId });
      }

      // Advanced routing analysis if enabled
      if (this.config.enableAdvancedRouting && context?.dealershipId) {
        const analysis = await advancedRoutingEngine.analyzeAndRoute(
          message,
          context.dealershipId,
          userId,
          context
        );
        
        routingDecision = analysis.routingDecision;
        sentiment = analysis.sentiment;
        
        logger.info('Advanced routing analysis completed', {
          recommendedAgent: routingDecision.recommendedAgent,
          confidence: routingDecision.confidence,
          sentiment: sentiment.emotion,
          urgency: sentiment.urgency,
          shouldEscalate: routingDecision.shouldEscalate
        });
        
        // Handle escalation if needed
        if (routingDecision.shouldEscalate) {
          await this.trackAnalytics({
            dealershipId: context.dealershipId,
            conversationId: sessionId,
            messageId: context.messageId,
            selectedAgent: 'human-escalation',
            classificationConfidence: routingDecision.confidence,
            responseTimeMs: Date.now() - startTime,
            escalatedToHuman: true,
            escalationReason: routingDecision.escalationReason
          });
          
          return {
            success: true,
            response: `I understand you need immediate assistance. Let me connect you with one of our team members who can help you right away.`,
            selectedAgent: 'human-escalation',
            reasoning: routingDecision.escalationReason || 'Customer requires human assistance',
            processingTime: Date.now() - startTime,
            conversationId: sessionId,
            confidence: routingDecision.confidence,
            escalated: true,
            sentiment: sentiment.emotion,
            priority: routingDecision.priority
          };
        }
      }

      // Enhanced context with all available information
      const enhancedContext = {
        ...context,
        timestamp: new Date().toISOString(),
        platform: 'rylie',
        userId: userId,
        sessionId: sessionId,
        routingDecision,
        sentiment,
        dealershipId: context?.dealershipId
      };
      
      // Route through Agent Squad orchestrator
      const response = await this.orchestrator.routeRequest(
        message,
        userId,
        sessionId,
        enhancedContext
      );
      const processingTime = Date.now() - startTime;
      
      // Determine final agent (use routing decision if available and confident)
      let finalAgent = response.selectedAgent;
      let finalConfidence = response.confidence || 0.8;
      let finalReasoning = response.reasoning;
      
      if (routingDecision && routingDecision.confidence > 0.7) {
        finalAgent = routingDecision.recommendedAgent;
        finalConfidence = Math.max(routingDecision.confidence, finalConfidence);
        finalReasoning = `${routingDecision.reasoning}; Agent Squad: ${response.reasoning}`;
      }
      
      logger.info(`Agent ${finalAgent} handled the request`, {
        processingTime,
        confidence: finalConfidence,
        reasoning: finalReasoning,
        sentiment: sentiment?.emotion,
        originalAgent: response.selectedAgent,
        routingAgent: routingDecision?.recommendedAgent
      });
      
      // Track analytics
      if (this.analyticsEnabled && context?.dealershipId) {
        await this.trackAnalytics({
          dealershipId: context.dealershipId,
          conversationId: sessionId,
          messageId: context.messageId,
          selectedAgent: finalAgent,
          classificationConfidence: finalConfidence,
          responseTimeMs: processingTime,
          escalatedToHuman: false
        });
      }
      
      return {
        success: true,
        response: response.response,
        selectedAgent: finalAgent,
        reasoning: finalReasoning,
        processingTime,
        conversationId: sessionId,
        confidence: finalConfidence,
        sentiment: sentiment?.emotion,
        urgency: sentiment?.urgency,
        priority: routingDecision?.priority || 'medium'
      };
      
    } catch (error) {
      logger.error('Agent Squad routing error:', error);
      
      // Track error in analytics
      if (this.analyticsEnabled && context?.dealershipId) {
        await this.trackAnalytics({
          dealershipId: context.dealershipId,
          conversationId: sessionId,
          messageId: context.messageId,
          selectedAgent: 'error-fallback',
          classificationConfidence: 0.1,
          responseTimeMs: Date.now() - startTime,
          escalatedToHuman: this.config.fallbackToGeneral ? false : true,
          escalationReason: 'Agent Squad routing error'
        });
      }
      
      // Provide fallback response if configured
      if (this.config.fallbackToGeneral) {
        return {
          success: true,
          response: "I'm here to help! Could you please tell me more about what you're looking for today?",
          selectedAgent: 'fallback-general',
          reasoning: 'Fallback due to routing error',
          processingTime: Date.now() - startTime,
          conversationId: sessionId,
          confidence: 0.3,
          fallback: true
        };
      }
      
      return {
        success: false,
        error: 'Failed to route message through agent squad',
        fallbackRequired: true,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  async getConversationHistory(sessionId: string): Promise<ConversationMessage[]> {
    try {
      return await this.storage.getConversationHistory(sessionId);
    } catch (error) {
      logger.error('Failed to get conversation history:', error);
      return [];
    }
  }
  
  async clearConversation(sessionId: string): Promise<void> {
    try {
      await this.storage.clearConversation(sessionId);
      logger.info(`Cleared conversation history for session ${sessionId}`);
    } catch (error) {
      logger.error('Failed to clear conversation:', error);
    }
  }

  /**
   * Track analytics data to database
   */
  private async trackAnalytics(analytics: AgentSquadAnalytics): Promise<void> {
    if (!this.analyticsEnabled) return;
    
    try {
      await client`
        INSERT INTO agent_squad_analytics (
          dealership_id,
          conversation_id,
          message_id,
          selected_agent,
          classification_confidence,
          response_time_ms,
          escalated_to_human,
          escalation_reason,
          customer_satisfaction_score,
          created_at
        ) VALUES (
          ${analytics.dealershipId},
          ${analytics.conversationId},
          ${analytics.messageId || null},
          ${analytics.selectedAgent},
          ${analytics.classificationConfidence},
          ${analytics.responseTimeMs},
          ${analytics.escalatedToHuman},
          ${analytics.escalationReason || null},
          ${analytics.customerSatisfactionScore || null},
          NOW()
        )
      `;
      
      logger.debug('Agent Squad analytics tracked', {
        dealershipId: analytics.dealershipId,
        agent: analytics.selectedAgent,
        responseTime: analytics.responseTimeMs,
        escalated: analytics.escalatedToHuman
      });
      
    } catch (error) {
      logger.error('Failed to track Agent Squad analytics:', error);
      // Don't throw - analytics failures shouldn't break the conversation
    }
  }

  /**
   * Update Agent Squad configuration for a dealership
   */
  async updateDealershipConfig(
    dealershipId: number,
    config: {
      enabled?: boolean;
      fallbackEnabled?: boolean;
      confidenceThreshold?: number;
      preferredAgents?: string[];
      agentPersonalities?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      await client`
        UPDATE agent_squad_config 
        SET 
          enabled = COALESCE(${config.enabled}, enabled),
          fallback_enabled = COALESCE(${config.fallbackEnabled}, fallback_enabled),
          confidence_threshold = COALESCE(${config.confidenceThreshold}, confidence_threshold),
          preferred_agents = COALESCE(${JSON.stringify(config.preferredAgents)}, preferred_agents),
          agent_personalities = COALESCE(${JSON.stringify(config.agentPersonalities)}, agent_personalities),
          updated_at = NOW()
        WHERE dealership_id = ${dealershipId}
      `;
      
      logger.info('Agent Squad configuration updated', { dealershipId, config });
      
    } catch (error) {
      logger.error('Failed to update Agent Squad configuration:', error);
      throw error;
    }
  }

  /**
   * Get Agent Squad performance metrics for a dealership
   */
  async getPerformanceMetrics(
    dealershipId: number,
    timeRange?: { start: Date; end: Date }
  ): Promise<{
    totalInteractions: number;
    agentBreakdown: Record<string, number>;
    averageResponseTime: number;
    escalationRate: number;
    averageConfidence: number;
    sentimentDistribution?: Record<string, number>;
  }> {
    try {
      const timeFilter = timeRange 
        ? client`AND created_at BETWEEN ${timeRange.start} AND ${timeRange.end}`
        : client`AND created_at >= NOW() - INTERVAL '30 days'`;
      
      const metrics = await client`
        SELECT 
          COUNT(*) as total_interactions,
          AVG(classification_confidence) as avg_confidence,
          AVG(response_time_ms) as avg_response_time,
          COUNT(*) FILTER (WHERE escalated_to_human = true) as escalations,
          selected_agent,
          COUNT(*) as agent_count
        FROM agent_squad_analytics 
        WHERE dealership_id = ${dealershipId} ${timeFilter}
        GROUP BY selected_agent
        ORDER BY agent_count DESC
      `;
      
      const totalInteractions = metrics.reduce((sum, m) => sum + parseInt(m.agent_count), 0);
      const escalations = metrics.reduce((sum, m) => sum + parseInt(m.escalations), 0);
      
      const agentBreakdown: Record<string, number> = {};
      let totalResponseTime = 0;
      let totalConfidence = 0;
      
      for (const metric of metrics) {
        agentBreakdown[metric.selected_agent] = parseInt(metric.agent_count);
        totalResponseTime += parseFloat(metric.avg_response_time) * parseInt(metric.agent_count);
        totalConfidence += parseFloat(metric.avg_confidence) * parseInt(metric.agent_count);
      }
      
      return {
        totalInteractions,
        agentBreakdown,
        averageResponseTime: totalInteractions > 0 ? Math.round(totalResponseTime / totalInteractions) : 0,
        escalationRate: totalInteractions > 0 ? Math.round((escalations / totalInteractions) * 100) / 100 : 0,
        averageConfidence: totalInteractions > 0 ? Math.round((totalConfidence / totalInteractions) * 100) / 100 : 0
      };
      
    } catch (error) {
      logger.error('Failed to get Agent Squad performance metrics:', error);
      throw error;
    }
  }

  /**
   * Get current configuration for a dealership
   */
  async getDealershipConfig(dealershipId: number): Promise<{
    enabled: boolean;
    fallbackEnabled: boolean;
    confidenceThreshold: number;
    preferredAgents: string[];
    agentPersonalities: Record<string, any>;
  } | null> {
    try {
      const result = await client`
        SELECT * FROM agent_squad_config 
        WHERE dealership_id = ${dealershipId}
        LIMIT 1
      `;
      
      if (result.length === 0) {
        return null;
      }
      
      const config = result[0];
      return {
        enabled: config.enabled,
        fallbackEnabled: config.fallback_enabled,
        confidenceThreshold: parseFloat(config.confidence_threshold),
        preferredAgents: config.preferred_agents || [],
        agentPersonalities: config.agent_personalities || {}
      };
      
    } catch (error) {
      logger.error('Failed to get Agent Squad configuration:', error);
      throw error;
    }
  }

  /**
   * Health check for Agent Squad service
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    agents: number;
    lastResponse: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    try {
      // Check if orchestrator is initialized
      if (!this.orchestrator) {
        errors.push('Orchestrator not initialized');
        status = 'unhealthy';
      }
      
      // Check if classifier is working
      if (!this.classifier) {
        errors.push('Classifier not initialized');
        status = 'degraded';
      }
      
      // Test database connectivity
      try {
        await client`SELECT 1`;
      } catch (dbError) {
        errors.push('Database connectivity issue');
        status = 'degraded';
      }
      
      // Count available agents
      const agentCount = 6; // We initialize 6 agents
      
      return {
        status,
        agents: agentCount,
        lastResponse: Date.now(),
        errors
      };
      
    } catch (error) {
      logger.error('Agent Squad health check failed:', error);
      return {
        status: 'unhealthy',
        agents: 0,
        lastResponse: Date.now(),
        errors: ['Health check failed', error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}