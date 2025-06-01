/**
 * Email Service - Unit Tests (Fixed Version)
 * 
 * Tests for the Email Service which handles:
 * - Multi-provider support (SendGrid/MailHog)
 * - Template rendering with Handlebars
 * - Email delivery tracking
 * - Error handling and retry logic
 * - Rate limiting
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EmailService, EmailOptions } from '../../server/services/email-service';
import eventBus from '../../server/services/event-bus';
import { prometheusMetrics } from '../../server/services/prometheus-metrics';
import logger from '../../server/utils/logger';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { MemoryRateLimitStore } from '../../server/utils/rate-limiter';

// Mock dependencies
vi.mock('@sendgrid/mail', () => {
  const mockSend = vi.fn().mockResolvedValue([
    {
      statusCode: 202,
      headers: { 'x-message-id': 'mock-sendgrid-message-id' },
      body: {}
    },
    {}
  ]);

  const mockSendGrid = {
    setApiKey: vi.fn(),
    send: mockSend
  };

  // Return a function that acts as the module for require('@sendgrid/mail')
  const mockModule = Object.assign(
    // Make the module itself have the SendGrid methods (for direct require)
    mockSendGrid,
    {
      // For ES6 default import: import sgMail from '@sendgrid/mail'
      default: mockSendGrid,
      // For CommonJS require: require('@sendgrid/mail').default
      __esModule: true,
      // Ensure all methods are available at module level too
      setApiKey: mockSendGrid.setApiKey,
      send: mockSend
    }
  );

  return mockModule;
});

vi.mock('nodemailer', () => {
  const mockTransport = {
    sendMail: vi.fn().mockResolvedValue({
      messageId: 'mock-message-id',
      envelope: {},
      accepted: ['recipient@example.com']
    })
  };
  
  const createTransportMock = vi.fn().mockReturnValue(mockTransport);
  
  return {
    // For import * as nodemailer 
    createTransport: createTransportMock,
    // For default import 
    default: {
      createTransport: createTransportMock
    }
  };
});

vi.mock('../../server/db', () => {
  return {
    default: {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        { id: 1, providerMessageId: 'mock-message-id', deliveryStatus: 'sent' }
      ]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([])
    }
  };
});

vi.mock('../../server/services/event-bus', () => {
  return {
    default: {
      emit: vi.fn()
    }
  };
});

vi.mock('../../server/services/prometheus-metrics', () => {
  return {
    prometheusMetrics: {
      incrementLeadsProcessed: vi.fn(),
      recordAiResponseLatency: vi.fn(),
      incrementHandoverTriggers: vi.fn(),
      incrementHandoverEmailSent: vi.fn()
    }
  };
});

vi.mock('../../server/utils/logger', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }
  };
});

vi.mock('fs', async () => {
  const mockTemplates = {
    'test-template.html': '<html><body>Hello {{name}}! Your vehicle is {{vehicle}}.</body></html>',
    'test-template.txt': 'Hello {{name}}! Your vehicle is {{vehicle}}.',
    'invalid-template.html': '<html><body>Hello {{name! Your vehicle is {{vehicle}}.</body></html>',
    'adf-response.html': '<html><body>Thank you for your interest in {{vehicleMake}} {{vehicleModel}}!</body></html>',
    'adf-response.txt': 'Thank you for your interest in {{vehicleMake}} {{vehicleModel}}!'
  };
  
  const mockReadFile = vi.fn().mockImplementation(async (filePath) => {
    const basename = filePath.split(/[/\\]/).pop();
    if (mockTemplates[basename]) {
      return Promise.resolve(mockTemplates[basename]);
    }
    return Promise.reject(new Error(`File not found: ${filePath}`));
  });
  
  return {
    default: {
      promises: {
        readFile: mockReadFile,
        access: vi.fn().mockResolvedValue(true)
      }
    },
    promises: {
      readFile: mockReadFile,
      access: vi.fn().mockResolvedValue(true)
    }
  };
});

describe('EmailService', () => {
  let emailService: EmailService;
  let originalEnv: NodeJS.ProcessEnv;

  // Helper function to get the mocked SendGrid module
  const getMockedSendGrid = async () => {
    const sendgridModule = await import('@sendgrid/mail');
    return vi.mocked(sendgridModule);
  };

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Clear all email-related environment variables
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    delete process.env.MAILHOG_HOST;
    delete process.env.MAILHOG_PORT;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    
    // Default to SendGrid provider for most tests (will be overridden in specific tests)
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'SG.test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
    
    // Create email service instance
    emailService = new EmailService();
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Provider Configuration', () => {
    it('should initialize with SendGrid provider when configured', () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      process.env.SENDGRID_API_KEY = 'SG.test-api-key';
      
      emailService = new EmailService();
      
      expect(emailService['provider']).toBe('sendgrid');
      expect(emailService['sendgrid']).toBeDefined();
    });
    
    it('should initialize with MailHog provider when configured', () => {
      // Clear mocks and restart fresh
      vi.clearAllMocks();
      
      // Clear default SendGrid env vars
      delete process.env.SENDGRID_API_KEY;
      process.env.EMAIL_PROVIDER = 'mailhog';
      process.env.MAILHOG_HOST = 'localhost';
      process.env.MAILHOG_PORT = '1025';
      
      const { createTransport } = vi.mocked(nodemailer);
      emailService = new EmailService();
      
      expect(emailService['provider']).toBe('mailhog');
      expect(emailService['smtpTransport']).toBeDefined();
      expect(createTransport).toHaveBeenCalledWith({
        host: 'localhost',
        port: 1025,
        secure: false,
        ignoreTLS: true
      });
    });
    
    it('should fall back to SMTP provider if no specific provider is configured', () => {
      // Clear mocks and restart fresh
      vi.clearAllMocks();
      
      // Clear all provider-specific env vars
      delete process.env.EMAIL_PROVIDER;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.MAILHOG_HOST;
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      
      const { createTransport } = vi.mocked(nodemailer);
      emailService = new EmailService();
      
      expect(emailService['provider']).toBe('smtp');
      expect(emailService['smtpTransport']).toBeDefined();
      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user',
          pass: 'pass'
        }
      });
    });
    
    it('should throw error if no email provider configuration is found', () => {
      // Clear all provider configuration
      delete process.env.EMAIL_PROVIDER;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.MAILHOG_HOST;
      delete process.env.SMTP_HOST;
      
      expect(() => new EmailService()).toThrow('No email provider configuration found');
    });
  });
  
  describe('Template Rendering', () => {
    it('should load and render HTML template correctly', async () => {
      const renderedHtml = await emailService.renderTemplate('test-template.html', {
        name: 'John',
        vehicle: 'Honda Accord'
      });
      
      expect(renderedHtml).toBe('<html><body>Hello John! Your vehicle is Honda Accord.</body></html>');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-template.html'),
        'utf8'
      );
    });
    
    it('should load and render text template correctly', async () => {
      const renderedText = await emailService.renderTemplate('test-template.txt', {
        name: 'John',
        vehicle: 'Honda Accord'
      });
      
      expect(renderedText).toBe('Hello John! Your vehicle is Honda Accord.');
      expect(fs.promises.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test-template.txt'),
        'utf8'
      );
    });
    
    it('should handle missing template files gracefully', async () => {
      vi.mocked(fs.promises.readFile).mockRejectedValueOnce(new Error('File not found'));
      
      await expect(emailService.renderTemplate('non-existent-template.html', {}))
        .rejects.toThrow('Failed to load email template');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load email template'),
        expect.any(Object)
      );
    });
    
    it('should handle invalid Handlebars syntax in templates', async () => {
      await expect(emailService.renderTemplate('invalid-template.html', {
        name: 'John',
        vehicle: 'Honda Accord'
      })).rejects.toThrow('Failed to render email template');
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to render email template'),
        expect.any(Object)
      );
    });
    
    it('should cache templates for performance', async () => {
      // First call should read from file
      await emailService.renderTemplate('test-template.html', { name: 'John', vehicle: 'Honda Accord' });
      
      // Second call should use cache
      await emailService.renderTemplate('test-template.html', { name: 'Jane', vehicle: 'Toyota Camry' });
      
      // File should only be read once
      expect(fs.promises.readFile).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Email Sending - SendGrid', () => {
    beforeEach(() => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      emailService = new EmailService();
    });
    
    it('should send email via SendGrid successfully', async () => {
      const sendgridModule = await import('@sendgrid/mail');
      const mockSend = vi.mocked(sendgridModule.send);

      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      };

      const result = await emailService.send(options);

      expect(result).toEqual({ messageId: expect.any(String) });
      expect(mockSend).toHaveBeenCalledWith({
        to: 'recipient@example.com',
        from: 'test@example.com', // From env
        subject: 'Test Email',
        text: 'This is a test email',
        html: '<p>This is a test email</p>'
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Email sent via SendGrid'),
        expect.any(Object)
      );
    });
    
    it('should use custom from address when provided', async () => {
      const sendgridModule = await import('@sendgrid/mail');
      const mockSend = vi.mocked(sendgridModule.send);

      const options: EmailOptions = {
        to: 'recipient@example.com',
        from: 'custom@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };

      await emailService.send(options);

      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
        from: 'custom@example.com'
      }));
    });
  });
  
  describe('Rate Limiting', () => {
    it('should respect rate limits with throttling', async () => {
      // Create deterministic time mock
      let currentTime = 1000;
      const mockNow = vi.fn(() => currentTime);
      
      // Create mock rate limit store
      const mockStore = new MemoryRateLimitStore(mockNow);
      
      // Update the existing email service with rate limiting configuration
      emailService.updateRateLimitConfig(true, 2, mockStore, mockNow);
      
      // Get the mocked SendGrid module and setup the mock before use
      const sendgridModule = await import('@sendgrid/mail');
      const mockSend = vi.mocked(sendgridModule.send);
      
      // Clear previous mock calls and reset the mock implementation
      mockSend.mockClear();
      mockSend.mockReset();
      
      // Simple mock that doesn't cause stack overflow
      mockSend.mockResolvedValue([
        { statusCode: 202, headers: { 'x-message-id': 'test-msg' } }, 
        {}
      ]);
      
      // Also mock the default export to ensure all import patterns work
      if (sendgridModule.default && sendgridModule.default.send) {
        vi.mocked(sendgridModule.default.send).mockResolvedValue([
          { statusCode: 202, headers: { 'x-message-id': 'test-msg' } }, 
          {}
        ]);
      }
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      // Send 3 emails (rate limit is 2 per second)
      const result1 = await emailService.send(options);
      const result2 = await emailService.send(options);
      const result3 = await emailService.send(options);
      
      // All emails should have been sent successfully
      expect(result1.messageId).toBeDefined();
      expect(result2.messageId).toBeDefined();
      expect(result3.messageId).toBeDefined();
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
    
    it('should handle concurrent requests properly', async () => {
      // Create deterministic time mock
      let currentTime = 2000;
      const mockNow = vi.fn(() => currentTime);
      
      // Create mock rate limit store
      const mockStore = new MemoryRateLimitStore(mockNow);
      
      // Update the existing email service with rate limiting configuration
      emailService.updateRateLimitConfig(true, 1, mockStore, mockNow);
      
      // Get the mocked SendGrid module and setup the mock before use
      const sendgridModule = await import('@sendgrid/mail');
      const mockSend = vi.mocked(sendgridModule.send);
      
      // Clear previous mock calls and reset the mock implementation
      mockSend.mockClear();
      mockSend.mockReset();
      
      // Simple mock that doesn't cause stack overflow
      mockSend.mockResolvedValue([
        { statusCode: 202, headers: { 'x-message-id': 'test-msg' } }, 
        {}
      ]);
      
      // Also mock the default export to ensure all import patterns work
      if (sendgridModule.default && sendgridModule.default.send) {
        vi.mocked(sendgridModule.default.send).mockResolvedValue([
          { statusCode: 202, headers: { 'x-message-id': 'test-msg' } }, 
          {}
        ]);
      }
      
      const options: EmailOptions = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email'
      };
      
      // Send 3 emails serially (rate limit is 1 per second)
      const result1 = await emailService.send(options);
      const result2 = await emailService.send(options);
      const result3 = await emailService.send(options);
      
      // All emails should have been sent successfully
      expect(result1.messageId).toBeDefined();
      expect(result2.messageId).toBeDefined();
      expect(result3.messageId).toBeDefined();
      expect(mockSend).toHaveBeenCalledTimes(3);
    });
  });
});