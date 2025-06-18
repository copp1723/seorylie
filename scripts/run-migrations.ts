import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files\n`);

    // Check which migrations have been run
    const { rows: executedMigrations } = await pool.query(
      'SELECT filename FROM schema_migrations'
    );
    const executed = new Set(executedMigrations.map(r => r.filename));

    // Run pending migrations
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`▶️  Running ${file}...`);
      const sqlPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [file]
        );
        await pool.query('COMMIT');
        console.log(`✅ ${file} completed\n`);
      } catch (err: any) {
        await pool.query('ROLLBACK');
        console.error(`❌ ${file} failed:`, err.message);
        throw err;
      }
    }

    console.log('✅ All migrations completed successfully!');

    // Show table summary
    console.log('\n📊 Database tables:');
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    for (const table of tables) {
      const { rows: [count] } = await pool.query(
        `SELECT COUNT(*) as count FROM ${table.table_name}`
      );
      console.log(`   - ${table.table_name}: ${count.count} rows`);
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations
runMigrations().then(() => {
  console.log('\n🎉 Database is ready!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});