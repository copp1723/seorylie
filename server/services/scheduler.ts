/**
 * Scheduler service for Rylie AI platform
 *
 * This module manages scheduled tasks using a simple interval-based approach
 * with a fallback mechanism when cron or sophisticated schedulers are unavailable
 */
import { queueReportGeneration } from './queue';
import logger from '../utils/logger';
import db, { executeQuery } from "../db";
import { dealerships, reportSchedules } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Scheduler state
const scheduledJobs = new Map<string, NodeJS.Timeout>();

// Default intervals (in milliseconds)
const DEFAULT_INTERVALS = {
  DAILY_REPORTS: 24 * 60 * 60 * 1000, // 24 hours
  WEEKLY_REPORTS: 7 * 24 * 60 * 60 * 1000, // 7 days
  SYSTEM_HEALTH: 15 * 60 * 1000, // 15 minutes
  METRICS_ROLLUP: 60 * 60 * 1000, // 1 hour
};

/**
 * Schedule a report to be generated on a recurring basis
 * @param dealershipId Dealership ID
 * @param reportType Report type
 * @param interval Interval in milliseconds
 * @param initialDelay Initial delay in milliseconds
 */
export const scheduleRecurringReport = (
  dealershipId: number,
  reportType: 'daily' | 'weekly',
  interval = reportType === 'daily' ? DEFAULT_INTERVALS.DAILY_REPORTS : DEFAULT_INTERVALS.WEEKLY_REPORTS,
  initialDelay = 0
) => {
  const jobId = `report_${reportType}_${dealershipId}`;

  // Cancel existing job with the same ID
  if (scheduledJobs.has(jobId)) {
    clearInterval(scheduledJobs.get(jobId));
    scheduledJobs.delete(jobId);
  }

  // Schedule initial job after delay
  const timeoutId = setTimeout(() => {
    // Queue the report generation
    queueReportGeneration({
      dealershipId,
      reportType,
    }).then((jobId) => {
      logger.info(`Queued ${reportType} report for dealership ${dealershipId}`, { jobId });
    }).catch((error) => {
      logger.error(`Failed to queue ${reportType} report for dealership ${dealershipId}`, error);
    });

    // Set up recurring schedule
    const intervalId = setInterval(() => {
      queueReportGeneration({
        dealershipId,
        reportType,
      }).then((jobId) => {
        logger.info(`Queued recurring ${reportType} report for dealership ${dealershipId}`, { jobId });
      }).catch((error) => {
        logger.error(`Failed to queue recurring ${reportType} report for dealership ${dealershipId}`, error);
      });
    }, interval);

    // Store the interval ID
    scheduledJobs.set(jobId, intervalId);
  }, initialDelay);

  // Store the timeout ID until it's replaced by the interval
  scheduledJobs.set(jobId, timeoutId);

  logger.info(`Scheduled recurring ${reportType} report for dealership ${dealershipId}`);

  return jobId;
};

/**
 * Cancel a scheduled report
 * @param jobId Job ID
 */
export const cancelScheduledReport = (jobId: string) => {
  if (scheduledJobs.has(jobId)) {
    clearInterval(scheduledJobs.get(jobId));
    scheduledJobs.delete(jobId);
    logger.info(`Canceled scheduled report ${jobId}`);
    return true;
  }
  logger.warn(`Attempted to cancel non-existent report ${jobId}`);
  return false;
};

/**
 * Initialize scheduled reports for all dealerships
 */
export const initializeReportSchedules = async () => {
  try {
    // First, ensure the report_schedules table exists and has the required structure
    try {
      await executeQuery(async () => {
        // Try to query the table to see if it exists and has the right structure
        const testQuery = await db.select().from(reportSchedules).limit(1);
        return testQuery;
      });
    } catch (tableError: any) {
      if (tableError.message && tableError.message.includes('does not exist')) {
        logger.warn('report_schedules table does not exist, creating it...');

        // Create the table if it doesn't exist
        await executeQuery(async () => {
          return await db.execute(`
            CREATE TABLE IF NOT EXISTS report_schedules (
              id SERIAL PRIMARY KEY,
              active BOOLEAN NOT NULL DEFAULT true,
              created_at TIMESTAMP DEFAULT NOW(),
              updated_at TIMESTAMP DEFAULT NOW()
            );
          `);
        });

        logger.info('Created report_schedules table');
      } else if (tableError.message && tableError.message.includes('column') && tableError.message.includes('does not exist')) {
        logger.warn('report_schedules table exists but missing columns, updating schema...');

        // Add missing columns
        await executeQuery(async () => {
          return await db.execute(`
            ALTER TABLE report_schedules
            ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY,
            ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
          `);
        });

        logger.info('Updated report_schedules table schema');
      } else {
        // Re-throw if it's a different error
        throw tableError;
      }
    }

    // Get all dealerships
    const allDealerships = await executeQuery(async () => {
      return await db.select().from(dealerships);
    });

    // Schedule reports for each dealership at staggered times
    allDealerships.forEach((dealership, index) => {
      // Stagger initial reports to prevent all reports running at once
      const initialDailyDelay = index * 5 * 60 * 1000; // 5 minutes stagger
      const initialWeeklyDelay = index * 10 * 60 * 1000; // 10 minutes stagger

      // Schedule daily reports
      scheduleRecurringReport(dealership.id, 'daily', DEFAULT_INTERVALS.DAILY_REPORTS, initialDailyDelay);

      // Schedule weekly reports
      scheduleRecurringReport(dealership.id, 'weekly', DEFAULT_INTERVALS.WEEKLY_REPORTS, initialWeeklyDelay);
    });

    logger.info(`Initialized report schedules for ${allDealerships.length} dealerships`);
  } catch (error) {
    logger.error('Failed to initialize report schedules', error);
    // Don't throw the error to prevent application startup failure
  }
};

/**
 * Schedule a one-time report
 * @param dealershipId Dealership ID
 * @param reportType Report type
 * @param delay Delay in milliseconds
 */
export const scheduleOneTimeReport = (
  dealershipId: number,
  reportType: string,
  delay = 0
) => {
  const jobId = `one_time_report_${reportType}_${dealershipId}_${Date.now()}`;

  const timeoutId = setTimeout(() => {
    queueReportGeneration({
      dealershipId,
      reportType,
      oneTime: true,
    }).then((jobId) => {
      logger.info(`Queued one-time ${reportType} report for dealership ${dealershipId}`, { jobId });
    }).catch((error) => {
      logger.error(`Failed to queue one-time ${reportType} report for dealership ${dealershipId}`, error);
    });

    // Remove job from map once executed
    scheduledJobs.delete(jobId);
  }, delay);

  scheduledJobs.set(jobId, timeoutId);

  logger.info(`Scheduled one-time ${reportType} report for dealership ${dealershipId}`);

  return jobId;
};

/**
 * Clean up all scheduled jobs
 */
export const shutdownScheduler = () => {
  scheduledJobs.forEach((timeoutId, jobId) => {
    clearInterval(timeoutId);
    logger.info(`Canceled scheduled job ${jobId} during shutdown`);
  });

  scheduledJobs.clear();

  logger.info('Scheduler shutdown complete');
};

// Add scheduler to graceful shutdown process
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    shutdownScheduler();
  });

  process.on('SIGINT', () => {
    shutdownScheduler();
  });
}

// Email schedule settings interface
export interface EmailScheduleSettings {
  id: string;
  dealershipId: number;
  recipientEmails: string[];
  frequency: 'daily' | 'weekly';
  dayOfWeek?: number;
  timeOfDay: string;
  reportType: string;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

// Store for email schedules
const emailSchedules = new Map<string, EmailScheduleSettings>();

/**
 * Schedule an email report
 * @param settings Email schedule settings
 * @returns Schedule ID
 */
export const scheduleEmailReport = (settings: Omit<EmailScheduleSettings, 'id'>): string => {
  const id = `email_${settings.reportType}_${settings.dealershipId}_${Date.now()}`;

  // Calculate next run time
  const nextRun = calculateNextRunTime(settings.frequency, settings.dayOfWeek, settings.timeOfDay);

  // Store schedule
  emailSchedules.set(id, {
    ...settings,
    id,
    nextRun,
    enabled: true
  });

  // Calculate delay until next run
  const delay = nextRun.getTime() - Date.now();

  // Schedule one-time report
  if (delay > 0) {
    scheduleOneTimeReport(settings.dealershipId, settings.reportType, delay);
  }

  logger.info(`Scheduled email report: ${settings.reportType} for dealership ${settings.dealershipId}`, {
    id,
    nextRun: nextRun.toISOString()
  });

  return id;
};

/**
 * Remove a scheduled report
 * @param id Schedule ID
 * @returns Whether the schedule was removed
 */
export const removeScheduledReport = (id: string): boolean => {
  const removed = emailSchedules.delete(id);

  if (removed) {
    // Also cancel any pending job
    cancelScheduledReport(id);
    logger.info(`Removed scheduled report: ${id}`);
  } else {
    logger.warn(`Attempted to remove non-existent schedule: ${id}`);
  }

  return removed;
};

/**
 * Get all scheduled reports
 * @param dealershipId Optional dealership ID filter
 * @returns Array of scheduled reports
 */
export const getScheduledReports = (dealershipId?: number): EmailScheduleSettings[] => {
  const schedules = Array.from(emailSchedules.values());

  if (dealershipId !== undefined) {
    return schedules.filter(schedule => schedule.dealershipId === dealershipId);
  }

  return schedules;
};

/**
 * Calculate the next run time for a schedule
 * @param frequency Schedule frequency
 * @param dayOfWeek Day of week (0-6, 0 is Sunday)
 * @param timeOfDay Time of day (HH:MM)
 * @returns Next run date
 */
const calculateNextRunTime = (
  frequency: 'daily' | 'weekly',
  dayOfWeek?: number,
  timeOfDay: string = '00:00'
): Date => {
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const now = new Date();
  const nextRun = new Date();

  // Set time
  nextRun.setHours(hours, minutes, 0, 0);

  // If the time is in the past, add a day
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  // For weekly schedules, adjust to the specified day
  if (frequency === 'weekly' && dayOfWeek !== undefined) {
    const currentDay = nextRun.getDay();
    let daysToAdd = dayOfWeek - currentDay;

    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }

    nextRun.setDate(nextRun.getDate() + daysToAdd);
  }

  return nextRun;
};

export default {
  scheduleRecurringReport,
  cancelScheduledReport,
  scheduleOneTimeReport,
  initializeReportSchedules,
  shutdownScheduler,
  scheduleEmailReport,
  removeScheduledReport,
  getScheduledReports
};