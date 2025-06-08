import swaggerJSDoc from "swagger-jsdoc";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  inboundLeadRequestSchema,
  leadCreationResponseSchema,
  replyMessageRequestSchema,
  messageResponseSchema,
  handoverRequestSchema,
  handoverResponseSchema,
  handoverUpdateRequestSchema,
  leadsQuerySchema,
  conversationsQuerySchema,
  leadListResponseSchema,
  leadDetailResponseSchema,
  conversationListResponseSchema,
  conversationDetailResponseSchema,
  errorResponseSchema,
  validationErrorResponseSchema,
  twilioWebhookSchema,
  apiLeadSchema,
  apiConversationSchema,
  apiMessageSchema,
  apiCustomerSchema,
  vehicleInterestSchema,
} from "../../shared/index";

// Convert Zod schemas to JSON Schema for OpenAPI
const convertToJsonSchema = (zodSchema: any, title?: string) => {
  return zodToJsonSchema(zodSchema, {
    name: title,
    $refStrategy: "none",
  });
};

// OpenAPI configuration
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Rylie AI Lead Management API",
      version: "1.0.0",
      description: `
# Rylie AI Lead Management API

A comprehensive API for managing automotive leads, conversations, and AI-to-human handovers.

## Features

- **Lead Ingestion**: Accept leads from multiple sources (ADF, forms, APIs)
- **Conversation Management**: Thread-based messaging with AI assistance
- **Handover System**: Seamless escalation from AI to human agents
- **SMS Integration**: Twilio-powered SMS delivery with tracking
- **Analytics**: Lead scoring, attribution tracking, and performance metrics

## Authentication

All API endpoints require authentication using API keys:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Rate Limiting

API requests are rate limited per dealership:
- **Standard**: 1000 requests per minute
- **Burst**: Up to 100 requests per second for short periods

## Error Handling

The API uses conventional HTTP response codes:
- **200-299**: Success
- **400-499**: Client errors (invalid request, authentication, etc.)
- **500-599**: Server errors

All error responses include detailed error information in a consistent format.

## Webhooks

The API supports webhooks for real-time notifications:
- SMS delivery status updates (Twilio)
- Lead status changes
- Conversation events
      `,
      contact: {
        name: "Rylie AI Support",
        email: "support@rylie.ai",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || "http://localhost:3000",
        description: "Development server",
      },
      {
        url: "https://api.rylie.ai",
        description: "Production server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API_KEY",
          description:
            "API key authentication. Use your dealership API key as the bearer token.",
        },
      },
      schemas: {
        // Request schemas
        InboundLeadRequest: convertToJsonSchema(
          inboundLeadRequestSchema,
          "InboundLeadRequest",
        ),
        ReplyMessageRequest: convertToJsonSchema(
          replyMessageRequestSchema,
          "ReplyMessageRequest",
        ),
        HandoverRequest: convertToJsonSchema(
          handoverRequestSchema,
          "HandoverRequest",
        ),
        HandoverUpdateRequest: convertToJsonSchema(
          handoverUpdateRequestSchema,
          "HandoverUpdateRequest",
        ),

        // Response schemas
        LeadCreationResponse: convertToJsonSchema(
          leadCreationResponseSchema,
          "LeadCreationResponse",
        ),
        MessageResponse: convertToJsonSchema(
          messageResponseSchema,
          "MessageResponse",
        ),
        HandoverResponse: convertToJsonSchema(
          handoverResponseSchema,
          "HandoverResponse",
        ),
        LeadListResponse: convertToJsonSchema(
          leadListResponseSchema,
          "LeadListResponse",
        ),
        LeadDetailResponse: convertToJsonSchema(
          leadDetailResponseSchema,
          "LeadDetailResponse",
        ),
        ConversationListResponse: convertToJsonSchema(
          conversationListResponseSchema,
          "ConversationListResponse",
        ),
        ConversationDetailResponse: convertToJsonSchema(
          conversationDetailResponseSchema,
          "ConversationDetailResponse",
        ),

        // Entity schemas
        Lead: convertToJsonSchema(apiLeadSchema, "Lead"),
        Conversation: convertToJsonSchema(
          apiConversationSchema,
          "Conversation",
        ),
        Message: convertToJsonSchema(apiMessageSchema, "Message"),
        Customer: convertToJsonSchema(apiCustomerSchema, "Customer"),
        VehicleInterest: convertToJsonSchema(
          vehicleInterestSchema,
          "VehicleInterest",
        ),

        // Error schemas
        ErrorResponse: convertToJsonSchema(
          errorResponseSchema,
          "ErrorResponse",
        ),
        ValidationErrorResponse: convertToJsonSchema(
          validationErrorResponseSchema,
          "ValidationErrorResponse",
        ),

        // Webhook schemas
        TwilioWebhook: convertToJsonSchema(
          twilioWebhookSchema,
          "TwilioWebhook",
        ),

        // Query parameter schemas
        LeadsQuery: convertToJsonSchema(leadsQuerySchema, "LeadsQuery"),
        ConversationsQuery: convertToJsonSchema(
          conversationsQuerySchema,
          "ConversationsQuery",
        ),

        // Standard response wrapper
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Whether the request was successful",
            },
            data: {
              description: "Response data (varies by endpoint)",
            },
            message: {
              type: "string",
              description: "Human-readable message",
            },
            errors: {
              type: "array",
              items: { type: "string" },
              description: "Array of error messages",
            },
            warnings: {
              type: "array",
              items: { type: "string" },
              description: "Array of warning messages",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Response timestamp",
            },
          },
          required: ["success"],
        },
      },
      responses: {
        BadRequest: {
          description: "Invalid request parameters or body",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
            },
          },
        },
        Unauthorized: {
          description: "Missing or invalid API key",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Forbidden: {
          description: "Insufficient permissions",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Conflict: {
          description: "Resource conflict (e.g., duplicate lead)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        TooManyRequests: {
          description: "Rate limit exceeded",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        InternalServerError: {
          description: "Internal server error",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
      parameters: {
        LeadId: {
          name: "leadId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique identifier for the lead",
        },
        ConversationId: {
          name: "conversationId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique identifier for the conversation",
        },
        HandoverId: {
          name: "handoverId",
          in: "path",
          required: true,
          schema: {
            type: "string",
            format: "uuid",
          },
          description: "Unique identifier for the handover",
        },
        Limit: {
          name: "limit",
          in: "query",
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 50,
          },
          description: "Number of items to return",
        },
        Offset: {
          name: "offset",
          in: "query",
          schema: {
            type: "integer",
            minimum: 0,
            default: 0,
          },
          description: "Number of items to skip",
        },
      },
    },
    tags: [
      {
        name: "Leads",
        description: "Lead management and ingestion",
      },
      {
        name: "Conversations",
        description: "Conversation and messaging management",
      },
      {
        name: "Handovers",
        description: "AI to human agent escalations",
      },
      {
        name: "SMS",
        description: "SMS delivery and tracking",
      },
      {
        name: "Webhooks",
        description: "Webhook endpoints for external integrations",
      },
    ],
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ["./server/routes/*.ts", "./server/routes/**/*.ts"],
};

// Generate OpenAPI specification
export const generateOpenApiSpec = () => {
  try {
    const spec = swaggerJSDoc(options);

    // Add custom examples to schemas
    addExamples(spec);

    return spec;
  } catch (error) {
    console.error("Error generating OpenAPI spec:", error);
    throw error;
  }
};

/**
 * Add example data to OpenAPI schemas
 */
function addExamples(spec: any) {
  if (!spec.components?.schemas) return;

  // Add examples for request schemas
  if (spec.components.schemas.InboundLeadRequest) {
    spec.components.schemas.InboundLeadRequest.example = {
      customer: {
        firstName: "John",
        lastName: "Smith",
        fullName: "John Smith",
        email: "john.smith@example.com",
        phone: "+1-555-123-4567",
        city: "Springfield",
        state: "IL",
        zipCode: "62701",
      },
      vehicleInterest: {
        year: 2024,
        make: "Honda",
        model: "Accord",
        condition: "new",
        maxPrice: 35000,
      },
      lead: {
        requestType: "Purchase",
        description: "Looking for a reliable sedan with good fuel economy",
        source: "website_form",
        campaign: "spring_2024",
        priority: "medium",
      },
      attribution: {
        source: "google",
        medium: "cpc",
        campaign: "honda_accord_2024",
        keyword: "honda accord 2024",
        landingPage: "https://example.com/honda-accord",
      },
    };
  }

  if (spec.components.schemas.ReplyMessageRequest) {
    spec.components.schemas.ReplyMessageRequest.example = {
      conversationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      content:
        "Thank you for your interest in the 2024 Honda Accord. I'd be happy to help you find the perfect vehicle.",
      contentType: "text",
      sender: "ai",
      senderName: "Rylie AI Assistant",
    };
  }

  if (spec.components.schemas.HandoverRequest) {
    spec.components.schemas.HandoverRequest.example = {
      conversationId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      reason: "pricing_negotiation",
      description:
        "Customer is ready to negotiate pricing and financing options for the 2024 Honda Accord",
      urgency: "high",
      context: {
        vehicleOfInterest: "2024 Honda Accord Sport",
        customerBudget: 35000,
        tradeInValue: 15000,
      },
    };
  }

  // Add examples for response schemas
  if (spec.components.schemas.LeadCreationResponse) {
    spec.components.schemas.LeadCreationResponse.example = {
      success: true,
      data: {
        leadId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        customerId: "g58bd20c-69dd-5483-b678-1f13c3d4e580",
        conversationId: "h69ce30d-70ee-6594-c789-2g24d4e5f691",
        leadNumber: "LEAD-1-24-0001",
        isExistingCustomer: false,
        warnings: [],
      },
      message: "Lead created successfully",
    };
  }
}

/**
 * Get OpenAPI JSON specification
 */
export const getOpenApiJson = () => {
  return generateOpenApiSpec();
};

/**
 * Get OpenAPI YAML specification
 */
export const getOpenApiYaml = () => {
  const spec = generateOpenApiSpec();
  const yaml = require("js-yaml");
  return yaml.dump(spec);
};
