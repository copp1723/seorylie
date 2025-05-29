import express from 'express';
import authRoutes from './routes/auth-routes';
import localAuthRoutes from './routes/local-auth-routes';
import magicLinkRoutes from './routes/magic-link';
import adminRoutes from './routes/admin-routes';
import adminUserRoutes from './routes/admin-user-routes';
import dealershipConfigRoutes from './routes/dealership-config-routes';
import inventoryRoutes from './routes/inventory-routes';
import promptTestingRoutes from './routes/prompt-testing-routes';
import simplePromptTest from './routes/simple-prompt-test';
import monitoringRoutes from './routes/monitoring-routes';
import optimizedRoutes from './routes/optimized-routes';
import optimizedApi from './routes/optimized-api';
import apiDocs from './routes/api-docs';
import leadApiRoutes from './routes/lead-api-routes';
import leadManagementRoutes from './routes/lead-management-routes';
import agentDashboardRoutes from './routes/agent-dashboard-routes';
import agentSquadRoutes from './routes/agent-squad-routes';
import userManagementRoutes from './routes/user-management-routes';
import conversationLogsRoutes from './routes/conversation-logs-routes';
import customerInsightsRoutes from './routes/customer-insights-routes';
import escalationRoutes from './routes/escalation-routes';
import performanceRoutes from './routes/performance-routes';
import twilioWebhooks from './routes/twilio-webhooks';
import sendgridWebhook from './routes/webhooks/sendgrid';
import apiResponseExamples from './routes/api-response-examples';
import cacheDemoRoutes from './routes/cache-demo-routes';
import logger from './utils/logger';

export default function registerRoutes(app: express.Express) {
  logger.info('Registering routes');

  // API Documentation
  app.use('/api-docs', apiDocs);

  // Authentication routes
  app.use('/auth', authRoutes);
  app.use('/auth/local', localAuthRoutes);
  app.use('/auth/magic-link', magicLinkRoutes);

  // Admin routes
  app.use('/admin', adminRoutes);
  app.use('/admin/users', adminUserRoutes);

  // Dealership configuration
  app.use('/dealership-config', dealershipConfigRoutes);

  // Inventory management
  app.use('/inventory', inventoryRoutes);

  // Prompt testing
  app.use('/prompt-testing', promptTestingRoutes);
  app.use('/simple-prompt-test', simplePromptTest);

  // Monitoring and health checks
  app.use('/api', monitoringRoutes);

  // Optimized routes
  app.use('/optimized', optimizedRoutes);
  app.use('/api/v2', optimizedApi);

  // Lead management
  app.use('/api/leads', leadApiRoutes);
  app.use('/lead-management', leadManagementRoutes);

  // Agent dashboard
  app.use('/agent-dashboard', agentDashboardRoutes);
  app.use('/agent-squad', agentSquadRoutes);

  // User management
  app.use('/user-management', userManagementRoutes);

  // Conversation logs
  app.use('/conversation-logs', conversationLogsRoutes);

  // Customer insights
  app.use('/customer-insights', customerInsightsRoutes);

  // Escalation routes
  app.use('/escalation', escalationRoutes);

  // Performance routes
  app.use('/performance', performanceRoutes);

  // Webhooks
  app.use('/webhooks/twilio', twilioWebhooks);
  app.use('/webhooks', sendgridWebhook);

  // API Response Examples
  app.use('/api-response-examples', apiResponseExamples);

  // Cache demo routes
  app.use('/cache-demo', cacheDemoRoutes);

  // Default route
  app.get('/', (req, res) => {
    res.json({ message: 'API is running' });
  });

  logger.info('Routes registered successfully');
}
