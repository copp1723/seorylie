/**
 * Enhanced WebSocket Service
 * 
 * Standardized WebSocket service following the new service architecture patterns.
 * Manages WebSocket connections, real-time messaging, and event broadcasting.
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { BaseService, ServiceConfig, ServiceHealth } from './base-service';
import { authService } from './auth-service';
import logger from '../utils/logger';
import { CustomError } from '../utils/error-handler';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  userId?: string;
  dealershipId?: number;
  conversationId?: string;
}

export interface ConnectionInfo {
  socketId: string;
  userId?: string;
  dealershipId?: number;
  connectedAt: Date;
  lastActivity: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface BroadcastOptions {
  room?: string;
  userId?: string;
  dealershipId?: number;
  excludeSocket?: string;
}

export class EnhancedWebSocketService extends BaseService {
  private io: SocketIOServer | null = null;
  private connections: Map<string, ConnectionInfo> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> socketIds
  private dealershipSockets: Map<number, Set<string>> = new Map(); // dealershipId -> socketIds

  constructor(config: ServiceConfig) {
    super({
      ...config,
      dependencies: ['AuthService']
    });
  }

  protected async onInitialize(): Promise<void> {
    logger.info('Enhanced WebSocket Service initializing...');
    // Initialization will happen when HTTP server is provided
  }

  protected async onShutdown(): Promise<void> {
    logger.info('Enhanced WebSocket Service shutting down...');
    
    if (this.io) {
      // Notify all clients about shutdown
      this.io.emit('server:shutdown', {
        message: 'Server is shutting down',
        timestamp: new Date()
      });

      // Close all connections
      this.io.close();
      this.io = null;
    }

    this.connections.clear();
    this.userSockets.clear();
    this.dealershipSockets.clear();
  }

  protected async checkDependencyHealth(dependency: string): Promise<ServiceHealth> {
    if (dependency === 'AuthService') {
      try {
        // Check if auth service is available
        const authHealth = await authService.getHealth();
        return authHealth;
      } catch (error) {
        return {
          status: 'unhealthy',
          lastCheck: new Date(),
          uptime: 0,
          dependencies: {},
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return {
      status: 'healthy',
      lastCheck: new Date(),
      uptime: 0,
      dependencies: {}
    };
  }

  /**
   * Initialize WebSocket server with HTTP server
   */
  initializeServer(httpServer: HTTPServer): void {
    if (this.io) {
      logger.warn('Enhanced WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['*'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      path: '/socket.io'
    });

    this.setupEventHandlers();
    
    logger.info('Enhanced WebSocket server initialized', {
      transports: ['websocket', 'polling']
    });
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId: string, message: WebSocketMessage): boolean {
    return this.executeWithMetrics(async () => {
      const socketIds = this.userSockets.get(userId);
      if (!socketIds || socketIds.size === 0) {
        logger.debug('No active connections for user', { userId });
        return false;
      }

      let sent = false;
      for (const socketId of socketIds) {
        const socket = this.io?.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('message', message);
          sent = true;
        }
      }

      if (sent) {
        logger.debug('Message sent to user', { userId, type: message.type });
      }

      return sent;
    }, 'sendToUser').catch(() => false);
  }

  /**
   * Send message to all users in a dealership
   */
  sendToDealership(dealershipId: number, message: WebSocketMessage): boolean {
    return this.executeWithMetrics(async () => {
      const socketIds = this.dealershipSockets.get(dealershipId);
      if (!socketIds || socketIds.size === 0) {
        logger.debug('No active connections for dealership', { dealershipId });
        return false;
      }

      let sent = false;
      for (const socketId of socketIds) {
        const socket = this.io?.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('message', message);
          sent = true;
        }
      }

      if (sent) {
        logger.debug('Message sent to dealership', { dealershipId, type: message.type });
      }

      return sent;
    }, 'sendToDealership').catch(() => false);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage, options?: BroadcastOptions): void {
    this.executeWithMetrics(async () => {
      if (!this.io) {
        logger.warn('Enhanced WebSocket server not initialized');
        return;
      }

      let target = this.io;

      // Apply filters based on options
      if (options?.room) {
        target = this.io.to(options.room);
      }

      if (options?.excludeSocket) {
        target = target.except(options.excludeSocket);
      }

      target.emit('message', message);

      logger.debug('Message broadcasted', { 
        type: message.type, 
        room: options?.room,
        excluded: options?.excludeSocket 
      });
    }, 'broadcast').catch(error => {
      logger.error('Failed to broadcast message', error);
    });
  }

  /**
   * Join socket to a room
   */
  joinRoom(socketId: string, room: string): boolean {
    const socket = this.io?.sockets.sockets.get(socketId);
    if (!socket) {
      return false;
    }

    socket.join(room);
    logger.debug('Socket joined room', { socketId, room });
    return true;
  }

  /**
   * Remove socket from a room
   */
  leaveRoom(socketId: string, room: string): boolean {
    const socket = this.io?.sockets.sockets.get(socketId);
    if (!socket) {
      return false;
    }

    socket.leave(room);
    logger.debug('Socket left room', { socketId, room });
    return true;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    dealershipConnections: Record<number, number>;
    userConnections: Record<string, number>;
  } {
    const dealershipConnections: Record<number, number> = {};
    const userConnections: Record<string, number> = {};

    // Count dealership connections
    for (const [dealershipId, socketIds] of this.dealershipSockets) {
      dealershipConnections[dealershipId] = socketIds.size;
    }

    // Count user connections
    for (const [userId, socketIds] of this.userSockets) {
      userConnections[userId] = socketIds.size;
    }

    return {
      totalConnections: this.connections.size,
      authenticatedConnections: this.userSockets.size,
      dealershipConnections,
      userConnections
    };
  }

  /**
   * Get active connections
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const connectionInfo: ConnectionInfo = {
        socketId: socket.id,
        connectedAt: new Date(),
        lastActivity: new Date(),
        userAgent: socket.handshake.headers['user-agent'],
        ipAddress: socket.handshake.address
      };

      this.connections.set(socket.id, connectionInfo);

      logger.info('Enhanced WebSocket connection established', {
        socketId: socket.id,
        userAgent: connectionInfo.userAgent,
        ipAddress: connectionInfo.ipAddress
      });

      // Handle authentication
      socket.on('authenticate', async (data) => {
        try {
          const { token } = data;
          if (!token) {
            socket.emit('auth:error', { message: 'Token required' });
            return;
          }

          const user = await authService.verifyToken(token);
          
          // Update connection info
          connectionInfo.userId = user.id;
          connectionInfo.dealershipId = user.dealershipId;
          
          // Track user and dealership connections
          if (!this.userSockets.has(user.id)) {
            this.userSockets.set(user.id, new Set());
          }
          this.userSockets.get(user.id)!.add(socket.id);

          if (user.dealershipId) {
            if (!this.dealershipSockets.has(user.dealershipId)) {
              this.dealershipSockets.set(user.dealershipId, new Set());
            }
            this.dealershipSockets.get(user.dealershipId)!.add(socket.id);
          }

          socket.emit('auth:success', { 
            user: { 
              id: user.id, 
              email: user.email, 
              name: user.name,
              role: user.role 
            } 
          });

          logger.info('Enhanced WebSocket client authenticated', {
            socketId: socket.id,
            userId: user.id,
            dealershipId: user.dealershipId
          });

        } catch (error) {
          socket.emit('auth:error', { 
            message: error instanceof Error ? error.message : 'Authentication failed' 
          });
          
          logger.warn('Enhanced WebSocket authentication failed', {
            socketId: socket.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        connectionInfo.lastActivity = new Date();
        socket.emit('pong', { timestamp: new Date() });
      });

      // Handle custom events
      socket.on('message', (data) => {
        connectionInfo.lastActivity = new Date();
        this.handleCustomMessage(socket, data);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this.handleDisconnection(socket.id, reason);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        logger.error('Enhanced WebSocket connection error', error, {
          socketId: socket.id,
          userId: connectionInfo.userId
        });
      });
    });

    logger.info('Enhanced WebSocket event handlers configured');
  }

  /**
   * Handle custom messages from clients
   */
  private handleCustomMessage(socket: any, data: any): void {
    const connectionInfo = this.connections.get(socket.id);
    if (!connectionInfo) return;

    logger.debug('Enhanced WebSocket message received', {
      socketId: socket.id,
      userId: connectionInfo.userId,
      type: data.type
    });

    // Emit event for other services to handle
    this.emit('message', {
      socket,
      connectionInfo,
      data
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(socketId: string, reason: string): void {
    const connectionInfo = this.connections.get(socketId);
    
    if (connectionInfo) {
      // Remove from user tracking
      if (connectionInfo.userId) {
        const userSockets = this.userSockets.get(connectionInfo.userId);
        if (userSockets) {
          userSockets.delete(socketId);
          if (userSockets.size === 0) {
            this.userSockets.delete(connectionInfo.userId);
          }
        }
      }

      // Remove from dealership tracking
      if (connectionInfo.dealershipId) {
        const dealershipSockets = this.dealershipSockets.get(connectionInfo.dealershipId);
        if (dealershipSockets) {
          dealershipSockets.delete(socketId);
          if (dealershipSockets.size === 0) {
            this.dealershipSockets.delete(connectionInfo.dealershipId);
          }
        }
      }

      logger.info('Enhanced WebSocket connection closed', {
        socketId,
        userId: connectionInfo.userId,
        dealershipId: connectionInfo.dealershipId,
        reason,
        duration: Date.now() - connectionInfo.connectedAt.getTime()
      });
    }

    this.connections.delete(socketId);
  }
}

// Create and export singleton instance
export const enhancedWebSocketService = new EnhancedWebSocketService({
  name: 'EnhancedWebSocketService',
  version: '1.0.0'
});
