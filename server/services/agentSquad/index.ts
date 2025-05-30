// AgentSquad service index - extended with Tool Registry integration
import logger from '../../utils/logger';
import { toolRegistry, ToolRequest, ToolResponse } from '../tool-registry';
import { analyticsClient } from '../analytics-client';
import { WebSocketService } from '../websocket-service';

// Get WebSocket service instance
let wsService: WebSocketService | undefined;
try {
  const { getWebSocketService } = require('../websocket-service');
  wsService = getWebSocketService();
} catch (error) {
  logger.warn('WebSocket service not available, streaming responses will not work');
}

// AgentSquad response type
export interface AgentSquadResponse {
  success: boolean;
  response?: string;
  selectedAgent?: string;
  reasoning?: string;
  conversationId?: string;
  error?: string;
  fallbackRequired?: boolean;
  usedTool?: string;
  toolResponse?: any;
}

// Tool call detection regex
const TOOL_CALL_REGEX = /tool:([a-z_]+)(?:\((.*?)\))?/i;

// AgentSquad readiness check
export function isAgentSquadReady(): boolean {
  try {
    // Check if tool registry is available
    const availableTools = toolRegistry.getAvailableTools();
    const hasAnalyticsTool = availableTools.includes('watchdog_analysis');
    
    // Basic readiness check - ensure core modules and tools are available
    return hasAnalyticsTool;
  } catch (error) {
    logger.error('AgentSquad readiness check failed:', error);
    return false;
  }
}

// Initialize AgentSquad with configuration
export function initializeAgentSquad(config: { enabled: boolean; openaiApiKey?: string; fallbackToOriginal?: boolean }): boolean {
  try {
    if (!config.enabled) {
      logger.info('Agent Squad is disabled in configuration');
      return false;
    }
    
    if (!config.openaiApiKey) {
      logger.warn('Agent Squad: No OpenAI API key provided');
      return false;
    }
    
    // Check analytics client health
    analyticsClient.checkHealth()
      .then(health => {
        if (health.status === 'ok' || health.status === 'healthy') {
          logger.info('Analytics client health check passed', { status: health.status });
        } else {
          logger.warn('Analytics client health check failed', { status: health.status });
        }
      })
      .catch(error => {
        logger.error('Analytics client health check error', { error });
      });
    
    logger.info('Agent Squad initialized successfully with Tool Registry integration');
    return true;
    
  } catch (error) {
    logger.error('Failed to initialize Agent Squad:', error);
    return false;
  }
}

/**
 * Parse a message for tool calls
 * @param message The message to parse
 * @returns The parsed tool call or null if no tool call found
 */
function parseToolCall(message: string): { toolName: string; parameters: string } | null {
  const match = message.match(TOOL_CALL_REGEX);
  if (!match) return null;
  
  const [, toolName, parameters = ''] = match;
  return { toolName, parameters };
}

/**
 * Parse tool parameters from string to object
 * @param parametersStr The parameters string
 * @returns Parsed parameters object
 */
function parseToolParameters(parametersStr: string): Record<string, any> {
  if (!parametersStr.trim()) return {};
  
  try {
    // Try parsing as JSON
    return JSON.parse(parametersStr);
  } catch (error) {
    // If not valid JSON, parse as key=value pairs
    const params: Record<string, any> = {};
    const pairs = parametersStr.split(',');
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(p => p.trim());
      if (key && value !== undefined) {
        // Try to convert value to appropriate type
        if (value.toLowerCase() === 'true') params[key] = true;
        else if (value.toLowerCase() === 'false') params[key] = false;
        else if (!isNaN(Number(value))) params[key] = Number(value);
        else params[key] = value;
      }
    }
    
    return params;
  }
}

// Route message through AgentSquad with tool integration
export async function routeMessageThroughAgentSquad(
  message: string,
  userId: string,
  conversationId: string,
  context?: any
): Promise<AgentSquadResponse> {
  try {
    logger.info(`Routing message for user ${userId}, conversation ${conversationId}`);
    
    // Check for tool calls in the message
    const toolCall = parseToolCall(message);
    
    if (toolCall) {
      logger.info(`Detected tool call: ${toolCall.toolName}`, { 
        conversationId,
        userId,
        parameters: toolCall.parameters
      });
      
      // Parse tool parameters
      const parameters = parseToolParameters(toolCall.parameters);
      
      // Create request ID
      const requestId = `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Create tool context
      const toolContext = {
        agentId: 'agent-squad',
        conversationId,
        userId,
        dealershipId: context?.dealershipId,
        sessionId: context?.sessionId,
        requestId,
        timestamp: Date.now()
      };
      
      // Create tool request
      const toolRequest: ToolRequest = {
        toolName: toolCall.toolName,
        parameters,
        context: toolContext,
        streaming: !!wsService
      };
      
      try {
        // Check if we should use streaming
        if (toolRequest.streaming && wsService && toolContext.sessionId) {
          // Execute tool with streaming
          logger.info(`Executing tool with streaming: ${toolCall.toolName}`, { requestId });
          
          const emitter = toolRegistry.executeToolStream(toolRequest);
          
          // Forward events to WebSocket
          emitter.on('data', (event) => {
            wsService?.sendToSession(toolContext.sessionId!, {
              type: 'tool:stream',
              ...event
            });
          });
          
          // Return immediate response indicating streaming started
          return {
            success: true,
            response: `Tool execution started: ${toolCall.toolName}`,
            selectedAgent: 'tool-executor',
            reasoning: `Executing tool ${toolCall.toolName} with streaming`,
            conversationId,
            usedTool: toolCall.toolName,
            toolResponse: {
              status: 'streaming',
              requestId
            }
          };
        } else {
          // Execute tool without streaming
          logger.info(`Executing tool: ${toolCall.toolName}`, { requestId });
          const toolResponse = await toolRegistry.executeTool(toolRequest);
          
          if (toolResponse.success) {
            logger.info(`Tool execution successful: ${toolCall.toolName}`, { 
              requestId,
              processingTime: toolResponse.meta?.processingTime
            });
            
            return {
              success: true,
              response: JSON.stringify(toolResponse.data, null, 2),
              selectedAgent: 'tool-executor',
              reasoning: `Successfully executed tool ${toolCall.toolName}`,
              conversationId,
              usedTool: toolCall.toolName,
              toolResponse: toolResponse.data
            };
          } else {
            logger.warn(`Tool execution failed: ${toolCall.toolName}`, { 
              requestId,
              error: toolResponse.error
            });
            
            return {
              success: false,
              error: `Tool execution failed: ${toolResponse.error?.message}`,
              fallbackRequired: true,
              conversationId,
              usedTool: toolCall.toolName,
              toolResponse: toolResponse.error
            };
          }
        }
      } catch (toolError) {
        logger.error(`Error executing tool ${toolCall.toolName}:`, toolError);
        
        return {
          success: false,
          error: `Error executing tool ${toolCall.toolName}: ${toolError instanceof Error ? toolError.message : String(toolError)}`,
          fallbackRequired: true,
          conversationId
        };
      }
    }
    
    // If no tool call, proceed with normal agent routing
    logger.info(`No tool call detected, using standard agent routing for conversation ${conversationId}`);
    
    // Simplified implementation - would normally use the full orchestrator
    return {
      success: true,
      response: 'This is a placeholder response from AgentSquad.',
      selectedAgent: 'general-agent',
      reasoning: 'Standard agent routing logic',
      conversationId: conversationId
    };
  } catch (error) {
    logger.error('Agent Squad routing failed:', error);
    
    return {
      success: false,
      error: 'Agent routing failed',
      fallbackRequired: true
    };
  }
}

// Export for compatibility
export default {
  isAgentSquadReady,
  initializeAgentSquad,
  routeMessageThroughAgentSquad
};
