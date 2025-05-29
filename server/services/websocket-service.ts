import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { URL } from 'url';
import { logger } from '../utils/logger';
import { dealershipConfigService } from './dealership-config-service';
import { DealershipMode } from '../../shared/schema';
import { orchestrator } from './orchestrator';

// Message types for our WebSocket communication
export enum MessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CHAT_MESSAGE = 'chat_message',
  TYPING = 'typing',
  READ_RECEIPT = 'read_receipt',
  MODE_CHANGE = 'mode_change',
  AVAILABILITY = 'availability',
  TOOL_STREAM = 'tool_stream',
  SANDBOX_MESSAGE = 'sandbox_message',
  ERROR = 'error'
}

// Interface for our WebSocket messages
export interface WebSocketMessage {
  type: MessageType | string;
  dealershipId?: number;
  userId?: number;
  userName?: string;
  conversationId?: string;
  message?: string;
  timestamp?: string;
  metadata?: any;
  // Tool stream specific fields
  toolName?: string;
  requestId?: string;
  data?: any;
  error?: any;
  status?: string;
  // Sandbox specific fields
  sandboxId?: number;
  sessionId?: string;
  payload?: any;
}

// Connection types
enum ConnectionType {
  STANDARD = 'standard',
  SANDBOX = 'sandbox'
}

// Client information
interface ClientInfo {
  ws: WebSocket;
  userId?: number;
  dealershipId?: number;
  userType?: 'customer' | 'agent';
  sessionId?: string;
  connectionType: ConnectionType;
  sandboxId?: number;
  sandboxSessionId?: string;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientInfo> = new Map();

  // Session to client ID mapping for quick lookups
  private sessions: Map<string, string> = new Map();
  
  // Sandbox channel mappings
  private sandboxChannels: Map<number, Set<string>> = new Map();
  private sandboxSessions: Map<string, string> = new Map();

  /**
   * Initialize the WebSocket server
   */
  initialize(server: Server) {
    // Create WebSocket server with a path prefix
    this.wss = new WebSocketServer({ 
      server, 
      path: undefined, // Handle all WebSocket connections
      verifyClient: (info, callback) => {
        // Allow all connections, we'll parse the path later
        callback(true);
      }
    });

    this.wss.on('connection', (ws, request) => {
      try {
        // Parse the URL to determine the connection type
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const pathname = url.pathname;
        
        // Generate a unique client ID
        const clientId = this.generateClientId();
        
        // Determine connection type and extract relevant IDs
        let connectionType = ConnectionType.STANDARD;
        let sandboxId: number | undefined;
        let sandboxSessionId: string | undefined;
        
        // Check if this is a sandbox connection
        const sandboxMatch = pathname.match(/^\/ws\/sandbox\/(\d+)\/([^\/]+)$/);
        if (sandboxMatch) {
          connectionType = ConnectionType.SANDBOX;
          sandboxId = parseInt(sandboxMatch[1], 10);
          sandboxSessionId = sandboxMatch[2];
          
          // Add to sandbox channel
          if (!this.sandboxChannels.has(sandboxId)) {
            this.sandboxChannels.set(sandboxId, new Set());
          }
          this.sandboxChannels.get(sandboxId)?.add(clientId);
          
          // Map sandbox session to client ID
          this.sandboxSessions.set(sandboxSessionId, clientId);
          
          logger.info('New sandbox WebSocket connection established', { 
            clientId, 
            sandboxId, 
            sandboxSessionId 
          });
        } else if (pathname.startsWith('/ws')) {
          // Standard connection
          logger.info('New standard WebSocket connection established', { clientId });
        } else {
          // Invalid path
          logger.warn('Invalid WebSocket connection path', { pathname });
          ws.close(1003, 'Invalid WebSocket path');
          return;
        }
        
        // Store client connection
        this.clients.set(clientId, { 
          ws, 
          connectionType,
          sandboxId,
          sandboxSessionId
        });
        
        // Send initial welcome message
        this.sendToClient(ws, {
          type: MessageType.CONNECT,
          message: 'Connected to WebSocket server',
          timestamp: new Date().toISOString(),
          metadata: { 
            clientId,
            connectionType,
            sandboxId,
            sandboxSessionId
          }
        });
        
        // Handle messages from clients
        ws.on('message', async (rawData) => {
          try {
            const data: WebSocketMessage = JSON.parse(rawData.toString());
            
            // Handle message based on connection type
            if (connectionType === ConnectionType.SANDBOX) {
              // Handle sandbox message
              await this.handleSandboxMessage(clientId, sandboxId!, sandboxSessionId!, data);
            } else {
              // Update client information if provided
              if (data.userId && data.dealershipId) {
                const client = this.clients.get(clientId);
                if (client) {
                  client.userId = data.userId;
                  client.dealershipId = data.dealershipId;
                  this.clients.set(clientId, client);
                }
              }
              
              // Store session ID if provided
              if (data.metadata?.sessionId) {
                const client = this.clients.get(clientId);
                if (client) {
                  client.sessionId = data.metadata.sessionId;
                  this.clients.set(clientId, client);
                  this.sessions.set(data.metadata.sessionId, clientId);
                  
                  logger.debug('Session ID registered for client', { 
                    clientId, 
                    sessionId: data.metadata.sessionId 
                  });
                }
              }
              
              // Process standard message
              await this.handleMessage(clientId, data);
            }
          } catch (error) {
            logger.error('Error processing WebSocket message', { 
              error: error instanceof Error ? error.message : String(error),
              clientId 
            });
            
            this.sendToClient(ws, {
              type: MessageType.ERROR,
              message: 'Error processing message',
              timestamp: new Date().toISOString(),
              error: {
                message: error instanceof Error ? error.message : String(error)
              }
            });
          }
        });
        
        // Handle disconnection
        ws.on('close', () => {
          logger.info('WebSocket connection closed', { clientId });
          
          const client = this.clients.get(clientId);
          if (client) {
            // Clean up session mapping if exists
            if (client.sessionId) {
              this.sessions.delete(client.sessionId);
            }
            
            // Clean up sandbox mappings if this is a sandbox connection
            if (client.connectionType === ConnectionType.SANDBOX && client.sandboxId && client.sandboxSessionId) {
              // Remove from sandbox channel
              this.sandboxChannels.get(client.sandboxId)?.delete(clientId);
              if (this.sandboxChannels.get(client.sandboxId)?.size === 0) {
                this.sandboxChannels.delete(client.sandboxId);
              }
              
              // Remove sandbox session mapping
              this.sandboxSessions.delete(client.sandboxSessionId);
            }
          }
          
          this.clients.delete(clientId);
        });
        
        // Handle errors
        ws.on('error', (error) => {
          logger.error('WebSocket error', { error, clientId });
          
          const client = this.clients.get(clientId);
          if (client) {
            // Clean up session mapping if exists
            if (client.sessionId) {
              this.sessions.delete(client.sessionId);
            }
            
            // Clean up sandbox mappings if this is a sandbox connection
            if (client.connectionType === ConnectionType.SANDBOX && client.sandboxId && client.sandboxSessionId) {
              // Remove from sandbox channel
              this.sandboxChannels.get(client.sandboxId)?.delete(clientId);
              if (this.sandboxChannels.get(client.sandboxId)?.size === 0) {
                this.sandboxChannels.delete(client.sandboxId);
              }
              
              // Remove sandbox session mapping
              this.sandboxSessions.delete(client.sandboxSessionId);
            }
          }
          
          this.clients.delete(clientId);
        });
      } catch (error) {
        logger.error('Error handling WebSocket connection', {
          error: error instanceof Error ? error.message : String(error),
          url: request.url
        });
        
        ws.close(1011, 'Internal server error');
      }
    });
    
    logger.info('WebSocket server initialized');
  }
  
  /**
   * Handle sandbox messages
   */
  private async handleSandboxMessage(
    clientId: string, 
    sandboxId: number, 
    sessionId: string, 
    data: WebSocketMessage
  ): Promise<void> {
    try {
      // Log the message
      logger.debug('Received sandbox message', {
        clientId,
        sandboxId,
        sessionId,
        messageType: data.type
      });
      
      // Forward the message to the orchestrator
      await orchestrator.handleSandboxMessage(sandboxId, sessionId, {
        ...data,
        sandboxId,
        sessionId
      });
    } catch (error) {
      logger.error('Error handling sandbox message', {
        error: error instanceof Error ? error.message : String(error),
        clientId,
        sandboxId,
        sessionId
      });
      
      // Send error back to client
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.ws, {
          type: MessageType.ERROR,
          message: 'Error processing sandbox message',
          timestamp: new Date().toISOString(),
          error: {
            message: error instanceof Error ? error.message : String(error)
          },
          metadata: {
            sandboxId,
            sessionId
          }
        });
      }
    }
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(clientId: string, data: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    switch(data.type) {
      case MessageType.CHAT_MESSAGE:
        await this.handleChatMessage(clientId, data);
        break;
        
      case MessageType.TYPING:
        await this.broadcastTypingStatus(data);
        break;
        
      case MessageType.READ_RECEIPT:
        await this.broadcastReadReceipt(data);
        break;
        
      default:
        logger.warn('Unknown message type', { type: data.type, clientId });
    }
  }
  
  /**
   * Handle chat messages, routing based on dealership mode
   */
  private async handleChatMessage(clientId: string, data: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || !data.dealershipId) return;
    
    // Get dealership mode to determine message handling
    const mode = await dealershipConfigService.getDealershipMode(data.dealershipId);
    
    // Handle differently based on mode
    if (mode === 'rylie_ai') {
      await this.handleRylieAiMessage(clientId, data);
    } else if (mode === 'direct_agent') {
      await this.handleDirectAgentMessage(clientId, data);
    }
  }
  
  /**
   * Handle messages in Rylie AI mode (automated responses)
   */
  private async handleRylieAiMessage(clientId: string, data: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || !data.dealershipId) return;
    
    try {
      // Store message in database
      // TODO: Implement message storage
      
      // Acknowledge receipt to sender
      this.sendToClient(client.ws, {
        type: MessageType.CHAT_MESSAGE,
        dealershipId: data.dealershipId,
        userId: data.userId,
        conversationId: data.conversationId,
        message: 'Message received',
        timestamp: new Date().toISOString(),
        metadata: { status: 'received', messageId: this.generateMessageId() }
      });
      
      // TODO: Send to AI service for processing
      // For now, just send a mock AI response after a delay
      setTimeout(() => {
        this.sendToClient(client.ws, {
          type: MessageType.CHAT_MESSAGE,
          dealershipId: data.dealershipId,
          userId: -1, // AI user ID
          userName: 'Rylie AI',
          conversationId: data.conversationId,
          message: `This is an automated response to: "${data.message}"`,
          timestamp: new Date().toISOString(),
          metadata: { isAiResponse: true }
        });
      }, 1500);
    } catch (error) {
      logger.error('Error handling Rylie AI message', { error, clientId, data });
    }
  }
  
  /**
   * Handle messages in Direct Agent mode (human agent handling)
   */
  private async handleDirectAgentMessage(clientId: string, data: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || !data.dealershipId || !data.conversationId) return;
    
    try {
      // Check if dealership is within working hours
      const isWithinWorkingHours = await dealershipConfigService.isWithinWorkingHours(data.dealershipId);
      
      // Store message in database
      // TODO: Implement message storage
      
      // Acknowledge receipt to sender
      this.sendToClient(client.ws, {
        type: MessageType.CHAT_MESSAGE,
        dealershipId: data.dealershipId,
        userId: data.userId,
        conversationId: data.conversationId,
        message: 'Message received',
        timestamp: new Date().toISOString(),
        metadata: { status: 'received', messageId: this.generateMessageId() }
      });
      
      // If outside working hours, send automated response
      if (!isWithinWorkingHours) {
        // Get away message template
        const templates = await dealershipConfigService.getTemplateMessages(data.dealershipId);
        
        setTimeout(() => {
          this.sendToClient(client.ws, {
            type: MessageType.CHAT_MESSAGE,
            dealershipId: data.dealershipId,
            userId: -1, // System user ID
            userName: 'System',
            conversationId: data.conversationId,
            message: templates.away || "We're currently outside of our business hours. Please leave a message and we'll get back to you during our regular hours.",
            timestamp: new Date().toISOString(),
            metadata: { isSystemMessage: true }
          });
        }, 1000);
        return;
      }
      
      // Broadcast message to all agents for the dealership
      this.broadcastToDealershipAgents(data.dealershipId, data);
    } catch (error) {
      logger.error('Error handling Direct Agent message', { error, clientId, data });
    }
  }
  
  /**
   * Broadcast typing status to relevant users
   */
  private async broadcastTypingStatus(data: WebSocketMessage) {
    if (!data.dealershipId || !data.conversationId) return;
    
    // Broadcast to agents if from customer, or to specific customer if from agent
    this.broadcastToDealershipAgents(data.dealershipId, {
      type: MessageType.TYPING,
      dealershipId: data.dealershipId,
      userId: data.userId,
      userName: data.userName,
      conversationId: data.conversationId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Broadcast read receipt to relevant users
   */
  private async broadcastReadReceipt(data: WebSocketMessage) {
    if (!data.dealershipId || !data.conversationId) return;
    
    // Broadcast to agents if from customer, or to specific customer if from agent
    this.broadcastToDealershipAgents(data.dealershipId, {
      type: MessageType.READ_RECEIPT,
      dealershipId: data.dealershipId,
      userId: data.userId,
      conversationId: data.conversationId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Broadcast a message to all agents for a specific dealership
   */
  broadcastToDealershipAgents(dealershipId: number, message: WebSocketMessage) {
    // Find all agent clients for this dealership
    this.clients.forEach((client, clientId) => {
      if (client.dealershipId === dealershipId && client.userType === 'agent' && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.ws, message);
      }
    });
  }
  
  /**
   * Broadcast dealership mode change to all connected clients for that dealership
   */
  broadcastModeChange(dealershipId: number, mode: DealershipMode) {
    // Find all clients for this dealership
    this.clients.forEach((client, clientId) => {
      if (client.dealershipId === dealershipId && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.ws, {
          type: MessageType.MODE_CHANGE,
          dealershipId,
          message: `Dealership mode changed to ${mode}`,
          timestamp: new Date().toISOString(),
          metadata: { mode }
        });
      }
    });
  }
  
  /**
   * Broadcast a message to all clients in a sandbox
   */
  broadcastToSandbox(sandboxId: number, message: WebSocketMessage) {
    const clientIds = this.sandboxChannels.get(sandboxId);
    if (!clientIds) {
      logger.warn(`No clients found for sandbox ${sandboxId}`);
      return;
    }
    
    // Add sandbox metadata
    const sandboxMessage = {
      ...message,
      metadata: {
        ...(message.metadata || {}),
        sandboxId,
        channelType: 'sandbox'
      }
    };
    
    // Send to all clients in the sandbox
    let sentCount = 0;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client.ws, sandboxMessage);
        sentCount++;
      }
    }
    
    logger.debug(`Broadcast to sandbox ${sandboxId}: sent to ${sentCount} clients`);
  }
  
  /**
   * Send a message to a specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Send a message to a specific session
   * @param sessionId The session ID to send to
   * @param message The message to send
   * @returns true if sent successfully, false otherwise
   */
  sendToSession(sessionId: string, message: WebSocketMessage): boolean {
    try {
      // Check if this is a sandbox session
      if (this.sandboxSessions.has(sessionId)) {
        const clientId = this.sandboxSessions.get(sessionId);
        if (!clientId) {
          logger.warn('Sandbox session not found for message', { sessionId });
          return false;
        }
        
        // Get client
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
          logger.warn('Sandbox client not found or not connected for session', { sessionId, clientId });
          return false;
        }
        
        // Add sandbox metadata
        const sandboxMessage = {
          ...message,
          metadata: {
            ...(message.metadata || {}),
            sandboxId: client.sandboxId,
            sessionId,
            channelType: 'sandbox'
          }
        };
        
        // Send the message
        this.sendToClient(client.ws, sandboxMessage);
        return true;
      }
      
      // Regular session
      const clientId = this.sessions.get(sessionId);
      if (!clientId) {
        logger.warn('Session not found for message', { sessionId });
        return false;
      }
      
      // Get client
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) {
        logger.warn('Client not found or not connected for session', { sessionId, clientId });
        return false;
      }
      
      // Handle tool stream events specially
      if (message.type === 'tool:stream') {
        const toolMessage: WebSocketMessage = {
          type: MessageType.TOOL_STREAM,
          timestamp: new Date().toISOString(),
          toolName: message.toolName,
          requestId: message.requestId,
          metadata: {
            streamType: message.status || 'data',
            toolName: message.toolName,
            requestId: message.requestId
          }
        };
        
        // Add appropriate fields based on stream type
        if (message.data) {
          toolMessage.data = message.data;
        }
        
        if (message.error) {
          toolMessage.error = message.error;
        }
        
        // Log the tool stream event
        logger.debug('Sending tool stream event', { 
          sessionId, 
          clientId,
          streamType: message.status || 'data',
          toolName: message.toolName,
          requestId: message.requestId
        });
        
        // Send the message
        this.sendToClient(client.ws, toolMessage);
        return true;
      }
      
      // Send regular message
      this.sendToClient(client.ws, message);
      return true;
    } catch (error) {
      logger.error('Error sending message to session', { 
        error: error instanceof Error ? error.message : String(error),
        sessionId 
      });
      return false;
    }
  }
  
  /**
   * Send a message to a sandbox session
   */
  sendToSandboxSession(sandboxId: number, sessionId: string, message: WebSocketMessage): boolean {
    try {
      // Get the client ID for this sandbox session
      const clientId = this.sandboxSessions.get(sessionId);
      if (!clientId) {
        logger.warn('Sandbox session not found', { sandboxId, sessionId });
        return false;
      }
      
      // Get the client
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) {
        logger.warn('Sandbox client not found or not connected', { sandboxId, sessionId, clientId });
        return false;
      }
      
      // Ensure this client belongs to the specified sandbox
      if (client.sandboxId !== sandboxId) {
        logger.warn('Client sandbox ID mismatch', { 
          sandboxId, 
          clientSandboxId: client.sandboxId,
          sessionId 
        });
        return false;
      }
      
      // Add sandbox metadata
      const sandboxMessage = {
        ...message,
        metadata: {
          ...(message.metadata || {}),
          sandboxId,
          sessionId,
          channelType: 'sandbox'
        }
      };
      
      // Send the message
      this.sendToClient(client.ws, sandboxMessage);
      return true;
    } catch (error) {
      logger.error('Error sending message to sandbox session', {
        error: error instanceof Error ? error.message : String(error),
        sandboxId,
        sessionId
      });
      return false;
    }
  }
  
  /**
   * Generate a unique client ID for WebSocket connections
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * Get active sandbox connections count
   */
  getSandboxConnectionsCount(sandboxId: number): number {
    const clientIds = this.sandboxChannels.get(sandboxId);
    return clientIds ? clientIds.size : 0;
  }
  
  /**
   * Get all active sandbox IDs
   */
  getActiveSandboxIds(): number[] {
    return Array.from(this.sandboxChannels.keys());
  }
  
  /**
   * Check if a sandbox session is connected
   */
  isSandboxSessionConnected(sandboxId: number, sessionId: string): boolean {
    const clientId = this.sandboxSessions.get(sessionId);
    if (!clientId) return false;
    
    const client = this.clients.get(clientId);
    return !!(client && 
              client.ws.readyState === WebSocket.OPEN && 
              client.sandboxId === sandboxId);
  }
}

// Create singleton instance
const webSocketServiceInstance = new WebSocketService();

// Export the singleton instance as default
export default webSocketServiceInstance;

// Export a getter function for the instance
export function getWebSocketService(): WebSocketService {
  return webSocketServiceInstance;
}

// Export the class and types for type checking
export { WebSocketService, MessageType, type WebSocketMessage };
