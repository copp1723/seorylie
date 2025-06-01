#!/usr/bin/env tsx

/**
 * ADF-W10 Conversation Orchestrator Setup Script
 * 
 * Initializes the conversation orchestrator system including:
 * - Database schema migration
 * - Default prompt templates
 * - Redis streams setup
 * - Health check verification
 */

import { conversationOrchestrator } from '../server/services/conversation-orchestrator';
import db from '../server/db';
import { sql } from 'drizzle-orm';
import logger from '../server/utils/logger';
import { promises as fs } from 'fs';
import path from 'path';

interface SetupOptions {
  skipMigration?: boolean;
  skipPrompts?: boolean;
  skipHealthCheck?: boolean;
  testMode?: boolean;
}

async function setupConversationOrchestrator(options: SetupOptions = {}) {
  try {
    logger.info('🚀 Setting up ADF-W10 Conversation Orchestrator...');

    // Step 1: Run database migration
    if (!options.skipMigration) {
      logger.info('📊 Running database migration...');
      await runMigration();
      logger.info('✅ Database migration completed');
    }

    // Step 2: Load default prompt templates
    if (!options.skipPrompts) {
      logger.info('📝 Loading default prompt templates...');
      await loadDefaultPrompts();
      logger.info('✅ Default prompts loaded');
    }

    // Step 3: Initialize orchestrator
    logger.info('🎛️ Initializing conversation orchestrator...');
    await conversationOrchestrator.initialize();
    logger.info('✅ Orchestrator initialized');

    // Step 4: Health check
    if (!options.skipHealthCheck) {
      logger.info('🏥 Running health check...');
      const health = await conversationOrchestrator.getHealthStatus();
      
      if (health.status === 'healthy') {
        logger.info('✅ Health check passed');
      } else {
        logger.warn('⚠️ Health check shows degraded status', { health });
      }
    }

    // Step 5: Test setup (if in test mode)
    if (options.testMode) {
      logger.info('🧪 Running test setup...');
      await runTestSetup();
      logger.info('✅ Test setup completed');
    }

    logger.info('🎉 Conversation Orchestrator setup completed successfully!');
    
    // Display summary
    await displaySetupSummary();

  } catch (error) {
    logger.error('❌ Setup failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function runMigration(): Promise<void> {
  try {
    // Check if migration file exists
    const migrationPath = path.join(process.cwd(), 'migrations', '0017_conversation_orchestrator_v2.sql');
    
    try {
      await fs.access(migrationPath);
    } catch {
      throw new Error('Migration file not found: 0017_conversation_orchestrator_v2.sql');
    }

    // Read and execute migration
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }

    logger.info('Database schema updated successfully');

  } catch (error) {
    logger.error('Migration failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function loadDefaultPrompts(): Promise<void> {
  try {
    const promptsDir = path.join(process.cwd(), 'prompts', 'adf');
    
    // Check if prompts directory exists
    try {
      await fs.access(promptsDir);
    } catch {
      logger.warn('Prompts directory not found, skipping prompt loading');
      return;
    }

    const promptFiles = await fs.readdir(promptsDir);
    const markdownFiles = promptFiles.filter(file => file.endsWith('.md'));

    for (const file of markdownFiles) {
      const filePath = path.join(promptsDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Parse front matter
      const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      
      if (frontMatterMatch) {
        const metadata = parseFrontMatter(frontMatterMatch[1]);
        const template = frontMatterMatch[2];
        
        // Check if prompt already exists
        const existingPrompt = await db.execute(sql`
          SELECT id FROM prompt_templates_v2 
          WHERE name = ${metadata.name} AND category = ${metadata.category}
        `);

        if (existingPrompt.rows.length === 0) {
          // Insert new prompt
          await db.execute(sql`
            INSERT INTO prompt_templates_v2 (
              id, name, category, template_content, turn_number, 
              variables, metadata, is_active, created_at, updated_at
            ) VALUES (
              ${crypto.randomUUID()}, ${metadata.name}, ${metadata.category}, ${template},
              ${metadata.turnNumber}, ${JSON.stringify(metadata.variables || [])},
              ${JSON.stringify(metadata)}, true, NOW(), NOW()
            )
          `);
          
          logger.info(`Loaded prompt: ${metadata.name}`);
        } else {
          logger.debug(`Prompt already exists: ${metadata.name}`);
        }
      }
    }

  } catch (error) {
    logger.error('Failed to load default prompts:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

function parseFrontMatter(frontMatter: string): any {
  const metadata: any = {};
  
  frontMatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      // Handle different value types
      if (value === 'true' || value === 'false') {
        metadata[key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        metadata[key] = Number(value);
      } else if (value.startsWith('[') && value.endsWith(']')) {
        // Simple array parsing
        metadata[key] = value.slice(1, -1).split(',').map(s => s.trim());
      } else {
        metadata[key] = value.replace(/^['"]|['"]$/g, ''); // Remove quotes
      }
    }
  });
  
  return metadata;
}

async function runTestSetup(): Promise<void> {
  try {
    // Create test conversation
    const testContext = {
      conversationId: 'test-' + crypto.randomUUID(),
      leadId: 'test-lead-123',
      dealershipId: 1,
      currentTurn: 0,
      maxTurns: 2,
      metadata: {
        source: 'test',
        customerInfo: {
          name: 'Test Customer',
          email: 'test@example.com'
        }
      },
      state: 'active',
      aiModel: 'gpt-3.5-turbo',
      temperature: 0.7,
      priority: 0
    };

    await db.execute(sql`
      INSERT INTO conversations_v2 (
        id, lead_id, dealership_id, current_turn, max_turns, state,
        ai_model, temperature, metadata, priority, created_at, updated_at
      ) VALUES (
        ${testContext.conversationId}, ${testContext.leadId}, ${testContext.dealershipId},
        ${testContext.currentTurn}, ${testContext.maxTurns}, ${testContext.state},
        ${testContext.aiModel}, ${testContext.temperature}, ${JSON.stringify(testContext.metadata)},
        ${testContext.priority}, NOW(), NOW()
      )
    `);

    // Add test message
    await db.execute(sql`
      INSERT INTO conversation_messages_v2 (
        id, conversation_id, role, content, turn_number, metadata, created_at, updated_at
      ) VALUES (
        ${crypto.randomUUID()}, ${testContext.conversationId}, 'user', 
        'Hello, I am interested in learning more about your vehicles.',
        1, '{"test": true}', NOW(), NOW()
      )
    `);

    logger.info('Test conversation created:', { conversationId: testContext.conversationId });

  } catch (error) {
    logger.error('Test setup failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

async function displaySetupSummary(): Promise<void> {
  try {
    // Get conversation count
    const conversationResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM conversations_v2
    `);
    const conversationCount = conversationResult.rows[0]?.count || 0;

    // Get prompt count
    const promptResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM prompt_templates_v2 WHERE is_active = true
    `);
    const promptCount = promptResult.rows[0]?.count || 0;

    // Get health status
    const health = await conversationOrchestrator.getHealthStatus();

    logger.info('📋 Setup Summary:');
    logger.info(`   • Conversations in database: ${conversationCount}`);
    logger.info(`   • Active prompt templates: ${promptCount}`);
    logger.info(`   • Orchestrator status: ${health.status}`);
    logger.info(`   • Queue depth: ${health.queue.waiting + health.queue.active}`);
    logger.info(`   • Circuit breaker: ${health.circuitBreaker.state}`);
    logger.info(`   • Redis connected: ${health.redis.connected}`);

  } catch (error) {
    logger.warn('Could not generate setup summary:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function cleanupTestData(): Promise<void> {
  try {
    logger.info('🧹 Cleaning up test data...');

    await db.execute(sql`
      DELETE FROM conversation_messages_v2 
      WHERE conversation_id IN (
        SELECT id FROM conversations_v2 WHERE lead_id LIKE 'test-%'
      )
    `);

    await db.execute(sql`
      DELETE FROM conversations_v2 WHERE lead_id LIKE 'test-%'
    `);

    logger.info('✅ Test data cleaned up');

  } catch (error) {
    logger.error('Cleanup failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'setup':
        await setupConversationOrchestrator({
          skipMigration: args.includes('--skip-migration'),
          skipPrompts: args.includes('--skip-prompts'),
          skipHealthCheck: args.includes('--skip-health-check'),
          testMode: args.includes('--test-mode')
        });
        break;

      case 'migrate':
        await runMigration();
        logger.info('✅ Migration completed');
        break;

      case 'load-prompts':
        await loadDefaultPrompts();
        logger.info('✅ Prompts loaded');
        break;

      case 'health-check':
        await conversationOrchestrator.initialize();
        const health = await conversationOrchestrator.getHealthStatus();
        console.log(JSON.stringify(health, null, 2));
        break;

      case 'cleanup':
        await cleanupTestData();
        break;

      case 'help':
      default:
        console.log(`
ADF-W10 Conversation Orchestrator Setup

Usage: npm run setup:orchestrator <command> [options]

Commands:
  setup              Full setup (migration + prompts + health check)
  migrate            Run database migration only
  load-prompts       Load default prompt templates only
  health-check       Check orchestrator health
  cleanup            Remove test data
  help               Show this help

Options:
  --skip-migration   Skip database migration
  --skip-prompts     Skip prompt loading
  --skip-health-check Skip health check
  --test-mode        Create test data

Examples:
  npm run setup:orchestrator setup
  npm run setup:orchestrator setup --test-mode
  npm run setup:orchestrator migrate
  npm run setup:orchestrator health-check
        `);
        break;
    }

  } catch (error) {
    logger.error('Command failed:', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  } finally {
    await conversationOrchestrator.shutdown();
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export {
  setupConversationOrchestrator,
  runMigration,
  loadDefaultPrompts,
  cleanupTestData
};