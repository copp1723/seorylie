#!/usr/bin/env tsx

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import DatabasePerformanceMonitor from './db-performance-monitor';
import logger from '../../server/utils/logger';

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  metrics?: any;
  errors?: string[];
}

interface PerformanceTestSuite {
  startTime: Date;
  endTime?: Date;
  results: TestResult[];
  dbMetrics?: any;
  systemMetrics: SystemMetrics[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    bottlenecks: string[];
  };
}

interface SystemMetrics {
  timestamp: Date;
  cpu: number;
  memory: NodeJS.MemoryUsage;
  loadAverage: number[];
}

class PerformanceTestRunner {
  private dbMonitor: DatabasePerformanceMonitor;
  private testSuite: PerformanceTestSuite;
  private systemMetricsInterval?: NodeJS.Timeout;

  constructor() {
    this.dbMonitor = new DatabasePerformanceMonitor();
    this.testSuite = {
      startTime: new Date(),
      results: [],
      systemMetrics: [],
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        totalDuration: 0,
        bottlenecks: []
      }
    };
  }

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Performance & Load Testing Suite');
    console.log('=========================================================\n');

    // Start monitoring
    this.startSystemMonitoring();
    this.dbMonitor.startMonitoring();

    try {
      // Run tests in sequence to avoid resource conflicts
      await this.runTest('API Load Test', 'npm run test:load:api');
      await this.runTest('Chat/WebSocket Load Test', 'npm run test:load:chat');
      await this.runTest('Inventory Load Test', 'npm run test:load:inventory');
      await this.runTest('Full Load Test Suite', 'npm run test:load');

      // Run database-specific performance tests
      await this.runDatabasePerformanceTests();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      // Stop monitoring and generate reports
      this.stopSystemMonitoring();
      const dbMetrics = this.dbMonitor.stopMonitoring();
      this.testSuite.dbMetrics = dbMetrics;
      this.testSuite.endTime = new Date();

      await this.generateFinalReport();
    }
  }

  private async runTest(testName: string, command: string): Promise<TestResult> {
    console.log(`\n🧪 Running: ${testName}`);
    console.log(`Command: ${command}`);
    console.log('─'.repeat(50));

    const startTime = Date.now();
    const result: TestResult = {
      testName,
      success: false,
      duration: 0,
      errors: []
    };

    try {
      const success = await this.executeCommand(command);
      result.success = success;
      result.duration = Date.now() - startTime;

      if (success) {
        console.log(`✅ ${testName} completed successfully`);
        this.testSuite.summary.passedTests++;
      } else {
        console.log(`❌ ${testName} failed`);
        this.testSuite.summary.failedTests++;
      }

    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.errors = [error instanceof Error ? error.message : String(error)];

      console.log(`❌ ${testName} failed with error:`, error);
      this.testSuite.summary.failedTests++;
    }

    this.testSuite.results.push(result);
    this.testSuite.summary.totalTests++;
    this.testSuite.summary.totalDuration += result.duration;

    return result;
  }

  private executeCommand(command: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ');
      const process = spawn(cmd, args, {
        stdio: 'inherit',
        shell: true
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Set timeout for long-running tests
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Test timeout after 10 minutes'));
      }, 10 * 60 * 1000); // 10 minutes
    });
  }

  private async runDatabasePerformanceTests(): Promise<void> {
    console.log('\n🗄️ Running Database Performance Tests');
    console.log('─'.repeat(50));

    const testQueries = [
      {
        name: 'Complex Inventory Search',
        query: async () => {
          // Simulate complex inventory search
          return this.dbMonitor.executeQuery(
            async () => {
              // This would be replaced with actual database queries
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
              return [];
            },
            'SELECT * FROM vehicles WHERE make = ? AND year > ? AND price BETWEEN ? AND ?'
          );
        }
      },
      {
        name: 'Multi-tenant Conversation Query',
        query: async () => {
          return this.dbMonitor.executeQuery(
            async () => {
              await new Promise(resolve => setTimeout(resolve, Math.random() * 150));
              return [];
            },
            'SELECT c.*, m.* FROM conversations c JOIN messages m ON c.id = m.conversation_id WHERE c.dealership_id = ?'
          );
        }
      },
      {
        name: 'Bulk Vehicle Insert',
        query: async () => {
          return this.dbMonitor.executeQuery(
            async () => {
              await new Promise(resolve => setTimeout(resolve, Math.random() * 300));
              return { insertedCount: 50 };
            },
            'INSERT INTO vehicles (make, model, year, vin, price, dealership_id) VALUES ...'
          );
        }
      }
    ];

    for (const test of testQueries) {
      try {
        console.log(`Running: ${test.name}`);
        await test.query();
        console.log(`✅ ${test.name} completed`);
      } catch (error) {
        console.log(`❌ ${test.name} failed:`, error);
      }
    }
  }

  private startSystemMonitoring(): void {
    this.systemMetricsInterval = setInterval(() => {
      const metrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: process.cpuUsage().user / 1000000, // Convert to seconds
        memory: process.memoryUsage(),
        loadAverage: require('os').loadavg()
      };

      this.testSuite.systemMetrics.push(metrics);
    }, 5000); // Every 5 seconds
  }

  private stopSystemMonitoring(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
  }

  private async generateFinalReport(): Promise<void> {
    console.log('\n📊 Generating Performance Test Report');
    console.log('=====================================');

    // Analyze results for bottlenecks
    this.analyzeBottlenecks();

    // Print summary
    this.printSummary();

    // Save detailed report
    await this.saveDetailedReport();

    // Generate recommendations
    this.generateRecommendations();
  }

  private analyzeBottlenecks(): void {
    const bottlenecks: string[] = [];

    // Check for failed tests
    const failedTests = this.testSuite.results.filter(r => !r.success);
    if (failedTests.length > 0) {
      bottlenecks.push(`${failedTests.length} tests failed`);
    }

    // Check for slow tests
    const slowTests = this.testSuite.results.filter(r => r.duration > 300000); // > 5 minutes
    if (slowTests.length > 0) {
      bottlenecks.push(`${slowTests.length} tests took longer than 5 minutes`);
    }

    // Check memory usage
    const maxMemory = Math.max(...this.testSuite.systemMetrics.map(m => m.memory.heapUsed));
    if (maxMemory > 1024 * 1024 * 1024) { // > 1GB
      bottlenecks.push('High memory usage detected (>1GB)');
    }

    this.testSuite.summary.bottlenecks = bottlenecks;
  }

  private printSummary(): void {
    const { summary } = this.testSuite;
    const duration = this.testSuite.endTime
      ? (this.testSuite.endTime.getTime() - this.testSuite.startTime.getTime()) / 1000
      : 0;

    console.log(`\n📈 PERFORMANCE TEST SUMMARY`);
    console.log(`Total Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Tests: ${summary.totalTests}`);
    console.log(`Passed: ${summary.passedTests}`);
    console.log(`Failed: ${summary.failedTests}`);
    console.log(`Success Rate: ${((summary.passedTests / summary.totalTests) * 100).toFixed(1)}%`);

    if (summary.bottlenecks.length > 0) {
      console.log(`\n⚠️ BOTTLENECKS IDENTIFIED:`);
      summary.bottlenecks.forEach((bottleneck, index) => {
        console.log(`${index + 1}. ${bottleneck}`);
      });
    } else {
      console.log(`\n✅ No major bottlenecks identified!`);
    }
  }

  private async saveDetailedReport(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `performance-test-report-${timestamp}.json`;
    const filepath = path.join(__dirname, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(this.testSuite, null, 2));
      console.log(`\n💾 Detailed report saved to: ${filepath}`);
    } catch (error) {
      console.error('Failed to save detailed report:', error);
    }
  }

  private generateRecommendations(): void {
    console.log(`\n💡 RECOMMENDATIONS:`);

    const { summary, results } = this.testSuite;

    if (summary.failedTests > 0) {
      console.log(`1. Investigate ${summary.failedTests} failed tests`);
    }

    if (summary.bottlenecks.length > 0) {
      console.log(`2. Address identified bottlenecks`);
    }

    const avgTestDuration = summary.totalDuration / summary.totalTests;
    if (avgTestDuration > 180000) { // > 3 minutes average
      console.log(`3. Consider optimizing test performance (avg: ${(avgTestDuration/1000).toFixed(1)}s)`);
    }

    console.log(`4. Review database performance metrics for optimization opportunities`);
    console.log(`5. Monitor memory usage during peak load`);
    console.log(`6. Consider implementing caching for frequently accessed data`);
  }
}

// Main execution
const runner = new PerformanceTestRunner();
runner.runAllTests().catch(console.error);

export default PerformanceTestRunner;
