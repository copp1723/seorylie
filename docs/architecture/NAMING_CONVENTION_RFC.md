# RFC: Unified Naming Convention Strategy
**RFC Number:** RFC-001  
**Title:** Establishing Single Source-of-Truth Naming Strategy  
**Status:** APPROVED  
**Created:** 2025-01-20  
**Authors:** Development Team  
**Reviewers:** Architecture Team, Lead Developers  
**Approved by:** Technical Lead, Database Admin, Frontend Lead  
**Date:** 2025-01-20  

## Executive Summary

This RFC establishes a unified naming strategy to resolve the current inconsistency between database snake_case conventions and TypeScript camelCase conventions. **DECISION: Maintain snake_case as the single source-of-truth with enhanced runtime mappers.**

## Current State Analysis

### Database Layer (snake_case)
```sql
-- Current schema follows PostgreSQL conventions
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

### Application Layer (Mixed Conventions)
```typescript
// Current TypeScript interfaces mix conventions
interface User {
  id: number;
  tenantId: string;    // camelCase
  created_at: Date;    // snake_case from DB
  updatedAt: Date;     // mixed approach
}
```

### Existing Infrastructure
- **Runtime Mappers:** Already implemented in `/shared/schema-mappers.ts`
- **Drizzle ORM:** Supports both `mapTo` and column aliases
- **API Layer:** Predominantly uses camelCase
- **Frontend:** Exclusively uses camelCase

## Decision Matrix

| Factor | snake_case + Mappers | camelCase + DB Mapping |
|--------|---------------------|------------------------|
| **Database Consistency** | ✅ PostgreSQL standard | ❌ Non-standard |
| **TypeScript Consistency** | ❌ Requires mapping | ✅ Native convention |
| **Migration Effort** | 🟡 Medium (runtime only) | 🔴 High (schema changes) |
| **Performance Impact** | 🟡 Runtime conversion | ✅ No conversion |
| **Tool Compatibility** | ✅ Standard DB tools | 🟡 Mixed support |
| **Team Velocity** | 🟡 Learning curve | ✅ Familiar patterns |
| **Backward Compatibility** | ✅ Full compatibility | 🔴 Breaking changes |

## **APPROVED SOLUTION: snake_case Single Source-of-Truth**

**Strategy:** Maintain database snake_case as the authoritative naming convention with enhanced runtime mapping.

### Implementation Architecture

1. **Enhanced Schema Definitions**
```typescript
// server/models/schema.ts
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true),
});

// Type inference maintains snake_case internally
export type UserDB = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

// Mapped types for application layer
export type User = {
  id: number;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
};
```

2. **Automated Mapping Layer**
```typescript
// shared/schema-mappers.ts (enhanced)
export class DatabaseMapper {
  static toCamelCase<T extends Record<string, any>>(obj: T): CamelCaseKeys<T> {
    return transformKeys(obj, toCamelCase);
  }
  
  static toSnakeCase<T extends Record<string, any>>(obj: T): SnakeCaseKeys<T> {
    return transformKeys(obj, toSnakeCase);
  }
  
  static createRepository<TTable, TSelect, TInsert>(table: TTable) {
    return {
      async findMany(where?: any): Promise<CamelCaseKeys<TSelect>[]> {
        const results = await db.select().from(table).where(where);
        return results.map(row => this.toCamelCase(row));
      },
      
      async create(data: SnakeCaseKeys<TInsert>): Promise<CamelCaseKeys<TSelect>> {
        const snakeData = this.toSnakeCase(data);
        const [result] = await db.insert(table).values(snakeData).returning();
        return this.toCamelCase(result);
      }
    };
  }
}
```

3. **Service Layer Integration**
```typescript
// server/services/user-service.ts
export class UserService {
  private userRepo = DatabaseMapper.createRepository(users);
  
  async createUser(userData: CreateUserRequest): Promise<User> {
    // Automatic snake_case conversion for DB
    const user = await this.userRepo.create(userData);
    // Automatic camelCase conversion for response
    return user;
  }
}
```

## Migration Policy

### Phase 1: Foundation (Weeks 1-2)
- [ ] Enhance `schema-mappers.ts` with type-safe converters
- [ ] Create automated repository pattern
- [ ] Update core schema definitions
- [ ] Implement comprehensive test suite

### Phase 2: Service Layer (Weeks 3-4)  
- [ ] Update all database services to use mappers
- [ ] Standardize API response formats
- [ ] Update authentication/authorization layers
- [ ] Migrate business logic services

### Phase 3: API Standardization (Weeks 5-6)
- [ ] Ensure all API endpoints return camelCase
- [ ] Update API documentation
- [ ] Implement validation schemas
- [ ] Add backward compatibility headers

### Phase 4: Frontend Alignment (Week 7)
- [ ] Update frontend TypeScript interfaces
- [ ] Remove manual case conversions
- [ ] Update component prop types
- [ ] Validate end-to-end consistency

## Backward Compatibility Notes

### API Versioning
```typescript
// Support both conventions during transition
app.get('/v1/users', (req, res) => {
  // Legacy snake_case support
  const users = await getUsersSnakeCase();
  res.json(users);
});

app.get('/v2/users', (req, res) => {
  // New camelCase standard
  const users = await getUsersCamelCase();
  res.json(users);
});
```

### Database Safety
```sql
-- No schema changes required
-- Existing queries continue to work
SELECT user_id, created_at, tenant_id 
FROM users 
WHERE is_active = true;
```

## Quality Assurance

### Automated Testing
```typescript
// Test naming consistency
describe('Naming Convention Compliance', () => {
  it('should maintain snake_case in database', async () => {
    const rawQuery = await db.execute(sql`SELECT * FROM users LIMIT 1`);
    expect(Object.keys(rawQuery[0])).toEqual(['id', 'tenant_id', 'created_at']);
  });
  
  it('should provide camelCase in API responses', async () => {
    const response = await request(app).get('/api/users');
    expect(Object.keys(response.body[0])).toEqual(['id', 'tenantId', 'createdAt']);
  });
});
```

### Performance Considerations
- Runtime conversion overhead: ~1-2ms per request
- Memory allocation for object transformation
- Caching strategy for repeated conversions

## Risk Mitigation

### Technical Risks
- **Performance:** Monitor runtime conversion overhead
- **Memory:** Object transformation memory usage
- **Complexity:** Additional abstraction layer

### Rollback Plan
- Feature flags to disable mapping layer
- Direct database access fallback
- Version-controlled schema changes
- Blue-green deployment strategy

## Success Metrics

### Technical Metrics
- [ ] 100% API responses use camelCase
- [ ] Zero schema migration failures
- [ ] <5ms performance overhead for mapping
- [ ] 90%+ test coverage for mapping utilities

### Team Metrics
- [ ] Developer onboarding time reduced by 30%
- [ ] Naming-related bugs reduced by 80%
- [ ] Code review time for DB changes reduced by 50%

## Rationale for Decision

1. **Minimal Risk:** No breaking database changes
2. **Standard Compliance:** Maintains PostgreSQL conventions
3. **Developer Experience:** Provides TypeScript-friendly APIs
4. **Backward Compatibility:** Existing queries remain functional
5. **Incremental Migration:** Can be implemented progressively

---

**Next Steps:**
1. Begin Phase 1 implementation
2. Update development documentation
3. Schedule team training sessions
4. Establish monitoring and metrics collection

**Status:** APPROVED ✅ - Implementation begins immediately
