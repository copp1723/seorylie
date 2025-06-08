import { EventEmitter } from "events";
import logger from "../utils/logger";
import db from "../db";
import { sql } from "drizzle-orm";
// TODO: Fix missing modules - temporarily commented out for build
// import { adfEmailListener } from './adf-email-listener';
import { adfLeadProcessor } from "./adf-lead-processor";
// import { adfResponseOrchestrator } from './adf-response-orchestrator';
import { adfSmsResponseSender } from "./adf-sms-response-sender";
import { twilioSMSService } from "./twilio-sms-service";
import { ADFParser as ADFParserV1 } from "./adf-parser";
import { ADFParserV2 } from "./adf-parser-v2";
import {
  recordError,
  recordSuccess,
  recordDuration,
} from "../observability/metrics";
import { ValidationErrorCode } from "../types/adf-types";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import CircuitBreaker from "opossum";

export interface AdfServiceConfig {
  enabled?: boolean;
  emailPollingEnabled?: boolean;
  emailPollingInterval?: number;
  maxConcurrentProcessing?: number;
  parserV2Enabled?: boolean;
  fallbackToV1OnError?: boolean;
  strictValidation?: boolean;
  s3BackupEnabled?: boolean;
  s3BackupBucket?: string;
  s3BackupKeyPrefix?: string;
}

export class AdfService extends EventEmitter {
  private isListening: boolean = false;
  private adfParserV1: ADFParserV1;
  private adfParserV2: ADFParserV2;
  private s3Client: S3Client | null = null;
  private s3CircuitBreaker: CircuitBreaker<[PutObjectCommand], any> | null =
    null;

  private processingStats = {
    emailsReceived: 0,
    leadsProcessed: 0,
    duplicatesSkipped: 0,
    processingErrors: 0,
    lastEmailReceived: null as Date | null,
    lastLeadProcessed: null as Date | null,
    lastError: null as Error | null,
    startTime: new Date(),
    aiResponses: {
      generated: 0,
      failed: 0,
      avgLatency: 0,
    },
    parser: {
      v1Used: 0,
      v2Used: 0,
      v2Fallbacks: 0,
      xsdValidationFailures: 0,
      parseSuccesses: 0,
      parseFailures: 0,
      avgParseTimeMs: 0,
      s3BackupSuccesses: 0,
      s3BackupFailures: 0,
    },
  };

  constructor(private config: AdfServiceConfig = {}) {
    super();

    // Default configuration
    this.config = {
      enabled: process.env.ADF_ENABLED === "true",
      emailPollingEnabled: process.env.ADF_EMAIL_POLLING_ENABLED === "true",
      emailPollingInterval: parseInt(
        process.env.ADF_EMAIL_POLLING_INTERVAL || "300000",
        10,
      ),
      maxConcurrentProcessing: parseInt(
        process.env.ADF_MAX_CONCURRENT_PROCESSING || "5",
        10,
      ),
      parserV2Enabled: process.env.ADF_PARSER_V2_ENABLED === "true",
      fallbackToV1OnError: process.env.ADF_FALLBACK_TO_V1_ON_ERROR === "true",
      strictValidation: process.env.ADF_PARSER_STRICT_MODE === "true",
      s3BackupEnabled: process.env.ADF_S3_BACKUP_ENABLED === "true",
      s3BackupBucket: process.env.ADF_S3_BACKUP_BUCKET || "adf-raw-backup",
      s3BackupKeyPrefix: process.env.ADF_S3_BACKUP_KEY_PREFIX || "raw/",
      ...config,
    };

    // Initialize parsers
    this.adfParserV1 = new ADFParserV1();
    this.adfParserV2 = new ADFParserV2({
      strictMode: this.config.strictValidation,
      xsdVersion: process.env.ADF_PARSER_XSD_VERSION || "1.0",
      schemaBasePath: process.env.ADF_SCHEMA_BASE_PATH || "server/schemas/adf",
      extractPartialData: process.env.ADF_EXTRACT_PARTIAL_DATA === "true",
      requireMinimumFields: process.env.ADF_REQUIRE_MINIMUM_FIELDS === "true",
      minimumRequiredFields: (
        process.env.ADF_MINIMUM_REQUIRED_FIELDS || ""
      ).split(","),
    });

    // Initialize S3 client if backup is enabled
    if (this.config.s3BackupEnabled) {
      this.initializeS3Backup();
    }

    // Setup event listeners
    this.setupEventListeners();

    // Setup orchestrator integration
    this.setupOrchestratorIntegration();

    // Initialize SMS response sender
    adfSmsResponseSender.initialize().catch((error) => {
      logger.error("Failed to initialize ADF SMS Response Sender", error);
    });

    logger.info("ADF Service initialized", {
      enabled: this.config.enabled,
      emailPollingEnabled: this.config.emailPollingEnabled,
      emailPollingInterval: this.config.emailPollingInterval,
      parserV2Enabled: this.config.parserV2Enabled,
      fallbackToV1OnError: this.config.fallbackToV1OnError,
      strictValidation: this.config.strictValidation,
      s3BackupEnabled: this.config.s3BackupEnabled,
    });
  }

  /**
   * Start the ADF service
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("ADF Service is disabled, not starting");
      return;
    }

    try {
      logger.info("Starting ADF Service");

      // Verify parser health
      await this.checkParserHealth();

      // Start email listener if enabled
      if (this.config.emailPollingEnabled) {
        // TODO: Re-enable when adfEmailListener is available
        // await adfEmailListener.start();
        this.isListening = true;
        logger.info(
          "ADF Email Listener started successfully (temporarily disabled)",
        );
      } else {
        logger.info("ADF Email Polling is disabled");
      }

      this.emit("started");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to start ADF Service", { error: err.message });
      this.lastError = err;
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Stop the ADF service
   */
  async stop(): Promise<void> {
    try {
      logger.info("Stopping ADF Service");

      // Stop email listener if it was started
      if (this.isListening) {
        // TODO: Re-enable when adfEmailListener is available
        // await adfEmailListener.stop();
        this.isListening = false;
        logger.info(
          "ADF Email Listener stopped successfully (temporarily disabled)",
        );
      }

      this.emit("stopped");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to stop ADF Service", { error: err.message });
      this.lastError = err;
      this.emit("error", err);
      throw err;
    }
  }

  /**
   * Process a raw ADF XML string
   */
  async processAdfXml(
    xml: string,
    source: string = "manual",
    dealershipId?: string,
  ): Promise<any> {
    const startTime = Date.now();
    const useParserV2 = this.config.parserV2Enabled;
    let parsedData;
    let parserUsed = "v1";
    let fallbackUsed = false;

    try {
      logger.info("Processing ADF XML", {
        source,
        xmlLength: xml.length,
        parser: useParserV2 ? "v2" : "v1",
        dealershipId,
      });

      // Backup raw XML to S3 if enabled
      if (this.config.s3BackupEnabled && this.s3CircuitBreaker) {
        this.backupToS3(xml, dealershipId, "raw").catch((error) => {
          logger.warn("Failed to backup raw XML to S3", {
            error: error.message,
          });
          this.processingStats.parser.s3BackupFailures++;
          recordError("s3_backup_failed", "adf_parser", dealershipId);
        });
      }

      // Parse the XML using the appropriate parser
      if (useParserV2) {
        try {
          const parseStartTime = Date.now();
          parsedData = await this.adfParserV2.parse(xml, dealershipId);
          const parseEndTime = Date.now();
          const parseTimeMs = parseEndTime - parseStartTime;

          // Update metrics
          this.processingStats.parser.v2Used++;
          this.processingStats.parser.parseSuccesses++;

          // Update average parse time
          const totalParses =
            this.processingStats.parser.parseSuccesses +
            this.processingStats.parser.parseFailures;
          this.processingStats.parser.avgParseTimeMs =
            (this.processingStats.parser.avgParseTimeMs * (totalParses - 1) +
              parseTimeMs) /
            totalParses;

          // Record metrics
          recordSuccess("parse_success", "adf_parser_v2", dealershipId);
          recordDuration(
            "parse_duration_seconds",
            parseTimeMs / 1000,
            dealershipId,
          );

          parserUsed = "v2";
          logger.info("ADF XML parsed successfully with Parser v2", {
            parseTimeMs,
            dealershipId,
          });

          // Check for warnings
          if (parsedData.warnings && parsedData.warnings.length > 0) {
            logger.warn("ADF Parser v2 generated warnings", {
              warnings: parsedData.warnings,
              dealershipId,
            });

            // Record warning metrics
            parsedData.warnings.forEach((warning) => {
              recordError(
                `warning_${warning.code.toLowerCase()}`,
                "adf_parser_v2",
                dealershipId,
              );
            });
          }
        } catch (error) {
          // Handle parser v2 failure
          this.processingStats.parser.parseFailures++;

          if (error.code === ValidationErrorCode.XSD_VALIDATION_FAILED) {
            this.processingStats.parser.xsdValidationFailures++;
            recordError("xsd_validation_failed", "adf_parser_v2", dealershipId);
          } else {
            recordError(
              `parse_error_${error.code || "unknown"}`,
              "adf_parser_v2",
              dealershipId,
            );
          }

          // Try fallback to v1 if enabled
          if (this.config.fallbackToV1OnError) {
            logger.warn("Parser v2 failed, falling back to v1", {
              error: error.message,
              errorCode: error.code,
              dealershipId,
            });

            parsedData = await this.adfParserV1.parse(xml);
            this.processingStats.parser.v1Used++;
            this.processingStats.parser.v2Fallbacks++;
            parserUsed = "v1";
            fallbackUsed = true;

            // Record fallback metric
            recordSuccess("fallback_parse", "adf_parser_v1", dealershipId);

            logger.info(
              "ADF XML parsed successfully with fallback to Parser v1",
              { dealershipId },
            );
          } else {
            // Re-throw if fallback is not enabled
            throw error;
          }
        }
      } else {
        // Use parser v1 directly
        parsedData = await this.adfParserV1.parse(xml);
        this.processingStats.parser.v1Used++;
        parserUsed = "v1";
        logger.info("ADF XML parsed successfully with Parser v1", {
          dealershipId,
        });
      }

      // Backup parsed result to S3 if enabled
      if (this.config.s3BackupEnabled && this.s3CircuitBreaker && parsedData) {
        this.backupToS3(
          JSON.stringify(parsedData),
          dealershipId,
          "parsed",
        ).catch((error) => {
          logger.warn("Failed to backup parsed data to S3", {
            error: error.message,
          });
          this.processingStats.parser.s3BackupFailures++;
          recordError("s3_backup_failed", "adf_parser", dealershipId);
        });
      }

      // Process the parsed data
      const result = await adfLeadProcessor.processAdfData(
        parsedData,
        source,
        dealershipId,
      );

      if (result.success) {
        this.processingStats.leadsProcessed++;
        this.processingStats.lastLeadProcessed = new Date();

        if (result.isDuplicate) {
          this.processingStats.duplicatesSkipped++;
          logger.info("Duplicate ADF lead detected", {
            leadId: result.leadId,
            source,
            parserUsed,
            fallbackUsed,
          });
        } else {
          logger.info("ADF lead processed successfully", {
            leadId: result.leadId,
            source,
            parserUsed,
            fallbackUsed,
          });
          this.emit("leadProcessed", {
            leadId: result.leadId,
            source,
            parserUsed,
            fallbackUsed,
          });
        }
      } else {
        this.processingStats.processingErrors++;
        this.lastError = new Error(result.error || "Unknown processing error");
        logger.error("Failed to process ADF data", {
          error: result.error,
          source,
          parserUsed,
          fallbackUsed,
        });
      }

      // Record total processing duration
      const totalDuration = Date.now() - startTime;
      recordDuration(
        "total_processing_duration_seconds",
        totalDuration / 1000,
        dealershipId,
      );

      return {
        ...result,
        parserUsed,
        fallbackUsed,
        processingTimeMs: totalDuration,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.processingStats.processingErrors++;
      this.lastError = err;
      logger.error("Error in processAdfXml", {
        error: err.message,
        errorCode: err.code,
        source,
        parserUsed,
        fallbackUsed,
        dealershipId,
      });

      // Record error metric
      recordError("processing_error", "adf_service", dealershipId);

      throw err;
    }
  }

  /**
   * Get processing statistics
   */
  getProcessingStats(): any {
    return {
      ...this.processingStats,
      uptime: Date.now() - this.processingStats.startTime.getTime(),
      isListening: this.isListening,
      config: this.config,
      smsMetrics: adfSmsResponseSender.getMetrics(),
      parserHealth: {
        v1: true, // Parser v1 is always available
        v2: this.checkParserV2Health(),
        s3Backup:
          this.config.s3BackupEnabled && this.s3CircuitBreaker
            ? !this.s3CircuitBreaker.isOpen()
            : false,
      },
    };
  }

  /**
   * Setup event listeners for email and lead processing
   */
  private setupEventListeners(): void {
    // TODO: Re-enable when adfEmailListener is available
    /*
    // Listen for new emails
    adfEmailListener.on('email', async (email) => {
      try {
        this.processingStats.emailsReceived++;
        this.processingStats.lastEmailReceived = new Date();
        
        logger.info('ADF email received', { 
          subject: email.subject,
          from: email.from,
          date: email.date
        });
        
        // Check if email has ADF XML attachment
        const adfAttachment = email.attachments.find(att => 
          att.filename.toLowerCase().endsWith('.xml') || 
          att.contentType.includes('application/xml') ||
          att.contentType.includes('text/xml')
        );
        
        if (adfAttachment && adfAttachment.content) {
          // Process the XML
          const xml = adfAttachment.content.toString('utf8');
          await this.processAdfXml(xml, 'email');
        } else {
          logger.warn('No ADF XML attachment found in email', { 
            subject: email.subject,
            attachments: email.attachments.map(a => a.filename).join(', ')
          });
        }
        
        this.emit('emailProcessed', { emailId: email.id });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.processingStats.processingErrors++;
        this.lastError = err;
        logger.error('Failed to process ADF email', { error: err.message });
        this.emit('error', err);
      }
    });
    
    // Listen for email listener errors
    adfEmailListener.on('error', (error) => {
      this.processingStats.processingErrors++;
      this.lastError = error;
      logger.error('ADF Email Listener error', { error: error.message });
      this.emit('error', error);
    });
    
    // Listen for connection events
    adfEmailListener.on('connected', () => {
      logger.info('ADF Email Listener connected');
      this.emit('emailListenerConnected');
    });
    
    adfEmailListener.on('disconnected', () => {
      logger.warn('ADF Email Listener disconnected');
      this.emit('emailListenerDisconnected');
    });
    */
  }

  /**
   * Setup integration with the ADF Response Orchestrator
   */
  private setupOrchestratorIntegration(): void {
    // TODO: Re-enable when adfResponseOrchestrator is available
    /*
    // Forward lead processed events to orchestrator
    this.on('leadProcessed', async (data) => {
      try {
        await adfResponseOrchestrator.processLead(data.leadId);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to forward lead to orchestrator', { 
          error: err.message,
          leadId: data.leadId
        });
      }
    });
    
    // Listen for AI response events
    adfResponseOrchestrator.on('aiResponseGenerated', (result) => {
      this.processingStats.aiResponses.generated++;
      this.processingStats.aiResponses.avgLatency = 
        (this.processingStats.aiResponses.avgLatency * (this.processingStats.aiResponses.generated - 1) + 
         result.latencyMs) / this.processingStats.aiResponses.generated;
      
      logger.info('AI response generated', { 
        leadId: result.leadId, 
        latencyMs: result.latencyMs 
      });
      
      // Forward the event
      this.emit('aiResponseGenerated', result);
    });
    
    adfResponseOrchestrator.on('aiResponseFailed', (result) => {
      this.processingStats.aiResponses.failed++;
      logger.error('AI response generation failed', { 
        leadId: result.leadId, 
        error: result.error 
      });
      
      // Forward the event
      this.emit('aiResponseFailed', result);
    });
    */

    // Setup SMS response sender integration
    this.on("lead.response.ready", async (result) => {
      try {
        // Get lead data for SMS delivery
        const leadData = await this.getLeadData(result.leadId);
        if (!leadData) {
          logger.warn("No lead data found for SMS delivery", {
            leadId: result.leadId,
          });
          return;
        }

        // Emit to SMS response sender
        adfSmsResponseSender.emit("lead.response.ready", {
          leadId: result.leadId,
          response: result.responseText,
          dealershipId: leadData.dealershipId,
          lead: leadData,
          metadata: result.metadata,
        });

        logger.info("Lead response forwarded to SMS sender", {
          leadId: result.leadId,
          dealershipId: leadData.dealershipId,
        });
      } catch (error) {
        logger.error("Failed to forward lead response to SMS sender", {
          leadId: result.leadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Listen for SMS delivery events
    adfSmsResponseSender.on("sms.send.success", (event) => {
      logger.info("ADF SMS sent successfully", event);
      this.emit("adf.sms.sent", event);
    });

    adfSmsResponseSender.on("sms.delivered", (event) => {
      logger.info("ADF SMS delivered successfully", event);
      this.emit("adf.sms.delivered", event);
    });

    adfSmsResponseSender.on("sms.send.failed", (event) => {
      logger.warn("ADF SMS send failed", event);
      this.emit("adf.sms.failed", event);
    });
  }

  /**
   * Get lead data by ID for SMS delivery
   */
  private async getLeadData(leadId: number): Promise<any | null> {
    try {
      const results = await db.execute(sql`
        SELECT 
          l.id,
          l.dealership_id,
          l.provider,
          l.request_date,
          l.lead_type,
          l.status,
          c.name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          v.make as vehicle_make,
          v.model as vehicle_model,
          v.year as vehicle_year
        FROM adf_leads l
        LEFT JOIN adf_customers c ON l.id = c.lead_id
        LEFT JOIN adf_vehicles v ON l.id = v.lead_id
        WHERE l.id = ${leadId}
      `);

      if (results.length === 0) {
        return null;
      }

      const lead = results[0];

      // Transform to expected format
      return {
        id: lead.id,
        dealershipId: lead.dealership_id,
        provider: lead.provider,
        requestDate: lead.request_date,
        leadType: lead.lead_type,
        status: lead.status,
        customer: {
          name: lead.customer_name,
          phone: lead.customer_phone,
          email: lead.customer_email,
        },
        vehicle: {
          make: lead.vehicle_make,
          model: lead.vehicle_model,
          year: lead.vehicle_year,
        },
      };
    } catch (error) {
      logger.error("Failed to get lead data", {
        error: error instanceof Error ? error.message : String(error),
        leadId,
      });
      return null;
    }
  }

  /**
   * Test SMS response sending
   */
  async testSmsResponse(
    phoneNumber: string,
    message: string,
    dealershipId: number = 1,
  ): Promise<any> {
    try {
      logger.info("Testing SMS response", {
        phoneNumber: twilioSMSService.maskPhoneNumber(phoneNumber),
      });
      return await adfSmsResponseSender.testSendSms(
        phoneNumber,
        message,
        dealershipId,
      );
    } catch (error) {
      logger.error("Failed to test SMS response", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initialize S3 backup functionality
   */
  private initializeS3Backup(): void {
    try {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || "us-east-1",
      });

      // Setup circuit breaker for S3 operations
      const options = {
        timeout: parseInt(process.env.ADF_S3_TIMEOUT_MS || "5000", 10),
        errorThresholdPercentage: parseInt(
          process.env.ADF_CIRCUIT_ERROR_THRESHOLD || "50",
          10,
        ),
        resetTimeout: parseInt(
          process.env.ADF_CIRCUIT_RESET_TIMEOUT_MS || "30000",
          10,
        ),
      };

      this.s3CircuitBreaker = new CircuitBreaker(async (command) => {
        return await this.s3Client!.send(command);
      }, options);

      // Listen for circuit breaker events
      this.s3CircuitBreaker.on("open", () => {
        logger.warn("S3 backup circuit breaker opened");
        recordError("s3_circuit_open", "adf_parser");
      });

      this.s3CircuitBreaker.on("close", () => {
        logger.info("S3 backup circuit breaker closed");
      });

      logger.info("S3 backup initialized", {
        bucket: this.config.s3BackupBucket,
        keyPrefix: this.config.s3BackupKeyPrefix,
      });
    } catch (error) {
      logger.error("Failed to initialize S3 backup", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Backup data to S3
   */
  private async backupToS3(
    data: string,
    dealershipId?: string,
    type: "raw" | "parsed" = "raw",
  ): Promise<void> {
    if (!this.s3Client || !this.s3CircuitBreaker) {
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const key = `${this.config.s3BackupKeyPrefix}${dealershipId || "unknown"}/${timestamp}-${type}.${type === "raw" ? "xml" : "json"}`;

      const command = new PutObjectCommand({
        Bucket: this.config.s3BackupBucket,
        Key: key,
        Body: data,
      });

      await this.s3CircuitBreaker.fire(command);

      this.processingStats.parser.s3BackupSuccesses++;
      logger.debug("Successfully backed up to S3", { type, dealershipId, key });
    } catch (error) {
      this.processingStats.parser.s3BackupFailures++;
      logger.warn("Failed to backup to S3", {
        error: error instanceof Error ? error.message : String(error),
        type,
        dealershipId,
      });
      throw error;
    }
  }

  /**
   * Check parser health
   */
  private async checkParserHealth(): Promise<boolean> {
    try {
      // Basic v1 parser check - always available

      // Check v2 parser if enabled
      if (this.config.parserV2Enabled) {
        const v2Health = this.checkParserV2Health();
        if (!v2Health) {
          logger.warn(
            "Parser v2 health check failed, using fallback if enabled",
          );
          if (!this.config.fallbackToV1OnError) {
            logger.error(
              "Parser v2 is unhealthy and fallback is disabled, service may not function correctly",
            );
          }
        }
      }

      return true;
    } catch (error) {
      logger.error("Parser health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check Parser v2 health
   */
  private checkParserV2Health(): boolean {
    try {
      // Check if schema validator is initialized
      return this.adfParserV2.isHealthy();
    } catch (error) {
      logger.error("Parser v2 health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export the class as default
export default AdfService;

// Export a singleton instance for easy use
export const adfService = new AdfService();
