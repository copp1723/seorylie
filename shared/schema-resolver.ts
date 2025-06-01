/**
 * Schema resolver to prevent duplicate schema definitions
 *
 * This file serves as a central point for resolving schema imports
 * to prevent TypeScript compilation errors from duplicate definitions.
 */

// Re-export from schema.ts (base schema)
export * from './schema';

// Explicitly re-export A/B testing tables and types from schema.ts
export {
  promptExperiments,
  promptVariants,
  experimentVariants,
  promptMetrics,
  promptExperimentsRelations,
  promptVariantsRelations,
  experimentVariantsRelations,
  promptMetricsRelations,
  insertPromptExperimentSchema,
  insertPromptVariantSchema,
  insertExperimentVariantSchema,
  insertPromptMetricSchema,
} from './schema';

export type {
  PromptExperiment,
  InsertPromptExperiment,
  PromptVariant,
  InsertPromptVariant,
  ExperimentVariant,
  InsertExperimentVariant,
  PromptMetric,
  InsertPromptMetric
} from './schema';

// Re-export from schema.ts (base schema)
export {
  customersRelations,
  insertCustomerSchema
} from './schema';

export type {
  Customer,
  InsertUser as InsertCustomer  // Using InsertUser from schema.ts as InsertCustomer alias
} from './schema';

// Re-export from lead-management-schema.ts
export {
  leadSources,
  leadStatuses,
  leadPriorities,
  conversationStatuses,
  messageTypes,
  messageSenders,
  handoverReasons,
  handoverStatuses,
  leadSourcesTable,
  vehicleInterests,
  leads,
  conversations,
  messages,
  handovers,
  leadActivities,
  leadSourcesRelations,
  vehicleInterestsRelations,
  leadsRelations,
  conversationsRelations,
  messagesRelations,
  handoversRelations,
  leadActivitiesRelations,
  insertLeadSourceSchema,
  insertVehicleInterestSchema,
  insertLeadSchema,
  insertConversationSchema,
  insertMessageSchema,
  insertHandoverSchema,
  insertLeadActivitySchema,

  inboundLeadSchema,
  replyMessageSchema,
  handoverRequestSchema
} from './lead-management-schema';

// Re-export types from lead-management-schema.ts
export type {
  LeadSource,
  LeadStatus,
  LeadPriority,
  ConversationStatus,
  MessageType,
  MessageSender,
  HandoverReason,
  HandoverStatus,
  LeadSourceTable,
  InsertLeadSource,
  VehicleInterest,
  InsertVehicleInterest,
  Lead,
  InsertLead,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  Handover,
  InsertHandover,
  LeadActivity,
  InsertLeadActivity
} from './lead-management-schema';

// Re-export from adf-schema.ts
export {
  adfLeads,
  adfEmailQueue,
  adfProcessingLogs,
  adfLeadsRelations,
  adfEmailQueueRelations,
  adfProcessingLogsRelations,
  insertAdfLeadSchema,
  insertAdfEmailQueueSchema,
  insertAdfProcessingLogSchema
} from './adf-schema';

// Re-export types from adf-schema.ts
export type {
  AdfProcessingStatus,
  AdfLeadStatus,
  AdfLead,
  InsertAdfLead,
  AdfEmailQueue,
  InsertAdfEmailQueue,
  AdfProcessingLog,
  InsertAdfProcessingLog,
  AdfXmlStructure
} from './adf-schema';

// Re-export from schema-extensions.ts
export {
  escalationTriggers,
  leadScores,
  followUps,
  userInvitations,
  extensionAuditLogs,
  customerProfiles,
  customerInteractions,
  customerInsights,
  responseSuggestions,
  insertEscalationTriggerSchema,
  insertLeadScoreSchema,
  insertFollowUpSchema,
  insertUserInvitationSchema,
  insertExtensionAuditLogSchema,
  insertCustomerProfileSchema,
  insertCustomerInteractionSchema,
  insertCustomerInsightSchema,
  insertResponseSuggestionSchema
} from './schema-extensions';

// Re-export types from schema-extensions.ts
export type {
  EscalationTrigger,
  InsertEscalationTrigger,
  LeadScore,
  InsertLeadScore,
  FollowUp,
  InsertFollowUp,
  UserInvitation,
  InsertUserInvitation,
  ExtensionAuditLog,
  InsertExtensionAuditLog,
  CustomerProfile,
  InsertCustomerProfile,
  CustomerInteraction,
  InsertCustomerInteraction,
  CustomerInsight,
  InsertCustomerInsight,
  ResponseSuggestion,
  InsertResponseSuggestion
} from './schema-extensions';

// Re-export from api-schemas.ts
export {
  paginationSchema,
  apiResponseSchema,
  errorResponseSchema,
  validationErrorSchema,
  validationErrorResponseSchema,
  apiCustomerSchema,
  customerInputSchema,
  vehicleInterestSchema,
  vehicleInterestInputSchema,
  apiLeadSchema,
  inboundLeadRequestSchema,
  leadCreationResponseSchema,
  replyMessageRequestSchema,
  messageResponseSchema,
  handoverRequestSchema as apiHandoverRequestSchema,
  handoverResponseSchema,
  handoverUpdateRequestSchema,
  apiConversationSchema,
  apiMessageSchema,
  leadsQuerySchema,
  conversationsQuerySchema,
  leadListResponseSchema,
  leadDetailResponseSchema,
  conversationListResponseSchema,
  conversationDetailResponseSchema,
  twilioWebhookSchema
} from './api-schemas';

// Re-export types from api-schemas.ts
export type {
  InboundLeadRequest,
  LeadCreationResponse,
  ReplyMessageRequest,
  MessageResponse,
  HandoverRequest,
  HandoverResponse,
  HandoverUpdateRequest,
  LeadsQuery,
  ConversationsQuery,
  TwilioWebhook,
  ApiResponse,
  ErrorResponse,
  ValidationErrorResponse
} from './api-schemas';