import axios from "axios";
import { Worker, Job } from "bullmq";
import jwt from "jsonwebtoken";
import logger from "../utils/logger";
import { getRedisClient } from "../utils/redis-config";
import { SEO_TASK_QUEUE } from "./seo-task-queue";

export function startTaskWorker(): Worker {
  const connection = getRedisClient();

  const worker = new Worker(
    SEO_TASK_QUEUE,
    async (job: Job) => {
      if (job.name !== "process-seo-request") {
        return;
      }

      const { request } = job.data as any;
      const vendorUrl = process.env.VENDOR_RELAY_URL || "http://localhost:8000";
      const token = jwt.sign(
        { sandbox_id: request.sandbox_id },
        process.env.INTERNAL_JWT_SECRET || "dev-jwt-secret",
      );

      const payload = {
        request_id: request.id,
        sandbox_id: request.sandbox_id,
        task_type: request.type,
        title: request.title,
        description: request.description,
        priority: request.priority,
        deadline: request.deadline,
        details: request,
      };

      await axios.post(`${vendorUrl}/vendor/seo/task`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return { success: true };
    },
    { connection },
  );

  worker.on("completed", (job) => {
    logger.info("SEO task job completed", { jobId: job.id });
  });

  worker.on("failed", (job, err) => {
    logger.error("SEO task job failed", { jobId: job?.id, error: err });
  });

  logger.info("SEO task worker started");
  return worker;
}
