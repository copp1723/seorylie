import { EventEmitter } from 'events';
import { jest } from '@jest/globals';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../../server/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    sms: jest.fn()
  }
}));

jest.mock('../../../server/db', () => ({
  __esModule: true,
  default: {
    execute: jest.fn()
  }
}));

jest.mock('drizzle-orm', () => ({
  __esModule: true,
  sql: {
    raw: jest.fn((str) => str)
  }
}));

jest.mock('../../../server/services/twilio-sms-service', () => ({
  __esModule: true,
  twilioSMSService: {
    sendSMS: jest.fn(),
    checkOptOutStatus: jest.fn(),
    handleOptOut: jest.fn(),
    maskPhoneNumber: jest.fn((phone) => `****${phone.slice(-4)}`)
  }
}));

jest.mock('../../../server/services/monitoring', () => ({
  __esModule: true,
  monitoringService: {
    registerMetric: jest.fn(),
    incrementMetric: jest.fn(),
    recordMetric: jest.fn(),
    getMetrics: jest.fn()
  }
}));

// Import mocked dependencies
import logger from '../../../server/utils/logger';
import db from '../../../server/db';
import { sql } from 'drizzle-orm';
import { twilioSMSService } from '../../../server/services/twilio-sms-service';
import { monitoringService } from '../../../server/services/monitoring';

// Import the module under test
// We need to import after the mocks are set up
import { AdfSmsResponseSender } from '../../../server/services/adf-sms-response-sender';

describe('AdfSmsResponseSender', () => {
  let adfSmsResponseSender: AdfSmsResponseSender;
  const mockLeadId = 12345;
  const mockDealershipId = 1;
  const mockPhoneNumber = '+15555555555';
  const mockMessage = 'Test message';
  const mockMessageSid = 'SM' + crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock database responses
    (db.execute as jest.Mock).mockImplementation((query) => {
      if (query.includes('SELECT') && query.includes('adf_sms_responses')) {
        return Promise.resolve([{
          lead_id: mockLeadId,
          dealership_id: mockDealershipId,
          phone_number: mockPhoneNumber,
          message: mockMessage,
          message_sid: mockMessageSid,
          status: 'sent',
          created_at: new Date(),
          sent_at: new Date(),
          delivered_at: null,
          retry_count: 0,
          is_opt_out: false
        }]);
      }
      if (query.includes('SELECT') && query.includes('adf_leads')) {
        return Promise.resolve([{
          id: mockLeadId,
          dealership_id: mockDealershipId,
          sms_status: 'sent'
        }]);
      }
      return Promise.resolve([{ id: 'mock-id' }]);
    });
    
    // Create a new instance for each test
    adfSmsResponseSender = new AdfSmsResponseSender();
  });
  
  afterEach(() => {
    // Clean up any timers or listeners
    jest.useRealTimers();
  });
  
  describe('initialization', () => {
    test('should initialize and register metrics', async () => {
      await adfSmsResponseSender.initialize();
      
      expect(monitoringService.registerMetric).toHaveBeenCalledWith('adf_sms_sent_total', 'counter');
      expect(monitoringService.registerMetric).toHaveBeenCalledWith('adf_sms_delivered_total', 'counter');
      expect(monitoringService.registerMetric).toHaveBeenCalledWith('adf_sms_failed_total', 'counter');
      expect(monitoringService.registerMetric).toHaveBeenCalledWith('adf_sms_retry_total', 'counter');
      expect(monitoringService.registerMetric).toHaveBeenCalledWith('adf_sms_optout_total', 'counter');
      expect(monitoringService.registerMetric).toHaveBeenCalledWith('adf_sms_delivery_time_ms', 'histogram');
      
      expect(logger.info).toHaveBeenCalledWith('Initializing ADF SMS Response Sender');
      expect(logger.info).toHaveBeenCalledWith('ADF SMS Response Sender initialized successfully');
    });
    
    test('should only initialize once', async () => {
      await adfSmsResponseSender.initialize();
      await adfSmsResponseSender.initialize();
      
      // Should only register metrics once
      expect(monitoringService.registerMetric).toHaveBeenCalledTimes(6);
    });
    
    test('should handle initialization errors', async () => {
      // Mock a failure in monitoring service
      (monitoringService.registerMetric as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Registration failed');
      });
      
      await expect(adfSmsResponseSender.initialize()).rejects.toThrow('Registration failed');
      expect(logger.error).toHaveBeenCalledWith('Failed to initialize ADF SMS Response Sender', expect.any(Object));
    });
  });
  
  describe('event handling', () => {
    test('should set up event listeners', () => {
      // Access private method using type assertion
      const spy = jest.spyOn(adfSmsResponseSender as any, 'setupEventListeners');
      
      // Create a new instance to trigger constructor
      const newSender = new AdfSmsResponseSender();
      
      expect(spy).toHaveBeenCalled();
      
      // Check that event listeners were added
      expect(newSender.listenerCount('lead.response.ready')).toBeGreaterThan(0);
      expect(newSender.listenerCount('sms.delivery.update')).toBeGreaterThan(0);
      expect(newSender.listenerCount('sms.optout')).toBeGreaterThan(0);
      
      spy.mockRestore();
    });
    
    test('should handle lead.response.ready event', async () => {
      // Mock extractPhoneNumber to return a valid phone
      jest.spyOn(adfSmsResponseSender as any, 'extractPhoneNumber').mockReturnValue(mockPhoneNumber);
      
      // Mock sendSms to resolve successfully
      const sendSmsSpy = jest.spyOn(adfSmsResponseSender as any, 'sendSms').mockResolvedValue(undefined);
      
      // Mock checkOptOutStatus to return false (not opted out)
      (twilioSMSService.checkOptOutStatus as jest.Mock).mockResolvedValue(false);
      
      // Create event data
      const eventData = {
        leadId: mockLeadId,
        response: 'Thank you for your interest.',
        dealershipId: mockDealershipId,
        lead: {
          id: mockLeadId,
          customer: {
            name: 'Test Customer',
            phone: mockPhoneNumber
          }
        }
      };
      
      // Emit the event
      await adfSmsResponseSender.emit('lead.response.ready', eventData);
      
      // Wait for async handlers
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify phone extraction and SMS sending
      expect(adfSmsResponseSender['extractPhoneNumber']).toHaveBeenCalledWith(eventData.lead);
      expect(twilioSMSService.checkOptOutStatus).toHaveBeenCalledWith(mockDealershipId, mockPhoneNumber);
      expect(sendSmsSpy).toHaveBeenCalledWith(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        expect.any(String) // Formatted message
      );
      
      sendSmsSpy.mockRestore();
    });
    
    test('should skip sending if customer has opted out', async () => {
      // Mock extractPhoneNumber to return a valid phone
      jest.spyOn(adfSmsResponseSender as any, 'extractPhoneNumber').mockReturnValue(mockPhoneNumber);
      
      // Mock sendSms to track if it's called
      const sendSmsSpy = jest.spyOn(adfSmsResponseSender as any, 'sendSms');
      
      // Mock checkOptOutStatus to return true (opted out)
      (twilioSMSService.checkOptOutStatus as jest.Mock).mockResolvedValue(true);
      
      // Create event data
      const eventData = {
        leadId: mockLeadId,
        response: 'Thank you for your interest.',
        dealershipId: mockDealershipId,
        lead: {
          id: mockLeadId,
          customer: {
            name: 'Test Customer',
            phone: mockPhoneNumber
          }
        }
      };
      
      // Emit the event
      await adfSmsResponseSender.emit('lead.response.ready', eventData);
      
      // Wait for async handlers
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify phone extraction and opt-out check
      expect(adfSmsResponseSender['extractPhoneNumber']).toHaveBeenCalledWith(eventData.lead);
      expect(twilioSMSService.checkOptOutStatus).toHaveBeenCalledWith(mockDealershipId, mockPhoneNumber);
      
      // Verify SMS not sent
      expect(sendSmsSpy).not.toHaveBeenCalled();
      
      // Verify status update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_leads'));
      
      sendSmsSpy.mockRestore();
    });
    
    test('should handle missing phone number', async () => {
      // Mock extractPhoneNumber to return null (no valid phone)
      jest.spyOn(adfSmsResponseSender as any, 'extractPhoneNumber').mockReturnValue(null);
      
      // Mock sendSms to track if it's called
      const sendSmsSpy = jest.spyOn(adfSmsResponseSender as any, 'sendSms');
      
      // Create event data
      const eventData = {
        leadId: mockLeadId,
        response: 'Thank you for your interest.',
        dealershipId: mockDealershipId,
        lead: {
          id: mockLeadId,
          customer: {
            name: 'Test Customer',
            // No phone number
          }
        }
      };
      
      // Set up spy for emit to check for failure event
      const emitSpy = jest.spyOn(adfSmsResponseSender, 'emit');
      
      // Emit the event
      await adfSmsResponseSender.emit('lead.response.ready', eventData);
      
      // Wait for async handlers
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify phone extraction
      expect(adfSmsResponseSender['extractPhoneNumber']).toHaveBeenCalledWith(eventData.lead);
      
      // Verify SMS not sent
      expect(sendSmsSpy).not.toHaveBeenCalled();
      
      // Verify failure event emitted
      expect(emitSpy).toHaveBeenCalledWith('sms.send.failed', expect.objectContaining({
        leadId: mockLeadId,
        error: 'No valid phone number found'
      }));
      
      sendSmsSpy.mockRestore();
      emitSpy.mockRestore();
    });
  });
  
  describe('SMS sending', () => {
    test('should send SMS successfully', async () => {
      // Mock Twilio service to return success
      (twilioSMSService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageSid: mockMessageSid
      });
      
      // Mock recordSmsAttempt and updateSmsWithSid
      const recordAttemptSpy = jest.spyOn(adfSmsResponseSender as any, 'recordSmsAttempt').mockResolvedValue(undefined);
      const updateSidSpy = jest.spyOn(adfSmsResponseSender as any, 'updateSmsWithSid').mockResolvedValue(undefined);
      const setTimeoutSpy = jest.spyOn(adfSmsResponseSender as any, 'setDeliveryTimeout').mockImplementation(() => {});
      
      // Set up spy for emit to check for success event
      const emitSpy = jest.spyOn(adfSmsResponseSender, 'emit');
      
      // Call the private sendSms method
      await (adfSmsResponseSender as any).sendSms(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        mockMessage
      );
      
      // Verify SMS was sent
      expect(twilioSMSService.sendSMS).toHaveBeenCalledWith({
        dealershipId: mockDealershipId,
        toPhone: mockPhoneNumber,
        message: mockMessage,
        metadata: expect.objectContaining({
          leadId: mockLeadId,
          source: 'adf'
        })
      });
      
      // Verify database operations
      expect(recordAttemptSpy).toHaveBeenCalledWith(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        mockMessage
      );
      
      expect(updateSidSpy).toHaveBeenCalledWith(mockLeadId, mockMessageSid);
      
      // Verify timeout set
      expect(setTimeoutSpy).toHaveBeenCalledWith(mockLeadId, mockMessageSid);
      
      // Verify metrics updated
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith('adf_sms_sent_total');
      
      // Verify success event emitted
      expect(emitSpy).toHaveBeenCalledWith('sms.send.success', expect.objectContaining({
        leadId: mockLeadId,
        messageSid: mockMessageSid
      }));
      
      recordAttemptSpy.mockRestore();
      updateSidSpy.mockRestore();
      setTimeoutSpy.mockRestore();
      emitSpy.mockRestore();
    });
    
    test('should handle SMS sending failure', async () => {
      // Mock Twilio service to return failure
      (twilioSMSService.sendSMS as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to send SMS'
      });
      
      // Mock recordSmsAttempt and scheduleRetry
      const recordAttemptSpy = jest.spyOn(adfSmsResponseSender as any, 'recordSmsAttempt').mockResolvedValue(undefined);
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus').mockResolvedValue(undefined);
      const scheduleRetrySpy = jest.spyOn(adfSmsResponseSender as any, 'scheduleRetry').mockImplementation(() => {});
      
      // Set up spy for emit to check for failure event
      const emitSpy = jest.spyOn(adfSmsResponseSender, 'emit');
      
      // Call the private sendSms method
      await (adfSmsResponseSender as any).sendSms(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        mockMessage
      );
      
      // Verify SMS attempt was made
      expect(twilioSMSService.sendSMS).toHaveBeenCalled();
      
      // Verify database operations
      expect(recordAttemptSpy).toHaveBeenCalled();
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId, 'failed', 'Failed to send SMS');
      
      // Verify retry scheduled
      expect(scheduleRetrySpy).toHaveBeenCalledWith(mockLeadId);
      
      // Verify metrics updated
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith('adf_sms_failed_total');
      
      // Verify failure event emitted
      expect(emitSpy).toHaveBeenCalledWith('sms.send.failed', expect.objectContaining({
        leadId: mockLeadId,
        error: 'Failed to send SMS'
      }));
      
      recordAttemptSpy.mockRestore();
      updateLeadStatusSpy.mockRestore();
      scheduleRetrySpy.mockRestore();
      emitSpy.mockRestore();
    });
    
    test('should handle exceptions during SMS sending', async () => {
      // Mock recordSmsAttempt to throw an error
      jest.spyOn(adfSmsResponseSender as any, 'recordSmsAttempt').mockImplementation(() => {
        throw new Error('Database error');
      });
      
      // Mock updateLeadSmsStatus
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus').mockResolvedValue(undefined);
      
      // Call the private sendSms method and expect it to throw
      await expect((adfSmsResponseSender as any).sendSms(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        mockMessage
      )).rejects.toThrow('Database error');
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error in sendSms method', expect.objectContaining({
        error: 'Database error',
        leadId: mockLeadId
      }));
      
      // Verify lead status was updated
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId, 'failed', 'Database error');
      
      updateLeadStatusSpy.mockRestore();
    });
  });
  
  describe('webhook processing', () => {
    test('should process delivery status webhook for delivered status', async () => {
      // Mock getSmsResponseByMessageSid
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockResolvedValue({
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        sentAt: new Date(Date.now() - 5000), // 5 seconds ago
        status: 'sent'
      });
      
      // Mock clearDeliveryTimeout
      const clearTimeoutSpy = jest.spyOn(adfSmsResponseSender as any, 'clearDeliveryTimeout').mockImplementation(() => {});
      
      // Mock updateLeadSmsStatus
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus').mockResolvedValue(undefined);
      
      // Set up spy for emit
      const emitSpy = jest.spyOn(adfSmsResponseSender, 'emit');
      
      // Create webhook data
      const webhookData = {
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'delivered',
        timestamp: new Date()
      };
      
      // Process webhook
      await adfSmsResponseSender.handleDeliveryUpdate(webhookData);
      
      // Verify database update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_sms_responses'));
      
      // Verify lead status update
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId, 'delivered', undefined);
      
      // Verify timeout cleared
      expect(clearTimeoutSpy).toHaveBeenCalledWith(mockMessageSid);
      
      // Verify metrics updated
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith('adf_sms_delivered_total');
      expect(monitoringService.recordMetric).toHaveBeenCalledWith('adf_sms_delivery_time_ms', expect.any(Number));
      
      // Verify delivered event emitted
      expect(emitSpy).toHaveBeenCalledWith('sms.delivered', expect.objectContaining({
        leadId: mockLeadId,
        messageSid: mockMessageSid
      }));
      
      clearTimeoutSpy.mockRestore();
      updateLeadStatusSpy.mockRestore();
      emitSpy.mockRestore();
    });
    
    test('should process delivery status webhook for failed status', async () => {
      // Mock getSmsResponseByMessageSid
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockResolvedValue({
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'sent'
      });
      
      // Mock updateLeadSmsStatus
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus').mockResolvedValue(undefined);
      
      // Mock scheduleRetry
      const scheduleRetrySpy = jest.spyOn(adfSmsResponseSender as any, 'scheduleRetry').mockImplementation(() => {});
      
      // Set up spy for emit
      const emitSpy = jest.spyOn(adfSmsResponseSender, 'emit');
      
      // Create webhook data
      const webhookData = {
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'failed',
        errorCode: '30001',
        errorMessage: 'Failed to deliver',
        timestamp: new Date()
      };
      
      // Process webhook
      await adfSmsResponseSender.handleDeliveryUpdate(webhookData);
      
      // Verify database update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_sms_responses'));
      
      // Verify lead status update
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId, 'failed', 'Failed to deliver');
      
      // Verify retry scheduled
      expect(scheduleRetrySpy).toHaveBeenCalledWith(mockLeadId);
      
      // Verify metrics updated
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith('adf_sms_failed_total');
      
      // Verify failure event emitted
      expect(emitSpy).toHaveBeenCalledWith('sms.delivery.failed', expect.objectContaining({
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        errorCode: '30001',
        errorMessage: 'Failed to deliver'
      }));
      
      updateLeadStatusSpy.mockRestore();
      scheduleRetrySpy.mockRestore();
      emitSpy.mockRestore();
    });
    
    test('should handle webhook processing errors', async () => {
      // Mock db.execute to throw an error
      (db.execute as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      // Create webhook data
      const webhookData = {
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'delivered',
        timestamp: new Date()
      };
      
      // Process webhook
      await adfSmsResponseSender.handleDeliveryUpdate(webhookData);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Failed to handle delivery update', expect.objectContaining({
        error: 'Database error',
        messageSid: mockMessageSid
      }));
    });
    
    test('should process inbound SMS webhook for opt-out', async () => {
      // Mock findDealershipByPhoneNumber
      jest.spyOn(adfSmsResponseSender as any, 'findDealershipByPhoneNumber').mockResolvedValue(mockDealershipId);
      
      // Mock handleOptOut
      const handleOptOutSpy = jest.spyOn(adfSmsResponseSender as any, 'handleOptOut').mockResolvedValue(undefined);
      
      // Create webhook data
      const webhookData = {
        Body: 'STOP',
        From: mockPhoneNumber,
        To: '+16505551234',
        MessageSid: mockMessageSid,
        AccountSid: 'AC00000000000000000000000000000000'
      };
      
      // Process inbound SMS
      await adfSmsResponseSender.processInboundSms(webhookData);
      
      // Verify opt-out was handled
      expect(handleOptOutSpy).toHaveBeenCalledWith({
        phoneNumber: mockPhoneNumber,
        dealershipId: mockDealershipId,
        reason: 'user_request'
      });
      
      handleOptOutSpy.mockRestore();
    });
    
    test('should ignore inbound SMS without opt-out keywords', async () => {
      // Mock handleOptOut
      const handleOptOutSpy = jest.spyOn(adfSmsResponseSender as any, 'handleOptOut');
      
      // Create webhook data with non-opt-out message
      const webhookData = {
        Body: 'Thanks for the information',
        From: mockPhoneNumber,
        To: '+16505551234',
        MessageSid: mockMessageSid,
        AccountSid: 'AC00000000000000000000000000000000'
      };
      
      // Process inbound SMS
      await adfSmsResponseSender.processInboundSms(webhookData);
      
      // Verify opt-out was not handled
      expect(handleOptOutSpy).not.toHaveBeenCalled();
      
      handleOptOutSpy.mockRestore();
    });
  });
  
  describe('opt-out handling', () => {
    test('should handle opt-out requests', async () => {
      // Mock twilioSMSService.handleOptOut
      (twilioSMSService.handleOptOut as jest.Mock).mockResolvedValue(undefined);
      
      // Mock findLeadsByPhoneNumber
      jest.spyOn(adfSmsResponseSender as any, 'findLeadsByPhoneNumber').mockResolvedValue([
        { id: mockLeadId },
        { id: mockLeadId + 1 }
      ]);
      
      // Mock updateLeadSmsStatus
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus').mockResolvedValue(undefined);
      
      // Create opt-out data
      const optOutData = {
        phoneNumber: mockPhoneNumber,
        dealershipId: mockDealershipId,
        reason: 'user_request'
      };
      
      // Handle opt-out
      await adfSmsResponseSender.handleOptOut(optOutData);
      
      // Verify Twilio service was called
      expect(twilioSMSService.handleOptOut).toHaveBeenCalledWith(
        mockDealershipId,
        mockPhoneNumber,
        'user_request'
      );
      
      // Verify leads were updated
      expect(updateLeadStatusSpy).toHaveBeenCalledTimes(2);
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId, 'opted_out');
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId + 1, 'opted_out');
      
      // Verify metrics updated
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith('adf_sms_optout_total');
      
      updateLeadStatusSpy.mockRestore();
    });
    
    test('should handle errors during opt-out processing', async () => {
      // Mock twilioSMSService.handleOptOut to throw
      (twilioSMSService.handleOptOut as jest.Mock).mockImplementation(() => {
        throw new Error('Twilio error');
      });
      
      // Create opt-out data
      const optOutData = {
        phoneNumber: mockPhoneNumber,
        dealershipId: mockDealershipId
      };
      
      // Handle opt-out
      await adfSmsResponseSender.handleOptOut(optOutData);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Failed to handle opt-out', expect.objectContaining({
        error: 'Twilio error'
      }));
    });
  });
  
  describe('retry logic', () => {
    beforeEach(() => {
      // Mock setTimeout and clearTimeout
      jest.useFakeTimers();
    });
    
    test('should schedule retry for failed messages', async () => {
      // Mock getSmsResponseByLeadId
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByLeadId').mockResolvedValue({
        leadId: mockLeadId,
        dealershipId: mockDealershipId,
        phoneNumber: mockPhoneNumber,
        message: mockMessage,
        status: 'failed',
        retryCount: 0
      });
      
      // Mock sendSms
      const sendSmsSpy = jest.spyOn(adfSmsResponseSender as any, 'sendSms').mockResolvedValue(undefined);
      
      // Schedule retry
      (adfSmsResponseSender as any).scheduleRetry(mockLeadId);
      
      // Fast-forward timers
      jest.advanceTimersByTime(5 * 60 * 1000 + 100); // 5 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify database update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_sms_responses'));
      
      // Verify metrics updated
      expect(monitoringService.incrementMetric).toHaveBeenCalledWith('adf_sms_retry_total');
      
      // Verify SMS resent
      expect(sendSmsSpy).toHaveBeenCalledWith(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        mockMessage
      );
      
      sendSmsSpy.mockRestore();
    });
    
    test('should not retry already delivered messages', async () => {
      // Mock getSmsResponseByLeadId for delivered message
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByLeadId').mockResolvedValue({
        leadId: mockLeadId,
        status: 'delivered',
        retryCount: 0
      });
      
      // Mock sendSms
      const sendSmsSpy = jest.spyOn(adfSmsResponseSender as any, 'sendSms');
      
      // Schedule retry
      (adfSmsResponseSender as any).scheduleRetry(mockLeadId);
      
      // Fast-forward timers
      jest.advanceTimersByTime(5 * 60 * 1000 + 100); // 5 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify SMS not resent
      expect(sendSmsSpy).not.toHaveBeenCalled();
      
      sendSmsSpy.mockRestore();
    });
    
    test('should not retry messages that reached max retry count', async () => {
      // Mock getSmsResponseByLeadId for max retries
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByLeadId').mockResolvedValue({
        leadId: mockLeadId,
        status: 'failed',
        retryCount: 3 // Max retries
      });
      
      // Mock sendSms
      const sendSmsSpy = jest.spyOn(adfSmsResponseSender as any, 'sendSms');
      
      // Schedule retry
      (adfSmsResponseSender as any).scheduleRetry(mockLeadId);
      
      // Fast-forward timers
      jest.advanceTimersByTime(5 * 60 * 1000 + 100); // 5 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify SMS not resent
      expect(sendSmsSpy).not.toHaveBeenCalled();
      
      sendSmsSpy.mockRestore();
    });
    
    test('should handle errors during retry', async () => {
      // Mock getSmsResponseByLeadId to throw
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByLeadId').mockImplementation(() => {
        throw new Error('Database error');
      });
      
      // Schedule retry
      (adfSmsResponseSender as any).scheduleRetry(mockLeadId);
      
      // Fast-forward timers
      jest.advanceTimersByTime(5 * 60 * 1000 + 100); // 5 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Failed to retry SMS send', expect.objectContaining({
        error: 'Database error',
        leadId: mockLeadId
      }));
    });
  });
  
  describe('delivery timeout handling', () => {
    beforeEach(() => {
      // Mock setTimeout and clearTimeout
      jest.useFakeTimers();
    });
    
    test('should set delivery timeout for sent messages', async () => {
      // Mock getSmsResponseByMessageSid
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockResolvedValue({
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'sent'
      });
      
      // Mock updateLeadSmsStatus
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus').mockResolvedValue(undefined);
      
      // Mock scheduleRetry
      const scheduleRetrySpy = jest.spyOn(adfSmsResponseSender as any, 'scheduleRetry').mockImplementation(() => {});
      
      // Set delivery timeout
      (adfSmsResponseSender as any).setDeliveryTimeout(mockLeadId, mockMessageSid);
      
      // Fast-forward timers
      jest.advanceTimersByTime(30 * 60 * 1000 + 100); // 30 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify database update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_sms_responses'));
      
      // Verify lead status update
      expect(updateLeadStatusSpy).toHaveBeenCalledWith(mockLeadId, 'undelivered');
      
      // Verify retry scheduled
      expect(scheduleRetrySpy).toHaveBeenCalledWith(mockLeadId);
      
      updateLeadStatusSpy.mockRestore();
      scheduleRetrySpy.mockRestore();
    });
    
    test('should not update already delivered messages', async () => {
      // Mock getSmsResponseByMessageSid for delivered message
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockResolvedValue({
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'delivered'
      });
      
      // Mock updateLeadSmsStatus
      const updateLeadStatusSpy = jest.spyOn(adfSmsResponseSender as any, 'updateLeadSmsStatus');
      
      // Set delivery timeout
      (adfSmsResponseSender as any).setDeliveryTimeout(mockLeadId, mockMessageSid);
      
      // Fast-forward timers
      jest.advanceTimersByTime(30 * 60 * 1000 + 100); // 30 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify lead status not updated
      expect(updateLeadStatusSpy).not.toHaveBeenCalled();
      
      updateLeadStatusSpy.mockRestore();
    });
    
    test('should clear delivery timeout', () => {
      // Mock clearTimeout
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Set and then clear timeout
      (adfSmsResponseSender as any).setDeliveryTimeout(mockLeadId, mockMessageSid);
      (adfSmsResponseSender as any).clearDeliveryTimeout(mockMessageSid);
      
      // Verify clearTimeout was called
      expect(clearTimeoutSpy).toHaveBeenCalled();
      
      clearTimeoutSpy.mockRestore();
    });
    
    test('should handle errors during timeout handling', async () => {
      // Mock getSmsResponseByMessageSid to throw
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockImplementation(() => {
        throw new Error('Database error');
      });
      
      // Set delivery timeout
      (adfSmsResponseSender as any).setDeliveryTimeout(mockLeadId, mockMessageSid);
      
      // Fast-forward timers
      jest.advanceTimersByTime(30 * 60 * 1000 + 100); // 30 minutes + buffer
      
      // Wait for promises to resolve
      await Promise.resolve();
      await Promise.resolve();
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error in delivery timeout handler', expect.objectContaining({
        error: 'Database error',
        leadId: mockLeadId
      }));
    });
  });
  
  describe('phone number and message formatting', () => {
    test('should extract phone number from lead data', () => {
      // Test with structured phone object
      const lead1 = {
        customer: {
          phone: {
            number: mockPhoneNumber,
            type: 'mobile'
          }
        }
      };
      
      expect((adfSmsResponseSender as any).extractPhoneNumber(lead1)).toBe(mockPhoneNumber);
      
      // Test with string phone
      const lead2 = {
        customer: {
          phone: mockPhoneNumber
        }
      };
      
      expect((adfSmsResponseSender as any).extractPhoneNumber(lead2)).toBe(mockPhoneNumber);
      
      // Test with phones array
      const lead3 = {
        customer: {
          phones: [
            { type: 'mobile', number: mockPhoneNumber },
            { type: 'home', number: '+15551234567' }
          ]
        }
      };
      
      expect((adfSmsResponseSender as any).extractPhoneNumber(lead3)).toBe(mockPhoneNumber);
      
      // Test with no phone
      const lead4 = {
        customer: {
          name: 'Test Customer'
        }
      };
      
      expect((adfSmsResponseSender as any).extractPhoneNumber(lead4)).toBeNull();
    });
    
    test('should format message with personalization and opt-out footer', () => {
      // Test with first name in structured name
      const lead1 = {
        customer: {
          name: {
            first: 'John',
            last: 'Doe'
          }
        }
      };
      
      const message1 = 'Thank you for your interest.';
      const formatted1 = (adfSmsResponseSender as any).formatMessage(message1, lead1);
      
      expect(formatted1).toContain('Hi John');
      expect(formatted1).toContain('Thank you for your interest');
      expect(formatted1).toContain('STOP to opt out');
      
      // Test with string name
      const lead2 = {
        customer: {
          name: 'John Doe'
        }
      };
      
      const message2 = 'Thank you for your interest.';
      const formatted2 = (adfSmsResponseSender as any).formatMessage(message2, lead2);
      
      expect(formatted2).toContain('Hi John');
      expect(formatted2).toContain('Thank you for your interest');
      expect(formatted2).toContain('STOP to opt out');
      
      // Test with very long message
      const longMessage = 'This is a very long message that should be truncated because SMS messages have a limit of 160 characters. We need to ensure that the message is properly truncated and the opt-out footer is still included. This message is definitely longer than 160 characters.';
      const formatted3 = (adfSmsResponseSender as any).formatMessage(longMessage, lead1);
      
      expect(formatted3.length).toBeLessThanOrEqual(160);
      expect(formatted3).toContain('...');
      expect(formatted3).toContain('STOP to opt out');
    });
    
    test('should handle errors in message formatting', () => {
      // Create a lead that will cause an error
      const problematicLead = {
        customer: {
          name: { get first() { throw new Error('Name error'); } }
        }
      };
      
      const message = 'Thank you for your interest.';
      const formatted = (adfSmsResponseSender as any).formatMessage(message, problematicLead);
      
      // Should fall back to original message with footer
      expect(formatted).toBe(`${message} Reply STOP to opt out.`);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error formatting message', expect.any(Object));
    });
  });
  
  describe('database operations', () => {
    test('should record SMS attempt in database', async () => {
      await (adfSmsResponseSender as any).recordSmsAttempt(
        mockLeadId,
        mockDealershipId,
        mockPhoneNumber,
        mockMessage
      );
      
      // Verify database call for existing check
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('SELECT id FROM adf_sms_responses'));
      
      // Verify insert or update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_sms_responses'));
    });
    
    test('should update SMS with SID', async () => {
      await (adfSmsResponseSender as any).updateSmsWithSid(mockLeadId, mockMessageSid);
      
      // Verify database update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_sms_responses'));
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('message_sid = '));
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('status = \'sent\''));
    });
    
    test('should update lead SMS status', async () => {
      await (adfSmsResponseSender as any).updateLeadSmsStatus(mockLeadId, 'delivered', 'Success');
      
      // Verify database update
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE adf_leads'));
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('sms_status = '));
      expect(db.execute).toHaveBeenCalledWith(expect.stringContaining('sms_error = '));
    });
    
    test('should handle database errors', async () => {
      // Mock db.execute to throw
      (db.execute as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      await (adfSmsResponseSender as any).updateLeadSmsStatus(mockLeadId, 'delivered');
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Failed to update lead SMS status', expect.objectContaining({
        error: 'Database error',
        leadId: mockLeadId
      }));
    });
  });
  
  describe('metrics and monitoring', () => {
    test('should return metrics', () => {
      const metrics = adfSmsResponseSender.getMetrics();
      
      // Verify metrics object structure
      expect(metrics).toHaveProperty('sentCount');
      expect(metrics).toHaveProperty('deliveredCount');
      expect(metrics).toHaveProperty('failedCount');
      expect(metrics).toHaveProperty('retryCount');
      expect(metrics).toHaveProperty('optOutCount');
      expect(metrics).toHaveProperty('avgDeliveryTimeMs');
    });
  });
  
  describe('webhook processing', () => {
    test('should process Twilio webhook', async () => {
      // Mock getSmsResponseByMessageSid
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockResolvedValue({
        leadId: mockLeadId,
        messageSid: mockMessageSid
      });
      
      // Mock handleDeliveryUpdate
      const handleDeliveryUpdateSpy = jest.spyOn(adfSmsResponseSender, 'handleDeliveryUpdate').mockResolvedValue(undefined);
      
      // Create webhook data
      const webhookData = {
        MessageSid: mockMessageSid,
        MessageStatus: 'delivered',
        To: mockPhoneNumber,
        From: '+16505551234',
        AccountSid: 'AC00000000000000000000000000000000'
      };
      
      // Process webhook
      await adfSmsResponseSender.processWebhook(webhookData);
      
      // Verify delivery update was handled
      expect(handleDeliveryUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
        leadId: mockLeadId,
        messageSid: mockMessageSid,
        status: 'delivered'
      }));
      
      handleDeliveryUpdateSpy.mockRestore();
    });
    
    test('should handle unknown message SID in webhook', async () => {
      // Mock getSmsResponseByMessageSid to return null
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockResolvedValue(null);
      
      // Create webhook data
      const webhookData = {
        MessageSid: 'unknown-sid',
        MessageStatus: 'delivered',
        To: mockPhoneNumber,
        From: '+16505551234',
        AccountSid: 'AC00000000000000000000000000000000'
      };
      
      // Process webhook
      await adfSmsResponseSender.processWebhook(webhookData);
      
      // Verify warning was logged
      expect(logger.warn).toHaveBeenCalledWith('Received webhook for unknown message SID', expect.any(Object));
    });
    
    test('should handle errors in webhook processing', async () => {
      // Mock getSmsResponseByMessageSid to throw
      jest.spyOn(adfSmsResponseSender as any, 'getSmsResponseByMessageSid').mockImplementation(() => {
        throw new Error('Database error');
      });
      
      // Create webhook data
      const webhookData = {
        MessageSid: mockMessageSid,
        MessageStatus: 'delivered',
        To: mockPhoneNumber,
        From: '+16505551234',
        AccountSid: 'AC00000000000000000000000000000000'
      };
      
      // Process webhook
      await adfSmsResponseSender.processWebhook(webhookData);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Failed to process webhook', expect.objectContaining({
        error: 'Database error'
      }));
    });
  });
  
  describe('test SMS sending', () => {
    test('should send test SMS', async () => {
      // Mock createTestLead
      jest.spyOn(adfSmsResponseSender as any, 'createTestLead').mockResolvedValue(mockLeadId);
      
      // Mock recordSmsAttempt and updateSmsWithSid
      jest.spyOn(adfSmsResponseSender as any, 'recordSmsAttempt').mockResolvedValue(undefined);
      jest.spyOn(adfSmsResponseSender as any, 'updateSmsWithSid').mockResolvedValue(undefined);
      
      // Mock Twilio service to return success
      (twilioSMSService.sendSMS as jest.Mock).mockResolvedValue({
        success: true,
        messageSid: mockMessageSid
      });
      
      // Send test SMS
      const result = await adfSmsResponseSender.testSendSms(
        mockPhoneNumber,
        mockMessage,
        mockDealershipId
      );
      
      // Verify result
      expect(result.success).toBe(true);
      expect(result.messageSid).toBe(mockMessageSid);
      
      // Verify Twilio service was called
      expect(twilioSMSService.sendSMS).toHaveBeenCalledWith(expect.objectContaining({
        dealershipId: mockDealershipId,
        toPhone: mockPhoneNumber,
        message: expect.stringContaining(mockMessage)
      }));
    });
    
    test('should handle test SMS failure', async () => {
      // Mock createTestLead
      jest.spyOn(adfSmsResponseSender as any, 'createTestLead').mockResolvedValue(mockLeadId);
      
      // Mock recordSmsAttempt
      jest.spyOn(adfSmsResponseSender as any, 'recordSmsAttempt').mockResolvedValue(undefined);
      
      // Mock Twilio service to return failure
      (twilioSMSService.sendSMS as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Failed to send test SMS'
      });
      
      // Send test SMS
      const result = await adfSmsResponseSender.testSendSms(
        mockPhoneNumber,
        mockMessage,
        mockDealershipId
      );
      
      // Verify result
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to send test SMS');
    });
  });
});
