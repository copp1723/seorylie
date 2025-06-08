/**
 * Queue consumer registration for Rylie AI background jobs
 *
 * This module sets up consumers for the various queue types in the system
 */
import { processEmailQueue, processReportQueue } from "./queue";
import logger from "../utils/logger";
import * as emailService from "./email-service";

/**
 * Initialize all queue processors
 */
export async function initializeQueueConsumers() {
  // Process email queue jobs
  await processEmailQueue(async (jobData: any) => {
    const { type, data } = jobData;

    logger.info(`Processing email job of type: ${type}`);

    try {
      switch (type) {
        case "welcome":
          await emailService.sendWelcomeEmail(data.email, data.name);
          break;

        case "report":
          await emailService.sendReportEmail(
            data.email,
            data.reportId,
            data.reportType,
          );
          break;

        case "notification":
          await emailService.sendNotificationEmail(
            data.email,
            data.subject,
            data.message,
          );
          break;

        case "password_reset":
          await emailService.sendPasswordResetEmail(
            data.email,
            data.resetToken,
          );
          break;

        case "handover":
          await emailService.sendHandoverEmail(data.email, data.handoverData);
          break;

        default:
          throw new Error(`Unknown email job type: ${type}`);
      }

      return { success: true };
    } catch (error) {
      logger.error(`Failed to process email job of type: ${type}`, error);
      throw error; // Re-throw to trigger Bull retry mechanism
    }
  });

  // Process report queue jobs
  await processReportQueue(async (jobData: any) => {
    const { type, data } = jobData;

    logger.info(`Processing report job of type: ${type}`);

    try {
      switch (type) {
        case "daily_summary":
          // Implementation would go here (mocked for now)
          logger.info(
            `Generated daily summary report for dealership ${data.dealershipId}`,
          );
          break;

        case "weekly_analytics":
          // Implementation would go here (mocked for now)
          logger.info(
            `Generated weekly analytics report for dealership ${data.dealershipId}`,
          );
          break;

        case "conversation_metrics":
          // Implementation would go here (mocked for now)
          logger.info(
            `Generated conversation metrics report for dealership ${data.dealershipId}`,
          );
          break;

        default:
          throw new Error(`Unknown report job type: ${type}`);
      }

      return { success: true };
    } catch (error) {
      logger.error(`Failed to process report job of type: ${type}`, error);
      throw error; // Re-throw to trigger Bull retry mechanism
    }
  });

  logger.info("Queue consumers initialized");
}

export default { initializeQueueConsumers };
