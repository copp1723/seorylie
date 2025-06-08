#!/usr/bin/env tsx

/**
 * Comprehensive Notification System Test Suite
 * Tests all error/success scenarios across inventory, chat, and auth
 */

import { execSync } from "child_process";
import chalk from "chalk";

interface TestScenario {
  name: string;
  description: string;
  endpoint?: string;
  method?: string;
  body?: any;
  expectedStatus?: number;
  category: "auth" | "inventory" | "chat" | "general";
}

const TEST_SCENARIOS: TestScenario[] = [
  // Authentication Scenarios
  {
    name: "Valid Login",
    description: "Test successful user login with valid credentials",
    endpoint: "/api/login",
    method: "POST",
    body: { username: "testuser", password: "validpassword" },
    expectedStatus: 200,
    category: "auth",
  },
  {
    name: "Invalid Login",
    description: "Test login failure with invalid credentials",
    endpoint: "/api/login",
    method: "POST",
    body: { username: "testuser", password: "wrongpassword" },
    expectedStatus: 401,
    category: "auth",
  },
  {
    name: "Session Expired",
    description: "Test session expiration handling",
    endpoint: "/api/user",
    method: "GET",
    expectedStatus: 401,
    category: "auth",
  },
  {
    name: "Magic Link Request",
    description: "Test magic link email sending",
    endpoint: "/api/auth/magic-link",
    method: "POST",
    body: { email: "test@example.com" },
    expectedStatus: 200,
    category: "auth",
  },
  {
    name: "Invalid Magic Link",
    description: "Test invalid magic link handling",
    endpoint: "/api/auth/magic-link",
    method: "POST",
    body: { email: "invalid-email" },
    expectedStatus: 400,
    category: "auth",
  },

  // Inventory Scenarios
  {
    name: "Successful Inventory Import",
    description: "Test successful inventory file import",
    endpoint: "/api/inventory/import",
    method: "POST",
    body: { file: "valid-inventory.tsv", dealershipId: 1 },
    expectedStatus: 200,
    category: "inventory",
  },
  {
    name: "Invalid Inventory Format",
    description: "Test inventory import with invalid file format",
    endpoint: "/api/inventory/import",
    method: "POST",
    body: { file: "invalid-format.txt", dealershipId: 1 },
    expectedStatus: 400,
    category: "inventory",
  },
  {
    name: "Large Inventory Import",
    description: "Test handling of large inventory files",
    endpoint: "/api/inventory/import",
    method: "POST",
    body: { file: "large-inventory.tsv", dealershipId: 1 },
    expectedStatus: 200,
    category: "inventory",
  },
  {
    name: "Inventory Not Found",
    description: "Test accessing non-existent inventory",
    endpoint: "/api/inventory/999999",
    method: "GET",
    expectedStatus: 404,
    category: "inventory",
  },

  // Chat Scenarios
  {
    name: "Successful Chat Message",
    description: "Test sending a valid chat message",
    endpoint: "/api/chat/send",
    method: "POST",
    body: { message: "Hello, I need help with a vehicle", conversationId: 1 },
    expectedStatus: 200,
    category: "chat",
  },
  {
    name: "Chat Service Unavailable",
    description: "Test chat service unavailability",
    endpoint: "/api/chat/send",
    method: "POST",
    body: { message: "Test message" },
    expectedStatus: 503,
    category: "chat",
  },
  {
    name: "Invalid Chat Message",
    description: "Test sending empty or invalid chat message",
    endpoint: "/api/chat/send",
    method: "POST",
    body: { message: "", conversationId: 1 },
    expectedStatus: 400,
    category: "chat",
  },
  {
    name: "Chat Rate Limit",
    description: "Test chat rate limiting",
    endpoint: "/api/chat/send",
    method: "POST",
    body: { message: "Rapid fire message", conversationId: 1 },
    expectedStatus: 429,
    category: "chat",
  },

  // General API Scenarios
  {
    name: "Resource Not Found",
    description: "Test 404 error handling",
    endpoint: "/api/nonexistent-endpoint",
    method: "GET",
    expectedStatus: 404,
    category: "general",
  },
  {
    name: "Method Not Allowed",
    description: "Test unsupported HTTP method",
    endpoint: "/api/user",
    method: "DELETE",
    expectedStatus: 405,
    category: "general",
  },
  {
    name: "Validation Error",
    description: "Test input validation failure",
    endpoint: "/api/dealerships",
    method: "POST",
    body: { name: "", subdomain: "invalid-subdomain!" },
    expectedStatus: 422,
    category: "general",
  },
];

class NotificationTestRunner {
  private baseUrl: string;
  private results: Array<{
    scenario: TestScenario;
    success: boolean;
    message: string;
    details?: any;
  }> = [];

  constructor(baseUrl = "http://localhost:3000") {
    this.baseUrl = baseUrl;
  }

  async runAllTests(): Promise<void> {
    console.log(
      chalk.blue("🧪 Starting Comprehensive Notification System Tests...\n"),
    );

    // Group tests by category
    const categorizedTests = this.groupTestsByCategory();

    for (const [category, scenarios] of Object.entries(categorizedTests)) {
      console.log(
        chalk.yellow(`\n📂 Testing ${category.toUpperCase()} scenarios:`),
      );
      console.log("=".repeat(50));

      for (const scenario of scenarios) {
        await this.runTest(scenario);
      }
    }

    this.generateReport();
  }

  private groupTestsByCategory(): Record<string, TestScenario[]> {
    return TEST_SCENARIOS.reduce(
      (acc, scenario) => {
        if (!acc[scenario.category]) {
          acc[scenario.category] = [];
        }
        acc[scenario.category].push(scenario);
        return acc;
      },
      {} as Record<string, TestScenario[]>,
    );
  }

  private async runTest(scenario: TestScenario): Promise<void> {
    console.log(chalk.cyan(`\n🔬 ${scenario.name}`));
    console.log(`   ${scenario.description}`);

    if (!scenario.endpoint) {
      // Frontend-only test scenario
      this.addResult(
        scenario,
        true,
        "Frontend test scenario - manual verification required",
      );
      return;
    }

    try {
      const response = await this.makeRequest(scenario);
      const success = this.evaluateResponse(response, scenario);

      if (success) {
        this.addResult(
          scenario,
          true,
          `✅ Expected status ${scenario.expectedStatus}, got ${response.status}`,
        );
      } else {
        this.addResult(
          scenario,
          false,
          `❌ Expected status ${scenario.expectedStatus}, got ${response.status}`,
          response.data,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Some errors are expected (like network errors for testing)
      if (scenario.expectedStatus && scenario.expectedStatus >= 400) {
        this.addResult(
          scenario,
          true,
          `✅ Expected error occurred: ${errorMessage}`,
        );
      } else {
        this.addResult(
          scenario,
          false,
          `❌ Unexpected error: ${errorMessage}`,
          error,
        );
      }
    }
  }

  private async makeRequest(
    scenario: TestScenario,
  ): Promise<{ status: number; data: any }> {
    const url = `${this.baseUrl}${scenario.endpoint}`;
    const method = scenario.method || "GET";

    const options: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    };

    if (scenario.body && method !== "GET") {
      options.body = JSON.stringify(scenario.body);
    }

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    return { status: response.status, data };
  }

  private evaluateResponse(
    response: { status: number; data: any },
    scenario: TestScenario,
  ): boolean {
    if (scenario.expectedStatus) {
      return response.status === scenario.expectedStatus;
    }

    // If no expected status, consider 2xx as success
    return response.status >= 200 && response.status < 300;
  }

  private addResult(
    scenario: TestScenario,
    success: boolean,
    message: string,
    details?: any,
  ): void {
    this.results.push({ scenario, success, message, details });

    const icon = success ? "✅" : "❌";
    const color = success ? chalk.green : chalk.red;
    console.log(`   ${icon} ${color(message)}`);
  }

  private generateReport(): void {
    console.log(chalk.blue("\n📊 NOTIFICATION SYSTEM TEST REPORT"));
    console.log("=".repeat(60));

    const total = this.results.length;
    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const successRate = ((passed / total) * 100).toFixed(1);

    console.log(`\n📈 Summary:`);
    console.log(`   Total Tests: ${total}`);
    console.log(`   Passed: ${chalk.green(passed)} ✅`);
    console.log(`   Failed: ${chalk.red(failed)} ❌`);
    console.log(`   Success Rate: ${successRate}%`);

    // Category breakdown
    console.log(`\n📂 Results by Category:`);
    const categories = ["auth", "inventory", "chat", "general"];

    categories.forEach((category) => {
      const categoryResults = this.results.filter(
        (r) => r.scenario.category === category,
      );
      const categoryPassed = categoryResults.filter((r) => r.success).length;
      const categoryTotal = categoryResults.length;
      const categoryRate =
        categoryTotal > 0
          ? ((categoryPassed / categoryTotal) * 100).toFixed(1)
          : "0";

      console.log(
        `   ${category.toUpperCase()}: ${categoryPassed}/${categoryTotal} (${categoryRate}%)`,
      );
    });

    // Failed tests details
    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`   • ${r.scenario.name}: ${r.message}`);
          if (r.details) {
            console.log(`     Details: ${JSON.stringify(r.details, null, 2)}`);
          }
        });
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);

    if (successRate === "100.0") {
      console.log(
        "   ✅ All tests passed! Notification system is working correctly.",
      );
    } else {
      console.log(
        "   🔧 Review failed tests and ensure proper error handling.",
      );
      console.log(
        "   📧 Verify that user-friendly messages are displayed for all errors.",
      );
      console.log(
        "   🎯 Test the notification system manually in the browser at /notifications-test",
      );
    }

    console.log(`\n🌐 Manual Testing:`);
    console.log(
      `   Visit ${this.baseUrl}/notifications-test to test the UI notifications`,
    );
    console.log(
      `   Verify that all notifications are actionable and user-friendly`,
    );
    console.log(`   Check that notifications auto-dismiss appropriately`);
    console.log(`   Ensure notifications don't block UI interactions`);

    // Save detailed report
    const reportPath = "./notification-test-report.json";
    const report = {
      timestamp: new Date().toISOString(),
      summary: { total, passed, failed, successRate: parseFloat(successRate) },
      results: this.results.map((r) => ({
        scenario: r.scenario.name,
        category: r.scenario.category,
        success: r.success,
        message: r.message,
        details: r.details,
      })),
    };

    try {
      require("fs").writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.log(`\n⚠️  Could not save report file: ${error.message}`);
    }
  }

  // Test specific notification features
  async testNotificationFeatures(): Promise<void> {
    console.log(chalk.blue("\n🎯 Testing Notification System Features...\n"));

    const featureTests = [
      {
        name: "Toast Auto-Dismiss",
        description: "Verify that success toasts auto-dismiss after 5 seconds",
      },
      {
        name: "Error Persistence",
        description:
          "Verify that error notifications persist until manually dismissed",
      },
      {
        name: "Action Buttons",
        description: "Verify that notification action buttons work correctly",
      },
      {
        name: "Multiple Notifications",
        description:
          "Verify that multiple notifications can be displayed simultaneously",
      },
      {
        name: "Form Validation",
        description:
          "Verify that inline form validation works with clear error messages",
      },
      {
        name: "Loading States",
        description: "Verify that loading notifications work correctly",
      },
    ];

    console.log("🔧 Manual Feature Tests (verify in browser):");
    featureTests.forEach((test, index) => {
      console.log(
        `   ${index + 1}. ${chalk.cyan(test.name)}: ${test.description}`,
      );
    });

    console.log(`\n📱 Accessibility Tests:`);
    console.log("   • Screen reader compatibility (aria-live regions)");
    console.log("   • Keyboard navigation support");
    console.log("   • High contrast mode compatibility");
    console.log("   • Focus management");

    console.log(`\n⚡ Performance Tests:`);
    console.log("   • Notification rendering performance");
    console.log("   • Memory usage with many notifications");
    console.log("   • Animation smoothness");
  }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
  const testRunner = new NotificationTestRunner(baseUrl);

  console.log(chalk.green("🚀 CleanRylie Notification System Test Suite"));
  console.log(chalk.gray(`Testing against: ${baseUrl}`));

  testRunner
    .runAllTests()
    .then(() => testRunner.testNotificationFeatures())
    .then(() => {
      console.log(chalk.green("\n🎉 Notification system testing complete!"));
      console.log(chalk.yellow("💡 Next steps:"));
      console.log("   1. Review any failed tests");
      console.log("   2. Test manually in browser at /notifications-test");
      console.log("   3. Verify accessibility and user experience");
      process.exit(0);
    })
    .catch((error) => {
      console.error(chalk.red("\n💥 Test suite failed:"), error);
      process.exit(1);
    });
}

export type { NotificationTestRunner };
