import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import logger from '../utils/logger';
import { dealershipConfigService } from './dealership-config-service';
import { DealershipMode } from '../../shared/schema';

// Message types for our WebSocket communication
export enum MessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CHAT_MESSAGE = 'chat_message',
  TYPING = 'typing',
  READ_RECEIPT = 'read_receipt',
  MODE_CHANGE = 'mode_change',
  AVAILABILITY = 'availability',
  ERROR = 'error'
}

// Interface for our WebSocket messages
interface WebSocketMessage {
  type: MessageType;
  dealershipId?: number;
  userId?: number;
  userName?: string;
  conversationId?: string;
  message?: string;
  timestamp?: string;
  metadata?: any;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, {
    ws: WebSocket;
    userId?: number;
    dealershipId?: number;
    userType?: 'customer' | 'agent';
  }> = new Map();

  /**
   * Initialize the WebSocket server
   */
  initialize(server: Server) {
    // Create WebSocket server with a specific path
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws, request) => {
      // Generate a unique client ID
      const clientId = this.generateClientId();

      // Store client connection
      this.clients.set(clientId, { ws });

      logger.info('New WebSocket connection established', { clientId });

      // Send initial welcome message
      this.sendToClient(ws, {
        type: MessageType.CONNECT,
        message: 'Connected to chat server',
        timestamp: new Date().toISOString(),
        metadata: { clientId }
      });

      // Handle messages from clients
      ws.on('message', async (rawData) => {
        try {
          const data: WebSocketMessage = JSON.parse(rawData.toString());

          // Update client information if provided
          if (data.userId && data.dealershipId) {
            const client = this.clients.get(clientId);
            if (client) {
              client.userId = data.userId;
              client.dealershipId = data.dealershipId;
              this.clients.set(clientId, client);
            }
          }

          // Process message based on type
          await this.handleMessage(clientId, data);

        } catch (error) {
          logger.error('Error processing WebSocket message', { error });
          this.sendToClient(ws, {
            type: MessageType.ERROR,
            message: 'Error processing message',
            timestamp: new Date().toISOString()
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        logger.info('WebSocket connection closed', { clientId });
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', { error, clientId });
        this.clients.delete(clientId);
      });
    });

    logger.info('WebSocket server initialized');
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
      setTimeout((): void => {
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
   * Send a message to a specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
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
}

// Export a singleton instance
export default new WebSocketService();