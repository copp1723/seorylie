import { AgentSquad, OpenAIAgent, OpenAIClassifier, InMemoryChatStorage } from 'agent-squad';
import type { ConversationMessage } from 'agent-squad';
import logger from '../utils/logger';
import {
  searchInventory,
  getVehicleDetails,
  getInventorySummary,
  inventoryFunctionDefinitions
} from './inventory-functions';
import { createRylieRetriever, type RylieRetrieverOptions } from './rylie-retriever';

interface RylieAgentSquadConfig {
  openaiApiKey: string;
  defaultDealershipId?: number;
}

export class RylieAgentSquad {
  private orchestrator: AgentSquad;
  private storage: InMemoryChatStorage;
  private classifier: OpenAIClassifier;
  private retriever: any; // Will be set per dealership
  private config: RylieAgentSquadConfig;

  constructor(config: RylieAgentSquadConfig) {
    this.config = config;
    this.storage = new InMemoryChatStorage();
    this.orchestrator = new AgentSquad({ storage: this.storage });

    // Initialize classifier for intent routing
    this.classifier = new OpenAIClassifier({
      apiKey: config.openaiApiKey,
      model: 'gpt-4o-mini', // Using faster model for classification
      examples: this.getAutomotiveClassificationExamples()
    });

    // Initialize automotive-specific agents with enhanced capabilities
    this.initializeAgents(config);

    logger.info('RylieAgentSquad initialized with enhanced automotive agents');
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

      // Enhanced context with dealership and conversation info
      const enhancedContext = {
        ...context,
        timestamp: new Date().toISOString(),
        platform: 'rylie',
        userId: userId,
        sessionId: sessionId
      };

      const startTime = Date.now();
      const response = await this.orchestrator.routeRequest(
        message,
        userId,
        sessionId,
        enhancedContext
      );
      const processingTime = Date.now() - startTime;

      logger.info(`Agent ${response.selectedAgent} handled the request`, {
        processingTime,
        reasoning: response.reasoning
      });

      return {
        success: true,
        response: response.response,
        selectedAgent: response.selectedAgent,
        reasoning: response.reasoning,
        processingTime,
        conversationId: sessionId,
        confidence: response.confidence || 0.8
      };

    } catch (error) {
      logger.error('Agent Squad routing error:', error);

      return {
        success: false,
        error: 'Failed to route message through agent squad',
        fallbackRequired: true
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
}

// Factory function to initialize orchestrator
export function initializeOrchestrator(config: RylieAgentSquadConfig): RylieAgentSquad {
  return new RylieAgentSquad(config);
}