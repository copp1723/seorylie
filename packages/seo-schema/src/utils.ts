/**
 * @file Shared utilities for Rylie SEO packages
 * @description Common utilities, configurations, and helpers to reduce code duplication
 */

import { S3 } from "aws-sdk";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import pino from "pino";
import { v4 as uuidv4 } from "uuid";

// Promisify fs functions - shared across packages
export const fsUtils = {
  readFile: promisify(fs.readFile),
  writeFile: promisify(fs.writeFile),
  mkdir: promisify(fs.mkdir),
  unlink: promisify(fs.unlink),
};

/**
 * Create a standardized logger instance
 * @param level Log level (default: 'info')
 * @returns Configured pino logger
 */
export function createLogger(level: string = process.env.LOG_LEVEL || "info") {
  return pino({
    level,
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
      },
    },
  });
}

/**
 * Create a standardized S3 client
 * @param region AWS region (default: 'us-east-1')
 * @returns Configured S3 client
 */
export function createS3Client(region: string = process.env.AWS_REGION || "us-east-1") {
  return new S3({
    region,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  });
}

/**
 * White-label configuration constants
 */
export const WHITE_LABEL_CONFIG = {
  name: "Rylie SEO",
  domain: "rylie-seo.com",
  email: "support@rylie-seo.com",
  colors: {
    primary: "#4A90E2",
    secondary: "#50E3C2",
  },
  defaultTempDir: path.join(process.cwd(), "tmp"),
  defaultS3Bucket: "rylie-seo-reports",
} as const;

/**
 * Vendor detection configuration
 */
export const VENDOR_CONFIG = {
  names: ["CustomerScout", "Customer Scout", "CS SEO", "CS Analytics"] as string[],
  domains: ["customerscout.com", "cs-seo.com", "cs-analytics.com"] as string[],
  emails: [
    "support@customerscout.com",
    "reports@cs-seo.com",
    "analytics@cs-analytics.com",
  ] as string[],
  logoPatterns: ["cs_logo", "customerscout_logo", "cs-logo"] as string[],
};

/**
 * Common transformation options interface
 */
export interface BaseTransformOptions {
  // Input options
  inputBuffer?: Buffer;
  inputPath?: string;
  inputS3Key?: string;
  
  // Output options
  outputPath?: string;
  outputS3Key?: string;
  outputS3Bucket?: string;
  
  // Branding options
  whiteLabelName?: string;
  whiteLabelDomain?: string;
  whiteLabelEmail?: string;
  
  // Processing options
  tempDir?: string;
}

/**
 * Common transformation result interface
 */
export interface BaseTransformResult {
  success: boolean;
  transformedBuffer?: Buffer;
  transformedPath?: string;
  transformedS3Url?: string;
  transformedS3Key?: string;
  detectedVendorReferences: string[];
  error?: Error;
}

/**
 * Generic input buffer retrieval utility
 * @param options Input options
 * @param s3Client S3 client instance
 * @param fileType File type for error messages
 * @returns Buffer containing the input file
 */
export async function getInputBuffer(
  options: {
    inputBuffer?: Buffer;
    inputPath?: string;
    inputS3Key?: string;
  },
  s3Client: S3,
  fileType: string = "file"
): Promise<Buffer> {
  if (options.inputBuffer) {
    return options.inputBuffer;
  }

  if (options.inputPath) {
    return await fsUtils.readFile(options.inputPath);
  }

  if (options.inputS3Key) {
    const s3Response = await s3Client
      .getObject({
        Bucket: process.env.S3_BUCKET_NAME || WHITE_LABEL_CONFIG.defaultS3Bucket,
        Key: options.inputS3Key,
      })
      .promise();

    if (!s3Response.Body) {
      throw new Error(`Failed to get ${fileType} from S3: ${options.inputS3Key}`);
    }

    return s3Response.Body as Buffer;
  }

  throw new Error(
    `No input ${fileType} provided. Please provide inputBuffer, inputPath, or inputS3Key.`
  );
}

/**
 * Generate a unique transformation ID
 * @returns UUID string
 */
export function generateTransformId(): string {
  return uuidv4();
}

/**
 * Ensure directory exists
 * @param dirPath Directory path to create
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fsUtils.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
    if ((error as any).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Common date range utility for analytics
 * @param dateRange Date range type
 * @param customStartDate Custom start date
 * @param customEndDate Custom end date
 * @returns Start and end dates
 */
export function getDateRange(
  dateRange: "last7days" | "last30days" | "last90days" | "custom",
  customStartDate?: string,
  customEndDate?: string
): { startDate: string; endDate: string } {
  const today = new Date();
  const formatDate = (date: Date) => date.toISOString().split("T")[0];

  switch (dateRange) {
    case "last7days":
      return {
        startDate: formatDate(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
        endDate: formatDate(today),
      };
    case "last30days":
      return {
        startDate: formatDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
        endDate: formatDate(today),
      };
    case "last90days":
      return {
        startDate: formatDate(new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000)),
        endDate: formatDate(today),
      };
    case "custom":
      if (!customStartDate || !customEndDate) {
        throw new Error("Custom date range requires both startDate and endDate");
      }
      return {
        startDate: customStartDate,
        endDate: customEndDate,
      };
    default:
      throw new Error(`Unsupported date range: ${dateRange}`);
  }
}
