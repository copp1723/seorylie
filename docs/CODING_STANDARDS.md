# CleanRylie Coding Standards

## File Naming Conventions

### Components
- **React Components**: Use PascalCase with `.tsx` extension
  - ✅ `ChatInterface.tsx`
  - ✅ `VehicleCard.tsx`
  - ❌ `chat-interface.tsx`
  - ❌ `vehicleCard.tsx`

### Hooks
- **Custom Hooks**: Use camelCase with `use` prefix and `.ts` extension
  - ✅ `useAuth.ts`
  - ✅ `useLocalStorage.ts`
  - ❌ `use-auth.ts`
  - ❌ `useAuth.tsx` (unless returning JSX)

### Services & Utilities
- **Services**: Use kebab-case with `-service` suffix and `.ts` extension
  - ✅ `conversation-service.ts`
  - ✅ `lead-management-service.ts`
  - ❌ `conversationService.ts`

- **Utilities**: Use kebab-case with `.ts` extension
  - ✅ `api-client.ts`
  - ✅ `error-handler.ts`
  - ❌ `apiClient.ts`

### Pages/Routes
- **Pages**: Use kebab-case with `.tsx` extension
  - ✅ `auth-login.tsx`
  - ✅ `dealership-setup.tsx`
  - ❌ `AuthLogin.tsx`

### Database & Schema
- **Migrations**: Use numeric prefix with descriptive name
  - ✅ `0001_lead_management_schema.sql`
  - ✅ `0002_agent_squad_tracking.sql`

## Directory Structure

```
cleanrylie/
├── client/                    # Frontend application
│   ├── src/
│   │   ├── components/        # Reusable React components
│   │   │   ├── ui/           # Base UI components (shadcn/ui)
│   │   │   ├── forms/        # Form-specific components
│   │   │   ├── layout/       # Layout components
│   │   │   └── [feature]/    # Feature-specific components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Page components
│   │   ├── contexts/         # React contexts
│   │   ├── lib/              # Client-side utilities
│   │   ├── types/            # TypeScript type definitions
│   │   └── utils/            # Helper functions
├── server/                   # Backend application
│   ├── routes/               # API route handlers
│   ├── services/             # Business logic services
│   ├── middleware/           # Express middleware
│   ├── utils/                # Server utilities
│   └── types/                # Server type definitions
├── shared/                   # Shared code between client/server
├── docs/                     # Project documentation
│   ├── tickets/              # Completed ticket summaries
│   └── reports/              # Testing and analysis reports
├── migrations/               # Database migrations
├── scripts/                  # Build and deployment scripts
├── test/                     # Test files
└── monitoring/               # Observability configuration
```

## Import/Export Patterns

### Index Files
- Use `index.ts` files to create clean module boundaries
- Export only public API from modules

```typescript
// ✅ components/ui/index.ts
export { Button } from './button';
export { Input } from './input';
export { Card } from './card';

// ✅ services/index.ts
export { conversationService } from './conversation-service';
export { leadService } from './lead-service';
```

### Import Order
1. React and external libraries
2. Internal components and utilities
3. Types and interfaces
4. Relative imports

```typescript
// ✅ Correct import order
import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { conversationService } from '@/services';

import type { User } from '@/types/auth';

import './styles.css';
```

### Path Aliases
- Use `@/` for absolute imports from `src/`
- Avoid relative imports beyond one level

```typescript
// ✅ Good
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// ❌ Avoid
import { Button } from '../../../components/ui/button';
```

## Component Organization

### Component Structure
```typescript
// ✅ Recommended component structure
import React from 'react';
import type { ComponentProps } from './types';

interface Props extends ComponentProps {
  // Component-specific props
}

export function ComponentName({ prop1, prop2, ...rest }: Props) {
  // Hooks at the top
  const [state, setState] = useState();
  const queryResult = useQuery();
  
  // Event handlers
  const handleClick = () => {
    // handler logic
  };
  
  // Early returns
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState />;
  
  // Main render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

### Props Interface
- Define props interfaces in the same file
- Use descriptive prop names
- Provide default values when appropriate

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ 
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick 
}: ButtonProps) {
  // Component implementation
}
```

## Service Layer Structure

### Service Organization
- One service per domain/feature
- Use dependency injection for external dependencies
- Implement error handling consistently

```typescript
// ✅ conversation-service.ts
class ConversationService {
  constructor(
    private db: Database,
    private aiService: AIService
  ) {}
  
  async createConversation(data: CreateConversationData): Promise<Conversation> {
    try {
      // Service logic
    } catch (error) {
      throw new ServiceError('Failed to create conversation', error);
    }
  }
}

export const conversationService = new ConversationService(db, aiService);
```

## TypeScript Conventions

### Type Definitions
- Use interfaces for object shapes
- Use type aliases for unions and complex types
- Prefer explicit typing over `any`

```typescript
// ✅ Good
interface User {
  id: number;
  email: string;
  role: UserRole;
}

type UserRole = 'admin' | 'dealer' | 'agent';

// ❌ Avoid
const user: any = getUserData();
```

### Generic Types
- Use descriptive generic parameter names
- Provide constraints when appropriate

```typescript
// ✅ Good
interface ApiResponse<TData> {
  data: TData;
  success: boolean;
  message?: string;
}

interface Repository<TEntity extends { id: number }> {
  findById(id: number): Promise<TEntity>;
  save(entity: TEntity): Promise<TEntity>;
}
```

## Error Handling

### Client-Side Errors
- Use Error Boundaries for React components
- Implement toast notifications for user-facing errors
- Log errors for debugging

```typescript
// ✅ Component error handling
const { data, error, isLoading } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  onError: (error) => {
    toast.error({
      title: 'Failed to load user',
      description: error.message
    });
  }
});
```

### Server-Side Errors
- Use structured error responses
- Implement proper HTTP status codes
- Log errors with context

```typescript
// ✅ API error handling
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userService.findById(req.params.id);
    res.json({ data: user, success: true });
  } catch (error) {
    logger.error('Failed to fetch user', { userId: req.params.id, error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});
```

## Testing Standards

### Test File Organization
- Place tests adjacent to source files with `.test.ts` suffix
- Use descriptive test names
- Group related tests with `describe` blocks

```typescript
// ✅ user-service.test.ts
describe('UserService', () => {
  describe('findById', () => {
    it('should return user when found', async () => {
      // Test implementation
    });
    
    it('should throw error when user not found', async () => {
      // Test implementation
    });
  });
});
```

## Database Conventions

### Migration Management
- Use sequential numbering for migrations
- Include rollback scripts
- Test migrations on copy of production data

### Schema Naming
- Use snake_case for table and column names
- Use descriptive table names
- Include proper indexes and constraints

```sql
-- ✅ Good migration structure
CREATE TABLE conversation_logs (
  id SERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id INTEGER REFERENCES users(id),
  message_content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversation_logs_conversation_id ON conversation_logs(conversation_id);
CREATE INDEX idx_conversation_logs_user_id ON conversation_logs(user_id);
```

## Performance Guidelines

### Client-Side Performance
- Use React.memo for expensive components
- Implement proper code splitting
- Optimize bundle size with tree shaking

### Server-Side Performance
- Implement database connection pooling
- Use caching for frequently accessed data
- Monitor API response times

## Security Best Practices

### Authentication & Authorization
- Use JWT tokens with proper expiration
- Implement role-based access control
- Validate all user inputs

### Data Protection
- Never log sensitive information
- Use environment variables for secrets
- Implement proper CORS policies

## Documentation Requirements

### Code Documentation
- Document complex business logic
- Include JSDoc comments for public APIs
- Maintain up-to-date README files

### API Documentation
- Use OpenAPI/Swagger specifications
- Include request/response examples
- Document error responses

## Git Workflow

### Commit Messages
- Use conventional commit format
- Include ticket references
- Write descriptive commit messages

```
feat(auth): implement magic link authentication

- Add magic link generation endpoint
- Implement email verification flow
- Update auth hook to support magic links

Resolves: TICKET-123
```

### Branch Naming
- Use consistent branch naming patterns
- Include ticket references

```
feature/TICKET-123-magic-link-auth
fix/TICKET-456-login-redirect-issue
chore/update-dependencies
```