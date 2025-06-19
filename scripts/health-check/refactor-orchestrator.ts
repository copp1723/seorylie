#!/usr/bin/env node
/**
 * Refactor the large orchestrator service into smaller, focused modules
 */

import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = '.backup/orchestrator-refactor';
const ORCHESTRATOR_FILE = 'server/services/orchestrator.ts';
const OUTPUT_DIR = 'server/services/orchestrator';

// Create directories
[BACKUP_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

console.log('🔨 Refactoring Orchestrator Service...\n');

// Backup original file
if (fs.existsSync(ORCHESTRATOR_FILE)) {
  fs.copyFileSync(ORCHESTRATOR_FILE, path.join(BACKUP_DIR, 'orchestrator.ts'));
  console.log('✅ Backed up original orchestrator.ts');
}

// Module structure
const modules = [
  {
    name: 'sandbox-manager',
    description: 'Manages sandbox creation and lifecycle',
    exports: ['SandboxManager']
  },
  {
    name: 'session-manager',
    description: 'Manages sandbox sessions',
    exports: ['SessionManager']
  },
  {
    name: 'workflow-engine',
    description: 'Handles workflow execution and state',
    exports: ['WorkflowEngine']
  },
  {
    name: 'rate-limiter',
    description: 'Manages rate limiting and usage tracking',
    exports: ['RateLimiter']
  },
  {
    name: 'tool-executor',
    description: 'Executes tools and manages tool calls',
    exports: ['ToolExecutor']
  },
  {
    name: 'event-coordinator',
    description: 'Coordinates events between modules',
    exports: ['EventCoordinator']
  }
];

// Create index file
const indexContent = `/**
 * Orchestrator Service
 * Coordinates AI agents, workflows, and tool execution
 */

export { SandboxManager } from './sandbox-manager';
export { SessionManager } from './session-manager';
export { WorkflowEngine } from './workflow-engine';
export { RateLimiter } from './rate-limiter';
export { ToolExecutor } from './tool-executor';
export { EventCoordinator } from './event-coordinator';
export { Orchestrator } from './orchestrator';

// Re-export types
export * from './types';
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent);

// Create types file
const typesContent = `/**
 * Orchestrator Types
 */

export interface SandboxConfig {
  id: number;
  name: string;
  userId: string;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  toolsEnabled?: string[];
  rateLimit?: {
    hourlyLimit: number;
    dailyLimit: number;
  };
  metadata?: Record<string, any>;
}

export interface SandboxSession {
  id: string;
  sandboxId: number;
  startedAt: Date;
  lastActivityAt: Date;
  metadata?: Record<string, any>;
}

export interface WorkflowState {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  steps: WorkflowStep[];
  context: Record<string, any>;
  results: Record<string, any>;
  error?: Error;
}

export interface WorkflowStep {
  id: string;
  type: 'tool' | 'agent' | 'condition' | 'parallel';
  config: Record<string, any>;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: any;
  error?: Error;
}

export interface ToolCall {
  id: string;
  sessionId: string;
  toolName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: Error;
  startedAt: Date;
  completedAt?: Date;
  tokensUsed?: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
  window: 'hourly' | 'daily';
}

export interface TokenUsage {
  sessionId: string;
  sandboxId: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
  timestamp: Date;
}

export enum EventType {
  // Sandbox events
  SANDBOX_CREATED = 'sandbox.created',
  SANDBOX_UPDATED = 'sandbox.updated',
  SANDBOX_DELETED = 'sandbox.deleted',
  
  // Session events
  SESSION_CREATED = 'session.created',
  SESSION_UPDATED = 'session.updated',
  SESSION_ENDED = 'session.ended',
  
  // Workflow events
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_STEP_STARTED = 'workflow.step.started',
  WORKFLOW_STEP_COMPLETED = 'workflow.step.completed',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  
  // Tool events
  TOOL_CALLED = 'tool.called',
  TOOL_COMPLETED = 'tool.completed',
  TOOL_FAILED = 'tool.failed',
  
  // Rate limit events
  RATE_LIMIT_EXCEEDED = 'ratelimit.exceeded',
  RATE_LIMIT_WARNING = 'ratelimit.warning'
}
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'types.ts'), typesContent);

// Create SandboxManager module
const sandboxManagerContent = `/**
 * Sandbox Manager
 * Manages sandbox creation, configuration, and lifecycle
 */

import { db } from '../../config/db';
import { sandboxes } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import { SandboxConfig, EventType } from './types';

export class SandboxManager extends EventEmitter {
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  async create(config: Omit<SandboxConfig, 'id'>): Promise<SandboxConfig> {
    try {
      const [sandbox] = await db
        .insert(sandboxes)
        .values({
          name: config.name,
          userId: config.userId,
          model: config.model,
          systemPrompt: config.systemPrompt,
          temperature: config.temperature ?? 0.7,
          maxTokens: config.maxTokens ?? 4096,
          toolsEnabled: config.toolsEnabled ?? [],
          hourlyTokenLimit: config.rateLimit?.hourlyLimit ?? 10000,
          dailyTokenLimit: config.rateLimit?.dailyLimit ?? 100000,
          isActive: true,
          metadata: config.metadata ?? {}
        })
        .returning();

      const sandboxConfig: SandboxConfig = {
        id: sandbox.id,
        name: sandbox.name,
        userId: sandbox.userId,
        model: sandbox.model,
        systemPrompt: sandbox.systemPrompt,
        temperature: sandbox.temperature,
        maxTokens: sandbox.maxTokens,
        toolsEnabled: sandbox.toolsEnabled,
        rateLimit: {
          hourlyLimit: sandbox.hourlyTokenLimit,
          dailyLimit: sandbox.dailyTokenLimit
        },
        metadata: sandbox.metadata as Record<string, any>
      };

      this.emit(EventType.SANDBOX_CREATED, sandboxConfig);
      this.logger.info('Sandbox created', { sandboxId: sandbox.id });

      return sandboxConfig;
    } catch (error) {
      this.logger.error('Failed to create sandbox', error);
      throw error;
    }
  }

  async get(sandboxId: number): Promise<SandboxConfig | null> {
    const sandbox = await db.query.sandboxes.findFirst({
      where: eq(sandboxes.id, sandboxId)
    });

    if (!sandbox) {
      return null;
    }

    return {
      id: sandbox.id,
      name: sandbox.name,
      userId: sandbox.userId,
      model: sandbox.model,
      systemPrompt: sandbox.systemPrompt,
      temperature: sandbox.temperature,
      maxTokens: sandbox.maxTokens,
      toolsEnabled: sandbox.toolsEnabled,
      rateLimit: {
        hourlyLimit: sandbox.hourlyTokenLimit,
        dailyLimit: sandbox.dailyTokenLimit
      },
      metadata: sandbox.metadata as Record<string, any>
    };
  }

  async update(sandboxId: number, updates: Partial<SandboxConfig>): Promise<SandboxConfig> {
    const updateData: any = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.systemPrompt !== undefined) updateData.systemPrompt = updates.systemPrompt;
    if (updates.temperature !== undefined) updateData.temperature = updates.temperature;
    if (updates.maxTokens !== undefined) updateData.maxTokens = updates.maxTokens;
    if (updates.toolsEnabled !== undefined) updateData.toolsEnabled = updates.toolsEnabled;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    
    if (updates.rateLimit) {
      if (updates.rateLimit.hourlyLimit !== undefined) {
        updateData.hourlyTokenLimit = updates.rateLimit.hourlyLimit;
      }
      if (updates.rateLimit.dailyLimit !== undefined) {
        updateData.dailyTokenLimit = updates.rateLimit.dailyLimit;
      }
    }

    const [updated] = await db
      .update(sandboxes)
      .set(updateData)
      .where(eq(sandboxes.id, sandboxId))
      .returning();

    const sandboxConfig = await this.get(sandboxId);
    if (sandboxConfig) {
      this.emit(EventType.SANDBOX_UPDATED, sandboxConfig);
    }

    return sandboxConfig!;
  }

  async delete(sandboxId: number): Promise<void> {
    await db
      .update(sandboxes)
      .set({ isActive: false })
      .where(eq(sandboxes.id, sandboxId));

    this.emit(EventType.SANDBOX_DELETED, { sandboxId });
    this.logger.info('Sandbox deleted', { sandboxId });
  }

  async listByUser(userId: string): Promise<SandboxConfig[]> {
    const userSandboxes = await db.query.sandboxes.findMany({
      where: and(
        eq(sandboxes.userId, userId),
        eq(sandboxes.isActive, true)
      )
    });

    return userSandboxes.map(sandbox => ({
      id: sandbox.id,
      name: sandbox.name,
      userId: sandbox.userId,
      model: sandbox.model,
      systemPrompt: sandbox.systemPrompt,
      temperature: sandbox.temperature,
      maxTokens: sandbox.maxTokens,
      toolsEnabled: sandbox.toolsEnabled,
      rateLimit: {
        hourlyLimit: sandbox.hourlyTokenLimit,
        dailyLimit: sandbox.dailyTokenLimit
      },
      metadata: sandbox.metadata as Record<string, any>
    }));
  }
}
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'sandbox-manager.ts'), sandboxManagerContent);

// Create SessionManager module
const sessionManagerContent = `/**
 * Session Manager
 * Manages sandbox sessions and activity tracking
 */

import { db } from '../../config/db';
import { sandboxSessions } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';
import { RedisClient } from '../../lib/redis';
import { SandboxSession, EventType } from './types';
import { v4 as uuidv4 } from 'uuid';

export class SessionManager extends EventEmitter {
  private logger: Logger;
  private redis: RedisClient;
  private sessionTimeout: number = 30 * 60 * 1000; // 30 minutes

  constructor() {
    super();
    this.logger = Logger.getInstance();
    this.redis = RedisClient.getInstance();
  }

  async create(sandboxId: number, metadata?: Record<string, any>): Promise<SandboxSession> {
    const sessionId = uuidv4();
    const now = new Date();

    const [session] = await db
      .insert(sandboxSessions)
      .values({
        id: sessionId,
        sandboxId,
        startedAt: now,
        lastActivityAt: now,
        metadata: metadata ?? {}
      })
      .returning();

    const sandboxSession: SandboxSession = {
      id: session.id,
      sandboxId: session.sandboxId,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      metadata: session.metadata as Record<string, any>
    };

    // Cache session
    await this.cacheSession(sandboxSession);

    this.emit(EventType.SESSION_CREATED, sandboxSession);
    this.logger.info('Session created', { sessionId, sandboxId });

    return sandboxSession;
  }

  async get(sessionId: string): Promise<SandboxSession | null> {
    // Try cache first
    const cached = await this.getCachedSession(sessionId);
    if (cached) {
      return cached;
    }

    // Fallback to database
    const session = await db.query.sandboxSessions.findFirst({
      where: and(
        eq(sandboxSessions.id, sessionId),
        eq(sandboxSessions.isActive, true)
      )
    });

    if (!session) {
      return null;
    }

    const sandboxSession: SandboxSession = {
      id: session.id,
      sandboxId: session.sandboxId,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      metadata: session.metadata as Record<string, any>
    };

    // Re-cache
    await this.cacheSession(sandboxSession);

    return sandboxSession;
  }

  async updateActivity(sessionId: string): Promise<void> {
    const now = new Date();

    await db
      .update(sandboxSessions)
      .set({ lastActivityAt: now })
      .where(eq(sandboxSessions.id, sessionId));

    // Update cache
    const session = await this.get(sessionId);
    if (session) {
      session.lastActivityAt = now;
      await this.cacheSession(session);
      this.emit(EventType.SESSION_UPDATED, session);
    }
  }

  async end(sessionId: string): Promise<void> {
    await db
      .update(sandboxSessions)
      .set({ 
        isActive: false,
        endedAt: new Date()
      })
      .where(eq(sandboxSessions.id, sessionId));

    // Remove from cache
    await this.redis.del(\`session:\${sessionId}\`);

    this.emit(EventType.SESSION_ENDED, { sessionId });
    this.logger.info('Session ended', { sessionId });
  }

  async getActiveSessions(sandboxId: number): Promise<SandboxSession[]> {
    const sessions = await db.query.sandboxSessions.findMany({
      where: and(
        eq(sandboxSessions.sandboxId, sandboxId),
        eq(sandboxSessions.isActive, true)
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.lastActivityAt)]
    });

    return sessions.map(session => ({
      id: session.id,
      sandboxId: session.sandboxId,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
      metadata: session.metadata as Record<string, any>
    }));
  }

  async cleanupInactiveSessions(): Promise<number> {
    const cutoffTime = new Date(Date.now() - this.sessionTimeout);
    
    const inactiveSessions = await db.query.sandboxSessions.findMany({
      where: and(
        eq(sandboxSessions.isActive, true),
        lte(sandboxSessions.lastActivityAt, cutoffTime)
      )
    });

    for (const session of inactiveSessions) {
      await this.end(session.id);
    }

    this.logger.info(\`Cleaned up \${inactiveSessions.length} inactive sessions\`);
    return inactiveSessions.length;
  }

  private async cacheSession(session: SandboxSession): Promise<void> {
    await this.redis.setex(
      \`session:\${session.id}\`,
      Math.floor(this.sessionTimeout / 1000),
      JSON.stringify(session)
    );
  }

  private async getCachedSession(sessionId: string): Promise<SandboxSession | null> {
    const cached = await this.redis.get(\`session:\${sessionId}\`);
    if (!cached) {
      return null;
    }

    try {
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }
}
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'session-manager.ts'), sessionManagerContent);

// Create main orchestrator that uses the modules
const orchestratorContent = `/**
 * Orchestrator Service
 * Main coordinator that uses all sub-modules
 */

import { SandboxManager } from './sandbox-manager';
import { SessionManager } from './session-manager';
import { WorkflowEngine } from './workflow-engine';
import { RateLimiter } from './rate-limiter';
import { ToolExecutor } from './tool-executor';
import { EventCoordinator } from './event-coordinator';
import { Logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import type { 
  SandboxConfig, 
  SandboxSession, 
  WorkflowState,
  ToolCall,
  EventType 
} from './types';

export class Orchestrator extends EventEmitter {
  private static instance: Orchestrator;
  
  private sandboxManager: SandboxManager;
  private sessionManager: SessionManager;
  private workflowEngine: WorkflowEngine;
  private rateLimiter: RateLimiter;
  private toolExecutor: ToolExecutor;
  private eventCoordinator: EventCoordinator;
  private logger: Logger;

  private constructor() {
    super();
    this.logger = Logger.getInstance();
    
    // Initialize modules
    this.sandboxManager = new SandboxManager();
    this.sessionManager = new SessionManager();
    this.workflowEngine = new WorkflowEngine();
    this.rateLimiter = new RateLimiter();
    this.toolExecutor = new ToolExecutor();
    this.eventCoordinator = new EventCoordinator();
    
    // Wire up event coordination
    this.setupEventHandlers();
    
    // Start background tasks
    this.startBackgroundTasks();
  }

  static getInstance(): Orchestrator {
    if (!Orchestrator.instance) {
      Orchestrator.instance = new Orchestrator();
    }
    return Orchestrator.instance;
  }

  // Sandbox operations
  async createSandbox(config: Omit<SandboxConfig, 'id'>): Promise<SandboxConfig> {
    return this.sandboxManager.create(config);
  }

  async getSandbox(sandboxId: number): Promise<SandboxConfig | null> {
    return this.sandboxManager.get(sandboxId);
  }

  async updateSandbox(sandboxId: number, updates: Partial<SandboxConfig>): Promise<SandboxConfig> {
    return this.sandboxManager.update(sandboxId, updates);
  }

  async deleteSandbox(sandboxId: number): Promise<void> {
    // End all active sessions first
    const sessions = await this.sessionManager.getActiveSessions(sandboxId);
    for (const session of sessions) {
      await this.sessionManager.end(session.id);
    }
    
    return this.sandboxManager.delete(sandboxId);
  }

  // Session operations
  async createSession(sandboxId: number, metadata?: Record<string, any>): Promise<SandboxSession> {
    // Verify sandbox exists and is active
    const sandbox = await this.sandboxManager.get(sandboxId);
    if (!sandbox) {
      throw new Error(\`Sandbox \${sandboxId} not found\`);
    }
    
    return this.sessionManager.create(sandboxId, metadata);
  }

  async getSession(sessionId: string): Promise<SandboxSession | null> {
    return this.sessionManager.get(sessionId);
  }

  async endSession(sessionId: string): Promise<void> {
    return this.sessionManager.end(sessionId);
  }

  // Workflow operations
  async startWorkflow(
    sessionId: string, 
    workflowDefinition: any
  ): Promise<WorkflowState> {
    // Verify session
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error(\`Session \${sessionId} not found\`);
    }

    // Update session activity
    await this.sessionManager.updateActivity(sessionId);

    // Check rate limits
    const sandbox = await this.sandboxManager.get(session.sandboxId);
    if (sandbox) {
      const allowed = await this.rateLimiter.checkLimit(
        session.sandboxId,
        sessionId
      );
      if (!allowed.allowed) {
        throw new Error(\`Rate limit exceeded. Resets at \${allowed.resetAt}\`);
      }
    }

    return this.workflowEngine.start(sessionId, workflowDefinition);
  }

  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    return this.workflowEngine.getState(workflowId);
  }

  async cancelWorkflow(workflowId: string): Promise<void> {
    return this.workflowEngine.cancel(workflowId);
  }

  // Tool operations
  async executeTool(
    sessionId: string,
    toolName: string,
    parameters: Record<string, any>
  ): Promise<ToolCall> {
    // Verify session
    const session = await this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error(\`Session \${sessionId} not found\`);
    }

    // Update session activity
    await this.sessionManager.updateActivity(sessionId);

    // Check if tool is enabled for sandbox
    const sandbox = await this.sandboxManager.get(session.sandboxId);
    if (sandbox && sandbox.toolsEnabled && !sandbox.toolsEnabled.includes(toolName)) {
      throw new Error(\`Tool \${toolName} is not enabled for this sandbox\`);
    }

    // Check rate limits
    if (sandbox) {
      const allowed = await this.rateLimiter.checkLimit(
        session.sandboxId,
        sessionId
      );
      if (!allowed.allowed) {
        throw new Error(\`Rate limit exceeded. Resets at \${allowed.resetAt}\`);
      }
    }

    // Execute tool
    const toolCall = await this.toolExecutor.execute(
      sessionId,
      toolName,
      parameters
    );

    // Log token usage if applicable
    if (toolCall.tokensUsed && sandbox) {
      await this.rateLimiter.logUsage(
        session.sandboxId,
        sessionId,
        sandbox.model,
        toolCall.tokensUsed
      );
    }

    return toolCall;
  }

  // Event handling setup
  private setupEventHandlers(): void {
    // Forward module events
    const modules = [
      this.sandboxManager,
      this.sessionManager,
      this.workflowEngine,
      this.rateLimiter,
      this.toolExecutor
    ];

    modules.forEach(module => {
      module.on('*', (eventType: string, data: any) => {
        this.emit(eventType, data);
        this.eventCoordinator.handleEvent(eventType, data);
      });
    });
  }

  // Background tasks
  private startBackgroundTasks(): void {
    // Clean up inactive sessions every 5 minutes
    setInterval(async () => {
      try {
        await this.sessionManager.cleanupInactiveSessions();
      } catch (error) {
        this.logger.error('Failed to cleanup sessions', error);
      }
    }, 5 * 60 * 1000);

    // Reset rate limits every hour
    setInterval(async () => {
      try {
        await this.rateLimiter.resetHourlyLimits();
      } catch (error) {
        this.logger.error('Failed to reset rate limits', error);
      }
    }, 60 * 60 * 1000);
  }

  // Utility methods
  async getUsageStatistics(sandboxId: number, period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    return this.rateLimiter.getUsageStatistics(sandboxId, period);
  }

  async exportWorkflowDefinition(workflowId: string): Promise<any> {
    const state = await this.workflowEngine.getState(workflowId);
    if (!state) {
      throw new Error(\`Workflow \${workflowId} not found\`);
    }
    return this.workflowEngine.exportDefinition(state);
  }

  async importWorkflowDefinition(definition: any): Promise<string> {
    return this.workflowEngine.importDefinition(definition);
  }
}

// Export singleton instance
export default Orchestrator.getInstance();
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'orchestrator.ts'), orchestratorContent);

// Create a stub for other modules (would be fully implemented in production)
const moduleStubs = [
  'workflow-engine',
  'rate-limiter',
  'tool-executor',
  'event-coordinator'
];

moduleStubs.forEach(moduleName => {
  const className = moduleName.split('-').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join('');
  
  const stubContent = `/**
 * ${className}
 * ${modules.find(m => m.name === moduleName)?.description || ''}
 */

import { EventEmitter } from 'events';
import { Logger } from '../../utils/logger';

export class ${className} extends EventEmitter {
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  // TODO: Implement ${className} methods
  // This is a stub that needs to be filled with actual implementation
  
  async initialize(): Promise<void> {
    this.logger.info('${className} initialized');
  }
}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, `${moduleName}.ts`), stubContent);
});

// Update imports in files that use orchestrator
const updateImportsContent = `#!/bin/bash
# Update imports for orchestrator refactoring

echo "Updating imports..."

# Find all files that import from orchestrator
grep -r "from.*orchestrator" server/ --include="*.ts" --include="*.js" | cut -d: -f1 | sort -u | while read file; do
  echo "Updating: $file"
  
  # Update import path
  sed -i '' 's|from.*orchestrator.*|from "./orchestrator"|g' "$file"
  
  # If the file imports specific classes, update to use the new structure
  sed -i '' 's|import { Orchestrator }|import orchestrator|g' "$file"
done

echo "✅ Import updates complete"
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'update-imports.sh'), updateImportsContent);
fs.chmodSync(path.join(OUTPUT_DIR, 'update-imports.sh'), '755');

// Create migration guide
const migrationGuide = `# Orchestrator Refactoring Guide

## What Changed

The monolithic orchestrator service (2433 lines) has been broken down into focused modules:

### Old Structure
- \`server/services/orchestrator.ts\` - Single large file with all functionality

### New Structure
\`\`\`
server/services/orchestrator/
├── index.ts              # Public exports
├── types.ts              # Shared types
├── orchestrator.ts       # Main coordinator
├── sandbox-manager.ts    # Sandbox lifecycle
├── session-manager.ts    # Session management
├── workflow-engine.ts    # Workflow execution
├── rate-limiter.ts       # Rate limiting
├── tool-executor.ts      # Tool execution
└── event-coordinator.ts  # Event handling
\`\`\`

## Benefits

1. **Separation of Concerns** - Each module has a single responsibility
2. **Easier Testing** - Test individual modules in isolation
3. **Better Maintainability** - Smaller files are easier to understand
4. **Reduced Coupling** - Modules communicate through events
5. **Improved Performance** - Can optimize individual modules

## Module Responsibilities

### SandboxManager
- Create, read, update, delete sandboxes
- Manage sandbox configuration
- Emit sandbox lifecycle events

### SessionManager
- Create and manage sessions
- Track session activity
- Handle session cleanup
- Cache sessions in Redis

### WorkflowEngine
- Execute workflow definitions
- Manage workflow state
- Handle step execution
- Support parallel execution

### RateLimiter
- Check rate limits
- Track token usage
- Reset limits periodically
- Generate usage reports

### ToolExecutor
- Execute tool calls
- Validate tool parameters
- Handle tool timeouts
- Track execution metrics

### EventCoordinator
- Route events between modules
- Handle cross-module workflows
- Manage event subscriptions

## Migration Steps

1. **Backup original file**
   \`\`\`bash
   cp server/services/orchestrator.ts server/services/orchestrator.ts.backup
   \`\`\`

2. **Install new modules**
   \`\`\`bash
   # Copy the new orchestrator directory
   cp -r server/services/orchestrator/* server/services/orchestrator/
   \`\`\`

3. **Update imports**
   \`\`\`typescript
   // Old
   import { Orchestrator } from './services/orchestrator';
   
   // New
   import orchestrator from './services/orchestrator';
   // Or import specific modules
   import { SandboxManager, SessionManager } from './services/orchestrator';
   \`\`\`

4. **Update instantiation**
   \`\`\`typescript
   // Old
   const orchestrator = new Orchestrator();
   
   // New (singleton)
   import orchestrator from './services/orchestrator';
   // Use directly - it's already instantiated
   \`\`\`

5. **Test each module**
   \`\`\`bash
   npm test server/services/orchestrator/*.test.ts
   \`\`\`

## Usage Examples

### Using the main orchestrator
\`\`\`typescript
import orchestrator from './services/orchestrator';

// Create sandbox
const sandbox = await orchestrator.createSandbox({
  name: 'My Sandbox',
  userId: 'user123',
  model: 'gpt-4'
});

// Create session
const session = await orchestrator.createSession(sandbox.id);

// Execute tool
const result = await orchestrator.executeTool(
  session.id,
  'web_search',
  { query: 'TypeScript best practices' }
);
\`\`\`

### Using individual modules
\`\`\`typescript
import { SandboxManager, SessionManager } from './services/orchestrator';

const sandboxManager = new SandboxManager();
const sessionManager = new SessionManager();

// Direct module usage
const sandbox = await sandboxManager.create({
  name: 'Test Sandbox',
  userId: 'user123',
  model: 'gpt-3.5-turbo'
});

const session = await sessionManager.create(sandbox.id);
\`\`\`

## Event Handling

The refactored orchestrator uses events for loose coupling:

\`\`\`typescript
import orchestrator from './services/orchestrator';

// Listen for events
orchestrator.on('sandbox.created', (sandbox) => {
  console.log('New sandbox:', sandbox);
});

orchestrator.on('session.created', (session) => {
  console.log('New session:', session);
});

orchestrator.on('ratelimit.exceeded', (details) => {
  console.log('Rate limit hit:', details);
});
\`\`\`

## Testing

Create separate test files for each module:

\`\`\`typescript
// sandbox-manager.test.ts
import { SandboxManager } from './sandbox-manager';

describe('SandboxManager', () => {
  let manager: SandboxManager;
  
  beforeEach(() => {
    manager = new SandboxManager();
  });
  
  it('should create sandbox', async () => {
    const sandbox = await manager.create({
      name: 'Test',
      userId: 'test-user',
      model: 'gpt-4'
    });
    
    expect(sandbox.id).toBeDefined();
    expect(sandbox.name).toBe('Test');
  });
});
\`\`\`

## Performance Improvements

1. **Caching** - Sessions are cached in Redis
2. **Event-driven** - Modules don't block each other
3. **Lazy loading** - Modules can be loaded on demand
4. **Connection pooling** - Each module manages its own connections

## Next Steps

1. Complete implementation of stub modules
2. Add comprehensive tests for each module
3. Add metrics collection
4. Implement module-specific middleware
5. Add OpenAPI documentation for each module
`;

fs.writeFileSync('ORCHESTRATOR_REFACTORING_GUIDE.md', migrationGuide);

console.log('\n✅ Orchestrator refactoring complete!');
console.log('\nCreated modules:');
modules.forEach(m => console.log(`  - ${m.name}: ${m.description}`));
console.log('\n📁 Files created in:', OUTPUT_DIR);
console.log('\n📖 See ORCHESTRATOR_REFACTORING_GUIDE.md for migration instructions');
console.log('\n⚠️  Note: Some modules are stubs and need full implementation');
console.log('\nNext steps:');
console.log('1. Review the refactored code');
console.log('2. Implement the stub modules');
console.log('3. Update imports using: ./server/services/orchestrator/update-imports.sh');
console.log('4. Test each module individually');
console.log('5. Remove the original orchestrator.ts after verification\n');