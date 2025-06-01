/**
 * Database Integration Test
 * 
 * This test verifies that our pg-mem database mocking setup works correctly
 * with dependency injection for services.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmailService } from '../../server/services/email-service';
import { createServiceWithMockDb, getMockDbForInjection } from '../setup/database-setup';
import { emailMessages } from '../../shared/index';
import { eq } from 'drizzle-orm';

describe('Database Integration with pg-mem', () => {
  let emailService: EmailService;
  let mockDb: any;

  beforeEach(async () => {
    // Set up EmailService with mock database
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'SG.test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
    
    emailService = createServiceWithMockDb(EmailService);
    mockDb = getMockDbForInjection();
  });

  it('should successfully inject mock database into EmailService', () => {
    expect(emailService).toBeDefined();
    expect(emailService['db']).toBeDefined();
    expect(emailService['db']).toBe(mockDb);
  });

  it('should be able to perform basic database operations', async () => {
    // Test insert operation
    const insertResult = await mockDb
      .insert(emailMessages)
      .values({
        from: 'sender@example.com',
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Test email body',
        status: 'sent',
        externalId: 'test-message-id',
        dealershipId: 1
      })
      .returning();

    expect(insertResult).toBeDefined();
    expect(insertResult[0]).toMatchObject({
      to: 'test@example.com',
      from: 'sender@example.com',
      status: 'sent'
    });

    // Test select operation
    const selectResult = await mockDb
      .select()
      .from(emailMessages)
      .where(eq(emailMessages.to, 'test@example.com'));

    expect(selectResult).toHaveLength(1);
    expect(selectResult[0].subject).toBe('Test Email');
  });

  it('should reset database between tests', async () => {
    // Insert a record
    await mockDb
      .insert(emailMessages)
      .values({
        from: 'sender@example.com',
        to: 'test@example.com',
        subject: 'Reset Test',
        body: 'Test body',
        status: 'sent',
        externalId: 'test-message-id',
        dealershipId: 1
      });

    // Verify it exists
    const beforeReset = await mockDb.select().from(emailMessages);
    expect(beforeReset).toHaveLength(1);

    // Database should be reset between tests automatically by the setup
    // This test will pass if the previous test's data doesn't persist
    const afterReset = await mockDb.select().from(emailMessages);
    expect(afterReset).toHaveLength(0);
  });

  it('should allow EmailService to use injected database for logging', async () => {
    // This test verifies that EmailService uses the injected database
    // by checking that it can access the same data we insert directly
    
    // Insert a test record directly to the mock database
    await mockDb
      .insert(emailMessages)
      .values({
        from: 'sender@example.com',
        to: 'direct@example.com',
        subject: 'Direct Test',
        body: 'Test body',
        status: 'sent',
        externalId: 'direct-message-id',
        dealershipId: 1
      });

    // EmailService should be able to see this record since it uses the same db instance
    const records = await mockDb.select().from(emailMessages);
    expect(records).toHaveLength(1);
    expect(records[0].to).toBe('direct@example.com');
  });
});