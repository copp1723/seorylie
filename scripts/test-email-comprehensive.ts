/**
 * Comprehensive Email Service Integration Test Suite
 * Tests SendGrid integration, email templates, and notification system
 */

import { 
  emailService, 
  sendEmail, 
  sendTemplatedEmail, 
  sendNotificationEmail,
  sendPasswordResetEmail,
  sendHandoverEmail,
  sendWelcomeEmail,
  sendReportEmail,
  getEmailServiceStatus
} from '../server/services/email-service';
import { processIncomingEmail, simulateIncomingEmail } from '../server/services/email-listener';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

class EmailTestSuite {
  private results: TestResult[] = [];
  private testEmail = 'test@cleanrylie.com';

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Comprehensive Email Service Tests...\n');
    
    // Test 1: Service Status Check
    await this.testServiceStatus();
    
    // Test 2: Basic Email Sending
    await this.testBasicEmailSending();
    
    // Test 3: Email Templates
    await this.testEmailTemplates();
    
    // Test 4: Notification System
    await this.testNotificationSystem();
    
    // Test 5: Email Bounce Handling
    await this.testBounceHandling();
    
    // Test 6: Inventory Import via Email
    await this.testInventoryImportViaEmail();
    
    // Generate summary
    this.generateSummary();
  }

  private async testServiceStatus(): Promise<void> {
    console.log('🔍 Testing Email Service Status...');
    
    try {
      const status = await getEmailServiceStatus();
      
      if (status.isInitialized && status.isConnected) {
        this.addResult('Service Status', true, 'Email service is properly initialized and connected');
      } else if (status.isInitialized && !status.isConnected) {
        this.addResult('Service Status', true, 'Email service initialized but using development mode', status);
      } else {
        this.addResult('Service Status', false, status.error || 'Service not properly initialized', status);
      }
    } catch (error) {
      this.addResult('Service Status', false, `Error checking status: ${error.message}`);
    }
  }

  private async testBasicEmailSending(): Promise<void> {
    console.log('📧 Testing Basic Email Sending...');
    
    const testCases = [
      {
        name: 'HTML Email',
        options: {
          to: this.testEmail,
          subject: 'Test HTML Email',
          html: '<h1>Test Email</h1><p>This is a test HTML email.</p>',
          text: 'Test Email\n\nThis is a test HTML email.'
        }
      },
      {
        name: 'Text Only Email',
        options: {
          to: this.testEmail,
          subject: 'Test Text Email',
          text: 'This is a plain text test email.'
        }
      },
      {
        name: 'Multiple Recipients',
        options: {
          to: [this.testEmail, 'admin@cleanrylie.com'],
          subject: 'Test Multiple Recipients',
          html: '<p>Test email to multiple recipients</p>'
        }
      }
    ];

    for (const testCase of testCases) {
      try {
        const result = await sendEmail(testCase.options);
        
        if (result.success) {
          this.addResult(`Basic Email - ${testCase.name}`, true, `Email sent successfully with message ID: ${result.messageId}`);
        } else {
          this.addResult(`Basic Email - ${testCase.name}`, false, result.error || 'Unknown error');
        }
      } catch (error) {
        this.addResult(`Basic Email - ${testCase.name}`, false, `Exception: ${error.message}`);
      }
    }
  }

  private async testEmailTemplates(): Promise<void> {
    console.log('📋 Testing Email Templates...');
    
    const templateTests = [
      {
        name: 'Welcome Email',
        test: () => sendWelcomeEmail(this.testEmail, 'Test User')
      },
      {
        name: 'Password Reset Email',
        test: () => sendPasswordResetEmail(this.testEmail, 'test-reset-token-123')
      },
      {
        name: 'Notification Email',
        test: () => sendNotificationEmail(this.testEmail, 'Test Notification', 'This is a test notification message.')
      },
      {
        name: 'Report Email',
        test: () => sendReportEmail(this.testEmail, 'report-123', 'Weekly Performance')
      },
      {
        name: 'Handover Email',
        test: () => sendHandoverEmail(this.testEmail, {
          customerName: 'John Doe',
          dealershipName: 'Test Dealership',
          conversationSummary: 'Customer inquired about a 2024 Honda Civic. Interested in financing options.',
          nextSteps: ['Schedule test drive', 'Prepare financing information', 'Follow up within 24 hours']
        })
      },
      {
        name: 'Templated Email with Variables',
        test: () => sendTemplatedEmail('welcome', this.testEmail, {
          userName: 'Test User',
          companyName: 'CleanRylie Test'
        })
      }
    ];

    for (const templateTest of templateTests) {
      try {
        const result = await templateTest.test();
        
        if (result.success) {
          this.addResult(`Template - ${templateTest.name}`, true, `Template rendered and sent successfully`);
        } else {
          this.addResult(`Template - ${templateTest.name}`, false, result.error || 'Template failed');
        }
      } catch (error) {
        this.addResult(`Template - ${templateTest.name}`, false, `Exception: ${error.message}`);
      }
    }
  }

  private async testNotificationSystem(): Promise<void> {
    console.log('🔔 Testing Notification System...');
    
    const notificationTests = [
      {
        type: 'Info',
        subject: 'System Information',
        message: 'This is an informational notification.'
      },
      {
        type: 'Warning',
        subject: 'System Warning',
        message: 'This is a warning notification that requires attention.'
      },
      {
        type: 'Error',
        subject: 'System Error',
        message: 'This is an error notification that requires immediate attention.'
      }
    ];

    for (const notification of notificationTests) {
      try {
        const result = await sendNotificationEmail(
          this.testEmail,
          notification.subject,
          notification.message
        );
        
        if (result.success) {
          this.addResult(`Notification - ${notification.type}`, true, 'Notification sent successfully');
        } else {
          this.addResult(`Notification - ${notification.type}`, false, result.error || 'Notification failed');
        }
      } catch (error) {
        this.addResult(`Notification - ${notification.type}`, false, `Exception: ${error.message}`);
      }
    }
  }

  private async testBounceHandling(): Promise<void> {
    console.log('📤 Testing Email Bounce Handling...');
    
    // Test with invalid email addresses to check bounce handling
    const bounceTests = [
      {
        name: 'Invalid Email Format',
        email: 'invalid-email-address',
        expectedResult: 'should fail validation'
      },
      {
        name: 'Non-existent Domain',
        email: 'test@non-existent-domain-12345.com',
        expectedResult: 'should handle delivery failure gracefully'
      }
    ];

    for (const bounceTest of bounceTests) {
      try {
        const result = await sendEmail({
          to: bounceTest.email,
          subject: 'Bounce Test Email',
          text: 'This email is testing bounce handling.'
        });
        
        if (!result.success) {
          this.addResult(`Bounce Handling - ${bounceTest.name}`, true, `Correctly handled invalid email: ${result.error}`);
        } else {
          this.addResult(`Bounce Handling - ${bounceTest.name}`, false, 'Should have failed but succeeded');
        }
      } catch (error) {
        this.addResult(`Bounce Handling - ${bounceTest.name}`, true, `Correctly caught exception: ${error.message}`);
      }
    }
  }

  private async testInventoryImportViaEmail(): Promise<void> {
    console.log('📦 Testing Inventory Import via Email...');
    
    try {
      // Create a test TSV file
      const testTsvContent = [
        'VIN\\tMake\\tModel\\tYear\\tPrice\\tStatus',
        '1HGCM82633A123456\\tHonda\\tCivic\\t2024\\t25000\\tAvailable',
        '1HGCM82633A654321\\tHonda\\tAccord\\t2024\\t30000\\tAvailable'
      ].join('\\n');
      
      const tempDir = '/tmp/email-test';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const testFilePath = path.join(tempDir, 'test-inventory.tsv');
      fs.writeFileSync(testFilePath, testTsvContent);
      
      // Test email processing
      const emailResult = await simulateIncomingEmail(
        'dealer@testdealership.com',
        'Inventory Update - Daily Import',
        testFilePath
      );
      
      if (emailResult.success) {
        this.addResult('Inventory Import', true, 'Email inventory import processed successfully', emailResult.results);
      } else {
        this.addResult('Inventory Import', false, emailResult.error || 'Import failed');
      }
      
      // Clean up
      fs.unlinkSync(testFilePath);
      
    } catch (error) {
      this.addResult('Inventory Import', false, `Exception during inventory import test: ${error.message}`);
    }
  }

  private addResult(name: string, success: boolean, message: string, details?: any): void {
    this.results.push({ name, success, message, details });
    
    const icon = success ? '✅' : '❌';
    console.log(`  ${icon} ${name}: ${message}`);
    
    if (details && process.env.VERBOSE_TESTS) {
      console.log(`     Details:`, details);
    }
  }

  private generateSummary(): void {
    console.log('\\n📋 EMAIL TEST SUMMARY');
    console.log('=' .repeat(50));
    
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;
    
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => console.log(`  - ${r.name}: ${r.message}`));
    }
    
    console.log('\\n🎯 Recommendations:');
    
    if (failed === 0) {
      console.log('  ✅ All tests passed! Email system is ready for production.');
    } else {
      console.log('  🔧 Review failed tests and fix configuration issues.');
      console.log('  📧 Ensure SendGrid API key is properly configured.');
      console.log('  🔍 Check email service logs for detailed error information.');
    }
    
    // Save detailed results to file
    const reportPath = path.join(process.cwd(), 'email-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, successRate: (passed / total) * 100 },
      results: this.results
    }, null, 2));
    
    console.log(`\\n📊 Detailed report saved to: ${reportPath}`);
  }
}

// Run the test suite if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const testSuite = new EmailTestSuite();
  testSuite.runAllTests()
    .then(() => {
      console.log('\\n🎉 Email testing complete!');
    })
    .catch(error => {
      console.error('\\n💥 Email testing failed:', error);
      process.exit(1);
    });
}

export type { EmailTestSuite }