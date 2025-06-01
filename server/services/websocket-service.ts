import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { dealershipConfigService } from './dealership-config-service';
import { DealershipMode } from '../../shared/schema';
import { featureFlagsService, FeatureFlagNames } from '../services/feature-flags-service';
import { monitoringService } from '../services/monitoring';
import { AppError, ErrorCode } from '../utils/error-codes';
import { generateTraceId } from '../utils/error-handler';

// Message types for our WebSocket communication
export enum MessageType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CHAT_MESSAGE = 'chat_message',
  TYPING = 'typing',
  READ_RECEIPT = 'read_receipt',
  MODE_CHANGE = 'mode_change',
  AVAILABILITY = 'availability',
  ERROR = 'error',
  HEALTH_CHECK = 'health_check',
  RECONNECT = 'reconnect',
  MIGRATION = 'migration'
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
  traceId?: string;
}

// Client connection information
interface ClientConnection {
  ws: WebSocket;
  userId?: number;
  dealershipId?: number;
  userType?: 'customer' | 'agent';
  lastActivity: number;
  createdAt: number;
  messageCount: number;
  instanceId: string;
  traceId: string;
  isAlive: boolean;
  rateLimit: {
    count: number;
    resetTime: number;
    blocked: boolean;
  };
}

// Redis channels
const REDIS_CHANNELS = {
  BROADCAST: 'ws:broadcast',
  DIRECT: 'ws:direct',
  CONNECTION_REGISTRY: 'ws:connections',
  HEALTH_CHECK: 'ws:health',
  MIGRATION: 'ws:migration'
};

// Redis keys
const REDIS_KEYS = {
  CONNECTION_PREFIX: 'ws:connection:',
  MESSAGE_QUEUE_PREFIX: 'ws:queue:',
  INSTANCE_REGISTRY: 'ws:instances',
  METRICS: 'ws:metrics:'
};

// Configuration
const CONFIG = {
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 300000, // 5 minutes
  RATE_LIMIT: {
    MAX_MESSAGES: 60, // Max messages per minute
    WINDOW_MS: 60000, // 1 minute
    BLOCK_DURATION: 300000 // 5 minutes
  },
  REDIS_RECONNECT: {
    MAX_ATTEMPTS: 10,
    RETRY_DELAY: 1000
  },
  MESSAGE_QUEUE: {
    MAX_SIZE: 100, // Max queued messages per client
    TTL: 86400 // 24 hours
  }
};

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private instanceId: string = uuidv4();
  private isRedisEnabled: boolean = false;
  private isShuttingDown: boolean = false;

  // Redis clients
  private redisPublisher: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private redisClient: Redis | null = null;

  // Monitoring metrics
  private metrics = {
    connections: {
      total: 0,
      active: 0,
      byDealership: new Map<number, number>()
    },
    messages: {
      sent: 0,
      received: 0,
      queued: 0,
      errors: 0
    },
    redis: {
      connected: false,
      reconnectAttempts: 0,
      lastReconnect: 0
    }
  };

  /**
   * Initialize the WebSocket server
   */
  async initialize(server: Server) {
    try {
      // Register metrics
      this.registerMetrics();

      // Generate trace ID for initialization
      const traceId = generateTraceId();

      // Initialize Redis if feature flag is enabled
      await this.initializeRedis(traceId);

      // Create WebSocket server with a specific path
      this.wss = new WebSocketServer({ server, path: '/ws' });

      logger.info('WebSocket server created', { instanceId: this.instanceId, traceId });

      // Set up connection handler
      this.wss.on('connection', (ws, request) => this.handleNewConnection(ws, request));

      // Set up health check interval
      setInterval(() => this.performHealthCheck(), CONFIG.HEALTH_CHECK_INTERVAL);

      // Register shutdown handlers
      this.registerShutdownHandlers();

      logger.info('WebSocket server initialized successfully', {
        instanceId: this.instanceId,
        redisEnabled: this.isRedisEnabled,
        traceId
      });

      // Register this instance in Redis if enabled
      if (this.isRedisEnabled && this.redisClient) {
        await this.redisClient.hset(
          REDIS_KEYS.INSTANCE_REGISTRY,
          this.instanceId,
          JSON.stringify({
            startTime: Date.now(),
            host: process.env.HOST || 'localhost',
            port: process.env.PORT || '3000'
          })
        );

        // Set expiry to auto-cleanup stale instances
        await this.redisClient.expire(REDIS_KEYS.INSTANCE_REGISTRY, 3600); // 1 hour
      }
    } catch (error) {
      const traceId = generateTraceId();
      logger.error('Failed to initialize WebSocket server', {
        error,
        instanceId: this.instanceId,
        traceId
      });

      // Attempt to initialize without Redis as fallback
      if (this.isRedisEnabled && !this.wss) {
        logger.warn('Falling back to non-Redis WebSocket mode', { traceId });
        this.isRedisEnabled = false;

        // Create WebSocket server
        this.wss = new WebSocketServer({ server, path: '/ws' });

        // Set up connection handler
        this.wss.on('connection', (ws, request) => this.handleNewConnection(ws, request));

        // Set up health check interval
        setInterval(() => this.performHealthCheck(), CONFIG.HEALTH_CHECK_INTERVAL);

        logger.info('WebSocket server initialized in fallback mode', {
          instanceId: this.instanceId,
          traceId
        });
      }
    }
  }

  /**
   * Initialize Redis connections for pub/sub and data storage
   */
  private async initializeRedis(traceId: string): Promise<void> {
    try {
      // Check feature flag
      const isEnabled = await featureFlagsService.isEnabled(
        FeatureFlagNames.REDIS_WEBSOCKET_SCALING,
        { environment: process.env.NODE_ENV || 'development' }
      );

      if (!isEnabled) {
        logger.info('Redis WebSocket scaling is disabled by feature flag', { traceId });
        this.isRedisEnabled = false;
        return;
      }

      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      // Initialize Redis clients
      this.redisPublisher = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          if (times > CONFIG.REDIS_RECONNECT.MAX_ATTEMPTS) {
            logger.error('Redis publisher max reconnect attempts reached', {
              times,
              traceId
            });
            return null; // Stop retrying
          }

          const delay = CONFIG.REDIS_RECONNECT.RETRY_DELAY * Math.min(times, 10);
          logger.warn('Redis publisher reconnecting', { times, delay, traceId });

          this.metrics.redis.reconnectAttempts = times;
          this.metrics.redis.lastReconnect = Date.now();

          return delay;
        }
      });

      this.redisSubscriber = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: false,
        connectTimeout: 10000,
        retryStrategy: (times) => {
          if (times > CONFIG.REDIS_RECONNECT.MAX_ATTEMPTS) {
            logger.error('Redis subscriber max reconnect attempts reached', {
              times,
              traceId
            });
            return null; // Stop retrying
          }

          const delay = CONFIG.REDIS_RECONNECT.RETRY_DELAY * Math.min(times, 10);
          logger.warn('Redis subscriber reconnecting', { times, delay, traceId });

          return delay;
        }
      });

      this.redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        connectTimeout: 10000
      });

      // Set up event handlers
      this.redisPublisher.on('connect', () => {
        logger.info('Redis publisher connected', { traceId });
        this.metrics.redis.connected = true;
      });

      this.redisPublisher.on('error', (error) => {
        logger.error('Redis publisher error', { error, traceId });
        this.metrics.redis.connected = false;
      });

      this.redisSubscriber.on('connect', () => {
        logger.info('Redis subscriber connected', { traceId });
      });

      this.redisSubscriber.on('error', (error) => {
        logger.error('Redis subscriber error', { error, traceId });
      });

      // Subscribe to channels
      await this.redisSubscriber.subscribe(
        REDIS_CHANNELS.BROADCAST,
        REDIS_CHANNELS.DIRECT + ':' + this.instanceId,
        REDIS_CHANNELS.HEALTH_CHECK,
        REDIS_CHANNELS.MIGRATION
      );

      // Set up message handler
      this.redisSubscriber.on('message', (channel, message) => {
        this.handleRedisMessage(channel, message);
      });

      // Ping Redis to verify connection
      await this.redisClient.ping();

      logger.info('Redis initialized successfully for WebSocket scaling', {
        instanceId: this.instanceId,
        traceId
      });

      this.isRedisEnabled = true;
    } catch (error) {
      logger.error('Failed to initialize Redis for WebSocket scaling', {
        error,
        traceId
      });

      // Cleanup any partially initialized Redis clients
      if (this.redisPublisher) {
        this.redisPublisher.disconnect();
        this.redisPublisher = null;
      }

      if (this.redisSubscriber) {
        this.redisSubscriber.disconnect();
        this.redisSubscriber = null;
      }

      if (this.redisClient) {
        this.redisClient.disconnect();
        this.redisClient = null;
      }

      this.isRedisEnabled = false;
    }
  }

  /**
   * Register metrics for monitoring
   */
  private registerMetrics(): void {
    // Connection metrics
    monitoringService.registerGauge(
      'websocket_connections_total',
      'Total number of WebSocket connections',
      ['state']
    );

    monitoringService.registerGauge(
      'websocket_connections_by_dealership',
      'Number of WebSocket connections by dealership',
      ['dealership_id']
    );

    // Message metrics
    monitoringService.registerCounter(
      'websocket_messages_total',
      'Total number of WebSocket messages',
      ['type', 'direction']
    );

    monitoringService.registerCounter(
      'websocket_errors_total',
      'Total number of WebSocket errors',
      ['type']
    );

    // Performance metrics
    monitoringService.registerHistogram(
      'websocket_message_delivery_seconds',
      'WebSocket message delivery time in seconds',
      ['type'],
      [0.001, 0.01, 0.1, 0.5, 1, 3, 5, 10]
    );

    // Redis metrics
    monitoringService.registerGauge(
      'websocket_redis_connected',
      'Whether Redis is connected for WebSocket scaling',
      []
    );

    monitoringService.registerGauge(
      'websocket_redis_reconnect_attempts',
      'Number of Redis reconnection attempts',
      []
    );

    monitoringService.registerGauge(
      'websocket_queued_messages',
      'Number of queued messages for offline clients',
      []
    );

    // Rate limiting metrics
    monitoringService.registerCounter(
      'websocket_rate_limited_total',
      'Total number of rate-limited WebSocket messages',
      ['dealership_id']
    );
  }

  /**
   * Update metrics for monitoring
   */
  private updateMetrics(): void {
    try {
      // Update connection metrics
      monitoringService.setGauge('websocket_connections_total', this.metrics.connections.total, ['total']);
      monitoringService.setGauge('websocket_connections_total', this.metrics.connections.active, ['active']);

      // Update dealership metrics
      this.metrics.connections.byDealership.forEach((count, dealershipId) => {
        monitoringService.setGauge('websocket_connections_by_dealership', count, [dealershipId.toString()]);
      });

      // Update Redis metrics
      monitoringService.setGauge('websocket_redis_connected', this.metrics.redis.connected ? 1 : 0, []);
      monitoringService.setGauge('websocket_redis_reconnect_attempts', this.metrics.redis.reconnectAttempts, []);
      monitoringService.setGauge('websocket_queued_messages', this.metrics.messages.queued, []);
    } catch (error) {
      logger.error('Error updating WebSocket metrics', { error });
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(ws: WebSocket, request: any): void {
    try {
      // Generate a unique client ID and trace ID
      const clientId = this.generateClientId();
      const traceId = generateTraceId();

      // Store client connection
      const client: ClientConnection = {
        ws,
        lastActivity: Date.now(),
        createdAt: Date.now(),
        messageCount: 0,
        instanceId: this.instanceId,
        traceId,
        isAlive: true,
        rateLimit: {
          count: 0,
          resetTime: Date.now() + CONFIG.RATE_LIMIT.WINDOW_MS,
          blocked: false
        }
      };

      this.clients.set(clientId, client);

      // Update metrics
      this.metrics.connections.total++;
      this.metrics.connections.active++;
      this.updateMetrics();

      logger.info('New WebSocket connection established', {
        clientId,
        traceId,
        ip: request.socket.remoteAddress
      });

      // Register connection in Redis if enabled
      if (this.isRedisEnabled && this.redisClient) {
        this.redisClient.hset(
          REDIS_KEYS.CONNECTION_PREFIX + clientId,
          'instanceId', this.instanceId,
          'createdAt', client.createdAt.toString(),
          'traceId', traceId
        ).catch(error => {
          logger.error('Failed to register connection in Redis', {
            error,
            clientId,
            traceId
          });
        });

        // Set expiry to auto-cleanup stale connections
        this.redisClient.expire(
          REDIS_KEYS.CONNECTION_PREFIX + clientId,
          3600 // 1 hour
        ).catch(error => {
          logger.warn('Failed to set expiry for connection in Redis', {
            error,
            clientId,
            traceId
          });
        });
      }

      // Send initial welcome message
      this.sendToClient(ws, {
        type: MessageType.CONNECT,
        message: 'Connected to chat server',
        timestamp: new Date().toISOString(),
        metadata: {
          clientId,
          instanceId: this.instanceId,
          redisEnabled: this.isRedisEnabled
        },
        traceId
      });

      // Set up ping for connection health monitoring
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastActivity = Date.now();
        }
      });

      // Handle messages from clients
      ws.on('message', async (rawData) => {
        try {
          // Check rate limit
          if (this.isRateLimited(clientId)) {
            this.sendToClient(ws, {
              type: MessageType.ERROR,
              message: 'Rate limit exceeded',
              timestamp: new Date().toISOString(),
              metadata: {
                reason: 'RATE_LIMIT_EXCEEDED',
                resetTime: this.clients.get(clientId)?.rateLimit.resetTime
              },
              traceId
            });
            return;
          }

          const data: WebSocketMessage = JSON.parse(rawData.toString());

          // Add trace ID if not present
          if (!data.traceId) {
            data.traceId = traceId;
          }

          // Update client information if provided
          if (data.userId && data.dealershipId) {
            const client = this.clients.get(clientId);
            if (client) {
              client.userId = data.userId;
              client.dealershipId = data.dealershipId;

              // Update dealership metrics
              if (!this.metrics.connections.byDealership.has(data.dealershipId)) {
                this.metrics.connections.byDealership.set(data.dealershipId, 0);
              }
              this.metrics.connections.byDealership.set(
                data.dealershipId,
                (this.metrics.connections.byDealership.get(data.dealershipId) || 0) + 1
              );

              // Update Redis if enabled
              if (this.isRedisEnabled && this.redisClient) {
                this.redisClient.hset(
                  REDIS_KEYS.CONNECTION_PREFIX + clientId,
                  'userId', data.userId.toString(),
                  'dealershipId', data.dealershipId.toString()
                ).catch(error => {
                  logger.warn('Failed to update connection in Redis', {
                    error,
                    clientId,
                    traceId
                  });
                });
              }
            }
          }

          // Update activity timestamp and message count
          const client = this.clients.get(clientId);
          if (client) {
            client.lastActivity = Date.now();
            client.messageCount++;

            // Update rate limit counter
            client.rateLimit.count++;

            // Reset rate limit if window has passed
            if (Date.now() > client.rateLimit.resetTime) {
              client.rateLimit.count = 1;
              client.rateLimit.resetTime = Date.now() + CONFIG.RATE_LIMIT.WINDOW_MS;
              client.rateLimit.blocked = false;
            }
          }

          // Update metrics
          this.metrics.messages.received++;
          monitoringService.incrementCounter(
            'websocket_messages_total',
            1,
            [data.type || 'unknown', 'received']
          );

          // Process message based on type
          await this.handleMessage(clientId, data);
        } catch (error) {
          logger.error('Error processing WebSocket message', {
            error,
            clientId,
            traceId
          });

          // Update error metrics
          this.metrics.messages.errors++;
          monitoringService.incrementCounter('websocket_errors_total', 1, ['processing']);

          this.sendToClient(ws, {
            type: MessageType.ERROR,
            message: 'Error processing message',
            timestamp: new Date().toISOString(),
            traceId
          });
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(clientId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', {
          error,
          clientId,
          traceId
        });

        // Update error metrics
        monitoringService.incrementCounter('websocket_errors_total', 1, ['connection']);

        this.handleDisconnection(clientId);
      });
    } catch (error) {
      const traceId = generateTraceId();
      logger.error('Error handling new WebSocket connection', {
        error,
        traceId
      });

      // Update error metrics
      monitoringService.incrementCounter('websocket_errors_total', 1, ['connection']);

      // Close connection with error
      try {
        ws.close(1011, 'Internal server error');
      } catch (closeError) {
        logger.error('Error closing WebSocket connection', {
          error: closeError,
          traceId
        });
      }
    }
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(clientId: string): void {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { dealershipId, traceId } = client;

      logger.info('WebSocket connection closed', {
        clientId,
        dealershipId,
        traceId
      });

      // Update metrics
      this.metrics.connections.active--;
      if (dealershipId && this.metrics.connections.byDealership.has(dealershipId)) {
        const currentCount = this.metrics.connections.byDealership.get(dealershipId) || 0;
        if (currentCount > 0) {
          this.metrics.connections.byDealership.set(dealershipId, currentCount - 1);
        }
      }
      this.updateMetrics();

      // Remove from clients map
      this.clients.delete(clientId);

      // Remove from Redis if enabled
      if (this.isRedisEnabled && this.redisClient) {
        this.redisClient.del(REDIS_KEYS.CONNECTION_PREFIX + clientId)
          .catch(error => {
            logger.warn('Failed to remove connection from Redis', {
              error,
              clientId,
              traceId
            });
          });
      }
    } catch (error) {
      logger.error('Error handling WebSocket disconnection', {
        error,
        clientId
      });
    }
  }

  /**
   * Check if client is rate limited
   */
  private isRateLimited(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // If already blocked
    if (client.rateLimit.blocked) {
      return true;
    }

    // Check if over limit
    if (client.rateLimit.count > CONFIG.RATE_LIMIT.MAX_MESSAGES) {
      client.rateLimit.blocked = true;

      // Schedule unblock
      setTimeout(() => {
        const client = this.clients.get(clientId);
        if (client) {
          client.rateLimit.blocked = false;
          client.rateLimit.count = 0;
          client.rateLimit.resetTime = Date.now() + CONFIG.RATE_LIMIT.WINDOW_MS;
        }
      }, CONFIG.RATE_LIMIT.BLOCK_DURATION);

      // Log rate limiting
      logger.warn('WebSocket client rate limited', {
        clientId,
        messageCount: client.rateLimit.count,
        userId: client.userId,
        dealershipId: client.dealershipId,
        traceId: client.traceId
      });

      // Update metrics
      if (client.dealershipId) {
        monitoringService.incrementCounter(
          'websocket_rate_limited_total',
          1,
          [client.dealershipId.toString()]
        );
      }

      return true;
    }

    return false;
  }

  /**
   * Handle Redis pub/sub messages
   */
  private handleRedisMessage(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);
      const { type, clientId, messageData, sourceInstanceId } = data;

      // Skip messages from this instance
      if (sourceInstanceId === this.instanceId) {
        return;
      }

      // Handle different channel types
      switch (channel) {
        case REDIS_CHANNELS.BROADCAST:
          // Broadcast to all clients
          this.handleBroadcastMessage(messageData);
          break;

        case REDIS_CHANNELS.DIRECT + ':' + this.instanceId:
          // Direct message to a specific client on this instance
          if (clientId && this.clients.has(clientId)) {
            const client = this.clients.get(clientId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
              this.sendToClient(client.ws, messageData);
            }
          }
          break;

        case REDIS_CHANNELS.HEALTH_CHECK:
          // Health check request - respond with instance status
          if (this.redisPublisher) {
            this.redisPublisher.publish(
              REDIS_CHANNELS.HEALTH_CHECK,
              JSON.stringify({
                type: 'health_response',
                instanceId: this.instanceId,
                timestamp: Date.now(),
                connections: this.clients.size,
                uptime: process.uptime()
              })
            );
          }
          break;

        case REDIS_CHANNELS.MIGRATION:
          // Handle migration request
          if (type === 'prepare' && this.redisPublisher) {
            // Prepare for migration
            this.prepareForMigration();
          } else if (type === 'complete' && data.targetInstanceId === this.instanceId) {
            // Complete migration - restore clients
            this.completeMigration(data.migrationData);
          }
          break;
      }
    } catch (error) {
      logger.error('Error handling Redis message', {
        error,
        channel
      });
    }
  }

  /**
   * Handle broadcast message from Redis
   */
  private handleBroadcastMessage(messageData: WebSocketMessage): void {
    try {
      // Filter clients by dealership ID if provided
      if (messageData.dealershipId) {
        this.clients.forEach((client, clientId) => {
          if (
            client.dealershipId === messageData.dealershipId &&
            client.ws.readyState === WebSocket.OPEN
          ) {
            this.sendToClient(client.ws, messageData);
          }
        });
      } else {
        // Broadcast to all clients
        this.clients.forEach((client, clientId) => {
          if (client.ws.readyState === WebSocket.OPEN) {
            this.sendToClient(client.ws, messageData);
          }
        });
      }
    } catch (error) {
      logger.error('Error handling broadcast message', {
        error,
        messageType: messageData.type
      });
    }
  }

  /**
   * Prepare for migration (server shutdown)
   */
  private prepareForMigration(): void {
    try {
      if (!this.redisClient || !this.redisPublisher) return;

      logger.info('Preparing for WebSocket migration', {
        instanceId: this.instanceId,
        connectionCount: this.clients.size
      });

      // Collect client data for migration
      const migrationData: Record<string, any> = {};

      this.clients.forEach((client, clientId) => {
        migrationData[clientId] = {
          userId: client.userId,
          dealershipId: client.dealershipId,
          userType: client.userType,
          createdAt: client.createdAt,
          messageCount: client.messageCount,
          traceId: client.traceId
        };

        // Notify client about migration
        this.sendToClient(client.ws, {
          type: MessageType.MIGRATION,
          message: 'Server migration in progress',
          timestamp: new Date().toISOString(),
          metadata: {
            reconnect: true,
            delay: 1000
          },
          traceId: client.traceId
        });
      });

      // Publish migration data
      this.redisPublisher.publish(
        REDIS_CHANNELS.MIGRATION,
        JSON.stringify({
          type: 'data',
          sourceInstanceId: this.instanceId,
          timestamp: Date.now(),
          migrationData
        })
      );

      logger.info('WebSocket migration data published', {
        instanceId: this.instanceId,
        clientCount: Object.keys(migrationData).length
      });
    } catch (error) {
      logger.error('Error preparing for migration', { error });
    }
  }

  /**
   * Complete migration (restore clients)
   */
  private completeMigration(migrationData: Record<string, any>): void {
    try {
      logger.info('Completing WebSocket migration', {
        instanceId: this.instanceId,
        clientCount: Object.keys(migrationData).length
      });

      // Migration is handled by clients reconnecting
      // This method is for future enhancements
    } catch (error) {
      logger.error('Error completing migration', { error });
    }
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    try {
      const now = Date.now();
      const staleClients: string[] = [];

      // Check all clients
      this.clients.forEach((client, clientId) => {
        // Mark as requiring a pong response
        client.isAlive = false;

        // Send ping
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        } catch (error) {
          logger.warn('Error sending ping to client', {
            error,
            clientId,
            traceId: client.traceId
          });
        }

        // Check for stale connections
        if (now - client.lastActivity > CONFIG.CONNECTION_TIMEOUT) {
          staleClients.push(clientId);
        }
      });

      // Clean up stale clients
      staleClients.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          logger.info('Closing stale WebSocket connection', {
            clientId,
            inactiveMs: Date.now() - client.lastActivity,
            traceId: client.traceId
          });

          try {
            client.ws.close(1000, 'Connection timeout');
          } catch (error) {
            logger.warn('Error closing stale connection', {
              error,
              clientId,
              traceId: client.traceId
            });
          }

          this.handleDisconnection(clientId);
        }
      });

      // Terminate connections that didn't respond to ping
      setTimeout(() => {
        this.clients.forEach((client, clientId) => {
          if (!client.isAlive) {
            logger.info('Terminating unresponsive WebSocket connection', {
              clientId,
              traceId: client.traceId
            });

            try {
              client.ws.terminate();
            } catch (error) {
              logger.warn('Error terminating unresponsive connection', {
                error,
                clientId,
                traceId: client.traceId
              });
            }

            this.handleDisconnection(clientId);
          }
        });
      }, 5000); // Wait 5 seconds for pong responses

      // Update metrics
      this.updateMetrics();

      // Publish health status to Redis if enabled
      if (this.isRedisEnabled && this.redisPublisher) {
        this.redisPublisher.publish(
          REDIS_CHANNELS.HEALTH_CHECK,
          JSON.stringify({
            type: 'health_status',
            instanceId: this.instanceId,
            timestamp: now,
            connections: {
              total: this.clients.size,
              stale: staleClients.length
            },
            uptime: process.uptime()
          })
        );

        // Update instance registry TTL
        if (this.redisClient) {
          this.redisClient.expire(REDIS_KEYS.INSTANCE_REGISTRY, 3600); // 1 hour
        }
      }
    } catch (error) {
      logger.error('Error performing WebSocket health check', { error });
    }
  }

  /**
   * Register shutdown handlers
   */
  private registerShutdownHandlers(): void {
    // Handle process termination
    const handleShutdown = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info('WebSocket service shutting down', {
        instanceId: this.instanceId,
        connectionCount: this.clients.size
      });

      // Prepare for migration if Redis is enabled
      if (this.isRedisEnabled) {
        this.prepareForMigration();
      }

      // Close all connections
      this.clients.forEach((client, clientId) => {
        try {
          client.ws.close(1001, 'Server shutting down');
        } catch (error) {
          logger.warn('Error closing connection during shutdown', {
            error,
            clientId,
            traceId: client.traceId
          });
        }
      });

      // Close WebSocket server
      if (this.wss) {
        this.wss.close((error) => {
          if (error) {
            logger.error('Error closing WebSocket server', { error });
          } else {
            logger.info('WebSocket server closed successfully');
          }
        });
      }

      // Close Redis connections
      if (this.redisPublisher) {
        try {
          await this.redisPublisher.quit();
        } catch (error) {
          logger.warn('Error closing Redis publisher', { error });
        }
      }

      if (this.redisSubscriber) {
        try {
          await this.redisSubscriber.quit();
        } catch (error) {
          logger.warn('Error closing Redis subscriber', { error });
        }
      }

      if (this.redisClient) {
        try {
          // Remove instance from registry
          await this.redisClient.hdel(REDIS_KEYS.INSTANCE_REGISTRY, this.instanceId);
          await this.redisClient.quit();
        } catch (error) {
          logger.warn('Error closing Redis client', { error });
        }
      }

      logger.info('WebSocket service shutdown complete', {
        instanceId: this.instanceId
      });
    };

    // Register handlers
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(clientId: string, data: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const startTime = process.hrtime();

    try {
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

        case MessageType.HEALTH_CHECK:
          // Respond to health check
          this.sendToClient(client.ws, {
            type: MessageType.HEALTH_CHECK,
            message: 'Health check response',
            timestamp: new Date().toISOString(),
            metadata: {
              status: 'healthy',
              connectionTime: Date.now() - client.createdAt
            },
            traceId: data.traceId
          });
          break;

        default:
          logger.warn('Unknown message type', {
            type: data.type,
            clientId,
            traceId: data.traceId
          });
      }

      // Record message processing time
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      monitoringService.observeHistogram(
        'websocket_message_delivery_seconds',
        duration,
        [data.type]
      );
    } catch (error) {
      logger.error('Error handling WebSocket message', {
        error,
        messageType: data.type,
        clientId,
        traceId: data.traceId
      });

      // Update error metrics
      this.metrics.messages.errors++;
      monitoringService.incrementCounter('websocket_errors_total', 1, ['handling']);
    }
  }

  /**
   * Handle chat messages, routing based on dealership mode
   */
  private async handleChatMessage(clientId: string, data: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client || !data.dealershipId) return;

    try {
      // Get dealership mode to determine message handling
      const mode = await dealershipConfigService.getDealershipMode(data.dealershipId);

      // Handle differently based on mode
      if (mode === 'rylie_ai') {
        await this.handleRylieAiMessage(clientId, data);
      } else if (mode === 'direct_agent') {
        await this.handleDirectAgentMessage(clientId, data);
      }
    } catch (error) {
      logger.error('Error determining dealership mode', {
        error,
        dealershipId: data.dealershipId,
        clientId,
        traceId: data.traceId
      });

      // Send error to client
      this.sendToClient(client.ws, {
        type: MessageType.ERROR,
        message: 'Error processing message',
        timestamp: new Date().toISOString(),
        traceId: data.traceId
      });
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
        metadata: { status: 'received', messageId: this.generateMessageId() },
        traceId: data.traceId
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
          metadata: { isAiResponse: true },
          traceId: data.traceId
        });
      }, 1500);
    } catch (error) {
      logger.error('Error handling Rylie AI message', {
        error,
        clientId,
        traceId: data.traceId
      });
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
        metadata: { status: 'received', messageId: this.generateMessageId() },
        traceId: data.traceId
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
            metadata: { isSystemMessage: true },
            traceId: data.traceId
          });
        }, 1000);
        return;
      }

      // Broadcast message to all agents for the dealership
      this.broadcastToDealershipAgents(data.dealershipId, data);
    } catch (error) {
      logger.error('Error handling Direct Agent message', {
        error,
        clientId,
        traceId: data.traceId
      });
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
      timestamp: new Date().toISOString(),
      traceId: data.traceId
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
      timestamp: new Date().toISOString(),
      traceId: data.traceId
    });
  }

  /**
   * Broadcast a message to all agents for a specific dealership
   */
  broadcastToDealershipAgents(dealershipId: number, message: WebSocketMessage) {
    try {
      // Local broadcast to clients on this instance
      this.clients.forEach((client, clientId) => {
        if (
          client.dealershipId === dealershipId &&
          client.userType === 'agent' &&
          client.ws.readyState === WebSocket.OPEN
        ) {
          this.sendToClient(client.ws, message);
        }
      });

      // Broadcast via Redis if enabled
      if (this.isRedisEnabled && this.redisPublisher) {
        this.redisPublisher.publish(
          REDIS_CHANNELS.BROADCAST,
          JSON.stringify({
            type: 'broadcast',
            sourceInstanceId: this.instanceId,
            messageData: {
              ...message,
              metadata: {
                ...(message.metadata || {}),
                sourceInstanceId: this.instanceId
              }
            }
          })
        );
      }
    } catch (error) {
      logger.error('Error broadcasting to dealership agents', {
        error,
        dealershipId,
        messageType: message.type,
        traceId: message.traceId
      });
    }
  }

  /**
   * Broadcast dealership mode change to all connected clients for that dealership
   */
  broadcastModeChange(dealershipId: number, mode: DealershipMode) {
    try {
      const traceId = generateTraceId();
      const message: WebSocketMessage = {
        type: MessageType.MODE_CHANGE,
        dealershipId,
        message: `Dealership mode changed to ${mode}`,
        timestamp: new Date().toISOString(),
        metadata: { mode },
        traceId
      };

      // Local broadcast to clients on this instance
      this.clients.forEach((client, clientId) => {
        if (
          client.dealershipId === dealershipId &&
          client.ws.readyState === WebSocket.OPEN
        ) {
          this.sendToClient(client.ws, message);
        }
      });

      // Broadcast via Redis if enabled
      if (this.isRedisEnabled && this.redisPublisher) {
        this.redisPublisher.publish(
          REDIS_CHANNELS.BROADCAST,
          JSON.stringify({
            type: 'broadcast',
            sourceInstanceId: this.instanceId,
            messageData: {
              ...message,
              metadata: {
                ...(message.metadata || {}),
                sourceInstanceId: this.instanceId
              }
            }
          })
        );
      }
    } catch (error) {
      logger.error('Error broadcasting mode change', {
        error,
        dealershipId,
        mode
      });
    }
  }

  /**
   * Send a message to a specific client
   */
  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        // Ensure message has a trace ID
        if (!message.traceId) {
          message.traceId = generateTraceId();
        }

        ws.send(JSON.stringify(message));

        // Update metrics
        this.metrics.messages.sent++;
        monitoringService.incrementCounter(
          'websocket_messages_total',
          1,
          [message.type, 'sent']
        );
      }
    } catch (error) {
      logger.error('Error sending message to client', {
        error,
        messageType: message.type,
        traceId: message.traceId
      });

      // Update error metrics
      this.metrics.messages.errors++;
      monitoringService.incrementCounter('websocket_errors_total', 1, ['send']);
    }
  }

  /**
   * Queue a message for a client that is currently offline
   */
  private async queueMessageForOfflineClient(
    clientId: string,
    dealershipId: number,
    userId: number,
    message: WebSocketMessage
  ): Promise<boolean> {
    if (!this.isRedisEnabled || !this.redisClient) {
      return false;
    }

    try {
      const queueKey = `${REDIS_KEYS.MESSAGE_QUEUE_PREFIX}${dealershipId}:${userId}`;

      // Add message to queue
      await this.redisClient.lpush(queueKey, JSON.stringify(message));

      // Trim queue to max size
      await this.redisClient.ltrim(queueKey, 0, CONFIG.MESSAGE_QUEUE.MAX_SIZE - 1);

      // Set TTL
      await this.redisClient.expire(queueKey, CONFIG.MESSAGE_QUEUE.TTL);

      // Update metrics
      this.metrics.messages.queued++;

      logger.debug('Message queued for offline client', {
        dealershipId,
        userId,
        messageType: message.type,
        traceId: message.traceId
      });

      return true;
    } catch (error) {
      logger.error('Error queuing message for offline client', {
        error,
        dealershipId,
        userId,
        messageType: message.type,
        traceId: message.traceId
      });

      return false;
    }
  }

  /**
   * Deliver queued messages to a client that has come online
   */
  private async deliverQueuedMessages(
    clientId: string,
    dealershipId: number,
    userId: number
  ): Promise<number> {
    if (!this.isRedisEnabled || !this.redisClient) {
      return 0;
    }

    try {
      const client = this.clients.get(clientId);
      if (!client || client.ws.readyState !== WebSocket.OPEN) {
        return 0;
      }

      const queueKey = `${REDIS_KEYS.MESSAGE_QUEUE_PREFIX}${dealershipId}:${userId}`;

      // Get all queued messages
      const messages = await this.redisClient.lrange(queueKey, 0, -1);

      if (messages.length === 0) {
        return 0;
      }

      // Deliver messages
      let deliveredCount = 0;

      for (const messageJson of messages) {
        try {
          const message = JSON.parse(messageJson) as WebSocketMessage;

          // Add metadata about queued delivery
          message.metadata = {
            ...(message.metadata || {}),
            queuedDelivery: true,
            queuedAt: message.timestamp,
            deliveredAt: new Date().toISOString()
          };

          // Send to client
          this.sendToClient(client.ws, message);
          deliveredCount++;
        } catch (error) {
          logger.error('Error delivering queued message', {
            error,
            clientId,
            traceId: client.traceId
          });
        }
      }

      // Clear queue
      await this.redisClient.del(queueKey);

      // Update metrics
      this.metrics.messages.queued -= deliveredCount;

      logger.info('Delivered queued messages to client', {
        clientId,
        deliveredCount,
        traceId: client.traceId
      });

      return deliveredCount;
    } catch (error) {
      logger.error('Error delivering queued messages', {
        error,
        clientId,
        dealershipId,
        userId
      });

      return 0;
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
   * Get the current connection count
   */
  getConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get connection metrics
   */
  getMetrics(): any {
    return {
      connections: {
        total: this.metrics.connections.total,
        active: this.metrics.connections.active,
        byDealership: Object.fromEntries(this.metrics.connections.byDealership)
      },
      messages: { ...this.metrics.messages },
      redis: { ...this.metrics.redis },
      instanceId: this.instanceId,
      redisEnabled: this.isRedisEnabled
    };
  }
}

// Export a singleton instance
export default new WebSocketService();
