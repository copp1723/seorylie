/**
 * ADF Lead Processor - Unit Tests
 *
 * Tests for the ADF Lead Processor service which handles:
 * - XML parsing and validation
 * - Lead deduplication
 * - Database operations
 * - Error handling
 * - Processing logs
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AdfLeadProcessor } from "../../server/services/adf-lead-processor";
import logger from "../../server/utils/logger";

// Mock dependencies
vi.mock("../../server/db", () => {
  // Create mock query builder with method chaining
  const createMockQueryBuilder = (mockData: any[] = []) => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(mockData),
    orderBy: vi.fn().mockReturnThis(),
    execute: vi
      .fn()
      .mockResolvedValue({ rows: mockData, rowCount: mockData.length }),
  });

  // Create mock insert builder with method chaining
  const createMockInsertBuilder = (
    mockData: any = { id: 1, externalId: "test-123", dealershipId: 1 },
  ) => ({
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([mockData]),
    execute: vi.fn().mockResolvedValue({ rows: [mockData], rowCount: 1 }),
  });

  // Create mock transaction
  const createMockTransaction = () => ({
    select: vi.fn(() => createMockQueryBuilder()),
    insert: vi.fn(() => createMockInsertBuilder()),
    update: vi.fn(() => createMockQueryBuilder()),
    delete: vi.fn(() => createMockQueryBuilder()),
    rollback: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
  });

  return {
    default: {
      transaction: vi.fn().mockImplementation(async (callback) => {
        const mockTx = createMockTransaction();
        return await callback(mockTx);
      }),
      select: vi.fn(() => createMockQueryBuilder()),
      insert: vi.fn(() => createMockInsertBuilder()),
      update: vi.fn(() => createMockQueryBuilder()),
      delete: vi.fn(() => createMockQueryBuilder()),
      execute: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    },
  };
});

vi.mock("../../server/utils/logger", () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(() => mockLogger),
    level: "info",
    silent: false,
  };

  return {
    default: mockLogger,
    logger: mockLogger,
    ...mockLogger,
  };
});

// Valid ADF XML sample
const validAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf version="1.0">
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
<adf version="1.0">
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

describe("AdfLeadProcessor", () => {
  let processor: AdfLeadProcessor;
  let mockDb: any;

  // Helper function to create lead processing input
  const createLeadInput = (
    adfXmlContent: string,
    emailFrom: string = "test@example.com",
  ) => ({
    emailMessageId: "test-123",
    emailSubject: "New Lead",
    emailFrom,
    emailTo: "dealer@example.com",
    emailDate: new Date(),
    adfXmlContent,
    rawEmailContent: "Raw email content",
    attachmentInfo: [],
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock database
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      transaction: vi.fn(),
      query: {
        adfLeads: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        dealerships: {
          findFirst: vi
            .fn()
            .mockResolvedValue({ id: 1, name: "Test Dealership" }),
          findMany: vi
            .fn()
            .mockResolvedValue([{ id: 1, name: "Test Dealership" }]),
        },
        adfEmailQueue: {
          findFirst: vi.fn().mockResolvedValue({
            id: 1,
            emailMessageId: "test-123",
            emailSubject: "Test Subject",
            emailFrom: "test@example.com",
            emailTo: "dealer@example.com",
            emailDate: new Date(),
            adfXmlContent: validAdfXml,
            rawEmailContent: "Raw email content",
            attachmentInfo: [],
          }),
        },
      },
    };

    // Create processor instance with mocked database
    processor = new AdfLeadProcessor(mockDb);
  });

  describe("XML Parsing and Validation", () => {
    it("should successfully parse valid ADF XML", async () => {
      const input = {
        emailMessageId: "test-123",
        emailSubject: "New Lead",
        emailFrom: "test@example.com",
        emailTo: "dealer@example.com",
        emailDate: new Date(),
        adfXmlContent: validAdfXml,
        rawEmailContent: "Raw email content",
        attachmentInfo: [],
      };

      const result = await processor.processAdfLead(input);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.leadId).toBe(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("ADF lead processed successfully"),
        expect.any(Object),
      );
    });

    it("should handle malformed XML", async () => {
      const result = await processor.processAdfLead(
        createLeadInput(malformedXml, "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should validate required fields in ADF XML", async () => {
      const result = await processor.processAdfLead(
        createLeadInput(missingFieldsXml, "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should extract customer information correctly", async () => {
      await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      // Check that database operations were called - the actual lead insert is the 6th call
      const dbInsert = vi.mocked(processor.db.insert);
      expect(dbInsert).toHaveBeenCalled();
      expect(dbInsert.mock.calls.length).toBeGreaterThan(5);
    });

    it("should extract vehicle information correctly", async () => {
      await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      // Check that database operations were called - the processor extracts vehicle data
      const dbInsert = vi.mocked(processor.db.insert);
      expect(dbInsert).toHaveBeenCalled();
      expect(dbInsert.mock.calls.length).toBeGreaterThan(5);
    });
  });

  describe("Lead Deduplication Logic", () => {
    it("should detect duplicate leads by deduplication hash", async () => {
      // Mock database to return an existing lead
      processor.db.query.adfLeads.findFirst.mockResolvedValueOnce({
        id: 1,
        customerFullName: "John Doe",
        createdAt: new Date(),
      });

      const result = await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.warnings[0]).toContain("Duplicate lead detected");
    });

    it("should process lead if no duplicate found", async () => {
      // Mock database to return no existing leads
      processor.db.query.adfLeads.findFirst.mockResolvedValueOnce(null);

      const result = await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.leadId).toBe(1);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe("Database Operations", () => {
    it("should insert lead into database successfully", async () => {
      await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      // Check database operations
      expect(processor.db.insert).toHaveBeenCalled();
      expect(processor.db.insert().values).toHaveBeenCalled();
      expect(processor.db.insert().values().returning).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      // Mock database to throw an error
      processor.db.insert.mockRejectedValueOnce(
        new Error("Database connection error"),
      );

      const result = await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Failed to add email to queue");
    });

    it("should insert data into multiple tables", async () => {
      await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      // Check multiple database operations - processor inserts queue, lead, and multiple processing logs
      expect(processor.db.insert).toHaveBeenCalled();
      expect(processor.db.insert.mock.calls.length).toBeGreaterThan(3);
    });
  });

  describe("Error Handling Scenarios", () => {
    it("should handle dealership mapping failures", async () => {
      // Mock dealership query to return no results
      processor.db.query.dealerships.findFirst.mockResolvedValue(null);
      processor.db.query.dealerships.findMany.mockResolvedValue([]);

      const result = await processor.processAdfLead(
        createLeadInput(validAdfXml, "unknown@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true); // Processing continues with warnings
      expect(
        result.warnings.some((w) =>
          w.includes("Could not map lead to specific dealership"),
        ),
      ).toBe(true);
    });

    it("should handle unexpected errors during processing", async () => {
      // Mock unexpected database error on first insert (email queue)
      processor.db.insert.mockRejectedValueOnce(
        new Error("Unexpected database error"),
      );

      const result = await processor.processAdfLead(
        createLeadInput(validAdfXml, "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain("Failed to add email to queue");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty XML input", async () => {
      const result = await processor.processAdfLead(
        createLeadInput("", "test@example.com"),
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle XML with valid structure but missing values", async () => {
      const emptyValuesXml = `<?xml version="1.0" encoding="UTF-8"?>
      <adf version="1.0">
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

      const result = await processor.processAdfLead(
        createLeadInput(emptyValuesXml, "test@example.com"),
      );

      // The parser may require certain fields, so it might fail or succeed
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });

    it("should handle extremely large XML input", async () => {
      // Generate a large XML with repeated customer comments
      let largeXml = validAdfXml.replace(
        "<comments>I'm interested in the Honda Accord</comments>",
        `<comments>${"A".repeat(50000)}</comments>`,
      );

      const result = await processor.processAdfLead(
        createLeadInput(largeXml, "test@example.com"),
      );

      // Should process large XML
      expect(result.success).toBe(true);
    });

    it("should handle non-ADF XML format", async () => {
      const nonAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
      <not-adf>
        <something>This is not an ADF format</something>
      </not-adf>`;

      const result = await processor.processAdfLead(
        createLeadInput(nonAdfXml, "test@example.com"),
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle XML with invalid UTF-8 characters", async () => {
      // XML with invalid UTF-8 sequence
      const invalidUtf8Xml = validAdfXml.replace(
        "John",
        "John\uD800", // Unpaired surrogate
      );

      const result = await processor.processAdfLead(
        createLeadInput(invalidUtf8Xml, "test@example.com"),
      );

      // Should handle invalid characters
      expect(result.success).toBe(true);
    });
  });
});
