#!/usr/bin/env tsx

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Quick Performance Test Runner
 *
 * This script runs a basic performance test to verify the setup is working
 * and provides a quick assessment of application performance.
 */

interface QuickTestResult {
  testName: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
}

class QuickPerformanceTest {
  private results: QuickTestResult[] = [];

  async runQuickTests(): Promise<void> {
    console.log('🚀 Running Quick Performance Tests');
    console.log('==================================\n');

    // Test 1: Verify application is running
    await this.testApplicationHealth();

    // Test 2: Basic API load test (light)
    await this.testBasicAPILoad();

    // Test 3: Database connectivity
    await this.testDatabaseConnectivity();

    // Generate summary
    this.generateSummary();
  }

  private async testApplicationHealth(): Promise<void> {
    console.log('🔍 Testing Application Health...');

    const result: QuickTestResult = {
      testName: 'Application Health Check',
      success: false,
      duration: 0
    };

    const startTime = Date.now();

    try {
      const response = await fetch('http://localhost:5000/api/metrics/health');
      result.duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        result.success = true;
        result.output = `Status: ${data.status}, Response time: ${result.duration}ms`;
        console.log(`✅ Application is healthy (${result.duration}ms)`);
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`❌ Application health check failed: ${result.error}`);
      }
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);
      console.log(`❌ Cannot connect to application: ${result.error}`);
    }

    this.results.push(result);
  }

  private async testBasicAPILoad(): Promise<void> {
    console.log('\n⚡ Running Basic API Load Test...');

    const result: QuickTestResult = {
      testName: 'Basic API Load Test',
      success: false,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Run a simple k6 test with minimal load
      const k6Script = this.generateSimpleK6Script();
      const scriptPath = path.join(__dirname, 'temp-quick-test.js');

      fs.writeFileSync(scriptPath, k6Script);

      const success = await this.executeCommand(`k6 run ${scriptPath}`);
      result.duration = Date.now() - startTime;
      result.success = success;

      // Cleanup
      fs.unlinkSync(scriptPath);

      if (success) {
        console.log(`✅ Basic load test passed (${result.duration}ms)`);
      } else {
        console.log(`❌ Basic load test failed`);
      }

    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);
      console.log(`❌ Load test error: ${result.error}`);
    }

    this.results.push(result);
  }

  private async testDatabaseConnectivity(): Promise<void> {
    console.log('\n🗄️ Testing Database Connectivity...');

    const result: QuickTestResult = {
      testName: 'Database Connectivity',
      success: false,
      duration: 0
    };

    const startTime = Date.now();

    try {
      // Test database through the API
      const response = await fetch('http://localhost:5000/api/metrics/database/performance');
      result.duration = Date.now() - startTime;

      if (response.ok) {
        result.success = true;
        console.log(`✅ Database connectivity verified (${result.duration}ms)`);
      } else {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
        console.log(`❌ Database connectivity test failed: ${result.error}`);
      }
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);
      console.log(`❌ Database test error: ${result.error}`);
    }

    this.results.push(result);
  }

  private generateSimpleK6Script(): string {
    return `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5, // 5 virtual users
  duration: '30s', // 30 seconds
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const baseUrl = 'http://localhost:5000';

  // Test health endpoint
  const healthResponse = http.get(\`\${baseUrl}/api/metrics/health\`);
  check(healthResponse, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test vehicle endpoint
  const vehicleResponse = http.get(\`\${baseUrl}/api/vehicles?limit=5\`);
  check(vehicleResponse, {
    'vehicle endpoint responds': (r) => r.status === 200 || r.status === 401,
    'vehicle response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
`;
  }

  private executeCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let error = '';

      process.stdout?.on('data', (data) => {
        output += data.toString();
      });

      process.stderr?.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          console.log('Command output:', output);
          console.log('Command error:', error);
          resolve(false);
        }
      });

      process.on('error', () => {
        resolve(false);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        process.kill('SIGTERM');
        resolve(false);
      }, 60000);
    });
  }

  private generateSummary(): void {
    console.log('\n📊 QUICK TEST SUMMARY');
    console.log('====================');

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    console.log('\nTest Results:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      console.log(`${index + 1}. ${status} ${result.testName} (${duration})`);

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.output) {
        console.log(`   ${result.output}`);
      }
    });

    console.log('\n💡 NEXT STEPS:');

    if (passedTests === totalTests) {
      console.log('✅ All quick tests passed! You can now run the full performance test suite:');
      console.log('   npm run test:setup-data');
      console.log('   npm run test:performance:full');
    } else {
      console.log('❌ Some tests failed. Please address the issues before running full tests:');

      if (!this.results[0].success) {
        console.log('   1. Ensure the application is running: npm run dev');
      }
      if (!this.results[1].success) {
        console.log('   2. Verify k6 is installed: brew install k6');
      }
      if (!this.results[2].success) {
        console.log('   3. Check database connection and ensure PostgreSQL is running');
      }
    }

    console.log('\n📚 For more information, see: test/performance/README.md');
  }
}

// Main execution
const quickTest = new QuickPerformanceTest();
quickTest.runQuickTests().catch(console.error);

export default QuickPerformanceTest;
