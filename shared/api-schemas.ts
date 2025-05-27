import { z } from 'zod';
import { 
  leadSources, 
  leadStatuses, 
  leadPriorities, 
  conversationStatuses,
  messageTypes, 
  messageSenders, 
  handoverReasons, 
  handoverStatuses 
} from './lead-management-schema';

// Import personas from schema to avoid duplicate imports
import { personas } from './schema';

// ===== BASE SCHEMAS =====

// Common pagination schema
export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  total: z.number().optional()
});

// Common response wrapper
export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    errors: z.array(z.string()).optional(),
    warnings: z.array(z.string()).optional(),
    pagination: paginationSchema.optional(),
    timestamp: z.string().datetime().optional()
  });

// Error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.array(z.string()).optional(),
  code: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

// Validation error details
export const validationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  code: z.string(),
  received: z.any().optional()
});

export const validationErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.literal('Validation failed'),
  details: z.array(validationErrorSchema),
  timestamp: z.string().datetime().optional()
});

// ===== CUSTOMER SCHEMAS =====

export const customerSchema = z.object({
  id: z.string().uuid(),
  dealershipId: z.number(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  alternatePhone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  country: z.string(),
  dateOfBirth: z.string().datetime().nullable(),
  preferredLanguage: z.string(),
  preferredContact: z.string().nullable(),
  leadScore: z.number(),
  customerValue: z.number(),
  segment: z.string().nullable(),
  gdprConsent: z.boolean(),
  marketingOptIn: z.boolean(),
  doNotCall: z.boolean(),
  firstContactDate: z.string().datetime().nullable(),
  lastContactDate: z.string().datetime().nullable(),
  totalLeads: z.number(),
  totalPurchases: z.number(),
  customFields: z.record(z.any()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const customerInputSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  fullName: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  address: z.string().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  country: z.string().max(50).default('US'),
  preferredLanguage: z.string().max(20).default('en'),
  customFields: z.record(z.any()).optional()
});

// ===== VEHICLE SCHEMAS =====

export const vehicleInterestSchema = z.object({
  id: z.string().uuid(),
  year: z.number().nullable(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  trim: z.string().nullable(),
  bodyStyle: z.string().nullable(),
  vin: z.string().nullable(),
  stockNumber: z.string().nullable(),
  condition: z.enum(['new', 'used', 'cpo', 'any']).nullable(),
  minPrice: z.number().nullable(),
  maxPrice: z.number().nullable(),
  mileageMax: z.number().nullable(),
  fuelType: z.string().nullable(),
  transmission: z.string().nullable(),
  features: z.array(z.string()),
  hasTradeIn: z.boolean(),
  tradeInYear: z.number().nullable(),
  tradeInMake: z.string().nullable(),
  tradeInModel: z.string().nullable(),
  tradeInTrim: z.string().nullable(),
  tradeInVin: z.string().nullable(),
  tradeInMileage: z.number().nullable(),
  tradeInCondition: z.string().nullable(),
  tradeInValue: z.number().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const vehicleInterestInputSchema = z.object({
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2).optional(),
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  trim: z.string().max(100).optional(),
  vin: z.string().length(17).optional(),
  stockNumber: z.string().max(50).optional(),
  condition: z.enum(['new', 'used', 'cpo']).optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  tradeIn: z.object({
    year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),
    make: z.string().max(100).optional(),
    model: z.string().max(100).optional(),
    vin: z.string().length(17).optional(),
    mileage: z.number().min(0).optional(),
    condition: z.string().max(50).optional()
  }).optional()
});

// ===== LEAD SCHEMAS =====

export const leadSchema = z.object({
  id: z.string().uuid(),
  dealershipId: z.number(),
  customerId: z.string().uuid(),
  vehicleInterestId: z.string().uuid().nullable(),
  sourceId: z.string().uuid().nullable(),
  assignedUserId: z.number().nullable(),
  leadNumber: z.string(),
  status: z.enum(leadStatuses),
  priority: z.enum(leadPriorities),
  requestType: z.string().nullable(),
  requestCategory: z.string().nullable(),
  description: z.string().nullable(),
  timeframe: z.string().nullable(),
  source: z.enum(leadSources),
  medium: z.string().nullable(),
  campaign: z.string().nullable(),
  keyword: z.string().nullable(),
  referrer: z.string().nullable(),
  landingPage: z.string().nullable(),
  leadScore: z.number(),
  estimatedValue: z.number().nullable(),
  probability: z.number().nullable(),
  firstContactDate: z.string().datetime().nullable(),
  lastContactDate: z.string().datetime().nullable(),
  expectedCloseDate: z.string().datetime().nullable(),
  actualCloseDate: z.string().datetime().nullable(),
  nextFollowUpDate: z.string().datetime().nullable(),
  followUpNotes: z.string().nullable(),
  externalId: z.string().nullable(),
  originalPayload: z.record(z.any()),
  customFields: z.record(z.any()),
  version: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ===== API REQUEST SCHEMAS =====

// Inbound lead schema (enhanced from lead-management-schema)
export const inboundLeadRequestSchema = z.object({
  customer: customerInputSchema,
  vehicleInterest: vehicleInterestInputSchema.optional(),
  lead: z.object({
    requestType: z.string().max(50).optional(),
    description: z.string().max(5000).optional(),
    timeframe: z.string().max(100).optional(),
    source: z.enum(leadSources),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    priority: z.enum(leadPriorities).default('medium')
  }),
  attribution: z.object({
    source: z.string().max(100),
    medium: z.string().max(100).optional(),
    campaign: z.string().max(100).optional(),
    keyword: z.string().max(255).optional(),
    referrer: z.string().max(500).optional(),
    landingPage: z.string().max(500).optional()
  }).optional(),
  customFields: z.record(z.any()).optional()
});

// Lead creation response
export const leadCreationResponseSchema = z.object({
  leadId: z.string().uuid(),
  customerId: z.string().uuid(),
  conversationId: z.string().uuid(),
  leadNumber: z.string(),
  isExistingCustomer: z.boolean(),
  warnings: z.array(z.string())
});

// Reply message schema
export const replyMessageRequestSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  contentType: z.enum(['text', 'html', 'markdown']).default('text'),
  sender: z.enum(messageSenders),
  senderUserId: z.number().optional(),
  senderName: z.string().max(100).optional(),
  subject: z.string().max(255).optional(),
  attachments: z.array(z.object({
    filename: z.string().max(255),
    contentType: z.string().max(100),
    size: z.number().min(0),
    url: z.string().url()
  })).optional()
});

// Message response
export const messageResponseSchema = z.object({
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  timestamp: z.string().datetime()
});

// Handover request schema
export const handoverRequestSchema = z.object({
  conversationId: z.string().uuid(),
  reason: z.enum(handoverReasons),
  description: z.string().min(1).max(1000),
  toUserId: z.number().optional(),
  urgency: z.enum(leadPriorities).default('medium'),
  context: z.record(z.any()).optional()
});

// Handover response
export const handoverResponseSchema = z.object({
  handoverId: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.enum(handoverStatuses),
  estimatedResponseTime: z.string()
});

// Handover update schema
export const handoverUpdateRequestSchema = z.object({
  status: z.enum(handoverStatuses),
  userId: z.number().optional(),
  notes: z.string().max(1000).optional(),
  customerSatisfaction: z.number().min(1).max(5).optional()
});

// ===== CONVERSATION SCHEMAS =====

export const conversationSchema = z.object({
  id: z.string().uuid(),
  dealershipId: z.number(),
  leadId: z.string().uuid(),
  customerId: z.string().uuid(),
  assignedUserId: z.number().nullable(),
  subject: z.string().nullable(),
  status: z.enum(conversationStatuses),
  channel: z.string().nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  messageCount: z.number(),
  isAiAssisted: z.boolean(),
  aiPersonaId: z.number().nullable(),
  externalThreadId: z.string().nullable(),
  tags: z.array(z.string()),
  priority: z.enum(leadPriorities),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable()
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  content: z.string(),
  contentType: z.enum(['text', 'html', 'markdown']),
  subject: z.string().nullable(),
  type: z.enum(messageTypes),
  sender: z.enum(messageSenders),
  senderUserId: z.number().nullable(),
  senderName: z.string().nullable(),
  senderEmail: z.string().nullable(),
  isRead: z.boolean(),
  readAt: z.string().datetime().nullable(),
  externalMessageId: z.string().nullable(),
  inReplyTo: z.string().uuid().nullable(),
  aiModel: z.string().nullable(),
  aiConfidence: z.number().nullable(),
  processingTime: z.number().nullable(),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    size: z.number(),
    url: z.string()
  })),
  sentiment: z.string().nullable(),
  entities: z.record(z.any()),
  keywords: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// ===== QUERY PARAMETER SCHEMAS =====

export const leadsQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).default('50'),
  offset: z.string().transform(val => parseInt(val)).pipe(z.number().min(0)).default('0'),
  status: z.enum(leadStatuses).optional(),
  source: z.enum(leadSources).optional(),
  customerId: z.string().uuid().optional(),
  assignedUserId: z.string().transform(val => parseInt(val)).pipe(z.number()).optional(),
  priority: z.enum(leadPriorities).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional()
});

export const conversationsQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).pipe(z.number().min(1).max(100)).default('50'),
  offset: z.string().transform(val => parseInt(val)).pipe(z.number().min(0)).default('0'),
  status: z.enum(conversationStatuses).optional(),
  leadId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  assignedUserId: z.string().transform(val => parseInt(val)).pipe(z.number()).optional(),
  channel: z.string().optional()
});

// ===== RESPONSE SCHEMAS =====

export const leadListResponseSchema = apiResponseSchema(z.object({
  leads: z.array(leadSchema),
  pagination: paginationSchema
}));

export const leadDetailResponseSchema = apiResponseSchema(leadSchema);

export const conversationListResponseSchema = apiResponseSchema(z.object({
  conversations: z.array(conversationSchema),
  pagination: paginationSchema
}));

export const conversationDetailResponseSchema = apiResponseSchema(z.object({
  conversation: conversationSchema,
  messages: z.array(messageSchema),
  totalMessages: z.number()
}));

// ===== WEBHOOK SCHEMAS =====

export const twilioWebhookSchema = z.object({
  MessageSid: z.string(),
  MessageStatus: z.enum(['queued', 'sent', 'delivered', 'failed', 'undelivered']),
  To: z.string(),
  From: z.string(),
  Body: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
  Timestamp: z.string().optional()
});

// ===== TYPE EXPORTS =====

export type InboundLeadRequest = z.infer<typeof inboundLeadRequestSchema>;
export type LeadCreationResponse = z.infer<typeof leadCreationResponseSchema>;
export type ReplyMessageRequest = z.infer<typeof replyMessageRequestSchema>;
export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type HandoverRequest = z.infer<typeof handoverRequestSchema>;
export type HandoverResponse = z.infer<typeof handoverResponseSchema>;
export type HandoverUpdateRequest = z.infer<typeof handoverUpdateRequestSchema>;
export type LeadsQuery = z.infer<typeof leadsQuerySchema>;
export type ConversationsQuery = z.infer<typeof conversationsQuerySchema>;
export type TwilioWebhook = z.infer<typeof twilioWebhookSchema>;
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  warnings?: string[];
  pagination?: z.infer<typeof paginationSchema>;
  timestamp?: string;
};
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;