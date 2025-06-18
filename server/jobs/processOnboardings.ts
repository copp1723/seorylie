/**
 * Scheduled job to process pending onboardings
 * Runs every 5 minutes to create tasks for new submissions
 */

import cron from 'node-cron';
import { processPendingOnboardings } from '../services/onboardingTaskCreator';

// Run every 5 minutes
const CRON_SCHEDULE = '*/5 * * * *';

export function startOnboardingProcessor(): void {
  console.log('Starting onboarding processor job...');

  // Process immediately on startup
  processPendingOnboardings()
    .then(result => {
      console.log(`Initial onboarding processing: ${result.processed} processed, ${result.failed} failed`);
    })
    .catch(error => {
      console.error('Initial onboarding processing failed:', error);
    });

  // Schedule recurring job
  const job = cron.schedule(CRON_SCHEDULE, async () => {
    console.log('Running scheduled onboarding processing...');
    try {
      const result = await processPendingOnboardings();
      if (result.processed > 0 || result.failed > 0) {
        console.log(`Onboarding processing complete: ${result.processed} processed, ${result.failed} failed`);
      }
    } catch (error) {
      console.error('Scheduled onboarding processing failed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Stopping onboarding processor...');
    job.stop();
  });

  process.on('SIGTERM', () => {
    console.log('Stopping onboarding processor...');
    job.stop();
  });

  console.log(`Onboarding processor scheduled to run ${CRON_SCHEDULE}`);
}