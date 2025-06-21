# Schema Migration Guide: Dual-Case Support Implementation

This guide demonstrates how to implement the enhanced dual-case schema support to resolve naming mismatches between database snake_case conventions and TypeScript camelCase conventions.

## Overview

The enhanced schema system provides:
- **Dual-case support**: Accepts both snake_case and camelCase during transition
- **Deprecation warnings**: Alerts developers to wrong-case usage  
- **Automatic transformation**: Maps snake_case DB columns to camelCase TS keys
- **Phase-out mechanism**: Structured approach to eliminate deprecated variants

## Implementation Steps

### Step 1: Update Schema Imports

**Before (legacy approach):**
```typescript
// shared/some-service.ts
import { createInsertSchema } from 'drizzle-zod';
import { users } from './schema';

const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
```

**After (enhanced approach):**
```typescript
// shared/some-service.ts
import { createMappedSchemas } from './schema-mappers';
import { users } from './schema';

const userSchemas = createMappedSchemas(users, {
  deprecationWarnings: true,
  transitionalSupport: true,
  omitFromInsert: ['id', 'createdAt', 'updatedAt']
});

// Use userSchemas.insert and userSchemas.select
```

### Step 2: Update API Endpoint Handlers

**Before:**
```typescript
// server/routes/users.ts
app.post('/api/users', async (req, res) => {
  try {
    // No validation or case conversion
    const userData = req.body;
    const [user] = await db.insert(users).values(userData).returning();
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

**After:**
```typescript
// server/routes/users.ts
import { enhancedUserSchemas, apiUserSchema, validateForDatabase, transformForAPI } from '../shared/enhanced-schemas';

app.post('/api/users', async (req, res) => {
  try {
    // Validate and transform input (accepts both camelCase and snake_case)
    const validatedData = validateForDatabase(
      enhancedUserSchemas.insert, 
      req.body, 
      'user'
    );
    
    // Insert to database (data is properly formatted for DB)
    const [dbUser] = await db.insert(users).values(validatedData).returning();
    
    // Transform DB result to API format (camelCase)
    const apiUser = transformForAPI(dbUser, apiUserSchema);
    
    res.json(apiUser);
  } catch (error) {
    console.error('User creation failed:', error);
    res.status(400).json({ error: error.message });
  }
});
```

### Step 3: Implement Transitional Request Schemas

```typescript
// shared/enhanced-schemas.ts
export const createUserRequestSchema = createTransitionalSchema(
  {
    username: z.string().min(1),
    name: z.string().min(1).optional(),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['admin', 'user', 'agent']).default('user'),
    dealershipId: z.number().optional(),
    isActive: z.boolean().default(true)
  },
  {
    // Legacy field mappings that trigger deprecation warnings
    'user_name': 'username',
    'email_address': 'email', 
    'dealership_id': 'dealershipId',
    'is_active': 'isActive'
  }
);
```

### Step 4: Update Database Service Layer

**Before:**
```typescript
// server/services/user-service.ts
export class UserService {
  async createUser(userData: any) {
    // Direct insertion, no validation
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }
  
  async getUsers() {
    return await db.select().from(users);
  }
}
```

**After:**
```typescript
// server/services/user-service.ts
import { enhancedUserSchemas, apiUserSchema, type CreateUserRequest, type EnhancedUser } from '../shared/enhanced-schemas';

export class UserService {
  async createUser(userData: CreateUserRequest): Promise<EnhancedUser> {
    // Schema handles both case conversion and validation
    const validatedData = enhancedUserSchemas.insert.parse(userData);
    
    const [dbUser] = await db.insert(users).values(validatedData).returning();
    
    // Transform to API format (camelCase)
    return enhancedUserSchemas.select.parse(dbUser);
  }
  
  async getUsers(): Promise<EnhancedUser[]> {
    const dbUsers = await db.select().from(users);
    
    // Transform all results to camelCase
    return dbUsers.map(user => enhancedUserSchemas.select.parse(user));
  }
}
```

### Step 5: Handle Legacy API Endpoints

```typescript
// server/routes/legacy-users.ts (temporary endpoint for backward compatibility)
import { legacyUserWrapper } from '../shared/enhanced-schemas';

app.get('/api/v1/users', async (req, res) => {
  try {
    const dbUsers = await db.select().from(users);
    
    // Use legacy wrapper that provides deprecation warnings
    const legacyUsers = dbUsers.map(user => 
      legacyUserWrapper.validate(user)
    );
    
    // Add deprecation header
    res.header('X-API-Deprecated', 'This endpoint is deprecated. Use /api/v2/users for camelCase responses.');
    res.header('X-API-Migration', 'https://docs.example.com/api-migration');
    
    res.json(legacyUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v2/users', async (req, res) => {
  try {
    const userService = new UserService();
    const users = await userService.getUsers();
    
    res.json(users); // Already in camelCase format
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Frontend Integration

### React Component Updates

**Before:**
```typescript
// web-console/src/components/UserForm.tsx
interface User {
  id: number;
  username: string;
  email: string;
  dealership_id: number; // Mixed case!
  isActive: boolean;
  created_at: string;    // Mixed case!
  updated_at: string;    // Mixed case!
}

const createUser = async (userData: any) => {
  // Manual case conversion
  const payload = {
    username: userData.username,
    email: userData.email,
    dealership_id: userData.dealershipId, // Manual conversion
    is_active: userData.isActive           // Manual conversion
  };
  
  return await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};
```

**After:**
```typescript
// web-console/src/components/UserForm.tsx
import type { EnhancedUser, CreateUserRequest } from '../../../shared/enhanced-schemas';

interface UserFormData {
  username: string;
  email: string;
  dealershipId: number;  // Consistent camelCase
  isActive: boolean;     // Consistent camelCase
}

const createUser = async (userData: CreateUserRequest): Promise<EnhancedUser> => {
  // No manual conversion needed - API handles both cases
  const response = await fetch('/api/v2/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData) // Send camelCase directly
  });
  
  if (!response.ok) {
    throw new Error('Failed to create user');
  }
  
  return response.json(); // Returns camelCase automatically
};
```

## Monitoring and Migration Tracking

### Add Deprecation Monitoring

```typescript
// server/middleware/deprecation-tracker.ts
import { Request, Response, NextFunction } from 'express';

interface DeprecationEvent {
  endpoint: string;
  deprecatedKeys: string[];
  clientInfo: {
    userAgent: string;
    ip: string;
    timestamp: Date;
  };
}

export function trackDeprecationUsage(req: Request, res: Response, next: NextFunction) {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Check for deprecated usage patterns
    if (req.body && hasDeprecatedKeys(req.body)) {
      const deprecatedKeys = Object.keys(req.body).filter(key => key.includes('_'));
      
      // Log deprecation event
      console.warn('[DEPRECATION-TRACKER]', {
        endpoint: req.path,
        method: req.method,
        deprecatedKeys,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date()
      });
      
      // Add response headers for client awareness
      res.header('X-Deprecated-Keys', deprecatedKeys.join(','));
      res.header('X-Migration-Guide', 'https://docs.example.com/api-migration');
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}

function hasDeprecatedKeys(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return Object.keys(obj).some(key => key.includes('_'));
}
```

### Migration Metrics Dashboard

```typescript
// server/routes/migration-metrics.ts
app.get('/admin/migration-metrics', async (req, res) => {
  // Return metrics about deprecated usage
  const metrics = {
    totalDeprecatedRequests: await getDeprecatedRequestCount(),
    endpointsUsingDeprecatedKeys: await getEndpointsWithDeprecatedUsage(),
    clientsNeedingMigration: await getClientsUsingDeprecatedAPIs(),
    migrationProgress: await calculateMigrationProgress()
  };
  
  res.json(metrics);
});
```

## Testing Strategy

### Unit Tests for Schema Validation

```typescript
// shared/__tests__/enhanced-schemas.test.ts
describe('Enhanced Schema Validation', () => {
  describe('createUserSchema', () => {
    it('should accept camelCase input', () => {
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        dealershipId: 123,
        isActive: true
      };
      
      const result = enhancedUserSchemas.insert.safeParse(validData);
      expect(result.success).toBe(true);
    });
    
    it('should accept snake_case input with warnings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const validData = {
        username: 'testuser',
        email: 'test@example.com',
        dealership_id: 123,  // snake_case
        is_active: true      // snake_case
      };
      
      const result = enhancedUserSchemas.insert.safeParse(validData);
      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[API-DEPRECATION]')
      );
      
      consoleSpy.mockRestore();
    });
    
    it('should handle legacy field mappings', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const legacyData = {
        user_name: 'testuser',      // Legacy mapping
        email_address: 'test@example.com', // Legacy mapping
        dealership_id: 123
      };
      
      const result = createUserSchema.safeParse(legacyData);
      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATION]')
      );
      
      consoleSpy.mockRestore();
    });
  });
});
```

### Integration Tests

```typescript
// server/__tests__/api-integration.test.ts
describe('API Integration with Enhanced Schemas', () => {
  it('should handle camelCase POST request', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      dealershipId: 123
    };
    
    const response = await request(app)
      .post('/api/v2/users')
      .send(userData)
      .expect(201);
    
    expect(response.body).toMatchObject({
      id: expect.any(Number),
      username: 'testuser',
      email: 'test@example.com',
      dealershipId: 123,
      // Should return camelCase
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
  });
  
  it('should handle snake_case POST request with deprecation warnings', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      dealership_id: 123  // snake_case
    };
    
    const response = await request(app)
      .post('/api/v2/users')
      .send(userData)
      .expect(201);
    
    // Should still work but with deprecation headers
    expect(response.headers['x-deprecated-keys']).toContain('dealership_id');
    expect(response.body.dealershipId).toBe(123); // Converted to camelCase
  });
});
```

## Migration Timeline

### Phase 1: Foundation (Weeks 1-2)
- [ ] Implement enhanced schema mappers
- [ ] Update core schema definitions  
- [ ] Add comprehensive test suite
- [ ] Create deprecation tracking middleware

### Phase 2: API Layer (Weeks 3-4)
- [ ] Update all API endpoints to use enhanced schemas
- [ ] Implement dual-case support in request handlers
- [ ] Add deprecation warnings and headers
- [ ] Create v2 endpoints with pure camelCase

### Phase 3: Service Layer (Weeks 5-6)
- [ ] Update database services to use enhanced schemas
- [ ] Implement automatic case conversion
- [ ] Add validation and error handling
- [ ] Update business logic services

### Phase 4: Frontend Migration (Weeks 7-8)
- [ ] Update TypeScript interfaces to use enhanced types
- [ ] Remove manual case conversions in frontend code
- [ ] Update API client to use v2 endpoints
- [ ] Add error handling for schema validation

### Phase 5: Cleanup (Weeks 9-10)
- [ ] Analyze deprecation usage metrics
- [ ] Remove legacy endpoints and schemas
- [ ] Update documentation
- [ ] Remove transitional support code

## Best Practices

1. **Always use enhanced schemas** for new code
2. **Monitor deprecation warnings** in development
3. **Test both case variants** during transition period
4. **Use TypeScript types** from enhanced schemas
5. **Track migration progress** with metrics
6. **Communicate changes** to API consumers
7. **Maintain backward compatibility** during transition
8. **Remove deprecated support** only after migration window

## Troubleshooting

### Common Issues

**Issue**: Schema validation fails with mixed case data
```typescript
// Problem: Manual case conversion
const badData = {
  username: 'test',
  dealership_id: 123,  // snake_case
  isActive: true       // camelCase
};

// Solution: Use transitional schemas
const goodData = createUserSchema.parse(badData); // Handles mixed case
```

**Issue**: Frontend receives snake_case from API
```typescript
// Problem: Using legacy endpoint
const users = await fetch('/api/v1/users').then(r => r.json());
// users[0].created_at (snake_case)

// Solution: Use v2 endpoint
const users = await fetch('/api/v2/users').then(r => r.json());
// users[0].createdAt (camelCase)
```

**Issue**: Database insert fails with camelCase
```typescript
// Problem: Direct insertion without schema
await db.insert(users).values({ dealershipId: 123 }); // Fails - dealershipId doesn't exist in DB

// Solution: Use enhanced schema
const validatedData = enhancedUserSchemas.insert.parse({ dealershipId: 123 });
await db.insert(users).values(validatedData); // Works - converts dealershipId to dealership_id
```

This migration approach ensures a smooth transition from mixed naming conventions to a standardized snake_case (DB) → camelCase (API/TS) pattern while maintaining backward compatibility during the deprecation window.
