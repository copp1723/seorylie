import {
  BaseChannelHandler,
  ChannelDeliveryResult,
  ChannelConfiguration,
} from "./base-channel-handler";
import { ChannelMessage, DeliveryStatus } from "../channel-routing-service";

export class WebChatChannelHandler extends BaseChannelHandler {
  private connectedClients: Map<string, WebSocket> = new Map();

  constructor(configuration: ChannelConfiguration) {
    super("web_chat", configuration);
  }

  async sendMessage(message: ChannelMessage): Promise<ChannelDeliveryResult> {
    try {
      const validation = this.validateMessage(message);
      if (!validation) {
        return {
          success: false,
          error: "Invalid message format for web chat channel",
        };
      }

      // Get customer's session ID or create a new chat session
      const sessionId =
        message.metadata?.sessionId ||
        (await this.findCustomerSession(message.customerId));

      if (!sessionId) {
        // Create a new chat session for the customer
        const newSessionId = await this.createChatSession(message);
        return await this.sendToSession(newSessionId, message);
      }

      return await this.sendToSession(sessionId, message);
    } catch (error) {
      return this.handleError(error, {
        sessionId: message.metadata?.sessionId || "unknown",
      });
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if WebSocket server is running and configured
      const wsConfig = this.configuration.settings?.websocket;
      if (!wsConfig?.enabled) {
        this.log("warn", "WebSocket not enabled for web chat");
        return false;
      }

      // Check business hours for web chat
      const businessHours = this.configuration.settings?.businessHours;
      if (businessHours?.enabled && !this.isWithinBusinessHours()) {
        this.log("info", "Web chat outside business hours");
        return false;
      }

      return true;
    } catch (error) {
      this.log("warn", "Web chat channel is not available", { error });
      return false;
    }
  }

  validateMessage(message: ChannelMessage): boolean {
    const commonValidation = this.validateCommonMessage(message);
    if (!commonValidation.valid) {
      this.log("warn", `Web chat validation failed: ${commonValidation.error}`);
      return false;
    }

    // Web chat specific validations
    const maxLength = this.getChannelInfo().maxMessageLength;
    if (message.content.length > maxLength) {
      this.log(
        "warn",
        `Web chat content exceeds maximum length: ${message.content.length}/${maxLength}`,
      );
      return false;
    }

    return true;
  }

  async getDeliveryStatus(externalMessageId: string): Promise<DeliveryStatus> {
    try {
      // For web chat, we can track if message was delivered to client
      const sessionId = externalMessageId;
      const isConnected = this.connectedClients.has(sessionId);

      return isConnected ? "delivered" : "failed";
    } catch (error) {
      this.log("error", "Failed to get web chat delivery status", {
        externalMessageId,
        error,
      });
      return "failed";
    }
  }

  async handleIncomingMessage(data: any): Promise<void> {
    try {
      // Handle incoming web chat messages from customers
      const { sessionId, message, customerId, timestamp } = data;

      this.log("info", "Processing web chat message", {
        sessionId,
        customerId,
        messagePreview: message.substring(0, 50) + "...",
        timestamp,
      });

      // Store the message in conversation history
      await this.storeIncomingMessage(
        sessionId,
        customerId,
        message,
        timestamp,
      );

      // Forward to conversation system for AI processing or agent routing
      await this.forwardToConversationSystem(sessionId, customerId, message);
    } catch (error) {
      this.log("error", "Failed to process web chat message", { data, error });
    }
  }

  getChannelInfo() {
    return {
      maxMessageLength: 2000,
      supportsRichContent: true,
      supportsAttachments: true,
      requiresPhoneNumber: false,
      requiresEmailAddress: false,
    };
  }

  /**
   * Register a WebSocket connection for a customer session
   */
  registerConnection(sessionId: string, websocket: WebSocket): void {
    this.connectedClients.set(sessionId, websocket);

    this.log("info", "Web chat connection registered", { sessionId });

    // Handle connection close
    websocket.addEventListener("close", () => {
      this.connectedClients.delete(sessionId);
      this.log("info", "Web chat connection closed", { sessionId });
    });

    // Handle incoming messages
    websocket.addEventListener("message", async (event) => {
      try {
        const data = JSON.parse(event.data.toString());
        await this.handleIncomingMessage({ ...data, sessionId });
      } catch (error) {
        this.log("error", "Failed to process WebSocket message", {
          sessionId,
          error,
        });
      }
    });
  }

  /**
   * Send typing indicator to customer
   */
  async sendTypingIndicator(
    sessionId: string,
    isTyping: boolean,
  ): Promise<void> {
    try {
      const websocket = this.connectedClients.get(sessionId);
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(
          JSON.stringify({
            type: "typing_indicator",
            isTyping,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (error) {
      this.log("error", "Failed to send typing indicator", {
        sessionId,
        error,
      });
    }
  }

  /**
   * Send chat session metadata (agent info, status, etc.)
   */
  async sendSessionUpdate(sessionId: string, update: any): Promise<void> {
    try {
      const websocket = this.connectedClients.get(sessionId);
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(
          JSON.stringify({
            type: "session_update",
            ...update,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    } catch (error) {
      this.log("error", "Failed to send session update", { sessionId, error });
    }
  }

  // Private helper methods
  private async sendToSession(
    sessionId: string,
    message: ChannelMessage,
  ): Promise<ChannelDeliveryResult> {
    try {
      const websocket = this.connectedClients.get(sessionId);

      if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        // Store message for when customer reconnects
        await this.storeOfflineMessage(sessionId, message);

        return {
          success: true,
          externalMessageId: sessionId,
          metadata: {
            stored_offline: true,
            sessionId,
          },
        };
      }

      const chatMessage = {
        type: "message",
        messageId: message.id || crypto.randomUUID(),
        content: this.formatChatContent(message),
        urgencyLevel: message.urgencyLevel,
        timestamp: new Date().toISOString(),
        agentInfo: this.getAgentInfo(),
        metadata: this.formatMetadata(message),
      };

      websocket.send(JSON.stringify(chatMessage));

      this.log("info", "Web chat message sent", {
        sessionId,
        messageId: chatMessage.messageId,
        urgencyLevel: message.urgencyLevel,
      });

      return {
        success: true,
        externalMessageId: sessionId,
        metadata: {
          messageId: chatMessage.messageId,
          sessionId,
          deliveredInstantly: true,
        },
      };
    } catch (error) {
      this.log("error", "Failed to send web chat message", {
        sessionId,
        error,
      });
      throw error;
    }
  }

  private async findCustomerSession(
    customerId: number,
  ): Promise<string | null> {
    try {
      // Query active chat sessions for this customer
      // For now, return null to create new session
      return null; // Would be implemented with actual database query
    } catch (error) {
      this.log("error", "Failed to find customer session", {
        customerId,
        error,
      });
      return null;
    }
  }

  private async createChatSession(message: ChannelMessage): Promise<string> {
    try {
      const sessionId = crypto.randomUUID();

      // Store chat session in database
      // This would create a new chat session record

      this.log("info", "Created new chat session", {
        sessionId,
        customerId: message.customerId,
        dealershipId: message.dealershipId,
      });

      return sessionId;
    } catch (error) {
      this.log("error", "Failed to create chat session", {
        customerId: message.customerId,
        error,
      });
      throw error;
    }
  }

  private formatChatContent(message: ChannelMessage): string {
    let content = message.content;

    // Add urgency styling for urgent messages
    if (message.urgencyLevel === "urgent") {
      content = `🚨 **URGENT**: ${content}`;
    } else if (message.urgencyLevel === "high") {
      content = `⚡ **HIGH PRIORITY**: ${content}`;
    }

    return content;
  }

  private getAgentInfo(): any {
    const settings = this.configuration.settings;
    return {
      name: settings?.agentName || "Rylie AI Assistant",
      avatar: settings?.agentAvatar || null,
      isAI: true,
      dealership: settings?.dealershipName || "Your Dealership",
    };
  }

  private async storeIncomingMessage(
    sessionId: string,
    customerId: number,
    message: string,
    timestamp: string,
  ): Promise<void> {
    try {
      // Store incoming message in chat history
      // This would save to the database for conversation continuity

      this.log("info", "Stored incoming chat message", {
        sessionId,
        customerId,
        messageLength: message.length,
      });
    } catch (error) {
      this.log("error", "Failed to store incoming message", {
        sessionId,
        customerId,
        error,
      });
    }
  }

  private async storeOfflineMessage(
    sessionId: string,
    message: ChannelMessage,
  ): Promise<void> {
    try {
      // Store message for offline delivery when customer reconnects
      // This would save to a pending messages queue

      this.log("info", "Stored offline chat message", {
        sessionId,
        messageId: message.id,
      });
    } catch (error) {
      this.log("error", "Failed to store offline message", {
        sessionId,
        error,
      });
    }
  }

  private async forwardToConversationSystem(
    sessionId: string,
    customerId: number,
    message: string,
  ): Promise<void> {
    try {
      // Forward to AI processing or agent routing
      // This would integrate with the conversation management system

      this.log("info", "Forwarded chat message to conversation system", {
        sessionId,
        customerId,
      });
    } catch (error) {
      this.log("error", "Failed to forward to conversation system", {
        sessionId,
        customerId,
        error,
      });
    }
  }

  private isWithinBusinessHours(): boolean {
    const now = new Date();
    const businessHours = this.configuration.settings?.businessHours;

    if (!businessHours) return true;

    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

    // Check if current day is a business day
    const businessDays = businessHours.days || [1, 2, 3, 4, 5]; // Monday-Friday default
    if (!businessDays.includes(currentDay)) {
      return false;
    }

    // Check if current time is within business hours
    const startHour = parseInt(businessHours.startTime?.split(":")[0] || "9");
    const endHour = parseInt(businessHours.endTime?.split(":")[0] || "17");

    return currentHour >= startHour && currentHour < endHour;
  }
}
