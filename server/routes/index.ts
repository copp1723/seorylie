/**
 * Main routes index file
 * Exports all route modules for use in the main application
 */

import adminRoutes from "./admin-routes";
import adminUserRoutes from "./admin-user-routes";
import agentDashboardRoutes from "./agent-dashboard-routes";
import agentSquadRoutes from "./agent-squad-routes";
import apiDocs from "./api-docs";
import authRoutes from "./auth-routes";
import cacheDemoRoutes from "./cache-demo-routes";
import conversationLogsRoutes from "./conversation-logs-routes";
import customerInsightsRoutes from "./customer-insights-routes";
import dealershipConfigRoutes from "./dealership-config-routes";
import escalationRoutes from "./escalation-routes";
import externalAPIFlagsRoutes from "./external-api-flags-routes";
import leadApiRoutes from "./lead-api-routes";
import leadManagementRoutes from "./lead-management-routes";
import localAuthRoutes from "./local-auth-routes";
import magicLinkRoutes from "./magic-link";
import monitoringRoutes from "./monitoring-routes";
import optimizedApiRoutes from "./optimized-api";
import optimizedRoutes from "./optimized-routes";
import performanceRoutes from "./performance-routes";
import promptTestRoutes from "./prompt-test";
import promptTestingRoutes from "./prompt-testing-routes";
import simplePromptTestRoutes from "./simple-prompt-test";
import twilioWebhooks from "./twilio-webhooks";
import dealersRoutes from "./dealers-routes";
import userManagementRoutes from "./user-management-routes";

export {
  adminRoutes,
  adminUserRoutes,
  agentDashboardRoutes,
  agentSquadRoutes,
  apiDocs,
  authRoutes,
  cacheDemoRoutes,
  conversationLogsRoutes,
  customerInsightsRoutes,
  dealershipConfigRoutes,
  escalationRoutes,
  externalAPIFlagsRoutes,
  leadApiRoutes,
  leadManagementRoutes,
  localAuthRoutes,
  magicLinkRoutes,
  monitoringRoutes,
  optimizedApiRoutes,
  optimizedRoutes,
  performanceRoutes,
  promptTestRoutes,
  promptTestingRoutes,
  simplePromptTestRoutes,
  twilioWebhooks,
  dealersRoutes,
  userManagementRoutes,
};
