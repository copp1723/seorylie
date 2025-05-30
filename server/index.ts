import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { standardLimiter, authLimiter, strictLimiter, apiKeyLimiter } from './middleware/rate-limit';
import logger from "./utils/logger";
import csrf from "csurf";
import cookieParser from "cookie-parser";
import monitoringRoutes from './routes/monitoring-routes';
import { monitoring } from './services/monitoring';
import escalationRoutes from './routes/escalation-routes';
import leadManagementRoutes from './routes/lead-management-routes';
import userManagementRoutes from './routes/user-management-routes';
import apiV1Routes from './routes/api-v1';
import customerInsightsRoutes from './routes/customer-insights-routes';
import { initializeFollowUpScheduler } from './services/follow-up-scheduler';

// Enable Redis fallback when Redis connection details aren't provided
if (!process.env.REDIS_HOST) {
  process.env.SKIP_REDIS = 'true';
  logger.info('No Redis host configured, using in-memory fallback');
}

const app = express();
