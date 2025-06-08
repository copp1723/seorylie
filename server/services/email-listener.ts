/**
 * Email Listener Service
 *
 * This service handles incoming emails with TSV attachments containing
 * inventory updates from dealerships.
 */

import { processTsvInventory, processInventoryEmail } from "./inventory-import";
import { storage } from "../storage";
import { sendEmail, sendInventoryUpdateEmail } from "./email-service";
import fs from "fs";
import path from "path";
import os from "os";

// Configuration for email listening
interface EmailListenerConfig {
  enabled: boolean;
  checkIntervalMinutes: number;
  allowedSenders: string[];
  requiredSubjectKeywords: string[];
  allowedFileExtensions: string[];
  tempDir: string;
}

// Default configuration
const defaultConfig: EmailListenerConfig = {
  enabled: true,
  checkIntervalMinutes: 15,
  allowedSenders: [],
  requiredSubjectKeywords: ["inventory", "update"],
  allowedFileExtensions: [".tsv", ".txt"],
  tempDir: path.join(os.tmpdir(), "rylie-inventory-attachments"),
};

/**
 * Process an email with potential inventory attachment
 *
 * @param emailData Email data including sender, subject, and attachments
 * @returns Processing result
 */
export async function processIncomingEmail(emailData: {
  from: string;
  subject: string;
  date: Date;
  attachments: Array<{
    filename: string;
    content: Buffer | string;
    contentType: string;
  }>;
}) {
  try {
    console.log(
      `Processing email: "${emailData.subject}" from ${emailData.from}`,
    );

    // Validate email based on configuration
    if (!validateEmail(emailData)) {
      console.log("Email validation failed, skipping");
      return { success: false, error: "Email validation failed" };
    }

    // Find TSV attachments
    const tsvAttachments = emailData.attachments.filter((att) => {
      const ext = path.extname(att.filename).toLowerCase();
      return defaultConfig.allowedFileExtensions.includes(ext);
    });

    if (tsvAttachments.length === 0) {
      console.log("No valid TSV attachments found");
      return { success: false, error: "No TSV attachments found" };
    }

    // Process each attachment
    const results = [];
    for (const attachment of tsvAttachments) {
      // Determine which dealership this is for based on email sender or content
      // For now, we'll use the first dealership in the database as an example
      const dealerships = await storage.getDealerships();
      if (!dealerships || dealerships.length === 0) {
        throw new Error("No dealerships found in database");
      }

      const dealershipId = dealerships[0].id;
      let attachmentContent: string;

      if (Buffer.isBuffer(attachment.content)) {
        attachmentContent = attachment.content.toString("utf8");
      } else {
        attachmentContent = attachment.content;
      }

      // Create temp file for processing if needed
      const tempFilePath = path.join(
        defaultConfig.tempDir,
        `inventory_${Date.now()}_${attachment.filename}`,
      );

      // Ensure temp directory exists
      if (!fs.existsSync(defaultConfig.tempDir)) {
        fs.mkdirSync(defaultConfig.tempDir, { recursive: true });
      }

      // Process the inventory data
      const result = await processInventoryEmail(
        attachmentContent,
        dealershipId,
        tempFilePath,
      );

      results.push({
        filename: attachment.filename,
        ...result,
      });

      // Send confirmation email
      await sendInventoryUpdateEmail(
        emailData.from,
        `Inventory Update Processed: ${attachment.filename}`,
        result,
      );
    }

    return {
      success: true,
      results,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing inventory email:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Validate incoming email based on configuration
 */
function validateEmail(emailData: { from: string; subject: string }) {
  // Skip sender validation if no allowed senders are configured
  if (defaultConfig.allowedSenders.length > 0) {
    const isAllowedSender = defaultConfig.allowedSenders.some((sender) =>
      emailData.from.toLowerCase().includes(sender.toLowerCase()),
    );

    if (!isAllowedSender) {
      console.log(`Sender ${emailData.from} not in allowed list`);
      return false;
    }
  }

  // Check if subject contains required keywords
  const subjectLower = emailData.subject.toLowerCase();
  const hasRequiredKeyword = defaultConfig.requiredSubjectKeywords.some(
    (keyword) => subjectLower.includes(keyword.toLowerCase()),
  );

  if (!hasRequiredKeyword) {
    console.log(
      `Subject "${emailData.subject}" does not contain required keywords`,
    );
    return false;
  }

  return true;
}

// This function was replaced with sendInventoryUpdateEmail from the email service

/**
 * Example function to simulate incoming email for testing purposes
 * In a real implementation, this would be replaced by an actual
 * email server listener or webhook handler
 */
export function simulateIncomingEmail(
  from: string,
  subject: string,
  attachmentFilePath: string,
) {
  const attachment = {
    filename: path.basename(attachmentFilePath),
    content: fs.readFileSync(attachmentFilePath, "utf8"),
    contentType: "text/tab-separated-values",
  };

  return processIncomingEmail({
    from,
    subject,
    date: new Date(),
    attachments: [attachment],
  });
}

// Initialize the email listener
// In a real implementation, this would connect to an email service
export function initializeEmailListener(config?: Partial<EmailListenerConfig>) {
  // Merge provided config with defaults
  const mergedConfig = { ...defaultConfig, ...config };

  console.log("Email listener initialized with configuration:", mergedConfig);

  // In a real implementation, this would start the email polling or webhook listener
  console.log(
    `Email listener would check for new emails every ${mergedConfig.checkIntervalMinutes} minutes`,
  );

  return {
    config: mergedConfig,
    processIncomingEmail,
    simulateIncomingEmail,
  };
}
