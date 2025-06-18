import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function createDatabase() {
  // Parse DATABASE_URL to get connection details
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const url = new URL(dbUrl);
  const dbName = url.pathname.slice(1);
  
  // Connect to postgres database to create our database
  const client = new Client({
    host: url.hostname,
    port: parseInt(url.port || '5432'),
    user: url.username,
    password: url.password,
    database: 'postgres' // Connect to default postgres database
  });

  try {
    console.log('🗳️  Creating database: ' + dbName);
    
    await client.connect();
    
    // Check if database exists
    const checkResult = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Database already exists');
    } else {
      // Create database
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log('✅ Database created successfully');
    }
    
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ PostgreSQL is not running or not accessible');
      console.error('\nMake sure PostgreSQL is installed and running:');
      console.error('- Mac: brew services start postgresql');
      console.error('- Linux: sudo systemctl start postgresql');
      console.error('- Windows: Start PostgreSQL service');
    } else if (error.code === '28P01') {
      console.error('❌ Authentication failed');
      console.error('Check your username and password');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
createDatabase().then(() => {
  console.log('\n🎉 Database ready! Run "npm run db:migrate" to create tables.');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});