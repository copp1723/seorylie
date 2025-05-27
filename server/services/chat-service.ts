import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import logger from '../utils/logger';
import db from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  id: string;
  conversationId: number;
  senderId: number;
  senderType: 'agent' | 'customer';
  content: string;
  messageType: 'text' | 'image' | 'file';
  timestamp: Date;
  metadata?: any;
}

interface ChatConnection {
  id: string;
  ws: WebSocket;
  userId?: number;
  dealershipId?: number;
  conversationId?: number;
  type: 'agent' | 'customer';
  lastActivity: Date;
}

interface ConversationRoom {
  conversationId: number;
  dealershipId: number;
  agents: Set<string>;
  customers: Set<string>;
  lastActivity: Date;
}

export class ChatServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, ChatConnection> = new Map();
  private rooms: Map<number, ConversationRoom> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/chat'
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    logger.info('Chat WebSocket server initialized');
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    const connectionId = uuidv4();
    
    // Extract session from cookies or headers for authentication
    // This is a simplified version - you'd want proper session verification
    const connection: ChatConnection = {
      id: connectionId,
      ws,
      type: 'customer', // Default, will be updated after auth
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(connectionId, message);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Error handling WebSocket message', { 
          error: err.message, 
          connectionId 
        });
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { error: error.message, connectionId });
      this.handleDisconnection(connectionId);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connection_established',
      connectionId,
      timestamp: new Date()
    });
  }

  private async handleMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();

    switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(connectionId, message);
        break;
      
      case 'join_conversation':
        await this.handleJoinConversation(connectionId, message);
        break;
      
      case 'send_message':
        await this.handleSendMessage(connectionId, message);
        break;
      
      case 'typing':
        await this.handleTyping(connectionId, message);
        break;
      
      case 'ping':
        this.sendMessage(connection.ws, { type: 'pong', timestamp: new Date() });
        break;
      
      default:
        logger.warn('Unknown message type', { type: message.type, connectionId });
    }
  }

  private async handleAuthentication(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      // Authenticate user based on session token or JWT
      // This is simplified - implement proper authentication
      const { token, userType } = message;
      
      // For demo purposes, we'll mock authentication
      // In production, verify the token and get user details
      if (token) {
        connection.userId = message.userId || 1;
        connection.dealershipId = message.dealershipId || 1;
        connection.type = userType || 'customer';

        this.sendMessage(connection.ws, {
          type: 'authenticated',
          userId: connection.userId,
          userType: connection.type,
          timestamp: new Date()
        });

        logger.info('User authenticated via WebSocket', {
          connectionId,
          userId: connection.userId,
          userType: connection.type
        });
      } else {
        this.sendError(connection.ws, 'Authentication failed');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Authentication error', { error: err.message, connectionId });
      this.sendError(connection.ws, 'Authentication failed');
    }
  }

  private async handleJoinConversation(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.userId) return;

    const { conversationId } = message;
    
    try {
      // Verify user has access to this conversation
      const hasAccess = await this.verifyConversationAccess(
        connection.userId, 
        conversationId, 
        connection.dealershipId!
      );

      if (!hasAccess) {
        this.sendError(connection.ws, 'Access denied to conversation');
        return;
      }

      // Update connection with conversation
      connection.conversationId = conversationId;

      // Add to room
      this.joinRoom(conversationId, connectionId, connection);

      // Send confirmation and recent messages
      const recentMessages = await this.getRecentMessages(conversationId);
      
      this.sendMessage(connection.ws, {
        type: 'joined_conversation',
        conversationId,
        recentMessages,
        timestamp: new Date()
      });

      // Notify other participants
      this.broadcastToRoom(conversationId, {
        type: 'user_joined',
        userId: connection.userId,
        userType: connection.type,
        timestamp: new Date()
      }, connectionId);

      logger.info('User joined conversation', {
        connectionId,
        userId: connection.userId,
        conversationId
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error joining conversation', { 
        error: err.message, 
        connectionId, 
        conversationId 
      });
      this.sendError(connection.ws, 'Failed to join conversation');
    }
  }

  private async handleSendMessage(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.conversationId || !connection.userId) return;

    try {
      const { content, messageType = 'text', metadata = {} } = message;

      // Save message to database
      const chatMessage: ChatMessage = {
        id: uuidv4(),
        conversationId: connection.conversationId,
        senderId: connection.userId,
        senderType: connection.type,
        content,
        messageType,
        timestamp: new Date(),
        metadata
      };

      await this.saveMessage(chatMessage);

      // Broadcast to all participants in the conversation
      this.broadcastToRoom(connection.conversationId, {
        type: 'new_message',
        message: chatMessage,
        timestamp: new Date()
      });

      // Update conversation last activity
      await this.updateConversationActivity(connection.conversationId);

      logger.info('Message sent', {
        connectionId,
        conversationId: connection.conversationId,
        messageId: chatMessage.id
      });

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error sending message', { 
        error: err.message, 
        connectionId 
      });
      this.sendError(connection.ws, 'Failed to send message');
    }
  }

  private async handleTyping(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.conversationId) return;

    const { isTyping } = message;

    // Broadcast typing indicator to other participants
    this.broadcastToRoom(connection.conversationId, {
      type: 'typing_indicator',
      userId: connection.userId,
      userType: connection.type,
      isTyping,
      timestamp: new Date()
    }, connectionId);
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from room if in a conversation
    if (connection.conversationId) {
      this.leaveRoom(connection.conversationId, connectionId);
      
      // Notify other participants
      this.broadcastToRoom(connection.conversationId, {
        type: 'user_left',
        userId: connection.userId,
        userType: connection.type,
        timestamp: new Date()
      });
    }

    this.connections.delete(connectionId);
    
    logger.info('User disconnected', {
      connectionId,
      userId: connection.userId,
      conversationId: connection.conversationId
    });
  }

  private joinRoom(conversationId: number, connectionId: string, connection: ChatConnection): void {
    if (!this.rooms.has(conversationId)) {
      this.rooms.set(conversationId, {
        conversationId,
        dealershipId: connection.dealershipId!,
        agents: new Set(),
        customers: new Set(),
        lastActivity: new Date()
      });
    }

    const room = this.rooms.get(conversationId)!;
    
    if (connection.type === 'agent') {
      room.agents.add(connectionId);
    } else {
      room.customers.add(connectionId);
    }
    
    room.lastActivity = new Date();
  }

  private leaveRoom(conversationId: number, connectionId: string): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;

    room.agents.delete(connectionId);
    room.customers.delete(connectionId);

    // Remove room if empty
    if (room.agents.size === 0 && room.customers.size === 0) {
      this.rooms.delete(conversationId);
    }
  }

  private broadcastToRoom(conversationId: number, message: any, excludeConnectionId?: string): void {
    const room = this.rooms.get(conversationId);
    if (!room) return;

    // Handle agents
    room.agents.forEach(connectionId => {
      if (connectionId === excludeConnectionId) return;
      
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    });
    
    // Handle customers
    room.customers.forEach(connectionId => {
      if (connectionId === excludeConnectionId) return;
      
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        this.sendMessage(connection.ws, message);
      }
    });
  }

  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: new Date()
    });
  }

  private async verifyConversationAccess(userId: number, conversationId: number, dealershipId: number): Promise<boolean> {
    try {
      // Check if user has access to this conversation
      // This is simplified - implement proper access control
      const result = await db.execute(sql`
        SELECT 1 FROM conversations 
        WHERE id = ${conversationId} 
        AND dealership_id = ${dealershipId}
      `);
      
      return result.length > 0;
    } catch (error) {
      logger.error('Error verifying conversation access', { error, userId, conversationId });
      return false;
    }
  }

  private async getRecentMessages(conversationId: number, limit: number = 50): Promise<ChatMessage[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          id,
          conversation_id as "conversationId",
          content,
          is_from_customer as "isFromCustomer",
          created_at as "timestamp",
          metadata
        FROM messages 
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `);

      // Transform database format to ChatMessage format
      const messages: ChatMessage[] = [];
      
      for (const row of result) {
        const senderType: 'agent' | 'customer' = row.isFromCustomer ? 'customer' : 'agent';
        messages.push({
          id: row.id,
          conversationId: row.conversationId,
          senderId: 0, // Would need to add sender_id to messages table
          senderType,
          content: row.content,
          messageType: 'text', // Default to text, could be stored in metadata
          timestamp: new Date(row.timestamp),
          metadata: row.metadata || {}
        });
      }
      
      return messages.reverse(); // Newest last
      
    } catch (error) {
      logger.error('Error getting recent messages', { error, conversationId });
      return [];
    }
  }

  private async saveMessage(message: ChatMessage): Promise<void> {
    try {
      // Save message to database
      await db.execute(sql`
        INSERT INTO messages (
          id, 
          conversation_id, 
          content, 
          is_from_customer,
          created_at,
          metadata
        ) VALUES (
          ${message.id},
          ${message.conversationId},
          ${message.content},
          ${message.senderType === 'customer'},
          ${message.timestamp.toISOString()},
          ${JSON.stringify(message.metadata)}
        )
      `);
    } catch (error) {
      logger.error('Error saving message', { error, message });
      throw error;
    }
  }

  private async updateConversationActivity(conversationId: number): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE conversations
        SET updated_at = NOW(),
            status = CASE WHEN status = 'closed' THEN 'active' ELSE status END
        WHERE id = ${conversationId}
      `);
    } catch (error) {
      logger.error('Error updating conversation activity', { error, conversationId });
    }
  }

  private startHeartbeat(): void {
    // Send heartbeats to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.checkConnections();
    }, 30000); // Check every 30 seconds
  }

  private checkConnections(): void {
    const now = new Date();
    const timeoutThreshold = 5 * 60 * 1000; // 5 minutes
    
    this.connections.forEach((connection, connectionId) => {
      // Check if connection is stale
      const timeSinceLastActivity = now.getTime() - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > timeoutThreshold) {
        // Connection has been inactive for too long
        logger.info('Closing inactive connection', { connectionId });
        
        if (connection.ws.readyState === WebSocket.OPEN) {
          connection.ws.close(1000, 'Connection timeout due to inactivity');
        }
        
        this.handleDisconnection(connectionId);
      } else if (connection.ws.readyState === WebSocket.OPEN) {
        // Send ping to keep connection alive
        this.sendMessage(connection.ws, { type: 'ping', timestamp: now });
      }
    });
    
    // Clean up empty rooms
    this.rooms.forEach((room, conversationId) => {
      if (room.agents.size === 0 && room.customers.size === 0) {
        this.rooms.delete(conversationId);
      }
    });
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all connections
    this.connections.forEach(connection => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, 'Server shutting down');
      }
    });
    
    this.connections.clear();
    this.rooms.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    logger.info('Chat server shut down');
  }
}