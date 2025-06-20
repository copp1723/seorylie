// AgentSquad service index - enhanced with full orchestrator integration and tool registry
import logger from "../../utils/logger";
import { RylieAgentSquad } from "./orchestrator";
import { WebSocketService } from "../websocket-service";

// Get WebSocket service instance
let wsService: WebSocketService | undefined;
try {
  const { getWebSocketService } = require("../websocket-service");
  wsService = getWebSocketService();
} catch (error) {
  logger.warn(
    "WebSocket service not available, streaming responses will not work",
  );
}

// Enhanced AgentSquad response type
export interface AgentSquadResponse {
  success: boolean;
  response?: string;
  selectedAgent?: string;
  reasoning?: string;
  conversationId?: string;
  error?: string;
  fallbackRequired?: boolean;
  processingTime?: number;
  confidence?: number;
  escalated?: boolean;
  sentiment?: string;
  urgency?: string;
  priority?: string;
  fallback?: boolean;
  usedTool?: string;
  toolResponse?: any;
}

// Global orchestrator instance
let globalOrchestrator: RylieAgentSquad | null = null;
let initializationPromise: Promise<boolean> | null = null;

// AgentSquad readiness check
export function isAgentSquadReady(): boolean {
  try {
    // Check if orchestrator is initialized and healthy
    return globalOrchestrator !== null;
  } catch (error) {
    logger.error("AgentSquad readiness check failed:", error);
    return false;
  }
}

// Initialize AgentSquad with configuration
export async function initializeAgentSquad(): Promise<boolean> {
  if (initializationPromise) {
    return await initializationPromise;
  }

  initializationPromise = (async (): Promise<boolean> => {
    try {
      if (globalOrchestrator) {
        logger.info("Agent Squad already initialized");
        return true;
      }

      globalOrchestrator = new RylieAgentSquad();
      const initialized = await globalOrchestrator.initialize();

      if (initialized) {
        logger.info("Agent Squad initialized successfully");
        return true;
      } else {
        logger.error("Failed to initialize Agent Squad");
        globalOrchestrator = null;
        return false;
      }
    } catch (error) {
      logger.error("Error initializing Agent Squad:", error);
      globalOrchestrator = null;
      return false;
    }
  })();

  return await initializationPromise;
}

// Get orchestrator health status
export async function getAgentSquadHealth(): Promise<{
  status: "healthy" | "degraded" | "unhealthy";
  agents: number;
  lastResponse: number;
  errors: string[];
}> {
  if (!globalOrchestrator) {
    return {
      status: "unhealthy",
      agents: 0,
      lastResponse: 0,
      errors: ["Agent Squad not initialized"],
    };
  }

  return await globalOrchestrator.healthCheck();
}

// Route message through AgentSquad orchestrator
export async function routeMessageThroughAgentSquad(
  message: string,
  userId: string,
  conversationId: string,
  context?: any,
): Promise<AgentSquadResponse> {
  try {
    if (!globalOrchestrator) {
      logger.warn("Agent Squad not initialized, cannot route message");
      return {
        success: false,
        error: "Agent Squad not initialized",
        fallbackRequired: true,
      };
    }

    logger.info(
      `Routing message through Agent Squad for user ${userId}, conversation ${conversationId}`,
    );

    // Route through the full orchestrator
    const result = await globalOrchestrator.routeMessage(
      message,
      userId,
      conversationId,
      context,
    );

    return result as AgentSquadResponse;
  } catch (error) {
    logger.error("Agent Squad routing failed:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Agent routing failed",
      fallbackRequired: true,
    };
  }
}

// Get Agent Squad performance metrics
export async function getAgentSquadMetrics(
  dealershipId: number,
  timeRange?: { start: Date; end: Date },
): Promise<{
  totalInteractions: number;
  agentBreakdown: Record<string, number>;
  averageResponseTime: number;
  escalationRate: number;
  averageConfidence: number;
} | null> {
  try {
    if (!globalOrchestrator) {
      logger.warn("Agent Squad not initialized, cannot get metrics");
      return null;
    }

    return await globalOrchestrator.getPerformanceMetrics(
      dealershipId,
      timeRange,
    );
  } catch (error) {
    logger.error("Failed to get Agent Squad metrics:", error);
    return null;
  }
}

// Update Agent Squad configuration for dealership
export async function updateAgentSquadConfig(
  dealershipId: number,
  config: {
    enabled?: boolean;
    fallbackEnabled?: boolean;
    confidenceThreshold?: number;
    preferredAgents?: string[];
    agentPersonalities?: Record<string, any>;
  },
): Promise<boolean> {
  try {
    if (!globalOrchestrator) {
      logger.warn("Agent Squad not initialized, cannot update config");
      return false;
    }

    await globalOrchestrator.updateDealershipConfig(dealershipId, config);
    logger.info("Agent Squad configuration updated", { dealershipId, config });
    return true;
  } catch (error) {
    logger.error("Failed to update Agent Squad configuration:", error);
    return false;
  }
}

// Get Agent Squad configuration for dealership
export async function getAgentSquadConfig(dealershipId: number): Promise<{
  enabled: boolean;
  fallbackEnabled: boolean;
  confidenceThreshold: number;
  preferredAgents: string[];
  agentPersonalities: Record<string, any>;
} | null> {
  try {
    if (!globalOrchestrator) {
      logger.warn("Agent Squad not initialized, cannot get config");
      return null;
    }

    return await globalOrchestrator.getDealershipConfig(dealershipId);
  } catch (error) {
    logger.error("Failed to get Agent Squad configuration:", error);
    return null;
  }
}

// Clear conversation history
export async function clearAgentSquadConversation(
  sessionId: string,
): Promise<boolean> {
  try {
    if (!globalOrchestrator) {
      logger.warn("Agent Squad not initialized, cannot clear conversation");
      return false;
    }

    await globalOrchestrator.clearConversation(sessionId);
    return true;
  } catch (error) {
    logger.error("Failed to clear Agent Squad conversation:", error);
    return false;
  }
}

// Get conversation history
export async function getAgentSquadConversationHistory(
  sessionId: string,
): Promise<any[]> {
  try {
    if (!globalOrchestrator) {
      logger.warn(
        "Agent Squad not initialized, cannot get conversation history",
      );
      return [];
    }

    return await globalOrchestrator.getConversationHistory(sessionId);
  } catch (error) {
    logger.error("Failed to get Agent Squad conversation history:", error);
    return [];
  }
}

// Export for compatibility
export default {
  isAgentSquadReady,
  initializeAgentSquad,
  routeMessageThroughAgentSquad,
  getAgentSquadHealth,
  getAgentSquadMetrics,
  updateAgentSquadConfig,
  getAgentSquadConfig,
  clearAgentSquadConversation,
  getAgentSquadConversationHistory,
};

// Export the main orchestrator class for advanced usage
export { RylieAgentSquad } from "./orchestrator";
export type { RoutingDecision, SentimentAnalysis } from "./advanced-routing";
export type {
  RylieRetrieverOptions,
  RetrievedDocument,
} from "./rylie-retriever";
export type {
  VehicleSearchParams,
  VehicleSearchResult,
} from "./inventory-functions";
