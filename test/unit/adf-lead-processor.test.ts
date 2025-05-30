/**
 * ADF Lead Processor - Unit Tests
 * 
 * Tests for the ADF Lead Processor service which handles:
 * - XML parsing and validation
 * - Lead deduplication
 * - Database operations
 * - Error handling
 * - Metrics tracking
 * - Event emission
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { AdfLeadProcessor } from '../../server/services/adf-lead-processor';
import eventBus from '../../server/services/event-bus';
import { prometheusMetrics } from '../../server/services/prometheus-metrics';
import logger from '../../server/utils/logger';

// Mock dependencies
vi.mock('../../server/db', () => {
  return {
    default: {
      transaction: vi.fn().mockImplementation(async (callback) => {
        return callback({
          select: vi.fn().mockReturnThis(),
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnValue([]),
          insert: vi.fn().mockReturnThis(),
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([
            { id: 1, externalId: 'test-123', dealershipId: 1 }
          ])
        });
      }),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        { id: 1, externalId: 'test-123', dealershipId: 1 }
      ])
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
      incrementImapDisconnections: vi.fn()
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

// Valid ADF XML sample
const validAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect status="new">
    <id source="dealersite">test-123</id>
    <requestdate>2023-09-01T09:30:00-05:00</requestdate>
    <vehicle interest="buy" status="new">
      <year>2023</year>
      <make>Honda</make>
      <model>Accord</model>
      <trim>Sport</trim>
      <stocknumber>ABC123</stocknumber>
    </vehicle>
    <customer>
      <contact primarycontact="1">
        <name part="first">John</name>
        <name part="last">Doe</name>
        <email>john.doe@example.com</email>
        <phone type="voice" time="morning">555-123-4567</phone>
      </contact>
      <comments>I'm interested in the Honda Accord</comments>
    </customer>
    <vendor>
      <vendorname>Test Vendor</vendorname>
      <contact primarycontact="1">
        <name part="full">Test Dealership</name>
        <email>dealer@example.com</email>
      </contact>
    </vendor>
  </prospect>
</adf>`;

// Malformed XML sample
const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect status="new">
    <id source="dealersite">test-456</id>
    <requestdate>2023-09-01T09:30:00-05:00</requestdate>
    <vehicle interest="buy" status="new">
      <year>2023</year>
      <make>Honda</make>
      <model>Accord</model>
    <!-- Missing closing tags -->
`;

// Missing required fields XML
const missingFieldsXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect status="new">
    <id source="dealersite">test-789</id>
    <requestdate>2023-09-01T09:30:00-05:00</requestdate>
    <!-- Missing vehicle section -->
    <customer>
      <contact primarycontact="1">
        <!-- Missing name -->
        <email>missing.fields@example.com</email>
        <phone type="voice" time="morning">555-987-6543</phone>
      </contact>
    </customer>
    <vendor>
      <vendorname>Test Vendor</vendorname>
    </vendor>
  </prospect>
</adf>`;

describe('AdfLeadProcessor', () => {
  let processor: AdfLeadProcessor;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Create processor instance with mocked dealership lookup
    processor = new AdfLeadProcessor();
    
    // Mock the getDealershipByEmail method
    processor.getDealershipByEmail = vi.fn().mockResolvedValue({
      id: 1,
      name: 'Test Dealership',
      primaryEmail: 'dealer@example.com',
      isActive: true,
      settings: { enableAdfProcessing: true }
    });
  });
  
  describe('XML Parsing and Validation', () => {
    it('should successfully parse valid ADF XML', async () => {
      const result = await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.leadId).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('ADF lead processed successfully'), expect.any(Object));
    });
    
    it('should handle malformed XML', async () => {
      const result = await processor.processAdfXml(malformedXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('XML parsing error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error parsing ADF XML'), expect.any(Object));
    });
    
    it('should validate required fields in ADF XML', async () => {
      const result = await processor.processAdfXml(missingFieldsXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Missing required fields'), expect.any(Object));
    });
    
    it('should extract customer information correctly', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      // Check the extracted customer data in the database insert
      const dbInsert = vi.mocked(processor.db.insert);
      expect(dbInsert).toHaveBeenCalled();
      
      const insertValues = vi.mocked(processor.db.insert().values);
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
        customerName: 'John Doe',
        customerEmail: 'john.doe@example.com',
        customerPhone: '555-123-4567'
      }));
    });
    
    it('should extract vehicle information correctly', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      // Check the extracted vehicle data in the database insert
      const dbInsert = vi.mocked(processor.db.insert);
      expect(dbInsert).toHaveBeenCalled();
      
      const insertValues = vi.mocked(processor.db.insert().values);
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
        vehicleYear: '2023',
        vehicleMake: 'Honda',
        vehicleModel: 'Accord',
        vehicleTrim: 'Sport',
        vehicleStockNumber: 'ABC123'
      }));
    });
  });
  
  describe('Lead Deduplication Logic', () => {
    it('should detect duplicate leads by externalId', async () => {
      // Mock database to return an existing lead
      processor.db.select = vi.fn().mockReturnThis();
      processor.db.from = vi.fn().mockReturnThis();
      processor.db.where = vi.fn().mockReturnThis();
      processor.db.limit = vi.fn().mockResolvedValue([
        { id: 1, externalId: 'test-123', dealershipId: 1, createdAt: new Date() }
      ]);
      
      const result = await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Duplicate lead');
      expect(eventBus.emit).toHaveBeenCalledWith('adf.lead.duplicate', expect.any(Object));
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate lead detected'), expect.any(Object));
    });
    
    it('should process lead if no duplicate found', async () => {
      // Mock database to return no existing leads
      processor.db.select = vi.fn().mockReturnThis();
      processor.db.from = vi.fn().mockReturnThis();
      processor.db.where = vi.fn().mockReturnThis();
      processor.db.limit = vi.fn().mockResolvedValue([]);
      
      const result = await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.leadId).toBe(1);
      expect(eventBus.emit).toHaveBeenCalledWith('adf.lead.processed', expect.any(Object));
    });
  });
  
  describe('Database Operations', () => {
    it('should insert lead into database successfully', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      // Check database operations
      expect(processor.db.insert).toHaveBeenCalled();
      expect(processor.db.insert().values).toHaveBeenCalled();
      expect(processor.db.insert().values().returning).toHaveBeenCalled();
    });
    
    it('should handle database errors gracefully', async () => {
      // Mock database to throw an error
      processor.db.transaction = vi.fn().mockRejectedValue(new Error('Database connection error'));
      
      const result = await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error storing ADF lead'), expect.any(Object));
    });
    
    it('should use database transaction for atomicity', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      // Check transaction was used
      expect(processor.db.transaction).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling Scenarios', () => {
    it('should handle dealership lookup failures', async () => {
      // Mock dealership lookup to fail
      processor.getDealershipByEmail = vi.fn().mockResolvedValue(null);
      
      const result = await processor.processAdfXml(validAdfXml, 'unknown@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dealership not found');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Dealership not found'), expect.any(Object));
    });
    
    it('should handle inactive dealerships', async () => {
      // Mock inactive dealership
      processor.getDealershipByEmail = vi.fn().mockResolvedValue({
        id: 2,
        name: 'Inactive Dealership',
        primaryEmail: 'inactive@example.com',
        isActive: false
      });
      
      const result = await processor.processAdfXml(validAdfXml, 'inactive@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Dealership is not active');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Inactive dealership'), expect.any(Object));
    });
    
    it('should handle dealerships with ADF processing disabled', async () => {
      // Mock dealership with ADF processing disabled
      processor.getDealershipByEmail = vi.fn().mockResolvedValue({
        id: 3,
        name: 'No ADF Dealership',
        primaryEmail: 'no-adf@example.com',
        isActive: true,
        settings: { enableAdfProcessing: false }
      });
      
      const result = await processor.processAdfXml(validAdfXml, 'no-adf@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('ADF processing disabled');
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ADF processing disabled'), expect.any(Object));
    });
    
    it('should handle unexpected errors during processing', async () => {
      // Mock unexpected error
      processor.parseAdfXml = vi.fn().mockRejectedValue(new Error('Unexpected error'));
      
      const result = await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Unexpected error'), expect.any(Object));
    });
  });
  
  describe('Metrics Tracking', () => {
    it('should track successful lead processing in metrics', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(prometheusMetrics.incrementLeadsProcessed).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 1,
        source_provider: expect.any(String),
        lead_type: expect.any(String),
        status: 'success'
      }));
    });
    
    it('should track failed lead processing in metrics', async () => {
      // Mock database to throw an error
      processor.db.transaction = vi.fn().mockRejectedValue(new Error('Database error'));
      
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(prometheusMetrics.incrementLeadsProcessed).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 1,
        source_provider: expect.any(String),
        lead_type: expect.any(String),
        status: 'error'
      }));
    });
    
    it('should track duplicate leads in metrics', async () => {
      // Mock database to return an existing lead
      processor.db.select = vi.fn().mockReturnThis();
      processor.db.from = vi.fn().mockReturnThis();
      processor.db.where = vi.fn().mockReturnThis();
      processor.db.limit = vi.fn().mockResolvedValue([
        { id: 1, externalId: 'test-123', dealershipId: 1, createdAt: new Date() }
      ]);
      
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(prometheusMetrics.incrementLeadsProcessed).toHaveBeenCalledWith(expect.objectContaining({
        dealership_id: 1,
        source_provider: expect.any(String),
        lead_type: expect.any(String),
        status: 'duplicate'
      }));
    });
  });
  
  describe('Event Emission', () => {
    it('should emit adf.lead.received event at start of processing', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(eventBus.emit).toHaveBeenCalledWith('adf.lead.received', expect.objectContaining({
        dealershipId: 1,
        externalId: 'test-123'
      }));
    });
    
    it('should emit adf.lead.processed event on successful processing', async () => {
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(eventBus.emit).toHaveBeenCalledWith('adf.lead.processed', expect.objectContaining({
        leadId: 1,
        dealershipId: 1,
        externalId: 'test-123'
      }));
    });
    
    it('should emit adf.lead.error event on processing failure', async () => {
      // Mock database to throw an error
      processor.db.transaction = vi.fn().mockRejectedValue(new Error('Database error'));
      
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(eventBus.emit).toHaveBeenCalledWith('adf.lead.error', expect.objectContaining({
        dealershipId: 1,
        externalId: 'test-123',
        error: expect.stringContaining('Database error')
      }));
    });
    
    it('should emit adf.lead.duplicate event for duplicate leads', async () => {
      // Mock database to return an existing lead
      processor.db.select = vi.fn().mockReturnThis();
      processor.db.from = vi.fn().mockReturnThis();
      processor.db.where = vi.fn().mockReturnThis();
      processor.db.limit = vi.fn().mockResolvedValue([
        { id: 1, externalId: 'test-123', dealershipId: 1, createdAt: new Date() }
      ]);
      
      await processor.processAdfXml(validAdfXml, 'test@example.com');
      
      expect(eventBus.emit).toHaveBeenCalledWith('adf.lead.duplicate', expect.objectContaining({
        dealershipId: 1,
        externalId: 'test-123',
        existingLeadId: 1
      }));
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle empty XML input', async () => {
      const result = await processor.processAdfXml('', 'test@example.com');
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty XML');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Empty XML'), expect.any(Object));
    });
    
    it('should handle XML with valid structure but missing values', async () => {
      const emptyValuesXml = `<?xml version="1.0" encoding="UTF-8"?>
      <adf>
        <prospect status="new">
          <id source="dealersite">test-empty</id>
          <requestdate></requestdate>
          <vehicle interest="buy" status="new">
            <year></year>
            <make></make>
            <model></model>
          </vehicle>
          <customer>
            <contact primarycontact="1">
              <name part="first"></name>
              <name part="last"></name>
              <email></email>
            </contact>
          </customer>
          <vendor>
            <vendorname></vendorname>
          </vendor>
        </prospect>
      </adf>`;
      
      const result = await processor.processAdfXml(emptyValuesXml, 'test@example.com');
      
      // Should still process but with default/empty values
      expect(result.success).toBe(true);
      
      // Check that empty values were handled gracefully
      const insertValues = vi.mocked(processor.db.insert().values);
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
        customerName: ' ', // First + Last with space between
        customerEmail: '',
        vehicleMake: '',
        vehicleModel: ''
      }));
    });
    
    it('should handle extremely large XML input', async () => {
      // Generate a large XML with repeated customer comments
      let largeXml = validAdfXml.replace(
        '<comments>I\'m interested in the Honda Accord</comments>',
        `<comments>${'A'.repeat(50000)}</comments>`
      );
      
      const result = await processor.processAdfXml(largeXml, 'test@example.com');
      
      // Should truncate and still process
      expect(result.success).toBe(true);
      
      // Check that values were truncated
      const insertValues = vi.mocked(processor.db.insert().values);
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
        customerComments: expect.stringMatching(/^A{1,5000}/) // Should be truncated
      }));
    });
    
    it('should handle non-ADF XML format', async () => {
      const nonAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
      <not-adf>
        <something>This is not an ADF format</something>
      </not-adf>`;
      
      const result = await processor.processAdfXml(nonAdfXml, 'test@example.com');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid ADF format');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid ADF format'), expect.any(Object));
    });
    
    it('should handle XML with invalid UTF-8 characters', async () => {
      // XML with invalid UTF-8 sequence
      const invalidUtf8Xml = validAdfXml.replace(
        'John',
        'John\uD800' // Unpaired surrogate
      );
      
      const result = await processor.processAdfXml(invalidUtf8Xml, 'test@example.com');
      
      // Should sanitize and still process
      expect(result.success).toBe(true);
      
      // Check that values were sanitized
      const insertValues = vi.mocked(processor.db.insert().values);
      expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
        customerName: expect.not.stringContaining('\uD800') // Should be sanitized
      }));
    });
  });
});
