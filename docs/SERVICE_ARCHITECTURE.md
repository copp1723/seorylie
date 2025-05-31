# Service Layer Architecture & Error Handling

This document describes the standardized service layer architecture and error handling system implemented in CleanRylie.

## Overview

The new service architecture provides:
- **Standardized service patterns** with base classes and interfaces
- **Centralized service registry** for dependency management
- **Comprehensive error handling** with correlation IDs and structured logging
- **Configuration management** with validation and hot-reloading
- **Health check system** with detailed monitoring
- **Request/response logging** with sensitive data redaction

## Architecture Components

### 1. Base Service Class (`server/services/base-service.ts`)

All services extend the `BaseService` class which provides:

```typescript
export abstract class BaseService extends EventEmitter {
  // Common functionality:
  // - Lifecycle management (initialize/shutdown)
  // - Health checks with dependency monitoring
  // - Metrics collection (request count, error rate, response time)
  // - Error handling with correlation IDs
  // - Event emission for service state changes
}
```

**Key Features:**
- Automatic health monitoring with configurable intervals
- Dependency health checking
- Metrics collection with performance tracking
- Standardized error handling and logging
- Event-driven architecture for service communication

### 2. Service Registry (`server/services/service-registry.ts`)

Central registry for managing all services:

```typescript
export class ServiceRegistry extends EventEmitter {
  // Manages service lifecycle:
  // - Registration with dependency tracking
  // - Initialization in dependency order
  // - Health monitoring across all services
  // - Graceful shutdown in reverse order
}
```

**Key Features:**
- Dependency resolution and initialization ordering
- Circular dependency detection
- Service discovery and retrieval
- Health aggregation across all services
- Event emission for service state changes

### 3. Configuration Manager (`server/config/config-manager.ts`)

Centralized configuration with validation:

```typescript
export class ConfigManager extends EventEmitter {
  // Provides:
  // - Environment variable loading and validation
  // - Type-safe configuration access
  // - Hot-reloading in development
  // - Critical dependency validation
}
```

**Key Features:**
- Zod schema validation for all configuration
- Type-safe access to configuration sections
- Hot-reloading for development environments
- Critical dependency validation (database, Redis, OpenAI)
- Environment-specific defaults and validation

### 4. Enhanced Error Handling (`server/utils/error-handler.ts`)

Standardized error handling with rich context:

```typescript
export interface StandardErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    traceId: string;
    requestId: string;
    timestamp: string;
    userMessage?: string;
    stack?: string;
    context?: any;
  };
}
```

**Key Features:**
- Correlation IDs for request tracing
- Structured error responses
- Context-aware logging
- User-friendly error messages
- Development vs production error details

### 5. Request/Response Logging (`server/middleware/request-logging.ts`)

Comprehensive HTTP request/response logging:

```typescript
export function createRequestLoggingMiddleware(options: LoggingOptions) {
  // Provides:
  // - Request/response correlation IDs
  // - Performance metrics
  // - Sensitive data redaction
  // - Configurable logging levels
}
```

**Key Features:**
- Automatic correlation ID generation
- Performance monitoring with slow request detection
- Sensitive data redaction (passwords, tokens, etc.)
- Configurable inclusion of headers, body, etc.
- Request/response size limits

### 6. Health Check Service (`server/services/health-check-service.ts`)

Comprehensive health monitoring:

```typescript
export class HealthCheckService extends BaseService {
  // Monitors:
  // - Database connectivity
  // - Redis availability
  // - Memory usage
  // - Service dependencies
  // - Custom health checks
}
```

**Key Features:**
- Built-in checks for common dependencies
- Custom health check registration
- Timeout and retry logic
- Health report aggregation
- Periodic health monitoring

## Service Implementation Guide

### Creating a New Service

1. **Extend BaseService:**

```typescript
import { BaseService, ServiceConfig, ServiceHealth } from './base-service';

export class MyService extends BaseService {
  constructor(config: ServiceConfig) {
    super({
      ...config,
      dependencies: ['AuthService', 'DatabaseService']
    });
  }

  protected async onInitialize(): Promise<void> {
    // Service-specific initialization
  }

  protected async onShutdown(): Promise<void> {
    // Service-specific cleanup
  }

  protected async checkDependencyHealth(dependency: string): Promise<ServiceHealth> {
    // Check specific dependency health
  }

  // Public service methods
  async doSomething(): Promise<void> {
    return this.executeWithMetrics(async () => {
      // Service logic with automatic metrics and error handling
    }, 'doSomething');
  }
}
```

2. **Register with Service Registry:**

```typescript
import { serviceRegistry } from './service-registry';
import { myService } from './my-service';

// Register service with dependencies
serviceRegistry.register(myService, ['AuthService', 'DatabaseService']);
```

3. **Initialize Services:**

```typescript
// Initialize all services in dependency order
await serviceRegistry.initializeAll();
```

### Error Handling Best Practices

1. **Use CustomError for known errors:**

```typescript
import { CustomError } from '../utils/error-handler';

throw new CustomError(
  'User not found',
  404,
  {
    code: 'USER_NOT_FOUND',
    context: { userId },
    userMessage: 'The requested user could not be found'
  }
);
```

2. **Let unknown errors bubble up:**

```typescript
// Unknown errors will be caught by global error handler
// and logged with full context
```

3. **Use correlation IDs:**

```typescript
// Correlation IDs are automatically added to requests
// and included in all log entries and error responses
```

### Configuration Usage

1. **Access configuration:**

```typescript
import { configManager } from '../config/config-manager';

const config = configManager.get();
const dbConfig = configManager.getSection('database');
```

2. **Environment variables:**

```bash
# Required variables
DATABASE_URL=postgresql://...
SESSION_SECRET=your-32-char-secret
JWT_SECRET=your-32-char-secret
OPENAI_API_KEY=sk-...
FROM_EMAIL=noreply@example.com

# Optional variables with defaults
NODE_ENV=development
PORT=3000
REDIS_ENABLED=true
AGENT_SQUAD_ENABLED=false
```

### Health Check Usage

1. **Register custom health checks:**

```typescript
import { healthCheckService } from './health-check-service';

healthCheckService.registerCheck('my-service', async () => {
  // Custom health check logic
  return {
    name: 'my-service',
    status: 'healthy',
    responseTime: 100,
    message: 'Service is operational'
  };
});
```

2. **Access health endpoints:**

```bash
# Basic health check
GET /api/health

# Detailed health report
GET /api/health/detailed

# Service-specific health
GET /api/health/services/AuthService

# Kubernetes probes
GET /api/health/ready    # Readiness probe
GET /api/health/live     # Liveness probe
GET /api/health/startup  # Startup probe

# ADF Conversation Dashboard endpoints (ADF-015)
GET /api/adf/conversations              # List conversations with filtering
GET /api/adf/conversations/stats        # Time-bucketed KPI metrics
GET /api/adf/conversations/:id          # Single conversation detail
GET /api/adf/conversations/:id/messages # Cursor-based message history
GET /api/adf/conversations/:id/lead-context # Lead/vehicle context
POST /api/adf/conversations/:id/events  # Log status/handover/notes
POST /api/adf/conversations/:id/status  # Change conversation status
```

## Migration Guide

### From Existing Services

1. **Update service to extend BaseService**
2. **Register with service registry**
3. **Update error handling to use CustomError**
4. **Add health check logic**
5. **Update initialization to use service registry**

### Testing the New Architecture

1. **Start the enhanced server:**

```bash
# Run the enhanced server
npm run dev:enhanced

# Or directly
npx ts-node server/enhanced-index.ts
```

2. **Check health endpoints:**

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/detailed
```

3. **Monitor logs for structured output**

## Real-Time Features (ADF-015)

The platform includes comprehensive real-time conversation capabilities:

### WebSocket Server Integration
- **Channel-based pub/sub**: `ws-server.ts` upgraded with dealership namespacing
- **Auto-reconnection**: Client-side WebSocket with ping/pong and dynamic subscribe/unsubscribe
- **Real-time events**: `new_message`, `conversation_updated`, `stats_updated`
- **Performance**: Observed latency ≤ 250ms on local tests at 30 RPS

### Database Integration (Migration 0014)
- **New tables**: `conversation_events`, `conversation_messages` with ADF linkage
- **Views**: `dealership_conversation_summary`, `customer_conversation_history`, `adf_conversation_metrics`
- **Triggers**: Auto-threading of inbound/outbound SMS, conversation status updates
- **Indexes**: GIN `search_vector` for <30ms full-text search, performance indexes on FK columns

### Frontend Dashboard Components
- **ConversationsPage**: Responsive dashboard with filters, pagination, charts
- **ChatMessage**: Rich message bubbles with delivery status and AI confidence
- **ConversationChart**: Re-charts based activity trends (day/week/month)
- **Mobile support**: Tailwind/ShadCN layout tested down to 375px

## Benefits

1. **Consistency:** All services follow the same patterns
2. **Observability:** Comprehensive logging and monitoring
3. **Reliability:** Standardized error handling and health checks
4. **Maintainability:** Clear service boundaries and dependencies
5. **Scalability:** Service registry enables easy service management
6. **Developer Experience:** Type-safe configuration and clear error messages
7. **Real-time capabilities:** WebSocket integration with conversation dashboard (ADF-015)

## Next Steps

1. **Migrate existing services** to the new architecture
2. **Add custom health checks** for external dependencies
3. **Implement service-specific metrics** collection
4. **Add integration tests** for service interactions
5. **Set up monitoring dashboards** using health check data
