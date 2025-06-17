// Re-export everything from the main db.ts file
export * from '../db';

// Also export pool specifically for compatibility with new code
import { client } from '../db';

// Create a pool object that mimics pg Pool interface
export const pool = {
  query: async (text: string, params?: any[]) => {
    // Use the postgres.js client syntax
    if (params && params.length > 0) {
      // Convert parameterized query to postgres.js template literal style
      return client.unsafe(text, params);
    }
    return client.unsafe(text);
  },
  connect: () => client,
  end: () => client.end()
};