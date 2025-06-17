// Re-export from the main db.ts file
export * from '../db.js';

// Import client from db.js
import { client } from '../db.js';

// Create a pool object that mimics pg Pool interface
export const pool = {
  query: async (text, params) => {
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