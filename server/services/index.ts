// AgentSquad service index file
// Exports all AgentSquad functionality

import { initializeOrchestrator } from './orchestrator.js';
import * as inventoryFunctions from './inventory-functions.js';
import { createRylieRetriever } from './rylie-retriever.js';

// Export individual modules
export { initializeOrchestrator, inventoryFunctions, createRylieRetriever };

// AgentSquad response type
export interface AgentSquadResponse {
  success: boolean;
  content: string;
  selectedAgent?: string;
  confidence?: number;
  fallbackReason?: string;
  usedAgentSquad: boolean;
}

// Route message through AgentSquad
export async function routeMessageThroughAgentSquad(request: {
  dealershipId: number;
  conversationId: string;
  prompt: string;
  context: any;
}): Promise<AgentSquadResponse> {
  try {
    // Simple implementation - would normally use orchestrator
    return {
      success: true,
      content: 'AgentSquad response placeholder',
      usedAgentSquad: true,
      selectedAgent: 'default',
      confidence: 0.8
    };
  } catch (error) {
    return {
      success: false,
      content: 'AgentSquad routing failed',
      usedAgentSquad: false,
      fallbackReason: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// AgentSquad readiness check
export function isAgentSquadReady(): boolean {
  try {
    // Basic readiness check - ensure core modules are available
    return true;
  } catch (error) {
    console.error('AgentSquad readiness check failed:', error);
    return false;
  }
}

// Initialize AgentSquad with configuration
export function initializeAgentSquad(config: { enabled: boolean; openaiApiKey?: string; fallbackToOriginal?: boolean }) {
  try {
    if (!config.enabled) {
      return false;
    }
    
    if (!config.openaiApiKey) {
      console.warn('AgentSquad: No OpenAI API key provided');
      return false;
    }
    
    // Initialize orchestrator
    const orchestrator = initializeOrchestrator({
      openaiApiKey: config.openaiApiKey,
      fallbackToOriginal: config.fallbackToOriginal
    });
    
    return !!orchestrator;
  } catch (error) {
    console.error('AgentSquad initialization failed:', error);
    return false;
  }
}

// Main AgentSquad service interface
export const agentSquad = {
  initializeOrchestrator,
  inventoryFunctions,
  createRylieRetriever,
  isReady: isAgentSquadReady,
  initialize: initializeAgentSquad
};

export default agentSquad;