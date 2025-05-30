import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import { setupVite, serveStatic, log } from "./vite";
import { setupRoutes } from "./routes";
import { standardLimiter, authLimiter, strictLimiter, apiKeyLimiter } from './middleware/rate-limit';
import logger from "./utils/logger";
import monitoringRoutes from './routes/monitoring-routes';
import escalationRoutes from './routes/escalation-routes';
import leadManagementRoutes from './routes/lead-management-routes';
import userManagementRoutes from './routes/user-management-routes';
import apiV1Routes from './routes/api-v1';
import customerInsightsRoutes from './routes/customer-insights-routes';
import { initializeFollowUpScheduler } from './services/follow-up-scheduler';
import { monitoring } from './services/monitoring';

// Load environment variables
dotenv.config();

// Initialize Express app and create HTTP server
const app = express();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security middleware
// app.use(csrf({ cookie: true })); // Uncomment if CSRF protection is needed

// Setup routes
setupRoutes(app);

// Register additional routes
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/escalation', escalationRoutes);
app.use('/api/leads', leadManagementRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/v1', apiV1Routes);
app.use('/api/insights', customerInsightsRoutes);

// Initialize services
initializeFollowUpScheduler();
monitoring.initialize();

// Setup Vite in development or serve static files in production
if (process.env.NODE_ENV === "production") {
  serveStatic(app);
} else {
  await setupVite(app, server);
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  log(`Server running on port ${PORT}`);
});

export default server;
