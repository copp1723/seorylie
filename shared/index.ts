// Primary Database Schemas - Export everything from schema.ts first
export * from './schema';

// Lead Management Schemas - Selective exports to avoid conflicts with schema.ts
export {
  // Types
  leadSources,
  leadStatuses, 
  leadPriorities,
  conversationStatuses,
  messageTypes,
  messageSenders,
  handoverReasons,
  handoverStatuses,
  type LeadSource,
  type LeadStatus,
  type LeadPriority,
  type ConversationStatus,
  type MessageType,
  type MessageSender,
  type HandoverReason,
  type HandoverStatus,
  
  // Tables (with lm_ prefix to avoid conflicts)
  leadSourcesTable,
  dealershipHandoverSettings,
  customers as lmCustomers,
  vehicleInterests,
  leads as lmLeads,
  conversations as lmConversations,
  messages as lmMessages,
  handovers,
  leadActivities,
  
  // Relations
  leadSourcesRelations,
  dealershipHandoverSettingsRelations,
  customersRelations as lmCustomersRelations,
  vehicleInterestsRelations,
  leadsRelations as lmLeadsRelations,
  conversationsRelations as lmConversationsRelations,
  messagesRelations as lmMessagesRelations,
  handoversRelations,
  leadActivitiesRelations,
  
  // Zod schemas (with lm_ prefix to avoid conflicts)
  insertLeadSourceSchema as lmInsertLeadSourceSchema,
  insertDealershipHandoverSettingsSchema,
  insertCustomerSchema as lmInsertCustomerSchema,
  insertVehicleInterestSchema,
  insertLeadSchema as lmInsertLeadSchema,
  insertConversationSchema as lmInsertConversationSchema,
  insertMessageSchema as lmInsertMessageSchema,
  insertHandoverSchema,
  insertLeadActivitySchema,
  
  // API schemas
  inboundLeadSchema,
  replyMessageSchema,
  handoverRequestSchema,
} from './lead-management-schema';

// ADF Schemas
export * from './adf-schema';

// API Schemas
export * from './api-schemas';

// Schema Extensions and Utilities
export * from './schema-extensions';
// Note: schema-resolver.ts also exports from schema.ts, causing conflicts, so we skip it
// export * from './schema-resolver';