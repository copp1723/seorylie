/**
 * Enhanced Server Entry Point
 * 
 * Demonstrates the new service layer architecture with standardized error handling,
 * configuration management, health checks, and service registry.
 */

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import helmet from 'helmet';

// Configuration and core services
import { configManager } from './config/config-manager';
import { serviceRegistry } from './services/service-registry';
import { healthCheckService } from './services/health-check-service';
import { authService } from './services/auth-service';
import { enhancedWebSocketService } from './services/enhanced-websocket-service';

// Middleware
import { createRequestLoggingMiddleware, correlationIdMiddleware, performanceMiddleware } from './middleware/request-logging';
import { errorHandler } from './utils/error-handler';
import { validateProductionSafety } from './utils/production-safety-checks';

// Routes
import healthRoutes from './routes/health-routes';
import { setupRoutes } from './routes';

// Observability
import { setupMetrics } from './observability/metrics';
import { setupTracing } from './observability/tracing';

// Logger
import logger from './utils/logger';

class EnhancedServer {
  private app: express.Application;
  private server: any;
  private isShuttingDown: boolean = false;

  constructor() {
    this.app = express();
  }

  /**
   * Initialize and start the server
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Enhanced CleanRylie Server...');

      // Step 1: Load and validate configuration
      await this.loadConfiguration();

      // Step 2: Run production safety checks
      await this.runSafetyChecks();

      // Step 3: Setup observability
      this.setupObservability();

      // Step 4: Register services
      await this.registerServices();

      // Step 5: Initialize services
      await this.initializeServices();

      // Step 6: Setup middleware
      this.setupMiddleware();

      // Step 7: Setup routes
      this.setupRoutes();

      // Step 8: Setup error handling
      this.setupErrorHandling();

      // Step 9: Create HTTP server
      this.createServer();

      // Step 10: Setup WebSocket
      this.setupWebSocket();

      // Step 11: Start listening
      await this.startListening();

      // Step 12: Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Enhanced CleanRylie Server started successfully');

    } catch (error) {
      logger.error('Failed to start Enhanced CleanRylie Server', error);
      process.exit(1);
    }
  }

  /**
   * Load and validate configuration
   */
  private async loadConfiguration(): Promise<void> {
    logger.info('Loading configuration...');
    
    await configManager.load();
    
    // Enable hot-reload in development
    if (configManager.get().server.environment === 'development') {
      configManager.enableHotReload();
    }

    logger.info('Configuration loaded successfully');
  }

  /**
   * Run production safety checks
   */
  private async runSafetyChecks(): Promise<void> {
    logger.info('Running production safety checks...');
    await validateProductionSafety();
    logger.info('Production safety checks passed');
  }

  /**
   * Setup observability (metrics and tracing)
   */
  private setupObservability(): void {
    logger.info('Setting up observability...');
    
    setupMetrics(this.app);
    setupTracing();
    
    logger.info('Observability configured');
  }

  /**
   * Register all services with the service registry
   */
  private async registerServices(): Promise<void> {
    logger.info('Registering services...');

    // Register core services
    serviceRegistry.register(healthCheckService, []);
    serviceRegistry.register(authService, ['database']);
    serviceRegistry.register(enhancedWebSocketService, ['AuthService']);

    // Listen for service events
    serviceRegistry.on('serviceStarted', (serviceName) => {
      logger.info(`Service started: ${serviceName}`);
    });

    serviceRegistry.on('serviceStopped', (serviceName) => {
      logger.info(`Service stopped: ${serviceName}`);
    });

    serviceRegistry.on('serviceError', (serviceName, error) => {
      logger.error(`Service error: ${serviceName}`, error);
    });

    logger.info('Services registered successfully');
  }

  /**
   * Initialize all registered services
   */
  private async initializeServices(): Promise<void> {
    logger.info('Initializing services...');
    await serviceRegistry.initializeAll();
    logger.info('Services initialized successfully');
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    logger.info('Setting up middleware...');

    const config = configManager.get();

    // Security middleware
    if (config.security.enableHelmet) {
      this.app.use(helmet());
    }

    // CORS
    this.app.use(cors({
      origin: config.server.corsOrigins,
      credentials: true
    }));

    // Request parsing
    this.app.use(express.json({ limit: config.server.bodyLimit }));
    this.app.use(express.urlencoded({ extended: true, limit: config.server.bodyLimit }));

    // Correlation IDs
    this.app.use(correlationIdMiddleware);

    // Performance monitoring
    this.app.use(performanceMiddleware);

    // Request/Response logging
    this.app.use(createRequestLoggingMiddleware({
      includeRequestBody: config.server.environment === 'development',
      includeResponseBody: config.server.environment === 'development',
      includeHeaders: config.server.environment === 'development',
      logLevel: config.server.environment === 'production' ? 'info' : 'debug'
    }));

    // Session configuration
    this.app.use(session({
      secret: config.auth.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.server.environment === 'production',
        maxAge: config.auth.sessionMaxAge
      }
    }));

    // Static files
    this.app.use(express.static(path.join(__dirname, '../dist/public')));

    logger.info('Middleware configured successfully');
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    logger.info('Setting up routes...');

    // Health check routes (no auth required)
    this.app.use('/api/health', healthRoutes);

    // API routes
    setupRoutes(this.app);

    // Catch-all route for SPA
    this.app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../dist/public/index.html'));
    });

    logger.info('Routes configured successfully');
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    logger.info('Setting up error handling...');

    // Global error handler (must be last)
    this.app.use(errorHandler);

    logger.info('Error handling configured successfully');
  }

  /**
   * Create HTTP server
   */
  private createServer(): void {
    logger.info('Creating HTTP server...');
    
    this.server = createServer(this.app);
    
    // Set server timeout
    const config = configManager.get();
    this.server.timeout = config.server.requestTimeout;

    logger.info('HTTP server created successfully');
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    logger.info('Setting up WebSocket server...');
    
    enhancedWebSocketService.initializeServer(this.server);
    
    logger.info('WebSocket server configured successfully');
  }

  /**
   * Start listening for connections
   */
  private async startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      const config = configManager.get();
      const port = config.server.port;
      const host = config.server.host;

      this.server.listen(port, host, (error: any) => {
        if (error) {
          reject(error);
          return;
        }

        logger.info(`Enhanced CleanRylie Server listening on ${host}:${port}`, {
          environment: config.server.environment,
          version: process.env.npm_package_version || '1.0.0',
          nodeVersion: process.version,
          pid: process.pid
        });

        resolve();
      });
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown already in progress, forcing exit...');
        process.exit(1);
      }

      this.isShuttingDown = true;
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new connections
        this.server.close(() => {
          logger.info('HTTP server closed');
        });

        // Shutdown services
        await serviceRegistry.shutdownAll();

        // Disable configuration hot-reload
        configManager.disableHotReload();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });

    logger.info('Graceful shutdown handlers configured');
  }

  /**
   * Get Express app instance
   */
  getApp(): express.Application {
    return this.app;
  }

  /**
   * Get HTTP server instance
   */
  getServer(): any {
    return this.server;
  }
}

// Create and start server if this file is run directly
if (require.main === module) {
  const server = new EnhancedServer();
  server.start().catch((error) => {
    logger.error('Failed to start server', error);
    process.exit(1);
  });
}

export { EnhancedServer };
export default EnhancedServer;
