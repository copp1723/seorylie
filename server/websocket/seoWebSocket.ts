import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
// Disabled - requires Supabase
// import { seoNotificationService } from '../services/seoNotificationService';
import logger from '../utils/logger';

// Mock notification service to prevent crashes
const seoNotificationService = {
  registerWebSocket: () => {},
  unregisterWebSocket: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
  getNotificationHistory: async () => [],
  markAsRead: async () => {}
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  dealershipId?: string;
  agencyId?: string;
}

export function setupSEOWebSocket(server: HTTPServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true
    },
    path: '/ws/seo'
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // TODO: Verify token and extract user info
      // For now, accept any token and extract info from handshake
      const { userId, dealershipId, agencyId } = socket.handshake.auth;
      
      socket.userId = userId;
      socket.dealershipId = dealershipId;
      socket.agencyId = agencyId;

      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', { error });
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info('WebSocket client connected', {
      socketId: socket.id,
      userId: socket.userId,
      dealershipId: socket.dealershipId
    });

    // Register socket with notification service
    if (socket.userId) {
      seoNotificationService.registerWebSocket(
        socket.id,
        socket,
        socket.userId,
        socket.dealershipId
      );
    }

    // Join room based on dealership
    if (socket.dealershipId) {
      socket.join(`dealership:${socket.dealershipId}`);
    }

    // Join room based on agency
    if (socket.agencyId) {
      socket.join(`agency:${socket.agencyId}`);
    }

    // Handle subscription to specific notification types
    socket.on('subscribe', (eventTypes: string[]) => {
      if (socket.userId) {
        seoNotificationService.subscribe(socket.id, {
          userId: socket.userId,
          dealershipId: socket.dealershipId,
          agencyId: socket.agencyId,
          eventTypes,
          callback: (event) => {
            socket.emit('notification', event);
          }
        });
      }
    });

    // Handle notification history request
    socket.on('get-notifications', async (limit: number = 50) => {
      if (socket.dealershipId) {
        try {
          const history = await seoNotificationService.getNotificationHistory(
            socket.dealershipId,
            limit
          );
          socket.emit('notification-history', history);
        } catch (error) {
          socket.emit('error', { message: 'Failed to fetch notifications' });
        }
      }
    });

    // Handle mark as read
    socket.on('mark-read', async (notificationIds: string[]) => {
      try {
        await seoNotificationService.markAsRead(notificationIds);
        socket.emit('marked-read', { success: true, notificationIds });
      } catch (error) {
        socket.emit('error', { message: 'Failed to mark notifications as read' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info('WebSocket client disconnected', { socketId: socket.id });
      
      // Unregister from notification service
      seoNotificationService.unregisterWebSocket(socket.id);
      seoNotificationService.unsubscribe(socket.id);
    });

    // Send initial connection success
    socket.emit('connected', {
      socketId: socket.id,
      userId: socket.userId,
      dealershipId: socket.dealershipId
    });
  });

  // Broadcast methods for server-side use
  const broadcast = {
    // Send to all clients in a dealership
    toDealership: (dealershipId: string, event: string, data: any) => {
      io.to(`dealership:${dealershipId}`).emit(event, data);
    },

    // Send to all clients in an agency
    toAgency: (agencyId: string, event: string, data: any) => {
      io.to(`agency:${agencyId}`).emit(event, data);
    },

    // Send to specific user
    toUser: (userId: string, event: string, data: any) => {
      // Find all sockets for this user
      io.sockets.sockets.forEach((socket: AuthenticatedSocket) => {
        if (socket.userId === userId) {
          socket.emit(event, data);
        }
      });
    }
  };

  // Attach broadcast methods to io instance
  (io as any).broadcast = broadcast;

  return io;
}