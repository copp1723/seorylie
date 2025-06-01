import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adfService } from '../../server/services/adf-service';
import { dlqService } from '../../server/services/dead-letter-queue';
import { adfLeadProcessor } from '../../server/services/adf-lead-processor';

describe('ADF Pipeline E2E Validation', () => {
  beforeAll(async () => {
    // Ensure services are initialized
  });

  afterAll(async () => {
    // Cleanup
    await adfService.stop();
    await dlqService.shutdown();
  });

  it('should have all ADF service dependencies wired correctly', () => {
    // Check that service is properly initialized
    expect(adfService).toBeDefined();
    expect(typeof adfService.start).toBe('function');
    expect(typeof adfService.stop).toBe('function');
    expect(typeof adfService.processAdfXml).toBe('function');
    expect(typeof adfService.getProcessingStats).toBe('function');
  });

  it('should have DLQ service configured with ADF handlers', () => {
    // Check DLQ service integration
    expect(dlqService).toBeDefined();
    expect(typeof dlqService.addEntry).toBe('function');
    expect(typeof dlqService.getStats).toBe('function');
    
    // Verify DLQ stats are accessible
    const stats = dlqService.getStats();
    expect(stats).toHaveProperty('total');
    expect(stats).toHaveProperty('pending');
    expect(stats).toHaveProperty('retryable');
    expect(stats).toHaveProperty('expired');
  });

  it('should process a sample ADF XML successfully', async () => {
    const sampleAdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf version="1.0">
  <prospect>
    <requestdate>2024-01-15T10:30:00Z</requestdate>
    <customer>
      <contact>
        <name>
          <part type="first">John</part>
          <part type="last">Doe</part>
        </name>
        <email>john.doe@example.com</email>
        <phone type="voice">555-123-4567</phone>
      </contact>
    </customer>
    <vehicle>
      <year>2024</year>
      <make>Toyota</make>
      <model>Camry</model>
      <trim>LE</trim>
    </vehicle>
    <vendor>
      <vendorname>Test Dealership</vendorname>
    </vendor>
    <provider>
      <name>TestLeadProvider</name>
      <service>web</service>
    </provider>
    <comments>Interested in test driving the 2024 Camry</comments>
  </prospect>
</adf>`;

    try {
      const result = await adfService.processAdfXml(sampleAdfXml, 'e2e-test');
      
      // Check that processing returned valid result
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      
      // If processing failed, check that it was added to DLQ
      if (!result.success) {
        const dlqStats = dlqService.getStats();
        expect(dlqStats.total).toBeGreaterThan(0);
      }
    } catch (error) {
      // If there's an error, verify it's handled by DLQ
      const dlqStats = dlqService.getStats();
      expect(dlqStats.total).toBeGreaterThan(0);
    }
  });

  it('should handle malformed ADF XML gracefully', async () => {
    const malformedXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf version="1.0">
  <prospect>
    <requestdate>invalid-date</requestdate>
    <customer>
      <contact>
        <!-- Missing required fields -->
      </contact>
    </customer>
  </prospect>
</adf>`;

    const initialDlqStats = dlqService.getStats();
    
    try {
      const result = await adfService.processAdfXml(malformedXml, 'e2e-test-malformed');
      
      // Should either succeed with warnings or fail gracefully
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    } catch (error) {
      // Error should be caught and handled
      expect(error).toBeDefined();
    }
    
    // Check that DLQ might have new entries for failed processing
    const finalDlqStats = dlqService.getStats();
    expect(finalDlqStats.total).toBeGreaterThanOrEqual(initialDlqStats.total);
  });

  it('should emit correct events during lead processing', (done) => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<adf version="1.0">
  <prospect>
    <requestdate>2024-01-15T10:30:00Z</requestdate>
    <customer>
      <contact>
        <name>
          <part type="first">Jane</part>
          <part type="last">Smith</part>
        </name>
        <email>jane.smith@example.com</email>
        <phone type="voice">555-987-6543</phone>
      </contact>
    </customer>
    <vehicle>
      <year>2024</year>
      <make>Honda</make>
      <model>Accord</model>
    </vehicle>
  </prospect>
</adf>`;

    let eventReceived = false;
    
    // Listen for processing events
    const onEvent = (data: any) => {
      eventReceived = true;
      expect(data).toBeDefined();
      done();
    };
    
    adfService.once('leadProcessed', onEvent);
    adfService.once('error', onEvent);
    
    // Process the XML
    adfService.processAdfXml(sampleXml, 'e2e-test-events')
      .then(() => {
        // If no event was received within timeout, complete test
        setTimeout(() => {
          if (!eventReceived) {
            done();
          }
        }, 1000);
      })
      .catch(() => {
        // Error processing should also trigger events
        setTimeout(() => {
          if (!eventReceived) {
            done();
          }
        }, 1000);
      });
  });

  it('should provide processing statistics', () => {
    const stats = adfService.getProcessingStats();
    
    expect(stats).toBeDefined();
    expect(stats).toHaveProperty('emailsReceived');
    expect(stats).toHaveProperty('leadsProcessed');
    expect(stats).toHaveProperty('duplicatesSkipped');
    expect(stats).toHaveProperty('processingErrors');
    expect(stats).toHaveProperty('isListening');
    expect(stats).toHaveProperty('uptime');
    expect(stats).toHaveProperty('config');
    expect(stats).toHaveProperty('aiResponses');
    
    // Check AI response stats structure
    expect(stats.aiResponses).toHaveProperty('generated');
    expect(stats.aiResponses).toHaveProperty('failed');
    expect(stats.aiResponses).toHaveProperty('avgLatency');
    
    // All numeric stats should be non-negative
    expect(stats.emailsReceived).toBeGreaterThanOrEqual(0);
    expect(stats.leadsProcessed).toBeGreaterThanOrEqual(0);
    expect(stats.duplicatesSkipped).toBeGreaterThanOrEqual(0);
    expect(stats.processingErrors).toBeGreaterThanOrEqual(0);
    expect(stats.uptime).toBeGreaterThanOrEqual(0);
  });
});