# Schema Coordination Document

## Overview
This document outlines the schema dependencies between UI components and database schema that need coordination between Agent 1 (Database/Schema) and Agent 2 (UI Components).

## Current Status

### Completed UI Fixes
1. ✅ React Query v5 Migration - Changed all `isLoading` to `isPending`
2. ✅ Fixed TypeScript errors in dashboard components
3. ✅ Fixed unused imports and parameters
4. ✅ Fixed type mismatches in components

### Schema Dependencies from UI

#### User Schema
The UI expects these fields on the User type:
```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  role: string;
  dealershipId?: number;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Analytics Data Schema
The analytics components expect:
```typescript
interface AnalyticsData {
  summary: {
    sessions: number;
    users: number;
    pageviews: number;
    avgSessionDuration: number;
    bounceRate: number;
    conversions: number;
  };
  comparison: {
    sessions: number;
    users: number;
    pageviews: number;
    conversions: number;
  };
  dailyMetrics: Array<{
    date: string;
    sessions: number;
    users: number;
    pageviews: number;
    conversions: number;
  }>;
  // ... additional fields
}
```

#### Form Validation Schemas
Located in `web-console/src/schemas/validation.ts`:
- Login/Register schemas expect specific user fields
- Profile schema expects user profile fields
- These should align with database schema

## Naming Convention Impact

### Current UI Implementation
- Frontend uses **camelCase** throughout (TypeScript/React standard)
- API responses are expected in camelCase
- Zod schemas validate camelCase fields

### Required Coordination
1. If Agent 1 chooses snake_case in DB with runtime mappers:
   - We need a transformation layer in API responses
   - Update services to handle the mapping
   
2. If Agent 1 chooses camelCase everywhere:
   - UI remains unchanged
   - Ensure Drizzle schema exports match our interfaces

## Action Items for UI Team

1. **Wait for Agent 1's naming decision** before updating API service layers
2. **Update type imports** once new schema is ready
3. **Test form submissions** with new schema structure
4. **Update authentication flow** if user schema changes significantly

## Shared Types Location
Recommend creating shared types in:
- `/shared/types/user.ts`
- `/shared/types/analytics.ts`
- `/shared/types/dealership.ts`

This allows both backend and frontend to import from same source.

## Testing Requirements
After schema changes:
1. Run `tsc --noEmit` in both root and web-console
2. Test all forms with actual API calls
3. Verify authentication flow
4. Check analytics data display

## Communication Protocol
1. Agent 1 should notify immediately when:
   - Naming convention is decided
   - Any user/auth schema changes
   - New required fields are added
   
2. UI team will update this document with:
   - New schema requirements from UI
   - Breaking changes in validation
   - New form fields needed