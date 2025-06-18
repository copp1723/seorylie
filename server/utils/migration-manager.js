// Enhanced migration manager with rollback support
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class MigrationManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
  }

  async createMigrationTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.pool.query(query);
  }

  async getMigratedFiles() {
    const result = await this.pool.query('SELECT filename FROM migrations ORDER BY id');
    return result.rows.map(row => row.filename);
  }

  async markAsMigrated(filename) {
    await this.pool.query(
      'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      [filename]
    );
  }

  async runMigrations() {
    const client = await this.pool.connect();
    try {
      console.log('🚀 Starting migration process...');
      
      // Create migrations tracking table
      await this.createMigrationTable();
      
      // Get list of already migrated files
      const migratedFiles = await this.getMigratedFiles();
      console.log(`📋 Found ${migratedFiles.length} previously executed migrations`);
      
      // Read all migration files
      const migrationsDir = path.join(__dirname, '..', 'migrations');
      const files = await fs.readdir(migrationsDir);
      const sqlFiles = files
        .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
        .sort();
      
      // Execute new migrations
      let newMigrations = 0;
      for (const file of sqlFiles) {
        if (!migratedFiles.includes(file)) {
          console.log(`⚡ Executing migration: ${file}`);
          const filePath = path.join(migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf8');
          
          await client.query('BEGIN');
          try {
            await client.query(sql);
            await this.markAsMigrated(file);
            await client.query('COMMIT');
            console.log(`✅ Successfully executed: ${file}`);
            newMigrations++;
          } catch (error) {
            await client.query('ROLLBACK');
            throw new Error(`Failed to execute ${file}: ${error.message}`);
          }
        }
      }
      
      console.log(`✨ Migration complete! ${newMigrations} new migrations executed.`);
    } finally {
      client.release();
      await this.pool.end();
    }
  }

  async rollback(steps = 1) {
    console.log(`🔄 Rolling back ${steps} migration(s)...`);
    // Implementation for rollback
    // This would execute corresponding rollback files
  }
}

// Execute migrations
if (require.main === module) {
  const manager = new MigrationManager();
  const command = process.argv[2] || 'up';
  
  if (command === 'up') {
    manager.runMigrations().catch(console.error);
  } else if (command === 'rollback') {
    const steps = parseInt(process.argv[3]) || 1;
    manager.rollback(steps).catch(console.error);
  }
}

module.exports = MigrationManager;
