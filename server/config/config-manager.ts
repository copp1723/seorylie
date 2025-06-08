/**
 * Configuration Manager
 *
 * Centralized configuration management with validation, defaults, and hot-reloading.
 * Provides type-safe access to environment variables and application settings.
 */

import { z } from "zod";
import { EventEmitter } from "events";
import fs from "fs";
import path from "path";
import logger from "../utils/logger";
import { CustomError } from "../utils/error-handler";

// Configuration schema definition
const ConfigSchema = z.object({
  // Server Configuration
  server: z.object({
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default("localhost"),
    environment: z
      .enum(["development", "staging", "production"])
      .default("development"),
    sessionSecret: z.string().min(32),
    corsOrigins: z.array(z.string()).default(["*"]),
    trustProxy: z.boolean().default(false),
    requestTimeout: z.number().default(30000),
    bodyLimit: z.string().default("10mb"),
  }),

  // Database Configuration
  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().default(20),
    connectionTimeout: z.number().default(10000),
    idleTimeout: z.number().default(30000),
    ssl: z.boolean().default(false),
    logging: z.boolean().default(false),
  }),

  // Redis Configuration
  redis: z.object({
    enabled: z.boolean().default(true),
    host: z.string().default("localhost"),
    port: z.number().min(1).max(65535).default(6379),
    password: z.string().optional(),
    database: z.number().default(0),
    tls: z.boolean().default(false),
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(1000),
  }),

  // Authentication Configuration
  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiresIn: z.string().default("24h"),
    sessionSecret: z
      .string()
      .min(32)
      .default("fallback-session-secret-change-in-production"),
    magicLinkExpiresIn: z.number().default(900), // 15 minutes
    bcryptRounds: z.number().min(10).max(15).default(12),
    sessionMaxAge: z.number().default(86400000), // 24 hours
    rateLimitWindow: z.number().default(900000), // 15 minutes
    rateLimitMax: z.number().default(5),
  }),

  // OpenAI Configuration
  openai: z.object({
    apiKey: z.string().min(1),
    model: z.string().default("gpt-4"),
    maxTokens: z.number().default(2000),
    temperature: z.number().min(0).max(2).default(0.7),
    timeout: z.number().default(30000),
    rateLimitRpm: z.number().default(60),
    rateLimitTpm: z.number().default(60000),
  }),

  // Email Configuration
  email: z.object({
    provider: z.enum(["sendgrid", "smtp"]).default("sendgrid"),
    sendgridApiKey: z.string().optional(),
    smtpHost: z.string().optional(),
    smtpPort: z.number().optional(),
    smtpUser: z.string().optional(),
    smtpPassword: z.string().optional(),
    fromEmail: z.string().email(),
    fromName: z.string().default("CleanRylie"),
  }),

  // SMS Configuration
  sms: z.object({
    provider: z.enum(["twilio"]).default("twilio"),
    twilioAccountSid: z.string().optional(),
    twilioAuthToken: z.string().optional(),
    twilioPhoneNumber: z.string().optional(),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPort: z.number().default(9090),
    healthCheckInterval: z.number().default(30000),
    prometheusEnabled: z.boolean().default(false),
    grafanaEnabled: z.boolean().default(false),
    tracingEnabled: z.boolean().default(false),
    tempoUrl: z.string().optional(),
    jaegerUrl: z.string().optional(),
  }),

  // Feature Flags
  features: z.object({
    agentSquadEnabled: z.boolean().default(false),
    adfProcessingEnabled: z.boolean().default(true),
    conversationLoggingEnabled: z.boolean().default(true),
    performanceTrackingEnabled: z.boolean().default(false),
    debugMode: z.boolean().default(false),
  }),

  // Security Configuration
  security: z.object({
    enableCsrf: z.boolean().default(true),
    enableHelmet: z.boolean().default(true),
    enableRateLimit: z.boolean().default(true),
    allowedFileTypes: z
      .array(z.string())
      .default([".jpg", ".jpeg", ".png", ".pdf"]),
    maxFileSize: z.number().default(10485760), // 10MB
    encryptionKey: z.string().min(32).optional(),
  }),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export class ConfigManager extends EventEmitter {
  private config: AppConfig | null = null;
  private configPath: string;
  private watchMode: boolean = false;
  private fileWatcher?: fs.FSWatcher;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || path.join(process.cwd(), ".env");
  }

  /**
   * Load and validate configuration
   */
  async load(): Promise<AppConfig> {
    try {
      logger.info("Loading application configuration...");

      // Load environment variables
      const rawConfig = this.loadEnvironmentVariables();

      // Validate configuration
      const validationResult = ConfigSchema.safeParse(rawConfig);

      if (!validationResult.success) {
        const errors = validationResult.error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ");

        throw new CustomError(
          `Configuration validation failed: ${errors}`,
          500,
          {
            code: "CONFIG_VALIDATION_FAILED",
            context: { errors: validationResult.error.errors },
          },
        );
      }

      this.config = validationResult.data;

      // Validate critical dependencies
      await this.validateCriticalDependencies();

      logger.info("Configuration loaded and validated successfully", {
        environment: this.config.server.environment,
        features: Object.entries(this.config.features)
          .filter(([, enabled]) => enabled)
          .map(([feature]) => feature),
      });

      this.emit("configLoaded", this.config);
      return this.config;
    } catch (error) {
      logger.error("Failed to load configuration", error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  get(): AppConfig {
    if (!this.config) {
      throw new CustomError(
        "Configuration not loaded. Call load() first.",
        500,
        { code: "CONFIG_NOT_LOADED" },
      );
    }
    return this.config;
  }

  /**
   * Get configuration section
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.get()[section];
  }

  /**
   * Check if configuration is loaded
   */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Enable hot-reloading of configuration (development only)
   */
  enableHotReload(): void {
    if (this.config?.server.environment === "production") {
      logger.warn("Hot-reload is disabled in production environment");
      return;
    }

    if (this.watchMode) {
      logger.warn("Hot-reload is already enabled");
      return;
    }

    try {
      this.fileWatcher = fs.watchFile(this.configPath, async () => {
        try {
          logger.info("Configuration file changed, reloading...");
          const newConfig = await this.load();
          this.emit("configReloaded", newConfig);
        } catch (error) {
          logger.error("Failed to reload configuration", error);
          this.emit("configReloadError", error);
        }
      });

      this.watchMode = true;
      logger.info("Configuration hot-reload enabled");
    } catch (error) {
      logger.error("Failed to enable configuration hot-reload", error);
    }
  }

  /**
   * Disable hot-reloading
   */
  disableHotReload(): void {
    if (this.fileWatcher) {
      fs.unwatchFile(this.configPath);
      this.fileWatcher = undefined;
    }
    this.watchMode = false;
    logger.info("Configuration hot-reload disabled");
  }

  /**
   * Validate that critical external dependencies are accessible
   */
  private async validateCriticalDependencies(): Promise<void> {
    if (!this.config) return;

    const validations: Promise<void>[] = [];

    // Validate database connection
    validations.push(this.validateDatabaseConnection());

    // Validate Redis connection (if enabled)
    if (this.config.redis.enabled) {
      validations.push(this.validateRedisConnection());
    }

    // Validate OpenAI API key
    validations.push(this.validateOpenAIConnection());

    try {
      await Promise.all(validations);
      logger.info("All critical dependencies validated successfully");
    } catch (error) {
      logger.error("Critical dependency validation failed", error);
      throw new CustomError("Critical dependency validation failed", 500, {
        code: "DEPENDENCY_VALIDATION_FAILED",
        context: { error },
      });
    }
  }

  private async validateDatabaseConnection(): Promise<void> {
    // This would implement actual database connection test
    // For now, just validate the URL format
    try {
      new URL(this.config!.database.url);
    } catch (error) {
      throw new CustomError("Invalid database URL format", 500, {
        code: "INVALID_DATABASE_URL",
      });
    }
  }

  private async validateRedisConnection(): Promise<void> {
    // This would implement actual Redis connection test
    // For now, just validate the configuration
    const redis = this.config!.redis;
    if (!redis.host || redis.port <= 0) {
      throw new CustomError("Invalid Redis configuration", 500, {
        code: "INVALID_REDIS_CONFIG",
      });
    }
  }

  private async validateOpenAIConnection(): Promise<void> {
    // This would implement actual OpenAI API test
    // For now, just validate the API key format
    const apiKey = this.config!.openai.apiKey;
    if (!apiKey.startsWith("sk-")) {
      throw new CustomError("Invalid OpenAI API key format", 500, {
        code: "INVALID_OPENAI_KEY",
      });
    }
  }

  /**
   * Load environment variables and map them to configuration structure
   */
  private loadEnvironmentVariables(): any {
    const env = process.env;

    return {
      server: {
        port: parseInt(env.PORT || "3000"),
        host: env.HOST || "localhost",
        environment: env.NODE_ENV || "development",
        sessionSecret:
          env.SESSION_SECRET || this.generateSecretWarning("SESSION_SECRET"),
        corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(",") : ["*"],
        trustProxy: env.TRUST_PROXY === "true",
        requestTimeout: parseInt(env.REQUEST_TIMEOUT || "30000"),
        bodyLimit: env.BODY_LIMIT || "10mb",
      },
      database: {
        url: env.DATABASE_URL || this.throwMissingEnvError("DATABASE_URL"),
        maxConnections: parseInt(env.DB_MAX_CONNECTIONS || "20"),
        connectionTimeout: parseInt(env.DB_CONNECTION_TIMEOUT || "10000"),
        idleTimeout: parseInt(env.DB_IDLE_TIMEOUT || "30000"),
        ssl: env.DB_SSL === "true",
        logging: env.DB_LOGGING === "true",
      },
      redis: {
        enabled: env.REDIS_ENABLED !== "false",
        host: env.REDIS_HOST || "localhost",
        port: parseInt(env.REDIS_PORT || "6379"),
        password: env.REDIS_PASSWORD,
        database: parseInt(env.REDIS_DATABASE || "0"),
        tls: env.REDIS_TLS === "true",
        retryAttempts: parseInt(env.REDIS_RETRY_ATTEMPTS || "3"),
        retryDelay: parseInt(env.REDIS_RETRY_DELAY || "1000"),
      },
      auth: {
        jwtSecret: env.JWT_SECRET || this.generateSecretWarning("JWT_SECRET"),
        jwtExpiresIn: env.JWT_EXPIRES_IN || "24h",
        magicLinkExpiresIn: parseInt(env.MAGIC_LINK_EXPIRES_IN || "900"),
        bcryptRounds: parseInt(env.BCRYPT_ROUNDS || "12"),
        sessionMaxAge: parseInt(env.SESSION_MAX_AGE || "86400000"),
        rateLimitWindow: parseInt(env.RATE_LIMIT_WINDOW || "900000"),
        rateLimitMax: parseInt(env.RATE_LIMIT_MAX || "5"),
      },
      openai: {
        apiKey:
          env.OPENAI_API_KEY || this.throwMissingEnvError("OPENAI_API_KEY"),
        model: env.OPENAI_MODEL || "gpt-4",
        maxTokens: parseInt(env.OPENAI_MAX_TOKENS || "2000"),
        temperature: parseFloat(env.OPENAI_TEMPERATURE || "0.7"),
        timeout: parseInt(env.OPENAI_TIMEOUT || "30000"),
        rateLimitRpm: parseInt(env.OPENAI_RATE_LIMIT_RPM || "60"),
        rateLimitTpm: parseInt(env.OPENAI_RATE_LIMIT_TPM || "60000"),
      },
      email: {
        provider: env.EMAIL_PROVIDER || "sendgrid",
        sendgridApiKey: env.SENDGRID_API_KEY,
        smtpHost: env.SMTP_HOST,
        smtpPort: env.SMTP_PORT ? parseInt(env.SMTP_PORT) : undefined,
        smtpUser: env.SMTP_USER,
        smtpPassword: env.SMTP_PASSWORD,
        fromEmail: env.FROM_EMAIL || this.throwMissingEnvError("FROM_EMAIL"),
        fromName: env.FROM_NAME || "CleanRylie",
      },
      sms: {
        provider: env.SMS_PROVIDER || "twilio",
        twilioAccountSid: env.TWILIO_ACCOUNT_SID,
        twilioAuthToken: env.TWILIO_AUTH_TOKEN,
        twilioPhoneNumber: env.TWILIO_PHONE_NUMBER,
      },
      monitoring: {
        enabled: env.MONITORING_ENABLED !== "false",
        metricsPort: parseInt(env.METRICS_PORT || "9090"),
        healthCheckInterval: parseInt(env.HEALTH_CHECK_INTERVAL || "30000"),
        prometheusEnabled: env.PROMETHEUS_ENABLED === "true",
        grafanaEnabled: env.GRAFANA_ENABLED === "true",
        tracingEnabled: env.TRACING_ENABLED === "true",
        tempoUrl: env.GRAFANA_TEMPO_URL,
        jaegerUrl: env.JAEGER_URL,
      },
      features: {
        agentSquadEnabled: env.AGENT_SQUAD_ENABLED === "true",
        adfProcessingEnabled: env.ADF_PROCESSING_ENABLED !== "false",
        conversationLoggingEnabled:
          env.CONVERSATION_LOGGING_ENABLED !== "false",
        performanceTrackingEnabled: env.PERFORMANCE_TRACKING_ENABLED === "true",
        debugMode: env.DEBUG_MODE === "true",
      },
      security: {
        enableCsrf: env.ENABLE_CSRF !== "false",
        enableHelmet: env.ENABLE_HELMET !== "false",
        enableRateLimit: env.ENABLE_RATE_LIMIT !== "false",
        allowedFileTypes: env.ALLOWED_FILE_TYPES
          ? env.ALLOWED_FILE_TYPES.split(",")
          : [".jpg", ".jpeg", ".png", ".pdf"],
        maxFileSize: parseInt(env.MAX_FILE_SIZE || "10485760"),
        encryptionKey: env.ENCRYPTION_KEY,
      },
    };
  }

  private generateSecretWarning(envVar: string): string {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${envVar} must be set in production environment`);
    }

    logger.warn(`${envVar} not set, using insecure default for development`);
    return "insecure-development-secret-change-in-production";
  }

  private throwMissingEnvError(envVar: string): never {
    throw new Error(`Required environment variable ${envVar} is not set`);
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
