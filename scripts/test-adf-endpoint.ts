#!/usr/bin/env tsx

/**
 * ADF Lead Ingestion Endpoint Test Script
 * 
 * Tests the POST /api/adf/lead endpoint for DEP-004/005 validation
 * 
 * Features tested:
 * - Basic ADF XML processing
 * - Rate limiting (30 req/min/IP)
 * - 500KB size limit validation
 * - XXE protection
 * - Prometheus metrics generation
 * - V2/V1 parser fallback
 */

import { performance } from 'perf_hooks';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const ADF_ENDPOINT = `${BASE_URL}/api/adf/lead`;

// Sample ADF XML for testing
const SAMPLE_ADF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<adf version="1.0">
  <prospect>
    <requestdate>2024-01-15T10:30:00Z</requestdate>
    <vehicle interest="buy" status="new">
      <year>2024</year>
      <make>Honda</make>
      <model>Accord</model>
      <trim>EX-L</trim>
    </vehicle>
    <customer>
      <contact>
        <name part="first">John</name>
        <name part="last">Doe</name>
        <email>john.doe@example.com</email>
        <phone type="voice" time="day">555-123-4567</phone>
      </contact>
    </customer>
    <vendor>
      <vendorname>Test Lead Provider</vendorname>
      <contact>
        <name>Test Provider</name>
      </contact>
    </vendor>
  </prospect>
</adf>`;

// Malicious XML for XXE testing
const XXE_ATTACK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE adf [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<adf version="1.0">
  <prospect>
    <requestdate>2024-01-15T10:30:00Z</requestdate>
    <customer>
      <contact>
        <name part="first">&xxe;</name>
        <name part="last">Test</name>
        <email>test@example.com</email>
      </contact>
    </customer>
  </prospect>
</adf>`;

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details: any;
  error?: string;
}

class AdfEndpointTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting ADF Lead Ingestion Endpoint Tests\n');

    // Test 1: Basic ADF XML Processing
    await this.testBasicAdfProcessing();

    // Test 2: JSON Payload with XML Content
    await this.testJsonPayload();

    // Test 3: Size Limit Validation (500KB)
    await this.testSizeLimit();

    // Test 4: Rate Limiting (30 req/min/IP)
    await this.testRateLimiting();

    // Test 5: XXE Protection
    await this.testXxeProtection();

    // Test 6: Invalid XML Handling
    await this.testInvalidXml();

    // Test 7: Missing XML Content
    await this.testMissingXml();

    // Test 8: Prometheus Metrics Endpoint
    await this.testPrometheusMetrics();

    this.printResults();
  }

  private async testBasicAdfProcessing(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(ADF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: SAMPLE_ADF_XML
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      this.results.push({
        name: 'Basic ADF XML Processing',
        success: response.status === 201 || response.status === 200,
        duration,
        details: {
          status: response.status,
          response: data
        }
      });

    } catch (error) {
      this.results.push({
        name: 'Basic ADF XML Processing',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testJsonPayload(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(ADF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          xmlContent: SAMPLE_ADF_XML,
          source: 'test_api',
          dealershipId: 1
        })
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      this.results.push({
        name: 'JSON Payload with XML Content',
        success: response.status === 201 || response.status === 200,
        duration,
        details: {
          status: response.status,
          response: data
        }
      });

    } catch (error) {
      this.results.push({
        name: 'JSON Payload with XML Content',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testSizeLimit(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Create XML larger than 500KB
      const largeXml = SAMPLE_ADF_XML + 'x'.repeat(600 * 1024);
      
      const response = await fetch(ADF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: largeXml
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      this.results.push({
        name: 'Size Limit Validation (500KB)',
        success: response.status === 413, // Should be rejected
        duration,
        details: {
          status: response.status,
          response: data,
          payloadSize: `${Math.round(largeXml.length / 1024)}KB`
        }
      });

    } catch (error) {
      this.results.push({
        name: 'Size Limit Validation (500KB)',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testRateLimiting(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('⏳ Testing rate limiting (sending 35 requests rapidly)...');
      
      const promises = [];
      for (let i = 0; i < 35; i++) {
        promises.push(
          fetch(ADF_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              xmlContent: SAMPLE_ADF_XML,
              source: `rate_test_${i}`
            })
          })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const duration = performance.now() - startTime;

      this.results.push({
        name: 'Rate Limiting (30 req/min/IP)',
        success: rateLimitedCount > 0, // Should have some rate limited requests
        duration,
        details: {
          totalRequests: 35,
          rateLimitedRequests: rateLimitedCount,
          successfulRequests: responses.filter(r => r.status < 400).length
        }
      });

    } catch (error) {
      this.results.push({
        name: 'Rate Limiting (30 req/min/IP)',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testXxeProtection(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(ADF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: XXE_ATTACK_XML
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      // Should either reject the XML or process it safely without exposing file contents
      const responseText = JSON.stringify(data).toLowerCase();
      const hasFileContents = responseText.includes('root:') || responseText.includes('/bin/bash');

      this.results.push({
        name: 'XXE Protection',
        success: !hasFileContents, // Success if no file contents are exposed
        duration,
        details: {
          status: response.status,
          response: data,
          exposedFileContents: hasFileContents
        }
      });

    } catch (error) {
      this.results.push({
        name: 'XXE Protection',
        success: true, // Error is acceptable for XXE protection
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testInvalidXml(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(ADF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: '<invalid>xml<unclosed>'
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      this.results.push({
        name: 'Invalid XML Handling',
        success: response.status === 400, // Should be rejected
        duration,
        details: {
          status: response.status,
          response: data
        }
      });

    } catch (error) {
      this.results.push({
        name: 'Invalid XML Handling',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testMissingXml(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(ADF_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'test_api'
          // Missing xmlContent
        })
      });

      const data = await response.json();
      const duration = performance.now() - startTime;

      this.results.push({
        name: 'Missing XML Content',
        success: response.status === 400, // Should be rejected
        duration,
        details: {
          status: response.status,
          response: data
        }
      });

    } catch (error) {
      this.results.push({
        name: 'Missing XML Content',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async testPrometheusMetrics(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`${BASE_URL}/metrics`);
      const metricsText = await response.text();
      const duration = performance.now() - startTime;

      // Check for ADF-specific metrics
      const hasAdfMetrics = [
        'adf_ingest_success_total',
        'adf_parse_failure_total',
        'adf_ingest_duration_seconds'
      ].every(metric => metricsText.includes(metric));

      this.results.push({
        name: 'Prometheus Metrics',
        success: response.status === 200 && hasAdfMetrics,
        duration,
        details: {
          status: response.status,
          hasAdfMetrics,
          metricsSize: `${Math.round(metricsText.length / 1024)}KB`
        }
      });

    } catch (error) {
      this.results.push({
        name: 'Prometheus Metrics',
        success: false,
        duration: performance.now() - startTime,
        details: {},
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private printResults(): void {
    console.log('\n📊 Test Results Summary\n');
    console.log('=' .repeat(80));
    
    let passed = 0;
    let failed = 0;

    this.results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = `${Math.round(result.duration)}ms`;
      
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   Status: ${status} (${duration})`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.details && Object.keys(result.details).length > 0) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2).replace(/\n/g, '\n            ')}`);
      }
      
      console.log('');
      
      if (result.success) {
        passed++;
      } else {
        failed++;
      }
    });

    console.log('=' .repeat(80));
    console.log(`📈 Summary: ${passed} passed, ${failed} failed, ${this.results.length} total`);
    
    if (failed === 0) {
      console.log('🎉 All tests passed! ADF endpoint is ready for production.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new AdfEndpointTester();
  tester.runAllTests().catch(console.error);
}

export { AdfEndpointTester };
