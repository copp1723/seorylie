import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import logger from "./utils/logger";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import { sql } from "drizzle-orm";

interface Client {
  connectionId: string;
  userId?: number;
  userType?: "agent" | "customer";
  dealershipId?: number;
  isAuthenticated: boolean;
  activeConversationId?: number;
  socket: WebSocket;
  lastActivity: Date;
}

interface ChatMessage {
  id: string;
  conversationId: number;
  senderId: number;
  senderType: "agent" | "customer";
  content: string;
  messageType: "text" | "image" | "file";
  timestamp: Date;
  metadata?: any;
}

class WebSocketChatServer {
  private wss!: WebSocketServer; // Definite assignment assertion - initialized in initialize()
  private clients: Map<string, Client> = new Map();
  private conversationClients: Map<number, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.setupCleanupJobs();
  }

  initialize(server: Server): this {
    try {
      this.wss = new WebSocketServer({ server, path: "/ws" });

      logger.info("WebSocket server initialized");

      this.wss.on("connection", (socket: WebSocket) => {
        this.handleConnection(socket);
      });

      this.wss.on("error", (error: Error) => {
        logger.error("WebSocket server error:", error);
        this.handleServerError(error);
      });

      this.isInitialized = true;
      return this;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to initialize WebSocket server:", err);
      throw new Error(`WebSocket server initialization failed: ${err.message}`);
    }
  }

  private handleServerError(error: Error): void {
    // Log the error and attempt recovery if possible
    logger.error("WebSocket server encountered an error:", {
      message: error.message,
      stack: error.stack,
    });

    // In production, you might want to implement recovery logic here
    // For now, we'll just ensure the error is properly logged
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.wss) {
      throw new Error(
        "WebSocket server not initialized. Call initialize() first.",
      );
    }
  }

  private handleConnection(socket: WebSocket): void {
    this.ensureInitialized();

    // Generate a unique ID for this connection
    const connectionId = uuidv4();

    // Store client info
    const client: Client = {
      connectionId,
      isAuthenticated: false,
      socket,
      lastActivity: new Date(),
    };

    this.clients.set(connectionId, client);

    logger.info(`New WebSocket connection: ${connectionId}`);

    // Send connection established message
    this.sendToClient(connectionId, {
      type: "connection_established",
      connectionId,
      timestamp: new Date().toISOString(),
    });

    // Set up event handlers
    socket.on("message", (message: WebSocket.Data) => {
      this.handleMessage(connectionId, message);
    });

    socket.on("close", (code: number, reason: Buffer) => {
      this.handleDisconnect(connectionId, code, reason.toString());
    });

    socket.on("error", (error) => {
      logger.error(`WebSocket error for connection ${connectionId}:`, error);
    });
  }

  private handleMessage(connectionId: string, message: WebSocket.Data) {
    const client = this.clients.get(connectionId);

    if (!client) {
      logger.warn(`Received message from unknown client: ${connectionId}`);
      return;
    }

    // Update last activity timestamp
    client.lastActivity = new Date();
    this.clients.set(connectionId, client);

    try {
      const data = JSON.parse(message.toString());

      // Process message based on type
      switch (data.type) {
        case "ping":
          this.handlePing(connectionId);
          break;

        case "authenticate":
          this.handleAuthentication(connectionId, data);
          break;

        case "join_conversation":
          this.handleJoinConversation(connectionId, data);
          break;

        case "leave_conversation":
          this.handleLeaveConversation(connectionId, data);
          break;

        case "send_message":
          this.handleSendMessage(connectionId, data);
          break;

        case "typing":
          this.handleTypingIndicator(connectionId, data);
          break;

        default:
          logger.warn(
            `Unknown message type from ${connectionId}: ${data.type}`,
          );
          this.sendToClient(connectionId, {
            type: "error",
            error: "Unknown message type",
            originalType: data.type,
          });
      }
    } catch (error) {
      logger.error(`Error processing message from ${connectionId}:`, error);
      this.sendToClient(connectionId, {
        type: "error",
        error: "Invalid message format",
      });
    }
  }

  private handleDisconnect(
    connectionId: string,
    code?: number,
    reason?: string,
  ) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    // If client was in a conversation, notify others and remove from conversation
    if (client.activeConversationId && client.isAuthenticated) {
      this.notifyConversation(
        client.activeConversationId,
        {
          type: "user_left",
          userId: client.userId,
          userType: client.userType,
          timestamp: new Date().toISOString(),
        },
        connectionId,
      );

      // Remove from conversation clients map
      const conversationClients = this.conversationClients.get(
        client.activeConversationId,
      );
      if (conversationClients) {
        conversationClients.delete(connectionId);

        if (conversationClients.size === 0) {
          this.conversationClients.delete(client.activeConversationId);
        } else {
          this.conversationClients.set(
            client.activeConversationId,
            conversationClients,
          );
        }
      }
    }

    // Remove client from clients map
    this.clients.delete(connectionId);

    logger.info(
      `WebSocket disconnected: ${connectionId}, code: ${code}, reason: ${reason || "No reason provided"}`,
    );
  }

  private handlePing(connectionId: string) {
    this.sendToClient(connectionId, {
      type: "pong",
      timestamp: new Date().toISOString(),
    });
  }

  private handleAuthentication(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    // Basic validation
    if (!data.userId || !data.userType || !data.dealershipId) {
      this.sendToClient(connectionId, {
        type: "error",
        error: "Authentication failed: Missing required fields",
      });
      return;
    }

    // In a real implementation, you would verify the token
    // For demonstration purposes, we'll accept any token

    // Update client with authenticated info
    client.userId = data.userId;
    client.userType = data.userType;
    client.dealershipId = data.dealershipId;
    client.isAuthenticated = true;

    this.clients.set(connectionId, client);

    this.sendToClient(connectionId, {
      type: "authenticated",
      userId: client.userId,
      userType: client.userType,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `Client authenticated: ${connectionId}, userId: ${client.userId}, userType: ${client.userType}`,
    );
  }

  private async handleJoinConversation(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);

    if (!client || !client.isAuthenticated) {
      this.sendToClient(connectionId, {
        type: "error",
        error: "Not authenticated",
      });
      return;
    }

    if (!data.conversationId) {
      this.sendToClient(connectionId, {
        type: "error",
        error: "Missing conversationId",
      });
      return;
    }

    const conversationId = data.conversationId;

    // Add client to conversation
    let conversationClients = this.conversationClients.get(conversationId);

    if (!conversationClients) {
      conversationClients = new Set();
    }

    conversationClients.add(connectionId);
    this.conversationClients.set(conversationId, conversationClients);

    // Update client's active conversation
    client.activeConversationId = conversationId;
    this.clients.set(connectionId, client);

    // Fetch recent messages from the database
    let recentMessages: ChatMessage[] = [];

    try {
      // This is a placeholder. In a real implementation, you would fetch from your database
      // For demonstration, we'll return empty or mock data
      recentMessages = await this.fetchRecentMessages(conversationId);
    } catch (error) {
      logger.error(
        `Error fetching recent messages for conversation ${conversationId}:`,
        error,
      );
    }

    // Send join confirmation and recent messages
    this.sendToClient(connectionId, {
      type: "joined_conversation",
      conversationId,
      recentMessages,
      timestamp: new Date().toISOString(),
    });

    // Notify other clients in the conversation
    this.notifyConversation(
      conversationId,
      {
        type: "user_joined",
        userId: client.userId,
        userType: client.userType,
        timestamp: new Date().toISOString(),
      },
      connectionId,
    );

    logger.info(
      `Client joined conversation: ${connectionId}, conversationId: ${conversationId}`,
    );
  }

  private handleLeaveConversation(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);

    if (!client || !client.isAuthenticated || !client.activeConversationId) {
      return;
    }

    const conversationId = client.activeConversationId;

    // Notify other clients in the conversation
    this.notifyConversation(
      conversationId,
      {
        type: "user_left",
        userId: client.userId,
        userType: client.userType,
        timestamp: new Date().toISOString(),
      },
      connectionId,
    );

    // Remove client from conversation
    const conversationClients = this.conversationClients.get(conversationId);

    if (conversationClients) {
      conversationClients.delete(connectionId);

      if (conversationClients.size === 0) {
        this.conversationClients.delete(conversationId);
      } else {
        this.conversationClients.set(conversationId, conversationClients);
      }
    }

    // Update client
    client.activeConversationId = undefined;
    this.clients.set(connectionId, client);

    logger.info(
      `Client left conversation: ${connectionId}, conversationId: ${conversationId}`,
    );
  }

  private async handleSendMessage(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);

    if (!client || !client.isAuthenticated || !client.activeConversationId) {
      this.sendToClient(connectionId, {
        type: "error",
        error: "Not authenticated or not in a conversation",
      });
      return;
    }

    if (!data.content) {
      this.sendToClient(connectionId, {
        type: "error",
        error: "Message content is required",
      });
      return;
    }

    const conversationId = client.activeConversationId;
    const messageId = uuidv4();
    const timestamp = new Date();

    // Create message object
    const message: ChatMessage = {
      id: messageId,
      conversationId,
      senderId: client.userId!,
      senderType: client.userType!,
      content: data.content,
      messageType: data.messageType || "text",
      timestamp,
      metadata: data.metadata || {},
    };

    // Save message to database
    try {
      await this.saveMessage(message);
    } catch (error) {
      logger.error(`Error saving message to database:`, error);
      this.sendToClient(connectionId, {
        type: "error",
        error: "Failed to save message",
      });
      return;
    }

    // Broadcast to all clients in the conversation
    this.notifyConversation(conversationId, {
      type: "new_message",
      message,
      timestamp: timestamp.toISOString(),
    });

    logger.info(
      `Message sent in conversation ${conversationId} by user ${client.userId}`,
    );
  }

  private handleTypingIndicator(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);

    if (!client || !client.isAuthenticated || !client.activeConversationId) {
      return;
    }

    const conversationId = client.activeConversationId;

    // Broadcast typing indicator to all clients in the conversation
    this.notifyConversation(
      conversationId,
      {
        type: "typing_indicator",
        userId: client.userId,
        userType: client.userType,
        isTyping: !!data.isTyping,
        timestamp: new Date().toISOString(),
      },
      connectionId,
    );
  }

  private sendToClient(connectionId: string, data: any) {
    const client = this.clients.get(connectionId);

    if (!client) {
      return;
    }

    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(data));
    }
  }

  private notifyConversation(
    conversationId: number,
    data: any,
    excludeConnectionId?: string,
  ) {
    const conversationClients = this.conversationClients.get(conversationId);

    if (!conversationClients) {
      return;
    }

    for (const clientId of conversationClients) {
      if (excludeConnectionId && clientId === excludeConnectionId) {
        continue;
      }

      this.sendToClient(clientId, data);
    }
  }

  /**
   * Publish a message to a specific channel (conversation)
   */
  publishToChannel(channel: string, data: any): void {
    // Parse channel to get conversation ID
    const conversationId = parseInt(channel.replace("conversation_", ""), 10);

    if (isNaN(conversationId)) {
      logger.warn(`Invalid channel format: ${channel}`);
      return;
    }

    this.notifyConversation(conversationId, data);
    logger.debug(`Published message to channel: ${channel}`);
  }

  private setupCleanupJobs() {
    // Heartbeat interval to detect dead connections
    this.heartbeatInterval = setInterval(() => {
      this.pingAllClients();
    }, 30000); // Every 30 seconds

    // Cleanup interval to remove inactive clients
    this.cleanupInterval = setInterval(() => {
      this.removeInactiveClients();
    }, 60000); // Every minute
  }

  private pingAllClients() {
    const now = new Date();

    for (const [connectionId, client] of this.clients.entries()) {
      // Only ping clients that haven't had activity in the last 20 seconds
      if (now.getTime() - client.lastActivity.getTime() > 20000) {
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.ping();
        }
      }
    }
  }

  private removeInactiveClients() {
    const now = new Date();
    const inactiveThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [connectionId, client] of this.clients.entries()) {
      if (now.getTime() - client.lastActivity.getTime() > inactiveThreshold) {
        logger.info(`Removing inactive client: ${connectionId}`);

        // Close the connection if still open
        if (client.socket.readyState === WebSocket.OPEN) {
          client.socket.close(1000, "Inactive timeout");
        }

        // Clean up as if it disconnected
        this.handleDisconnect(connectionId, 1000, "Inactive timeout");
      }
    }
  }

  private async fetchRecentMessages(
    conversationId: number,
  ): Promise<ChatMessage[]> {
    try {
      // In a real implementation, you would fetch from your database
      // For demonstration, we'll return mock data

      // Ideally you'd have something like:
      // const messages = await db.select().from(chatMessages)
      //  .where(eq(chatMessages.conversationId, conversationId))
      //  .orderBy(asc(chatMessages.timestamp))
      //  .limit(50);

      // For now, returning mock data
      return [];
    } catch (error) {
      logger.error(`Error fetching recent messages:`, error);
      return [];
    }
  }

  private async saveMessage(message: ChatMessage): Promise<void> {
    try {
      // In a real implementation, you would save to your database
      // For demonstration, we'll just log it
      logger.info(
        `Message saved: ${message.id} in conversation ${message.conversationId}`,
      );

      // Ideally you'd have something like:
      // await db.insert(chatMessages).values({
      //   id: message.id,
      //   conversationId: message.conversationId,
      //   senderId: message.senderId,
      //   senderType: message.senderType,
      //   content: message.content,
      //   messageType: message.messageType,
      //   timestamp: message.timestamp,
      //   metadata: message.metadata
      // });
    } catch (error) {
      logger.error(`Error saving message:`, error);
      throw error;
    }
  }

  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Close all connections
    for (const client of this.clients.values()) {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.close(1000, "Server shutdown");
      }
    }

    // Clear client maps
    this.clients.clear();
    this.conversationClients.clear();

    // Close the server if initialized
    if (this.isInitialized && this.wss) {
      this.wss.close();
    }

    this.isInitialized = false;
    logger.info("WebSocket server shut down");
  }
}

// Export singleton instance
export const wsServer = new WebSocketChatServer();

export default WebSocketChatServer;
