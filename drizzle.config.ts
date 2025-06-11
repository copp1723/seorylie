import { defineConfig } from 'drizzle-kit';
import { config } from './server/config';

export default defineConfig({
  schema: './server/models/schema.ts',
  out: './migrations',
  driver: 'pg',
  dbCredentials: {
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
  },
  verbose: true,
  strict: true,
});