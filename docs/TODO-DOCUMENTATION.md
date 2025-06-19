# TODO Documentation

This document tracks all TODO comments in the codebase with context and recommendations.

## Critical TODOs

### 1. Webhook Service - Database Tables Missing (17 TODOs)
**Location**: `/server/services/webhooks.ts`
**Issue**: The webhook service references `webhooks`, `webhookSubscriptions`, and `webhookTemplates` tables that don't exist in the schema.
**Impact**: High - Webhook functionality is completely non-functional
**Recommendation**: 
- Add missing tables to the database schema
- Create migration scripts
- Or remove webhook service if not needed

### 2. ADF Service - Missing Modules (5 TODOs)
**Location**: `/server/services/adf-service.ts`
**Issue**: References to `adfEmailListener` and `adfResponseOrchestrator` modules that don't exist
**Impact**: Medium - Some ADF functionality is disabled
**Recommendation**: 
- Implement the missing modules
- Or refactor to use existing services

### 3. Conversation Logs Service - Missing Aggregations (6 TODOs)
**Location**: `/server/services/conversation-logs-service.ts`
**Issue**: Missing implementations for:
- Status aggregation
- Channel aggregation  
- Daily stats aggregation
**Impact**: Medium - Analytics features incomplete
**Recommendation**: Implement aggregation methods using SQL queries

## Medium Priority TODOs

### 4. WebSocket Service - Enhanced Features (3 TODOs)
**Location**: `/server/services/websocket-service.ts`
**Issue**: 
- Rate limiting per connection
- Enhanced error handling for specific scenarios
- Connection quality monitoring
**Impact**: Low - Nice-to-have features
**Recommendation**: Implement when scaling requires these features

### 5. Handover Service - Dealership Email Config (1 TODO)
**Location**: `/server/services/handover-service.ts`
**Issue**: Hardcoded email fallback instead of dealership-specific configs
**Impact**: Low - System works with fallback
**Recommendation**: Add dealership email configuration table

### 6. Response Time Calculation (1 TODO)
**Location**: `/server/services/conversation-service.ts`
**Issue**: Average response time hardcoded to 0
**Impact**: Low - Metrics accuracy
**Recommendation**: Calculate from message timestamps

## Low Priority TODOs

### 7. Agent Squad Stub (1 TODO)
**Location**: `/server/lib/agent-squad-stub.ts`
**Issue**: Stub implementation waiting for actual package
**Impact**: Low - Stub is functional
**Recommendation**: Replace when agent-squad package is available

### 8. API Auth Middleware (1 TODO)
**Location**: `/server/middleware/api-auth.ts`
**Issue**: Implement proper API key validation
**Impact**: Low - Basic auth works
**Recommendation**: Enhance when needed

### 9. Python Vendor Relay (3 TODOs)
**Location**: `/apps/vendor-relay/src/main.py`
**Issue**: Missing error handling and retry logic
**Impact**: Low - Separate service
**Recommendation**: Implement as needed

### 10. Frontend Prompt Testing (4 TODOs)
**Location**: `/client/src/components/prompt-testing/PromptExperimentInterface.tsx`
**Issue**: UI enhancements and features
**Impact**: Low - UI improvements
**Recommendation**: Implement based on user feedback

## Summary

Total TODOs: 47 across 15 files

Priority Breakdown:
- Critical: 22 TODOs (webhook and ADF services)
- Medium: 10 TODOs (analytics and monitoring)
- Low: 15 TODOs (enhancements and UI)

Most TODOs are related to incomplete features rather than bugs. The webhook service has the most TODOs and appears to be partially implemented.