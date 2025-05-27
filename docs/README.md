# Rylie AI - Automotive Dealership Conversational AI Platform

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Features](#features)
4. [Getting Started](#getting-started)
5. [API Reference](#api-reference)
6. [User Management](#user-management)
7. [Dealership Configuration](#dealership-configuration)
8. [Persona Management](#persona-management)
9. [Conversation Management](#conversation-management)
10. [Inventory Management](#inventory-management)
11. [A/B Testing System](#ab-testing-system)
12. [Email Integration](#email-integration)
13. [Analytics and Reporting](#analytics-and-reporting)
14. [Authentication](#authentication)
15. [Troubleshooting](#troubleshooting)

## Overview

Rylie AI is a specialized conversational AI platform designed for automotive dealerships. The platform enables seamless communication between potential customers and dealerships through AI-powered conversations, with intelligent handover to human representatives when appropriate.

The system features include:
- Customizable AI personas for each dealership
- Automated inventory integration through email attachments
- Lead qualification and intent detection
- Comprehensive handover dossiers for sales representatives
- A/B testing infrastructure for continuous improvement
- Automated reports and analytics
- Secure authentication for staff access

> **Important Note**: The server runs on port 5000 by default. For more details on server configuration, see [Server Configuration Guide](SERVER_CONFIGURATION.md).

## System Architecture

Rylie AI follows a modern full-stack architecture with the following components:

### Frontend
- React-based single-page application (SPA)
- TanStack Query for data fetching
- Wouter for lightweight routing
- Shadcn/UI components with TailwindCSS for styling

### Backend
- Express.js API server in TypeScript
- PostgreSQL database with Drizzle ORM
- OpenAI integration for AI conversation capabilities
- SendGrid email service integration
- Replit Auth for secure authentication

### Database Schema
The database includes the following main entities:
- Users: Staff members with access to the platform
- Dealerships: Automotive dealership information
- Vehicles: Dealership inventory
- Personas: Customizable AI personalities
- Conversations: Customer interactions
- Messages: Individual exchanges within conversations
- Prompt Experiments: A/B testing configurations
- API Keys: Authentication tokens for API access

## Features

### AI Conversation Flow
Rylie AI manages the entire conversation flow:
1. Customer inquiry comes in via API or SMS
2. AI analyzes message intent and customer needs
3. AI responds based on dealership-specific persona configuration
4. System analyzes message for potential handover triggers
5. If needed, AI creates comprehensive handover dossier
6. Conversation can be escalated to human representatives

### Inventory Management
- Daily inventory updates via email attachments (TSV format)
- Automatic parsing and database updates
- Intelligent vehicle matching in conversations

### Persona Customization
- Each dealership can customize their AI's personality
- Configure tone, priority features, and behavior
- Set up automatic handover triggers and recipients

### A/B Testing
- Test different prompt variations
- Track performance metrics
- Optimize AI responses continuously

### Reporting
- Scheduled email reports
- Conversion analytics
- Performance metrics and insights

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database server
- PostgreSQL client tools (psql) for database management
- Redis server (optional, can use in-memory fallback)
- OpenAI API key
- SendGrid API key (for email functionality)

### Installation
The application is configured to run on Replit with the following steps:

1. Clone the repository
2. Set up required environment variables:
   - `DATABASE_URL`: PostgreSQL connection string (use "rylie" for production or "rylie_test" for development)
   - `REDIS_HOST`, `REDIS_PORT`: Redis connection details (optional, set `SKIP_REDIS=true` to use in-memory fallback)
   - `OPENAI_API_KEY`: API key for OpenAI services
   - `SENDGRID_API_KEY`: API key for email services
   - `SESSION_SECRET`: Secret for secure session management
3. Install dependencies: `npm install`
4. Set up the database: `npm run db:push`
5. Start the development server: `npm run dev`
6. Access the application at http://localhost:5000

### Environment Variables
```
DATABASE_URL=postgresql://username:password@host:port/database
OPENAI_API_KEY=sk-...
SENDGRID_API_KEY=SG...
SESSION_SECRET=your-secure-session-secret
```

## API Reference

### Authentication
All API endpoints require authentication using either:
1. API key in the `X-API-Key` header (for dealership integration)
2. Session-based authentication (for internal staff)

### Conversation Endpoints

#### Start a conversation
```
POST /api/inbound
```
Request body:
```json
{
  "customerMessage": "I'm interested in the new SUV models",
  "customerName": "John Doe",
  "customerPhone": "+1234567890",
  "customerEmail": "john@example.com",
  "dealershipId": 1,
  "channel": "sms",
  "campaignContext": "Summer Sale Campaign"
}
```

#### Reply to a message
```
POST /api/reply
```
Request body:
```json
{
  "conversationId": 123,
  "message": "What are the financing options?"
}
```

#### Handover to human
```
POST /api/handover
```
Request body:
```json
{
  "conversationId": 123,
  "reason": "Customer requesting specific financing details",
  "assignToUserId": 456
}
```

### Persona Management Endpoints

#### List personas
```
GET /api/personas
```

#### Get persona details
```
GET /api/personas/:id
```

#### Create persona
```
POST /api/personas
```

#### Update persona
```
PATCH /api/personas/:id
```

#### Delete persona
```
DELETE /api/personas/:id
```

### Inventory Management Endpoints

#### List vehicles
```
GET /api/inventory
```

#### Search vehicles
```
GET /api/inventory/search?query=suv
```

#### Import inventory
```
POST /api/inventory/import
```

## User Management

Rylie AI supports two types of users:
1. Staff members: Internal dealership staff with access to the dashboard
2. API users: External systems that integrate via API keys

### User Roles
- Admin: Full access to all features
- Manager: Access to dealership configuration and reporting
- Sales: Access to conversations and handovers
- Service: Limited access to service-related conversations

## Dealership Configuration

Each dealership in the system has:
- Basic information (name, location, contact details)
- Custom domain settings
- Default handover email
- API keys for integration

## Persona Management

Personas define how the AI assistant behaves for each dealership:

### Persona Attributes
- **Name**: Identifying name for the persona
- **Description**: Purpose and behavior description
- **Prompt Template**: System prompt that defines AI behavior
- **Tone**: Communication style (professional, friendly, etc.)
- **Priority Features**: Vehicle features to emphasize
- **Trade-in URL**: Link to send for trade-in inquiries
- **Financing URL**: Link to send for financing inquiries
- **Handover Email**: Where to send handover dossiers

### Default Persona
Each dealership must have one default persona that is used for conversations unless otherwise specified.

## Conversation Management

Conversations represent ongoing interactions between customers and the dealership:

### Conversation States
- **Active**: Ongoing conversation with the AI
- **Waiting**: Awaiting customer response
- **Escalated**: Handed over to human representative
- **Completed**: Conversation ended

### Handover Process
When a conversation requires human intervention:
1. AI detects handover trigger (keywords, intent, or explicit request)
2. System creates comprehensive handover dossier
3. Dossier is emailed to designated recipient
4. Conversation status changes to "escalated"
5. Human representative can view full conversation history

### Handover Dossier Contents
- Customer information
- Conversation summary
- Detected intent and interests
- Vehicle preferences
- Financing needs
- Trade-in information
- Suggested next steps

## Inventory Management

The system maintains an up-to-date inventory of vehicles:

### Inventory Import Methods
1. **Email Attachment**: TSV files sent to a designated email
2. **API Import**: Direct API call with inventory data
3. **Manual Upload**: Through the dashboard interface

### Vehicle Information
- Make, model, year
- VIN
- Exterior/interior colors
- Features and options
- Pricing details
- Availability status

## A/B Testing System

The platform includes a sophisticated A/B testing infrastructure:

### Test Components
- **Experiments**: Test configurations
- **Variants**: Different prompt versions
- **Metrics**: Performance measurements

### Metrics Tracked
- Response quality
- Conversation length
- Handover rate
- Customer satisfaction signals
- Conversion to appointment/showroom visit

## Email Integration

Rylie AI integrates with email systems for:

### Email Features
- **Inventory Import**: Processing TSV attachments
- **Handover Dossiers**: Sending detailed lead information
- **Scheduled Reports**: Automated performance reports
- **Conversation Summaries**: Daily or weekly summaries

## Analytics and Reporting

The platform provides comprehensive analytics:

### Report Types
- Conversation volume and outcomes
- Handover reasons and effectiveness
- Response quality metrics
- Customer intent analysis
- Inventory engagement metrics

### Scheduled Reports
Configure automated reports to be sent:
- Daily, weekly, or monthly
- To multiple recipients
- With customizable content

## Authentication

Rylie AI uses Replit Auth for secure internal staff authentication:

### Authentication Features
- Secure login with Replit credentials
- Role-based access control
- Session management
- API key generation for external integrations

## Troubleshooting

### Common Issues

#### API Integration Problems
- Verify API key is valid and active
- Ensure required parameters are provided
- Check request format matches documentation

#### Conversation Not Working
- Verify OpenAI API key is valid
- Check dealership has a default persona configured
- Examine logs for specific error messages

#### Inventory Import Failures
- Verify TSV format matches expected schema
- Check email integration is properly configured
- Ensure database connection is working properly

#### Authentication Issues
- Clear browser cookies and try again
- Verify user has appropriate permissions
- Check session configuration in server settings

---

For additional support, contact the Rylie AI team at support@rylie-ai.com