import { beforeAll, afterAll, vi } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config();

// Mock external services by default
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({ answer: 'Mock AI response for testing' })
            }
          }]
        })
      }
    }
  }))
}));

vi.mock('twilio', () => ({
  Twilio: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({ 
        sid: 'test-message-sid', 
        status: 'queued' 
      })
    }
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';
process.env.SESSION_SECRET = 'test-session-secret';

beforeAll(async () => {
  console.log('Setting up vitest environment...');
});

afterAll(async () => {
  console.log('Cleaning up vitest environment...');
  vi.clearAllMocks();
});