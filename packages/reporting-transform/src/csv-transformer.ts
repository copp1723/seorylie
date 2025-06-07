/**
 * @file CSV Transformer for white-labeling vendor reports
 * @description Transforms CSV files by removing vendor branding and replacing with white-label Rylie SEO branding
 */

import { S3 } from "aws-sdk";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";
import csvParser from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
});

/**
 * Configuration options for CSV transformation
 */
export interface CSVTransformOptions {
  // Input options
  inputCsvBuffer?: Buffer;
  inputCsvPath?: string;
  inputCsvS3Key?: string;

  // Output options
  outputCsvPath?: string;
  outputCsvS3Key?: string;
  outputCsvS3Bucket?: string;

  // Branding options
  whiteLabelName: string;
  whiteLabelDomain: string;
  whiteLabelEmail: string;
  whiteLabelPhone?: string;
  whiteLabelAddress?: string;

  // Vendor detection options
  vendorNames: string[];
  vendorDomains: string[];
  vendorEmails: string[];
  vendorPhones?: string[];

  // Column mapping
  columnMappings?: Record<string, string>;

  // Processing options
  sanitizeHeaders?: boolean;
  sanitizeData?: boolean;
  addWhiteLabelColumns?: boolean;
  addWhiteLabelFooter?: boolean;
  addWhiteLabelHeader?: boolean;
  tempDir?: string;

  // CSV options
  delimiter?: string;
  quoteChar?: string;
  escapeChar?: string;
  encoding?: BufferEncoding;
}

/**
 * Result of CSV transformation
 */
export interface CSVTransformResult {
  success: boolean;
  transformedCsvBuffer?: Buffer;
  transformedCsvPath?: string;
  transformedCsvS3Url?: string;
  transformedCsvS3Key?: string;
  detectedVendorReferences: string[];
  replacedValueCount: number;
  replacedHeaderCount: number;
  rowCount: number;
  columnCount: number;
  error?: Error;
}

/**
 * CSV Transformer class for white-labeling vendor reports
 */
export class CSVTransformer {
  private s3: S3;
  private options: CSVTransformOptions;
  private tempDir: string;
  private transformId: string;

  /**
   * Create a new CSVTransformer instance
   * @param options Configuration options for CSV transformation
   */
  constructor(options: CSVTransformOptions) {
    // Set default options first, then override with provided options
    const defaultOptions = {
      whiteLabelName: "Rylie SEO",
      whiteLabelDomain: "rylie-seo.com",
      whiteLabelEmail: "support@rylie-seo.com",
      vendorNames: [
        "CustomerScout",
        "Customer Scout",
        "CS SEO",
        "CS Analytics",
      ],
      vendorDomains: ["customerscout.com", "cs-seo.com", "cs-analytics.com"],
      vendorEmails: [
        "support@customerscout.com",
        "reports@cs-seo.com",
        "analytics@cs-analytics.com",
      ],
      sanitizeHeaders: true,
      sanitizeData: true,
      addWhiteLabelColumns: true,
      addWhiteLabelFooter: false,
      addWhiteLabelHeader: false,
      tempDir: path.join(process.cwd(), "tmp"),
      delimiter: ",",
      quoteChar: '"',
      escapeChar: '"',
      encoding: "utf8" as BufferEncoding,
    };

    this.options = {
      ...defaultOptions,
      ...options,
    };

    // Initialize S3 client
    this.s3 = new S3({
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });

    // Generate unique ID for this transformation
    this.transformId = uuidv4();

    // Set temp directory
    this.tempDir = this.options.tempDir || path.join(process.cwd(), "tmp");
  }

  /**
   * Transform a CSV to remove vendor branding and apply white-label branding
   * @returns Promise with transformation result
   */
  public async transform(): Promise<CSVTransformResult> {
    const result: CSVTransformResult = {
      success: false,
      detectedVendorReferences: [],
      replacedValueCount: 0,
      replacedHeaderCount: 0,
      rowCount: 0,
      columnCount: 0,
    };

    try {
      // Ensure temp directory exists
      await this.ensureTempDir();

      // Get input CSV buffer
      const inputCsvBuffer = await this.getInputCsvBuffer();

      // Process the CSV
      const { transformedCsvBuffer, stats } = await this.processCsv(
        inputCsvBuffer,
        result,
      );

      // Update result with stats
      result.rowCount = stats.rowCount;
      result.columnCount = stats.columnCount;

      // Handle output
      await this.handleOutput(transformedCsvBuffer, result);

      // Clean up temporary files
      await this.cleanup();

      result.success = true;
      return result;
    } catch (error) {
      logger.error(
        { error, transformId: this.transformId },
        "Error transforming CSV",
      );
      result.error = error as Error;
      return result;
    }
  }

  /**
   * Process the CSV data to apply white-labeling
   * @param inputCsvBuffer Input CSV buffer
   * @param result Result object to update with transformation details
   * @returns Processed CSV buffer and stats
   */
  private async processCsv(
    inputCsvBuffer: Buffer,
    result: CSVTransformResult,
  ): Promise<{
    transformedCsvBuffer: Buffer;
    stats: { rowCount: number; columnCount: number };
  }> {
    // Create a temporary file path for processing
    const tempInputPath = path.join(
      this.tempDir,
      `${this.transformId}_input.csv`,
    );
    const tempOutputPath = path.join(
      this.tempDir,
      `${this.transformId}_output.csv`,
    );

    // Write input buffer to temporary file
    await writeFile(tempInputPath, inputCsvBuffer);

    // Parse CSV to get headers and data
    const rows: Record<string, string>[] = [];
    let headers: string[] = [];
    let rowCount = 0;

    // Read CSV file
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(tempInputPath, { encoding: this.options.encoding })
        .pipe(
          csvParser({
            separator: this.options.delimiter,
            headers: true,
            skipLines: 0,
          }),
        )
        .on("headers", (headerList: string[]) => {
          headers = headerList;

          // Sanitize headers if enabled
          if (this.options.sanitizeHeaders) {
            headers = this.sanitizeHeaders(headerList, result);
          }
        })
        .on("data", (row: Record<string, string>) => {
          // Sanitize data if enabled
          if (this.options.sanitizeData) {
            row = this.sanitizeRowData(row, result);
          }

          rows.push(row);
          rowCount++;
        })
        .on("error", (error) => {
          reject(error);
        })
        .on("end", () => {
          resolve();
        });
    });

    // Add white-label columns if enabled
    if (this.options.addWhiteLabelColumns) {
      headers.push("Provided By");
      headers.push("Contact");

      // Add white-label info to each row
      rows.forEach((row) => {
        row["Provided By"] = this.options.whiteLabelName;
        row["Contact"] = this.options.whiteLabelEmail;
      });
    }

    // Apply column mappings if provided
    if (this.options.columnMappings) {
      headers = headers.map(
        (header) => this.options.columnMappings?.[header] || header,
      );
    }

    // Write transformed CSV
    const csvWriter = createObjectCsvWriter({
      path: tempOutputPath,
      header: headers.map((header) => ({ id: header, title: header })),
      fieldDelimiter: this.options.delimiter,
      encoding: this.options.encoding as BufferEncoding,
    });

    await csvWriter.writeRecords(rows);

    // Read the transformed CSV file
    const transformedCsvBuffer = await readFile(tempOutputPath);

    // Return the transformed CSV buffer and stats
    return {
      transformedCsvBuffer,
      stats: {
        rowCount,
        columnCount: headers.length,
      },
    };
  }

  /**
   * Sanitize CSV headers to remove vendor references
   * @param headers Original CSV headers
   * @param result Result object to update with transformation details
   * @returns Sanitized headers
   */
  private sanitizeHeaders(
    headers: string[],
    result: CSVTransformResult,
  ): string[] {
    const sanitizedHeaders = headers.map((header) => {
      let sanitizedHeader = header;
      let replacedHeader = false;

      // Check for vendor names in header
      this.options.vendorNames.forEach((vendorName) => {
        if (header.includes(vendorName)) {
          sanitizedHeader = sanitizedHeader.replace(
            new RegExp(vendorName, "gi"),
            this.options.whiteLabelName,
          );
          result.detectedVendorReferences.push(
            `Header contains vendor name: ${vendorName}`,
          );
          replacedHeader = true;
        }
      });

      // Check for vendor domains in header
      this.options.vendorDomains.forEach((vendorDomain) => {
        if (header.includes(vendorDomain)) {
          sanitizedHeader = sanitizedHeader.replace(
            new RegExp(vendorDomain, "gi"),
            this.options.whiteLabelDomain,
          );
          result.detectedVendorReferences.push(
            `Header contains vendor domain: ${vendorDomain}`,
          );
          replacedHeader = true;
        }
      });

      // Increment replaced header count
      if (replacedHeader) {
        result.replacedHeaderCount++;
      }

      return sanitizedHeader;
    });

    return sanitizedHeaders;
  }

  /**
   * Sanitize row data to remove vendor references
   * @param row Row data
   * @param result Result object to update with transformation details
   * @returns Sanitized row data
   */
  private sanitizeRowData(
    row: Record<string, string>,
    result: CSVTransformResult,
  ): Record<string, string> {
    const sanitizedRow: Record<string, string> = {};

    // Process each cell in the row
    Object.entries(row).forEach(([key, value]) => {
      let sanitizedValue = value;
      let replacedValue = false;

      // Skip empty values
      if (!value) {
        sanitizedRow[key] = value;
        return;
      }

      // Check for vendor names
      this.options.vendorNames.forEach((vendorName) => {
        if (value.includes(vendorName)) {
          sanitizedValue = sanitizedValue.replace(
            new RegExp(vendorName, "gi"),
            this.options.whiteLabelName,
          );
          result.detectedVendorReferences.push(
            `Data contains vendor name: ${vendorName}`,
          );
          replacedValue = true;
        }
      });

      // Check for vendor domains
      this.options.vendorDomains.forEach((vendorDomain) => {
        if (value.includes(vendorDomain)) {
          sanitizedValue = sanitizedValue.replace(
            new RegExp(vendorDomain, "gi"),
            this.options.whiteLabelDomain,
          );
          result.detectedVendorReferences.push(
            `Data contains vendor domain: ${vendorDomain}`,
          );
          replacedValue = true;
        }
      });

      // Check for vendor emails
      this.options.vendorEmails.forEach((vendorEmail) => {
        if (value.includes(vendorEmail)) {
          sanitizedValue = sanitizedValue.replace(
            new RegExp(vendorEmail, "gi"),
            this.options.whiteLabelEmail,
          );
          result.detectedVendorReferences.push(
            `Data contains vendor email: ${vendorEmail}`,
          );
          replacedValue = true;
        }
      });

      // Check for vendor phones
      if (this.options.vendorPhones && this.options.whiteLabelPhone) {
        this.options.vendorPhones.forEach((vendorPhone) => {
          if (value.includes(vendorPhone)) {
            sanitizedValue = sanitizedValue.replace(
              new RegExp(vendorPhone, "gi"),
              this.options.whiteLabelPhone || "",
            );
            result.detectedVendorReferences.push(
              `Data contains vendor phone: ${vendorPhone}`,
            );
            replacedValue = true;
          }
        });
      }

      // Increment replaced value count
      if (replacedValue) {
        result.replacedValueCount++;
      }

      sanitizedRow[key] = sanitizedValue;
    });

    return sanitizedRow;
  }

  /**
   * Get input CSV buffer from file, S3, or direct buffer
   * @returns Buffer containing the input CSV
   */
  private async getInputCsvBuffer(): Promise<Buffer> {
    if (this.options.inputCsvBuffer) {
      return this.options.inputCsvBuffer;
    }

    if (this.options.inputCsvPath) {
      return await readFile(this.options.inputCsvPath);
    }

    if (this.options.inputCsvS3Key) {
      const s3Response = await this.s3
        .getObject({
          Bucket: process.env.S3_BUCKET_NAME || "rylie-seo-reports",
          Key: this.options.inputCsvS3Key,
        })
        .promise();

      if (!s3Response.Body) {
        throw new Error(
          `Failed to get CSV from S3: ${this.options.inputCsvS3Key}`,
        );
      }

      return s3Response.Body as Buffer;
    }

    throw new Error(
      "No input CSV provided. Please provide inputCsvBuffer, inputCsvPath, or inputCsvS3Key.",
    );
  }

  /**
   * Handle the output of the transformed CSV
   * @param transformedCsvBuffer Buffer containing the transformed CSV
   * @param result Result object to update with transformation details
   */
  private async handleOutput(
    transformedCsvBuffer: Buffer,
    result: CSVTransformResult,
  ): Promise<void> {
    // Set the transformed CSV buffer
    result.transformedCsvBuffer = transformedCsvBuffer;

    // Save to file if outputCsvPath is provided
    if (this.options.outputCsvPath) {
      await writeFile(this.options.outputCsvPath, transformedCsvBuffer);
      result.transformedCsvPath = this.options.outputCsvPath;
    }

    // Upload to S3 if outputCsvS3Key is provided
    if (this.options.outputCsvS3Key) {
      const s3Bucket =
        this.options.outputCsvS3Bucket ||
        process.env.S3_BUCKET_NAME ||
        "rylie-seo-reports";

      await this.s3
        .putObject({
          Bucket: s3Bucket,
          Key: this.options.outputCsvS3Key,
          Body: transformedCsvBuffer,
          ContentType: "text/csv",
          Metadata: {
            "x-amz-meta-white-label": this.options.whiteLabelName,
            "x-amz-meta-transform-id": this.transformId,
          },
        })
        .promise();

      // Generate S3 URL
      result.transformedCsvS3Key = this.options.outputCsvS3Key;
      result.transformedCsvS3Url = `https://${s3Bucket}.s3.amazonaws.com/${this.options.outputCsvS3Key}`;

      // If CloudFront is configured, use that URL instead
      if (process.env.CLOUDFRONT_DOMAIN) {
        result.transformedCsvS3Url = `https://${process.env.CLOUDFRONT_DOMAIN}/${this.options.outputCsvS3Key}`;
      }
    }
  }

  /**
   * Ensure temporary directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanup(): Promise<void> {
    // Clean up temporary files
    const tempInputPath = path.join(
      this.tempDir,
      `${this.transformId}_input.csv`,
    );
    const tempOutputPath = path.join(
      this.tempDir,
      `${this.transformId}_output.csv`,
    );

    try {
      await unlink(tempInputPath);
      await unlink(tempOutputPath);
    } catch (error) {
      // Log but don't fail if cleanup fails
      logger.warn(
        { error, transformId: this.transformId },
        "Error cleaning up temporary files",
      );
    }
  }
}

/**
 * Create a new CSVTransformer instance with the given options
 * @param options Configuration options for CSV transformation
 * @returns CSVTransformer instance
 */
export function createCSVTransformer(
  options: CSVTransformOptions,
): CSVTransformer {
  return new CSVTransformer(options);
}

export default {
  CSVTransformer,
  createCSVTransformer,
};
