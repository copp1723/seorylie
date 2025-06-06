import { Queue } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../utils/redis-config';
import logger from '../utils/logger';

export const SEO_TASK_QUEUE = 'seo.tasks';

const connection = getRedisClient();

interface SeoTaskJob {
  request: any;
  dealershipName: string;
  timestamp: string;
}

const seoTaskQueue = new Queue(SEO_TASK_QUEUE, { connection });

export async function enqueueSeoTask(job: SeoTaskJob): Promise<string> {
  const jobId = `seo-task-${job.request.id || uuidv4()}`;
  await seoTaskQueue.add('process-seo-request', job, { jobId, removeOnComplete: true });
  logger.info('SEO task enqueued', { jobId });
  return jobId;
}

export { seoTaskQueue };
