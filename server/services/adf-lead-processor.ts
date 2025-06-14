import db from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  adfLeads,
  adfEmailQueue,
  adfProcessingLogs,
  type InsertAdfLead,
  type InsertAdfEmailQueue,
  type InsertAdfProcessingLog,
  type AdfProcessingStatus,
} from "@shared/index";
import { AdfParser } from "./adf-parser";
import logger from "../utils/logger";

export interface LeadProcessingInput {
  emailMessageId: string;
  emailSubject: string;
  emailFrom: string;
  emailTo: string;
  emailDate: Date;
  adfXmlContent: string;
  rawEmailContent: string;
  attachmentInfo: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export interface LeadProcessingResult {
  success: boolean;
  leadId?: number;
  queueId?: number;
  isDuplicate?: boolean;
  errors: string[];
  warnings: string[];
  processingTime: number;
}

export class AdfLeadProcessor {
  private adfParser: AdfParser;
  public db: any;

  constructor(database?: any) {
    this.adfParser = new AdfParser();
    this.db = database || db;
  }

  /**
   * Process an ADF lead from email input
   */
  async processAdfLead(
    input: LeadProcessingInput,
  ): Promise<LeadProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 1: Add email to processing queue
    let queueId: number;
    try {
      queueId = await this.addToEmailQueue(input);
      await this.logProcessingStep(
        null,
        "email_queue",
        "success",
        "Email added to processing queue",
        { queueId },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Failed to add email to queue: ${errorMessage}`);
      await this.logProcessingStep(null, "email_queue", "error", errorMessage);
      return {
        success: false,
        errors,
        warnings,
        processingTime: Date.now() - startTime,
      };
    }

    try {
      // Step 2: Parse ADF XML
      const parseResult = await this.adfParser.parseAdfXml(input.adfXmlContent);

      if (!parseResult.success || !parseResult.mappedLead) {
        errors.push(...parseResult.errors);
        await this.updateQueueStatus(queueId, "failed", parseResult.errors);
        await this.logProcessingStep(
          null,
          "xml_parse",
          "error",
          "XML parsing failed",
          { errors: parseResult.errors },
        );
        return {
          success: false,
          queueId,
          errors,
          warnings,
          processingTime: Date.now() - startTime,
        };
      }

      warnings.push(...parseResult.warnings);
      await this.logProcessingStep(
        null,
        "xml_parse",
        "success",
        "XML parsed successfully",
      );

      // Step 3: Add email metadata to lead data
      const leadData = this.enrichLeadWithEmailData(
        parseResult.mappedLead,
        input,
      );

      // Step 4: Check for duplicates
      const duplicateCheck = await this.checkForDuplicates(leadData);

      if (duplicateCheck.isDuplicate) {
        warnings.push(
          `Duplicate lead detected. Existing lead ID: ${duplicateCheck.existingLeadId}`,
        );
        await this.updateQueueStatus(
          queueId,
          "processed",
          [],
          duplicateCheck.existingLeadId,
        );
        await this.logProcessingStep(
          duplicateCheck.existingLeadId,
          "deduplication",
          "warning",
          "Duplicate lead detected",
          {
            existingLeadId: duplicateCheck.existingLeadId,
            deduplicationHash: leadData.deduplicationHash,
          },
        );

        return {
          success: true,
          queueId,
          leadId: duplicateCheck.existingLeadId,
          isDuplicate: true,
          errors,
          warnings,
          processingTime: Date.now() - startTime,
        };
      }

      await this.logProcessingStep(
        null,
        "deduplication",
        "success",
        "No duplicate found",
      );

      // Step 5: Map to dealership (if vendor info available)
      const dealershipId = await this.mapToDealership(leadData);
      if (dealershipId) {
        leadData.dealershipId = dealershipId;
        await this.logProcessingStep(
          null,
          "dealership_mapping",
          "success",
          `Mapped to dealership ID: ${dealershipId}`,
        );
      } else {
        warnings.push("Could not map lead to specific dealership");
        await this.logProcessingStep(
          null,
          "dealership_mapping",
          "warning",
          "Could not map to dealership",
        );
      }

      // Step 6: Store the lead
      const leadId = await this.storeLead(leadData);
      await this.logProcessingStep(
        leadId,
        "storage",
        "success",
        "Lead stored successfully",
        { leadId },
      );

      // Step 7: Update queue status
      await this.updateQueueStatus(queueId, "processed", [], leadId);

      logger.info("ADF lead processed successfully", {
        leadId,
        queueId,
        customerName: leadData.customerFullName,
        vendorName: leadData.vendorName,
        processingTime: Date.now() - startTime,
      });

      return {
        success: true,
        leadId,
        queueId,
        isDuplicate: false,
        errors,
        warnings,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Processing error: ${errorMessage}`);

      await this.updateQueueStatus(queueId, "failed", [errorMessage]);
      await this.logProcessingStep(null, "processing", "error", errorMessage, {
        error: errorMessage,
      });

      logger.error("ADF lead processing failed", {
        error: errorMessage,
        queueId,
        emailFrom: input.emailFrom,
      });

      return {
        success: false,
        queueId,
        errors,
        warnings,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Add email to processing queue
   */
  private async addToEmailQueue(input: LeadProcessingInput): Promise<number> {
    const queueData: InsertAdfEmailQueue = {
      emailMessageId: input.emailMessageId,
      emailSubject: input.emailSubject,
      emailFrom: input.emailFrom,
      emailTo: input.emailTo,
      emailDate: input.emailDate,
      rawEmailContent: input.rawEmailContent,
      adfXmlContent: input.adfXmlContent,
      attachmentInfo: input.attachmentInfo,
      processingStatus: "pending",
      processingAttempts: 1,
      maxRetries: 3,
    };

    const [queueEntry] = await this.db
      .insert(adfEmailQueue)
      .values(queueData)
      .returning({ id: adfEmailQueue.id });
    return queueEntry.id;
  }

  /**
   * Update email queue status
   */
  private async updateQueueStatus(
    queueId: number,
    status: AdfProcessingStatus,
    errors: string[] = [],
    resultingLeadId?: number,
  ): Promise<void> {
    const updateData: any = {
      processingStatus: status,
      updatedAt: new Date(),
    };

    if (status === "processed") {
      updateData.processedAt = new Date();
      if (resultingLeadId) {
        updateData.resultingLeadId = resultingLeadId;
      }
    }

    if (errors.length > 0) {
      updateData.processingErrors = errors;
    }

    await this.db
      .update(adfEmailQueue)
      .set(updateData)
      .where(eq(adfEmailQueue.id, queueId));
  }

  /**
   * Enrich lead data with email metadata
   */
  private enrichLeadWithEmailData(
    leadData: Partial<InsertAdfLead>,
    input: LeadProcessingInput,
  ): Partial<InsertAdfLead> {
    return {
      ...leadData,
      sourceEmailId: input.emailMessageId,
      sourceEmailSubject: input.emailSubject,
      sourceEmailFrom: input.emailFrom,
      sourceEmailDate: input.emailDate,
      processingStatus: "processed",
      processedAt: new Date(),
    };
  }

  /**
   * Check for duplicate leads using deduplication hash with advisory lock
   */
  private async checkForDuplicates(leadData: Partial<InsertAdfLead>): Promise<{
    isDuplicate: boolean;
    existingLeadId?: number;
  }> {
    if (!leadData.deduplicationHash) {
      return { isDuplicate: false };
    }

    try {
      // Use advisory lock to prevent race conditions
      const lockKey = `adf_lead_${leadData.deduplicationHash}`.substring(0, 63);
      const lockHash = Math.abs(lockKey.split('').reduce((a, b) => a + b.charCodeAt(0), 0));
      
      // Try to acquire advisory lock
      const lockResult = await this.db.execute(
        sql`SELECT pg_try_advisory_lock(${lockHash}) as locked`
      );
      
      const hasLock = lockResult.rows?.[0]?.locked;
      
      try {
        // Check for existing lead
        const existingLead = await this.db.query.adfLeads.findFirst({
          where: eq(adfLeads.deduplicationHash, leadData.deduplicationHash),
          columns: { id: true, customerFullName: true, createdAt: true },
        });

        if (existingLead) {
          logger.info("Duplicate lead detected", {
            existingLeadId: existingLead.id,
            customerName: existingLead.customerFullName,
            originalDate: existingLead.createdAt,
            deduplicationHash: leadData.deduplicationHash,
          });

          return {
            isDuplicate: true,
            existingLeadId: existingLead.id,
          };
        }

        return { isDuplicate: false };
      } finally {
        // Release advisory lock if we acquired it
        if (hasLock) {
          await this.db.execute(
            sql`SELECT pg_advisory_unlock(${lockHash})`
          );
        }
      }
    } catch (error) {
      logger.error("Error checking for duplicates with advisory lock", {
        error: error instanceof Error ? error.message : String(error),
        deduplicationHash: leadData.deduplicationHash,
      });
      
      // Fallback to simple check without lock
      const existingLead = await this.db.query.adfLeads.findFirst({
        where: eq(adfLeads.deduplicationHash, leadData.deduplicationHash),
        columns: { id: true, customerFullName: true, createdAt: true },
      });

      if (existingLead) {
        return {
          isDuplicate: true,
          existingLeadId: existingLead.id,
        };
      }

      return { isDuplicate: false };
    }
  }

  /**
   * Map lead to dealership based on vendor information
   */
  private async mapToDealership(
    leadData: Partial<InsertAdfLead>,
  ): Promise<number | null> {
    try {
      // Import dealerships table
      const { dealerships } = await import("@shared/index");

      // If vendor name is provided, try to find matching dealership
      if (leadData.vendorName) {
        const dealership = await this.db.query.dealerships.findFirst({
          where: eq(dealerships.name, leadData.vendorName),
          columns: { id: true },
        });

        if (dealership) {
          return dealership.id;
        }

        // Try fuzzy matching on dealership name
        const allDealerships = await this.db.query.dealerships.findMany({
          columns: { id: true, name: true },
        });

        for (const dealership of allDealerships) {
          if (
            this.fuzzyMatchDealershipName(leadData.vendorName, dealership.name)
          ) {
            logger.info("Fuzzy matched dealership", {
              vendorName: leadData.vendorName,
              dealershipName: dealership.name,
              dealershipId: dealership.id,
            });
            return dealership.id;
          }
        }
      }

      // If vendor email is provided, try to match domain
      if (leadData.vendorEmail) {
        const domain = leadData.vendorEmail.split("@")[1];
        if (domain) {
          const dealership = await this.db.query.dealerships.findFirst({
            where: eq(dealerships.website, `https://${domain}`),
            columns: { id: true },
          });

          if (dealership) {
            return dealership.id;
          }
        }
      }

      // Default to first dealership if no mapping found (fallback)
      const defaultDealership = await this.db.query.dealerships.findFirst({
        columns: { id: true },
      });

      return defaultDealership?.id || null;
    } catch (error) {
      logger.error("Error mapping lead to dealership", {
        error: error instanceof Error ? error.message : String(error),
        vendorName: leadData.vendorName,
        vendorEmail: leadData.vendorEmail,
      });
      return null;
    }
  }

  /**
   * Fuzzy match dealership names
   */
  private fuzzyMatchDealershipName(
    vendorName: string,
    dealershipName: string,
  ): boolean {
    const normalize = (str: string) =>
      str.toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedVendor = normalize(vendorName);
    const normalizedDealership = normalize(dealershipName);

    // Check if one contains the other
    if (
      normalizedVendor.includes(normalizedDealership) ||
      normalizedDealership.includes(normalizedVendor)
    ) {
      return true;
    }

    // Check for common words (minimum 3 characters)
    const vendorWords = normalizedVendor
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    const dealershipWords = normalizedDealership
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const commonWords = vendorWords.filter((word) =>
      dealershipWords.includes(word),
    );

    // Consider it a match if there are at least 2 common words or 1 word that's > 5 characters
    return (
      commonWords.length >= 2 || commonWords.some((word) => word.length > 5)
    );
  }

  /**
   * Store lead in database with conflict handling
   */
  private async storeLead(leadData: Partial<InsertAdfLead>): Promise<number> {
    // Ensure required fields have defaults
    const completeLeadData: InsertAdfLead = {
      adfVersion: "1.0",
      requestDate: new Date(),
      customerFullName: "Unknown",
      deduplicationHash: "",
      rawAdfXml: "",
      leadStatus: "new",
      processingStatus: "processed",
      ...leadData,
    } as InsertAdfLead;

    try {
      // Use INSERT ... ON CONFLICT to handle race conditions
      const result = await this.db.execute(sql`
        INSERT INTO adf_leads (
          adf_version, request_date, customer_full_name, 
          deduplication_hash, raw_adf_xml, lead_status, 
          processing_status, customer_first_name, customer_last_name,
          customer_email, customer_phone, customer_address,
          customer_city, customer_state, customer_postal_code,
          vehicle_year, vehicle_make, vehicle_model,
          vehicle_vin, vehicle_stock_number, vendor_name,
          vendor_email, provider_name, provider_service,
          provider_url, provider_email, dealer_id,
          customer_comments, price, lead_type, lead_source,
          created_at, updated_at
        ) VALUES (
          ${completeLeadData.adfVersion}, ${completeLeadData.requestDate}, 
          ${completeLeadData.customerFullName}, ${completeLeadData.deduplicationHash}, 
          ${completeLeadData.rawAdfXml}, ${completeLeadData.leadStatus}, 
          ${completeLeadData.processingStatus}, ${completeLeadData.customerFirstName || null}, 
          ${completeLeadData.customerLastName || null}, ${completeLeadData.customerEmail || null}, 
          ${completeLeadData.customerPhone || null}, ${completeLeadData.customerAddress || null},
          ${completeLeadData.customerCity || null}, ${completeLeadData.customerState || null}, 
          ${completeLeadData.customerPostalCode || null}, ${completeLeadData.vehicleYear || null}, 
          ${completeLeadData.vehicleMake || null}, ${completeLeadData.vehicleModel || null},
          ${completeLeadData.vehicleVin || null}, ${completeLeadData.vehicleStockNumber || null}, 
          ${completeLeadData.vendorName || null}, ${completeLeadData.vendorEmail || null}, 
          ${completeLeadData.providerName || null}, ${completeLeadData.providerService || null},
          ${completeLeadData.providerUrl || null}, ${completeLeadData.providerEmail || null}, 
          ${completeLeadData.dealerId || null}, ${completeLeadData.customerComments || null}, 
          ${completeLeadData.price || null}, ${completeLeadData.leadType || null}, 
          ${completeLeadData.leadSource || null}, NOW(), NOW()
        )
        ON CONFLICT (deduplication_hash) DO UPDATE SET
          updated_at = NOW(),
          processing_attempts = adf_leads.processing_attempts + 1
        RETURNING id
      `);
      
      return result.rows[0].id;
    } catch (error) {
      // Fallback to drizzle insert if raw SQL fails
      logger.warn("Failed to use INSERT ON CONFLICT, falling back to regular insert", {
        error: error instanceof Error ? error.message : String(error),
      });
      
      const [lead] = await this.db
        .insert(adfLeads)
        .values(completeLeadData)
        .returning({ id: adfLeads.id });
      return lead.id;
    }
  }

  /**
   * Log processing step for audit trail
   */
  private async logProcessingStep(
    leadId: number | null,
    processStep: string,
    status: "success" | "warning" | "error",
    message: string,
    details?: Record<string, any>,
  ): Promise<void> {
    try {
      const logData: InsertAdfProcessingLog = {
        adfLeadId: leadId,
        processStep,
        status,
        message,
        errorDetails: details || {},
      };

      await this.db.insert(adfProcessingLogs).values(logData);
    } catch (error) {
      // Don't let logging errors affect main processing
      logger.error("Failed to log processing step", {
        error: error instanceof Error ? error.message : String(error),
        processStep,
        status,
        message,
      });
    }
  }

  /**
   * Process ADF XML directly (without email context)
   */
  async processAdfXml(
    xmlContent: string,
    source: string = "direct",
  ): Promise<{
    success: boolean;
    leadId?: number;
    isDuplicate?: boolean;
    error?: string;
    warnings: string[];
  }> {
    const startTime = Date.now();

    try {
      logger.info("Processing ADF XML directly", {
        source,
        xmlLength: xmlContent.length,
      });

      // Parse the XML
      const parseResult = await this.adfParser.parseAdfXml(xmlContent);

      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.errors?.join("; ") || "XML parsing failed",
          warnings: parseResult.warnings || [],
        };
      }

      // Get the mapped lead data from parser result
      const leadData = parseResult.mappedLead;

      // Map to dealership (fallback to first available)
      const dealershipId = await this.mapToDealership(leadData);
      if (dealershipId) {
        leadData.dealershipId = dealershipId;
      }

      // Check for duplicates
      const { isDuplicate, existingLeadId } =
        await this.checkForDuplicates(leadData);

      if (isDuplicate) {
        logger.info("Duplicate lead detected during XML processing", {
          existingLeadId,
          source,
        });
        return {
          success: true,
          leadId: existingLeadId,
          isDuplicate: true,
          warnings: parseResult.warnings || [],
        };
      }

      // Store the lead
      const leadId = await this.storeLead(leadData);

      // Log success
      await this.logProcessingStep(
        leadId,
        "xml_processing",
        "success",
        `XML processed successfully from ${source}`,
      );

      logger.info("ADF XML processed successfully", {
        leadId,
        source,
        processingTime: Date.now() - startTime,
      });

      return {
        success: true,
        leadId,
        isDuplicate: false,
        warnings: parseResult.warnings || [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.error("Failed to process ADF XML", {
        error: errorMessage,
        source,
        processingTime: Date.now() - startTime,
      });

      // Log failure
      await this.logProcessingStep(
        null,
        "xml_processing",
        "error",
        `XML processing failed: ${errorMessage}`,
      );

      return {
        success: false,
        error: errorMessage,
        warnings: [],
      };
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(
    timeframe: "hour" | "day" | "week" = "day",
  ): Promise<{
    totalProcessed: number;
    successful: number;
    failed: number;
    duplicates: number;
    averageProcessingTime: number;
  }> {
    const now = new Date();
    let startDate = new Date();

    switch (timeframe) {
      case "hour":
        startDate.setHours(now.getHours() - 1);
        break;
      case "day":
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
    }

    // This would require more complex queries - simplified for now
    const totalProcessed = await this.db
      .select({ count: sql`count(*)` })
      .from(adfEmailQueue)
      .where(
        and(
          eq(adfEmailQueue.processingStatus, "processed"),
          sql`${adfEmailQueue.processedAt} >= ${startDate}`,
        ),
      );

    return {
      totalProcessed: totalProcessed[0]?.count || 0,
      successful: 0, // Would need additional queries
      failed: 0,
      duplicates: 0,
      averageProcessingTime: 0,
    };
  }

  /**
   * Retry failed processing
   */
  async retryFailedProcessing(queueId: number): Promise<LeadProcessingResult> {
    // Get email from queue
    const queueEntry = await this.db.query.adfEmailQueue.findFirst({
      where: eq(adfEmailQueue.id, queueId),
    });

    if (!queueEntry) {
      throw new Error(`Queue entry ${queueId} not found`);
    }

    if (queueEntry.processingAttempts >= queueEntry.maxRetries) {
      throw new Error(
        `Maximum retry attempts (${queueEntry.maxRetries}) exceeded for queue entry ${queueId}`,
      );
    }

    // Update attempts count
    await this.db
      .update(adfEmailQueue)
      .set({
        processingAttempts: queueEntry.processingAttempts + 1,
        processingStatus: "pending",
      })
      .where(eq(adfEmailQueue.id, queueId));

    // Retry processing
    const input: LeadProcessingInput = {
      emailMessageId: queueEntry.emailMessageId,
      emailSubject: queueEntry.emailSubject,
      emailFrom: queueEntry.emailFrom,
      emailTo: queueEntry.emailTo,
      emailDate: queueEntry.emailDate,
      adfXmlContent: queueEntry.adfXmlContent || "",
      rawEmailContent: queueEntry.rawEmailContent || "",
      attachmentInfo: (queueEntry.attachmentInfo as any) || [],
    };

    return this.processAdfLead(input);
  }
}

// Export the class as default
export default AdfLeadProcessor;

// Export a singleton instance for easy use
export const adfLeadProcessor = new AdfLeadProcessor();
