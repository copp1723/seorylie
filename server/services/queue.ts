/**
 * Queue Service for Rylie AI platform
 * 
 * This service manages background job processing using Bull queue with Redis
 * and provides a memory fallback for development
 */
import Bull from 'bull';
import { getRedisClient, isRedisAvailable } from '../utils/redis-config';
import logger from '../utils/logger';

// Queue names
export const EMAIL_QUEUE = 'email';
export const REPORT_QUEUE = 'report';

// Queue instances
let emailQueue: Bull.Queue | null = null;
let reportQueue: Bull.Queue | null = null;

// In-memory queue fallbacks (only for development)
const inMemoryQueues = new Map<string, any[]>();
const inMemoryProcessors = new Map<string, Function>();

// Queue options
const queueOptions: Bull.QueueOptions = {
  // Default settings
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 5000
  },
  removeOnComplete: 100, // Keep 100 completed jobs
  removeOnFail: 200 // Keep 200 failed jobs
};

/**
 * Initialize the Bull queue with Redis
 * @param queueName Queue name
 * @returns Bull Queue or null if Redis is unavailable
 */
const initializeQueue = async (queueName: string): Promise<Bull.Queue | null> => {
  try {
    if (await isRedisAvailable()) {
      const redisClient = getRedisClient();
      // Create a Redis client instance for Bull
      const queue = new Bull(queueName, {
        ...queueOptions,
        createClient: () => redisClient
      });
      
      // Set up event handlers
      queue.on('completed', job => {
        logger.info(`Job completed: ${queueName}`, { jobId: job.id });
      });
      
      queue.on('failed', (job, error) => {
        logger.error(`Job failed: ${queueName}`, error, { jobId: job?.id });
      });
      
      queue.on('stalled', jobId => {
        logger.warn(`Job stalled: ${queueName}`, { jobId });
      });
      
      logger.info(`Queue initialized: ${queueName}`);
      return queue;
    } else {
      logger.warn(`Redis unavailable, using in-memory fallback for ${queueName} queue`);
      return null;
    }
  } catch (error) {
    logger.error(`Error initializing queue: ${queueName}`, error);
    return null;
  }
};

/**
 * Process jobs in the email queue
 * @param processor Function to process email jobs
 */
export const processEmailQueue = async (processor: (job: any) => Promise<any>) => {
  if (!emailQueue) {
    emailQueue = await initializeQueue(EMAIL_QUEUE);
  }
  
  if (emailQueue) {
    emailQueue.process(async (job) => {
      logger.info(`Processing email job`, { jobId: job.id });
      return processor(job.data);
    });
    logger.info('Email queue processor registered');
  } else {
    // In-memory fallback for development
    inMemoryProcessors.set(EMAIL_QUEUE, processor);
    logger.info('Email queue processor registered (in-memory)');
  }
};

/**
 * Process jobs in the report queue
 * @param processor Function to process report jobs
 */
export const processReportQueue = async (processor: (job: any) => Promise<any>) => {
  if (!reportQueue) {
    reportQueue = await initializeQueue(REPORT_QUEUE);
  }
  
  if (reportQueue) {
    reportQueue.process(async (job) => {
      logger.info(`Processing report job`, { jobId: job.id });
      return processor(job.data);
    });
    logger.info('Report queue processor registered');
  } else {
    // In-memory fallback for development
    inMemoryProcessors.set(REPORT_QUEUE, processor);
    logger.info('Report queue processor registered (in-memory)');
  }
};

/**
 * Add a job to the email queue
 * @param data Job data
 * @param options Job options
 * @returns Job ID
 */
export const addEmailJob = async (data: any, options: Bull.JobOptions = {}): Promise<string> => {
  if (!emailQueue) {
    emailQueue = await initializeQueue(EMAIL_QUEUE);
  }
  
  if (emailQueue) {
    const job = await emailQueue.add(data, options);
    logger.info('Email job added to queue', { jobId: job.id });
    return job.id.toString();
  } else {
    // In-memory fallback for development
    const jobId = Date.now().toString();
    
    if (!inMemoryQueues.has(EMAIL_QUEUE)) {
      inMemoryQueues.set(EMAIL_QUEUE, []);
    }
    
    const queue = inMemoryQueues.get(EMAIL_QUEUE)!;
    queue.push({ id: jobId, data });
    
    // Process immediately in memory
    const processor = inMemoryProcessors.get(EMAIL_QUEUE);
    if (processor) {
      setTimeout(async () => {
        try {
          logger.info(`Processing in-memory email job`, { jobId });
          await processor(data);
          logger.info(`In-memory email job completed`, { jobId });
        } catch (error) {
          logger.error(`In-memory email job failed`, error, { jobId });
        }
      }, 100);
    }
    
    logger.info('Email job added to in-memory queue', { jobId });
    return jobId;
  }
};

/**
 * Add a job to the report queue
 * @param data Job data
 * @param options Job options
 * @returns Job ID
 */
export const addReportJob = async (data: any, options: Bull.JobOptions = {}): Promise<string> => {
  if (!reportQueue) {
    reportQueue = await initializeQueue(REPORT_QUEUE);
  }
  
  if (reportQueue) {
    const job = await reportQueue.add(data, options);
    logger.info('Report job added to queue', { jobId: job.id });
    return job.id.toString();
  } else {
    // In-memory fallback for development
    const jobId = Date.now().toString();
    
    if (!inMemoryQueues.has(REPORT_QUEUE)) {
      inMemoryQueues.set(REPORT_QUEUE, []);
    }
    
    const queue = inMemoryQueues.get(REPORT_QUEUE)!;
    queue.push({ id: jobId, data });
    
    // Process immediately in memory
    const processor = inMemoryProcessors.get(REPORT_QUEUE);
    if (processor) {
      setTimeout(async () => {
        try {
          logger.info(`Processing in-memory report job`, { jobId });
          await processor(data);
          logger.info(`In-memory report job completed`, { jobId });
        } catch (error) {
          logger.error(`In-memory report job failed`, error, { jobId });
        }
      }, 100);
    }
    
    logger.info('Report job added to in-memory queue', { jobId });
    return jobId;
  }
};

/**
 * Get queue statistics
 * @returns Queue statistics
 */
export const getQueueStats = async () => {
  const stats: Record<string, any> = {};
  
  if (await isRedisAvailable()) {
    if (emailQueue) {
      const jobCounts = await emailQueue.getJobCounts();
      stats.email = jobCounts;
    }
    
    if (reportQueue) {
      const jobCounts = await reportQueue.getJobCounts();
      stats.report = jobCounts;
    }
  } else {
    // In-memory queue stats
    stats.email = {
      waiting: inMemoryQueues.get(EMAIL_QUEUE)?.length || 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      inMemory: true
    };
    
    stats.report = {
      waiting: inMemoryQueues.get(REPORT_QUEUE)?.length || 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      inMemory: true
    };
  }
  
  return stats;
};

/**
 * Clean up queues on application shutdown
 */
export const shutdownQueues = async () => {
  try {
    if (emailQueue) {
      await emailQueue.close();
      logger.info('Email queue closed');
    }
    
    if (reportQueue) {
      await reportQueue.close();
      logger.info('Report queue closed');
    }
  } catch (error) {
    logger.error('Error shutting down queues', error);
  }
};

// Add queues to graceful shutdown process
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    await shutdownQueues();
  });
  
  process.on('SIGINT', async () => {
    await shutdownQueues();
  });
}

/**
 * Queue a report generation job
 * @param reportData Report data for generation
 * @param options Job options
 * @returns Job ID
 */
export const queueReportGeneration = async (reportData: any, options: Bull.JobOptions = {}): Promise<string> => {
  return await addReportJob({
    type: 'report_generation',
    data: reportData
  }, options);
};

export default {
  processEmailQueue,
  processReportQueue,
  addEmailJob,
  addReportJob,
  queueReportGeneration,
  getQueueStats,
  shutdownQueues
};