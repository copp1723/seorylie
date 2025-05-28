import { AgentSquad, OpenAIAgent, OpenAIClassifier, InMemoryChatStorage } from 'agent-squad';
import type { ConversationMessage } from 'agent-squad';
import logger from '../../utils/logger';
import { 
  searchInventory, 
  getVehicleDetails, 
  getInventorySummary, 
  inventoryFunctionDefinitions,
  createEnhancedInventoryHandlers,
  searchInventoryWithRecommendations,
  checkVehicleAvailability
} from './inventory-functions';
import { createRylieRetriever, type RylieRetrieverOptions } from './rylie-retriever';
import { advancedRoutingEngine, type RoutingDecision, type SentimentAnalysis } from './advanced-routing';
import { client } from '../../db';
import { 
  AGENT_CONFIGURATIONS, 
  ENHANCED_CLASSIFICATION_EXAMPLES,
  type AgentConfiguration 
} from './agent-configurations';
import { AGENT_PROMPT_TEMPLATES } from './agent-prompt-templates';

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
    // Use enhanced classification examples from configurations
    return ENHANCED_CLASSIFICATION_EXAMPLES;
  }
  
  private initializeAgents(config: RylieAgentSquadConfig) {
    // Create function handlers for inventory operations
    const functionHandlers = this.createFunctionHandlers();

    // Initialize all agents using comprehensive configurations
    const agentInstances: OpenAIAgent[] = [];

    // Core 6 automotive agents
    const coreAgents = [
      'general-agent',
      'inventory-agent', 
      'finance-agent',
      'service-agent',
      'trade-agent',
      'sales-agent'
    ];

    for (const agentName of coreAgents) {
      const agentConfig = AGENT_CONFIGURATIONS[agentName];
      const promptTemplate = AGENT_PROMPT_TEMPLATES[agentName];
      
      if (!agentConfig || !promptTemplate) {
        logger.warn(`Missing configuration for agent: ${agentName}`);
        continue;
      }

      // Build comprehensive instruction prompt
      const instructions = this.buildAgentInstructions(agentConfig, promptTemplate);
      
      // Determine functions and handlers for this agent
      let agentFunctions: any[] = [];
      let agentFunctionHandlers: Record<string, any> = {};
      
      if (agentName === 'inventory-agent') {
        // Inventory agent gets full function calling capabilities including enhanced features
        agentFunctions = inventoryFunctionDefinitions;
        agentFunctionHandlers = functionHandlers;
      } else if (agentName === 'general-agent') {
        // General agent gets inventory summary and basic search for overview
        agentFunctions = [
          inventoryFunctionDefinitions[0], // searchInventory
          inventoryFunctionDefinitions[2], // getInventorySummary
          inventoryFunctionDefinitions[3]  // searchInventoryWithRecommendations
        ];
        agentFunctionHandlers = {
          searchInventory: functionHandlers.searchInventory,
          getInventorySummary: functionHandlers.getInventorySummary,
          searchInventoryWithRecommendations: functionHandlers.searchInventoryWithRecommendations
        };
      } else if (agentName === 'sales-agent') {
        // Sales agent gets search and availability checking capabilities
        agentFunctions = [
          inventoryFunctionDefinitions[0], // searchInventory
          inventoryFunctionDefinitions[1], // getVehicleDetails
          inventoryFunctionDefinitions[3], // searchInventoryWithRecommendations
          inventoryFunctionDefinitions[4]  // checkVehicleAvailability
        ];
        agentFunctionHandlers = {
          searchInventory: functionHandlers.searchInventory,
          getVehicleDetails: functionHandlers.getVehicleDetails,
          searchInventoryWithRecommendations: functionHandlers.searchInventoryWithRecommendations,
          checkVehicleAvailability: functionHandlers.checkVehicleAvailability
        };
      }
      // Other agents can be extended with specific functions as needed

      const agent = new OpenAIAgent({
        name: agentConfig.name,
        description: agentConfig.description,
        instructions: instructions,
        apiKey: config.openaiApiKey,
        model: agentConfig.model || 'gpt-4o',
        functions: agentFunctions,
        functionHandlers: agentFunctionHandlers
      });

      agentInstances.push(agent);
      this.orchestrator.addAgent(agent);
      
      logger.info(`Initialized ${agentName} with enhanced configuration`, {
        capabilities: agentConfig.capabilities.length,
        trainingExamples: agentConfig.trainingExamples.length,
        hasFunctions: agentFunctions.length > 0
      });
    }

    // Add lead source specific agents
    this.initializeLeadSourceAgents(config, functionHandlers);
    
    // Set classifier with enhanced examples
    this.orchestrator.setClassifier(this.classifier);
    
    logger.info('Initialized comprehensive automotive agent suite', {
      coreAgents: coreAgents.length,
      totalAgents: agentInstances.length + 2, // +2 for lead source agents
      enhancedPrompts: true,
      domainKnowledge: true
    });
  }

  /**
   * Build comprehensive instruction prompts from configuration and templates
   */
  private buildAgentInstructions(config: AgentConfiguration, template: any): string {
    return `${template.basePrompt}

${template.domainKnowledge}

${template.conversationGuidelines}

${template.specializedSkills}

${template.escalationGuidelines}

CAPABILITIES:
${config.capabilities.map(cap => `- ${cap}`).join('\n')}

TRAINING EXAMPLES:
${template.examples}`;
  }

  /**
   * Initialize lead source specific agents
   */
  private initializeLeadSourceAgents(config: RylieAgentSquadConfig, functionHandlers: any) {
    // Credit Specialist Agent
    const creditAgent = new OpenAIAgent({
      name: 'credit-agent',
      description: AGENT_CONFIGURATIONS['credit-agent'].description,
      instructions: this.buildAgentInstructions(
        AGENT_CONFIGURATIONS['credit-agent'],
        { 
          basePrompt: AGENT_CONFIGURATIONS['credit-agent'].systemPrompt,
          domainKnowledge: '',
          conversationGuidelines: '',
          specializedSkills: '',
          escalationGuidelines: '',
          examples: AGENT_CONFIGURATIONS['credit-agent'].trainingExamples
            .map(ex => `Customer: "${ex.userMessage}"\nSpecialist: "${ex.expectedResponse}"`)
            .join('\n\n')
        }
      ),
      apiKey: config.openaiApiKey,
      model: 'gpt-4o'
    });

    // Lease Specialist Agent  
    const leaseAgent = new OpenAIAgent({
      name: 'lease-agent',
      description: AGENT_CONFIGURATIONS['lease-agent'].description,
      instructions: this.buildAgentInstructions(
        AGENT_CONFIGURATIONS['lease-agent'],
        {
          basePrompt: AGENT_CONFIGURATIONS['lease-agent'].systemPrompt,
          domainKnowledge: '',
          conversationGuidelines: '',
          specializedSkills: '',
          escalationGuidelines: '',
          examples: AGENT_CONFIGURATIONS['lease-agent'].trainingExamples
            .map(ex => `Customer: "${ex.userMessage}"\nSpecialist: "${ex.expectedResponse}"`)
            .join('\n\n')
        }
      ),
      apiKey: config.openaiApiKey,
      model: 'gpt-4o'
    });

    this.orchestrator.addAgent(creditAgent);
    this.orchestrator.addAgent(leaseAgent);
    
    logger.info('Initialized lead source specific agents', {
      creditAgent: true,
      leaseAgent: true
    });
  }

  /**
   * Create enhanced function handlers with improved error handling and real-time capabilities
   */
  private createFunctionHandlers() {
    return createEnhancedInventoryHandlers(this.config.defaultDealershipId);
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