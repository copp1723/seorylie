#!/usr/bin/env node
/**
 * Generate modular architecture with dependency injection
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

interface ModuleDefinition {
  name: string;
  path: string;
  dependencies: string[];
  interfaces: string[];
  implementation: string;
}

class ModuleGenerator {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  async generateCoreStructure(): Promise<void> {
    console.log('🏗️  Generating modular architecture...\n');
    
    // Create core infrastructure
    await this.createDependencyInjection();
    await this.createBaseClasses();
    await this.createCommonInterfaces();
    
    // Generate example modules
    await this.createExampleModule('auth');
    await this.createExampleModule('dealership');
    await this.createExampleModule('seoworks');
    
    console.log('✅ Modular architecture generated!');
    console.log('\n📚 Next steps:');
    console.log('1. Install dependency injection library: npm install inversify reflect-metadata');
    console.log('2. Add to tsconfig.json: "experimentalDecorators": true, "emitDecoratorMetadata": true');
    console.log('3. Import reflect-metadata in main server file');
    console.log('4. Migrate existing code to use the new module structure');
  }

  private async createDependencyInjection(): Promise<void> {
    const containerPath = path.join(this.rootDir, 'server/core/container.ts');
    await this.ensureDir(path.dirname(containerPath));
    
    const containerCode = `import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './types';

// Core interfaces
import { IDatabase } from './interfaces/IDatabase';
import { ILogger } from './interfaces/ILogger';
import { ICacheService } from './interfaces/ICacheService';
import { IEmailService } from './interfaces/IEmailService';
import { IAIService } from './interfaces/IAIService';

// Implementations
import { PostgresDatabase } from '../infrastructure/database/PostgresDatabase';
import { WinstonLogger } from '../infrastructure/logging/WinstonLogger';
import { RedisCache } from '../infrastructure/cache/RedisCache';
import { SendGridEmailService } from '../infrastructure/email/SendGridEmailService';
import { OpenAIService } from '../infrastructure/ai/OpenAIService';

const container = new Container({ defaultScope: 'Singleton' });

// Bind core services
container.bind<IDatabase>(TYPES.Database).to(PostgresDatabase);
container.bind<ILogger>(TYPES.Logger).to(WinstonLogger);
container.bind<ICacheService>(TYPES.Cache).to(RedisCache);
container.bind<IEmailService>(TYPES.Email).to(SendGridEmailService);
container.bind<IAIService>(TYPES.AI).to(OpenAIService);

// Factory for creating child containers
export function createModuleContainer(parent: Container = container): Container {
  const child = parent.createChild();
  return child;
}

export { container, TYPES };
`;
    
    await writeFile(containerPath, containerCode);
    
    // Create types file
    const typesPath = path.join(this.rootDir, 'server/core/types.ts');
    const typesCode = `export const TYPES = {
  // Core services
  Database: Symbol.for('Database'),
  Logger: Symbol.for('Logger'),
  Cache: Symbol.for('Cache'),
  Email: Symbol.for('Email'),
  AI: Symbol.for('AI'),
  
  // Domain services
  AuthService: Symbol.for('AuthService'),
  UserRepository: Symbol.for('UserRepository'),
  DealershipService: Symbol.for('DealershipService'),
  SEOWorksService: Symbol.for('SEOWorksService'),
  
  // Infrastructure
  HTTPClient: Symbol.for('HTTPClient'),
  MessageQueue: Symbol.for('MessageQueue'),
  EventBus: Symbol.for('EventBus'),
  
  // Middleware
  AuthMiddleware: Symbol.for('AuthMiddleware'),
  ValidationMiddleware: Symbol.for('ValidationMiddleware'),
  RateLimiter: Symbol.for('RateLimiter'),
};
`;
    
    await writeFile(typesPath, typesCode);
  }

  private async createBaseClasses(): Promise<void> {
    // Base Service
    const baseServicePath = path.join(this.rootDir, 'server/core/base/BaseService.ts');
    await this.ensureDir(path.dirname(baseServicePath));
    
    const baseServiceCode = `import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ILogger } from '../interfaces/ILogger';
import { IDatabase } from '../interfaces/IDatabase';

@injectable()
export abstract class BaseService {
  constructor(
    @inject(TYPES.Logger) protected logger: ILogger,
    @inject(TYPES.Database) protected db: IDatabase
  ) {}

  protected async executeWithTransaction<T>(
    operation: (trx: any) => Promise<T>
  ): Promise<T> {
    const trx = await this.db.beginTransaction();
    try {
      const result = await operation(trx);
      await trx.commit();
      return result;
    } catch (error) {
      await trx.rollback();
      this.logger.error('Transaction failed', { error });
      throw error;
    }
  }

  protected handleError(error: any, context: string): never {
    this.logger.error(\`Error in \${context}\`, { error });
    throw error;
  }
}
`;
    
    await writeFile(baseServicePath, baseServiceCode);
    
    // Base Repository
    const baseRepoPath = path.join(this.rootDir, 'server/core/base/BaseRepository.ts');
    const baseRepoCode = `import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { IDatabase } from '../interfaces/IDatabase';
import { ILogger } from '../interfaces/ILogger';

export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findAll(filters?: any): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

@injectable()
export abstract class BaseRepository<T> implements IBaseRepository<T> {
  protected abstract tableName: string;

  constructor(
    @inject(TYPES.Database) protected db: IDatabase,
    @inject(TYPES.Logger) protected logger: ILogger
  ) {}

  async findById(id: string): Promise<T | null> {
    const result = await this.db.query(
      \`SELECT * FROM \${this.tableName} WHERE id = $1\`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findAll(filters: any = {}): Promise<T[]> {
    let query = \`SELECT * FROM \${this.tableName}\`;
    const params: any[] = [];
    
    if (Object.keys(filters).length > 0) {
      const conditions = Object.entries(filters).map(([key, value], index) => {
        params.push(value);
        return \`\${key} = $\${index + 1}\`;
      });
      query += \` WHERE \${conditions.join(' AND ')}\`;
    }
    
    const result = await this.db.query(query, params);
    return result.rows;
  }

  async create(data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = keys.map((_, i) => \`$\${i + 1}\`);
    
    const query = \`
      INSERT INTO \${this.tableName} (\${keys.join(', ')})
      VALUES (\${placeholders.join(', ')})
      RETURNING *
    \`;
    
    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => \`\${key} = $\${i + 2}\`).join(', ');
    
    const query = \`
      UPDATE \${this.tableName}
      SET \${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    \`;
    
    const result = await this.db.query(query, [id, ...values]);
    return result.rows[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(
      \`DELETE FROM \${this.tableName} WHERE id = $1\`,
      [id]
    );
    return result.rowCount > 0;
  }
}
`;
    
    await writeFile(baseRepoPath, baseRepoCode);
    
    // Base Controller
    const baseControllerPath = path.join(this.rootDir, 'server/core/base/BaseController.ts');
    const baseControllerCode = `import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types';
import { ILogger } from '../interfaces/ILogger';

@injectable()
export abstract class BaseController {
  constructor(
    @inject(TYPES.Logger) protected logger: ILogger
  ) {}

  protected success(res: Response, data: any, statusCode: number = 200): void {
    res.status(statusCode).json({
      success: true,
      data
    });
  }

  protected error(res: Response, message: string, statusCode: number = 400, details?: any): void {
    this.logger.error('API Error', { message, statusCode, details });
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        details
      }
    });
  }

  protected async handleRequest(
    req: Request,
    res: Response,
    next: NextFunction,
    handler: () => Promise<any>
  ): Promise<void> {
    try {
      const result = await handler();
      this.success(res, result);
    } catch (error) {
      next(error);
    }
  }

  protected getPagination(req: Request): { limit: number; offset: number } {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    return { limit, offset };
  }

  protected getUserId(req: Request): string {
    return (req as any).user?.id;
  }

  protected getTenantId(req: Request): string {
    return (req as any).tenantId || req.headers['x-tenant-id'] as string;
  }
}
`;
    
    await writeFile(baseControllerPath, baseControllerCode);
  }

  private async createCommonInterfaces(): Promise<void> {
    const interfacesDir = path.join(this.rootDir, 'server/core/interfaces');
    await this.ensureDir(interfacesDir);
    
    // IDatabase interface
    const databaseInterface = `export interface IDatabase {
  query(text: string, params?: any[]): Promise<any>;
  beginTransaction(): Promise<ITransaction>;
  getPool(): any;
}

export interface ITransaction {
  query(text: string, params?: any[]): Promise<any>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
`;
    await writeFile(path.join(interfacesDir, 'IDatabase.ts'), databaseInterface);
    
    // ILogger interface
    const loggerInterface = `export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  child(meta: any): ILogger;
}
`;
    await writeFile(path.join(interfacesDir, 'ILogger.ts'), loggerInterface);
    
    // ICacheService interface
    const cacheInterface = `export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}
`;
    await writeFile(path.join(interfacesDir, 'ICacheService.ts'), cacheInterface);
    
    // IEmailService interface
    const emailInterface = `export interface IEmailService {
  sendEmail(options: EmailOptions): Promise<void>;
  sendBulkEmails(recipients: EmailOptions[]): Promise<void>;
  validateEmail(email: string): boolean;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
  }>;
}
`;
    await writeFile(path.join(interfacesDir, 'IEmailService.ts'), emailInterface);
    
    // IAIService interface
    const aiInterface = `export interface IAIService {
  generateResponse(prompt: string, context?: any): Promise<string>;
  analyzeIntent(message: string): Promise<IntentAnalysis>;
  generateEmbedding(text: string): Promise<number[]>;
}

export interface IntentAnalysis {
  intent: string;
  confidence: number;
  entities: Record<string, any>;
}
`;
    await writeFile(path.join(interfacesDir, 'IAIService.ts'), aiInterface);
  }

  private async createExampleModule(moduleName: string): Promise<void> {
    const moduleDir = path.join(this.rootDir, `server/modules/${moduleName}`);
    await this.ensureDir(moduleDir);
    
    // Module file
    const moduleCode = `import { ContainerModule } from 'inversify';
import { TYPES } from '../../core/types';
import { ${this.capitalize(moduleName)}Controller } from './${moduleName}.controller';
import { ${this.capitalize(moduleName)}Service } from './${moduleName}.service';
import { ${this.capitalize(moduleName)}Repository } from './${moduleName}.repository';

export const ${moduleName}Module = new ContainerModule((bind) => {
  bind(${this.capitalize(moduleName)}Controller).toSelf();
  bind(${this.capitalize(moduleName)}Service).toSelf();
  bind(${this.capitalize(moduleName)}Repository).toSelf();
});
`;
    await writeFile(path.join(moduleDir, `${moduleName}.module.ts`), moduleCode);
    
    // Controller
    const controllerCode = `import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { BaseController } from '../../core/base/BaseController';
import { ${this.capitalize(moduleName)}Service } from './${moduleName}.service';
import { TYPES } from '../../core/types';
import { ILogger } from '../../core/interfaces/ILogger';

@injectable()
export class ${this.capitalize(moduleName)}Controller extends BaseController {
  constructor(
    @inject(TYPES.Logger) logger: ILogger,
    @inject(${this.capitalize(moduleName)}Service) private ${moduleName}Service: ${this.capitalize(moduleName)}Service
  ) {
    super(logger);
  }

  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleRequest(req, res, next, async () => {
      const { limit, offset } = this.getPagination(req);
      return this.${moduleName}Service.findAll({ limit, offset });
    });
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleRequest(req, res, next, async () => {
      const { id } = req.params;
      const result = await this.${moduleName}Service.findById(id);
      
      if (!result) {
        throw new Error('${this.capitalize(moduleName)} not found');
      }
      
      return result;
    });
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleRequest(req, res, next, async () => {
      const userId = this.getUserId(req);
      return this.${moduleName}Service.create({ ...req.body, createdBy: userId });
    });
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleRequest(req, res, next, async () => {
      const { id } = req.params;
      return this.${moduleName}Service.update(id, req.body);
    });
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    await this.handleRequest(req, res, next, async () => {
      const { id } = req.params;
      await this.${moduleName}Service.delete(id);
      return { message: '${this.capitalize(moduleName)} deleted successfully' };
    });
  }
}
`;
    await writeFile(path.join(moduleDir, `${moduleName}.controller.ts`), controllerCode);
    
    // Service
    const serviceCode = `import { injectable, inject } from 'inversify';
import { BaseService } from '../../core/base/BaseService';
import { ${this.capitalize(moduleName)}Repository } from './${moduleName}.repository';
import { TYPES } from '../../core/types';
import { ILogger } from '../../core/interfaces/ILogger';
import { IDatabase } from '../../core/interfaces/IDatabase';
import { ICacheService } from '../../core/interfaces/ICacheService';

@injectable()
export class ${this.capitalize(moduleName)}Service extends BaseService {
  constructor(
    @inject(TYPES.Logger) logger: ILogger,
    @inject(TYPES.Database) db: IDatabase,
    @inject(TYPES.Cache) private cache: ICacheService,
    @inject(${this.capitalize(moduleName)}Repository) private ${moduleName}Repository: ${this.capitalize(moduleName)}Repository
  ) {
    super(logger, db);
  }

  async findAll(options: { limit: number; offset: number }): Promise<any[]> {
    const cacheKey = \`${moduleName}:all:\${options.limit}:\${options.offset}\`;
    
    // Check cache first
    const cached = await this.cache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Fetch from database
    const results = await this.${moduleName}Repository.findAll(options);
    
    // Cache for 5 minutes
    await this.cache.set(cacheKey, results, 300);
    
    return results;
  }

  async findById(id: string): Promise<any> {
    const cacheKey = \`${moduleName}:\${id}\`;
    
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const result = await this.${moduleName}Repository.findById(id);
    
    if (result) {
      await this.cache.set(cacheKey, result, 300);
    }
    
    return result;
  }

  async create(data: any): Promise<any> {
    return this.executeWithTransaction(async (trx) => {
      const created = await this.${moduleName}Repository.create(data, trx);
      
      // Clear relevant caches
      await this.cache.delete(\`${moduleName}:all:*\`);
      
      this.logger.info('${this.capitalize(moduleName)} created', { id: created.id });
      
      return created;
    });
  }

  async update(id: string, data: any): Promise<any> {
    return this.executeWithTransaction(async (trx) => {
      const updated = await this.${moduleName}Repository.update(id, data, trx);
      
      // Clear caches
      await this.cache.delete(\`${moduleName}:\${id}\`);
      await this.cache.delete(\`${moduleName}:all:*\`);
      
      this.logger.info('${this.capitalize(moduleName)} updated', { id });
      
      return updated;
    });
  }

  async delete(id: string): Promise<boolean> {
    return this.executeWithTransaction(async (trx) => {
      const deleted = await this.${moduleName}Repository.delete(id, trx);
      
      // Clear caches
      await this.cache.delete(\`${moduleName}:\${id}\`);
      await this.cache.delete(\`${moduleName}:all:*\`);
      
      this.logger.info('${this.capitalize(moduleName)} deleted', { id });
      
      return deleted;
    });
  }
}
`;
    await writeFile(path.join(moduleDir, `${moduleName}.service.ts`), serviceCode);
    
    // Repository
    const repositoryCode = `import { injectable } from 'inversify';
import { BaseRepository } from '../../core/base/BaseRepository';

@injectable()
export class ${this.capitalize(moduleName)}Repository extends BaseRepository<any> {
  protected tableName = '${moduleName}s';

  async findByUserId(userId: string): Promise<any[]> {
    const result = await this.db.query(
      \`SELECT * FROM \${this.tableName} WHERE user_id = $1 ORDER BY created_at DESC\`,
      [userId]
    );
    return result.rows;
  }

  async create(data: any, trx?: any): Promise<any> {
    const db = trx || this.db;
    const { name, description, userId } = data;
    
    const result = await db.query(
      \`INSERT INTO \${this.tableName} (name, description, user_id)
       VALUES ($1, $2, $3)
       RETURNING *\`,
      [name, description, userId]
    );
    
    return result.rows[0];
  }

  async update(id: string, data: any, trx?: any): Promise<any> {
    const db = trx || this.db;
    const { name, description } = data;
    
    const result = await db.query(
      \`UPDATE \${this.tableName}
       SET name = $2, description = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *\`,
      [id, name, description]
    );
    
    return result.rows[0];
  }

  async delete(id: string, trx?: any): Promise<boolean> {
    const db = trx || this.db;
    
    const result = await db.query(
      \`DELETE FROM \${this.tableName} WHERE id = $1\`,
      [id]
    );
    
    return result.rowCount > 0;
  }
}
`;
    await writeFile(path.join(moduleDir, `${moduleName}.repository.ts`), repositoryCode);
    
    // Routes
    const routesCode = `import { Router } from 'express';
import { container } from '../../core/container';
import { ${this.capitalize(moduleName)}Controller } from './${moduleName}.controller';
import { authMiddleware } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validation';
import { ${moduleName}Schema } from './${moduleName}.validation';

const router = Router();
const controller = container.get(${this.capitalize(moduleName)}Controller);

// Bind controller methods
const boundController = {
  getAll: controller.getAll.bind(controller),
  getById: controller.getById.bind(controller),
  create: controller.create.bind(controller),
  update: controller.update.bind(controller),
  delete: controller.delete.bind(controller)
};

// Define routes
router.get('/', authMiddleware, boundController.getAll);
router.get('/:id', authMiddleware, boundController.getById);
router.post('/', authMiddleware, validateRequest(${moduleName}Schema.create), boundController.create);
router.put('/:id', authMiddleware, validateRequest(${moduleName}Schema.update), boundController.update);
router.delete('/:id', authMiddleware, boundController.delete);

export const ${moduleName}Routes = router;
`;
    await writeFile(path.join(moduleDir, `${moduleName}.routes.ts`), routesCode);
    
    // Validation schemas
    const validationCode = `import { z } from 'zod';

export const ${moduleName}Schema = {
  create: z.object({
    body: z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional(),
    })
  }),
  
  update: z.object({
    body: z.object({
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
    })
  }),
  
  params: z.object({
    id: z.string().uuid()
  })
};
`;
    await writeFile(path.join(moduleDir, `${moduleName}.validation.ts`), validationCode);
    
    // Types
    const typesCode = `export interface ${this.capitalize(moduleName)} {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${this.capitalize(moduleName)}DTO {
  name: string;
  description?: string;
}

export interface Update${this.capitalize(moduleName)}DTO {
  name?: string;
  description?: string;
}
`;
    await writeFile(path.join(moduleDir, `${moduleName}.types.ts`), typesCode);
    
    console.log(`✅ Created ${moduleName} module`);
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Run the generator
const generator = new ModuleGenerator(path.join(__dirname, '../..'));
generator.generateCoreStructure().catch(console.error);
