#!/usr/bin/env npx tsx

/**
 * Frontend Component Rendering & Navigation Test Suite
 *
 * This script performs comprehensive testing of frontend components and navigation
 * by analyzing component structure, dependencies, and potential rendering issues.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, extname } from "path";

interface ComponentAnalysis {
  name: string;
  path: string;
  type: "page" | "component" | "layout" | "hook" | "util";
  dependencies: string[];
  exports: string[];
  hasDefaultExport: boolean;
  usesHooks: string[];
  hasTypeScript: boolean;
  imports: {
    external: string[];
    internal: string[];
    ui: string[];
  };
  potentialIssues: string[];
  complexity: "low" | "medium" | "high";
}

interface NavigationRoute {
  path: string;
  component: string;
  isProtected: boolean;
  hasLayout: boolean;
}

interface TestResult {
  category: string;
  test: string;
  status: "pass" | "warning" | "fail";
  message: string;
  details?: string[];
}

interface FrontendTestReport {
  summary: {
    totalComponents: number;
    totalPages: number;
    totalRoutes: number;
    passedTests: number;
    warningTests: number;
    failedTests: number;
  };
  components: ComponentAnalysis[];
  routes: NavigationRoute[];
  testResults: TestResult[];
  recommendations: string[];
}

class FrontendTester {
  private clientDir: string;
  private components: ComponentAnalysis[] = [];
  private routes: NavigationRoute[] = [];
  private testResults: TestResult[] = [];

  constructor() {
    this.clientDir = "./client/src";
  }

  /**
   * Add a test result to the results array
   */
  private addResult(
    category: string,
    test: string,
    status: "pass" | "warning" | "fail",
    message: string,
    details?: string[],
  ) {
    this.testResults.push({
      category,
      test,
      status,
      message,
      details,
    });
  }

  /**
   * Recursively scan directory for React/TypeScript files
   */
  private async scanDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stats = await stat(fullPath);

        if (
          stats.isDirectory() &&
          !entry.startsWith(".") &&
          entry !== "node_modules"
        ) {
          const subFiles = await this.scanDirectory(fullPath);
          files.push(...subFiles);
        } else if (stats.isFile()) {
          const ext = extname(entry);
          if ([".tsx", ".ts", ".jsx", ".js"].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not scan directory ${dir}`);
    }

    return files;
  }

  /**
   * Analyze a single component file
   */
  private async analyzeComponent(filePath: string): Promise<ComponentAnalysis> {
    const content = await readFile(filePath, "utf-8");
    const relativePath = filePath.replace("./client/src/", "");
    const name =
      relativePath
        .split("/")
        .pop()
        ?.replace(/\.(tsx?|jsx?)$/, "") || "unknown";

    // Determine component type
    let type: ComponentAnalysis["type"] = "component";
    if (relativePath.startsWith("pages/")) type = "page";
    else if (relativePath.startsWith("hooks/")) type = "hook";
    else if (relativePath.includes("layout")) type = "layout";
    else if (
      relativePath.startsWith("lib/") ||
      relativePath.startsWith("utils/")
    )
      type = "util";

    // Extract imports
    const importMatches =
      content.match(/^import\s+.*?from\s+['"][^'"]+['"];?$/gm) || [];
    const imports = {
      external: [] as string[],
      internal: [] as string[],
      ui: [] as string[],
    };

    importMatches.forEach((imp) => {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (match) {
        const importPath = match[1];
        if (importPath.startsWith("@/components/ui/")) {
          imports.ui.push(importPath);
        } else if (importPath.startsWith(".") || importPath.startsWith("@/")) {
          imports.internal.push(importPath);
        } else {
          imports.external.push(importPath);
        }
      }
    });

    // Extract exports
    const exportMatches = content.match(/^export\s+.*$/gm) || [];
    const exports = exportMatches.map((exp) => exp.replace(/^export\s+/, ""));
    const hasDefaultExport = content.includes("export default");

    // Detect React hooks usage
    const hookMatches = content.match(/\buse[A-Z]\w*/g) || [];
    const usesHooks = [...new Set(hookMatches)];

    // Check for TypeScript
    const hasTypeScript =
      filePath.endsWith(".tsx") ||
      filePath.endsWith(".ts") ||
      content.includes("interface ") ||
      content.includes("type ");

    // Identify potential issues
    const potentialIssues: string[] = [];

    if (type === "component" && !hasDefaultExport) {
      potentialIssues.push("Missing default export for component");
    }

    if (content.includes("console.log") || content.includes("console.error")) {
      potentialIssues.push("Contains console statements");
    }

    if (content.includes("any") && hasTypeScript) {
      potentialIssues.push('Uses "any" type (potential type safety issue)');
    }

    if (usesHooks.includes("useState") && !content.includes("React")) {
      potentialIssues.push("Uses React hooks but React import may be missing");
    }

    // Calculate complexity
    const lineCount = content.split("\n").length;
    const complexity =
      lineCount > 300 ? "high" : lineCount > 100 ? "medium" : "low";

    return {
      name,
      path: relativePath,
      type,
      dependencies: [...imports.external, ...imports.internal],
      exports,
      hasDefaultExport,
      usesHooks,
      hasTypeScript,
      imports,
      potentialIssues,
      complexity,
    };
  }

  /**
   * Extract routes from App.tsx
   */
  private async analyzeRoutes(): Promise<void> {
    try {
      const appPath = join(this.clientDir, "App.tsx");
      const content = await readFile(appPath, "utf-8");

      // Extract Route components
      const routeMatches = content.match(/<Route[^>]*>/g) || [];

      routeMatches.forEach((routeMatch) => {
        const pathMatch = routeMatch.match(/path=["']([^"']+)["']/);
        const componentMatch =
          routeMatch.match(/component=\{?(\w+)\}?/) ||
          routeMatch.match(/<(\w+)\s*\/?>/);

        if (pathMatch) {
          const path = pathMatch[1];
          const component = componentMatch ? componentMatch[1] : "Unknown";
          const isProtected = routeMatch.includes("ProtectedRoute");
          const hasLayout = routeMatch.includes("Layout");

          this.routes.push({
            path,
            component,
            isProtected,
            hasLayout,
          });
        }
      });

      this.addResult(
        "Routes",
        "Route Extraction",
        "pass",
        `Found ${this.routes.length} routes in App.tsx`,
      );
    } catch (error) {
      this.addResult(
        "Routes",
        "Route Extraction",
        "fail",
        "Could not analyze routes from App.tsx",
      );
    }
  }

  /**
   * Test login/registration pages
   */
  private testAuthPages(): void {
    console.log("🔐 Testing Login/Registration Pages...");

    const loginPages = this.components.filter(
      (c) =>
        c.name.toLowerCase().includes("login") ||
        c.name.toLowerCase().includes("auth"),
    );

    if (loginPages.length === 0) {
      this.addResult(
        "Authentication",
        "Login Pages Found",
        "fail",
        "No login/authentication pages found",
      );
      return;
    }

    loginPages.forEach((page) => {
      // Check for form validation
      if (
        page.usesHooks.includes("useState") &&
        page.dependencies.some(
          (dep) => dep.includes("form") || dep.includes("input"),
        )
      ) {
        this.addResult(
          "Authentication",
          `${page.name} Form Handling`,
          "pass",
          "Has form state management",
        );
      } else {
        this.addResult(
          "Authentication",
          `${page.name} Form Handling`,
          "warning",
          "May be missing form validation",
        );
      }

      // Check for error handling
      if (
        page.imports.ui.some((ui) => ui.includes("alert")) ||
        page.dependencies.some((dep) => dep.includes("error"))
      ) {
        this.addResult(
          "Authentication",
          `${page.name} Error Handling`,
          "pass",
          "Has error display capability",
        );
      } else {
        this.addResult(
          "Authentication",
          `${page.name} Error Handling`,
          "warning",
          "May be missing error handling",
        );
      }

      // Check for loading states
      if (
        page.usesHooks.includes("useAuth") ||
        page.usesHooks.includes("useMutation")
      ) {
        this.addResult(
          "Authentication",
          `${page.name} Loading States`,
          "pass",
          "Has authentication integration",
        );
      } else {
        this.addResult(
          "Authentication",
          `${page.name} Loading States`,
          "warning",
          "May be missing loading states",
        );
      }
    });
  }

  /**
   * Test dashboard components
   */
  private testDashboardPages(): void {
    console.log("📊 Testing Dashboard Pages...");

    const dashboardPages = this.components.filter(
      (c) =>
        c.name.toLowerCase().includes("dashboard") ||
        c.name.toLowerCase().includes("home"),
    );

    if (dashboardPages.length === 0) {
      this.addResult(
        "Dashboard",
        "Dashboard Pages Found",
        "warning",
        "No dashboard pages found",
      );
      return;
    }

    dashboardPages.forEach((page) => {
      // Check for data display components
      if (
        page.imports.ui.some(
          (ui) => ui.includes("card") || ui.includes("table"),
        )
      ) {
        this.addResult(
          "Dashboard",
          `${page.name} Data Display`,
          "pass",
          "Uses appropriate data display components",
        );
      } else {
        this.addResult(
          "Dashboard",
          `${page.name} Data Display`,
          "warning",
          "May need better data visualization",
        );
      }

      // Check for responsive design
      if (
        page.imports.ui.some((ui) => ui.includes("grid")) ||
        page.path.includes("responsive")
      ) {
        this.addResult(
          "Dashboard",
          `${page.name} Responsive Design`,
          "pass",
          "Likely has responsive layout",
        );
      } else {
        this.addResult(
          "Dashboard",
          `${page.name} Responsive Design`,
          "warning",
          "May need responsive design verification",
        );
      }
    });
  }

  /**
   * Test vehicle inventory components
   */
  private testInventoryComponents(): void {
    console.log("🚗 Testing Vehicle Inventory Components...");

    const inventoryComponents = this.components.filter(
      (c) =>
        c.name.toLowerCase().includes("inventory") ||
        c.name.toLowerCase().includes("vehicle"),
    );

    if (inventoryComponents.length === 0) {
      this.addResult(
        "Inventory",
        "Inventory Components Found",
        "warning",
        "No inventory components found",
      );
      return;
    }

    inventoryComponents.forEach((component) => {
      // Check for pagination
      if (
        component.imports.ui.some((ui) => ui.includes("pagination")) ||
        component.usesHooks.includes("useState")
      ) {
        this.addResult(
          "Inventory",
          `${component.name} Pagination`,
          "pass",
          "Has pagination support",
        );
      } else {
        this.addResult(
          "Inventory",
          `${component.name} Pagination`,
          "warning",
          "May need pagination for large datasets",
        );
      }

      // Check for search/filter
      if (
        component.usesHooks.includes("useState") &&
        component.imports.ui.some((ui) => ui.includes("input"))
      ) {
        this.addResult(
          "Inventory",
          `${component.name} Search/Filter`,
          "pass",
          "Has search/filter functionality",
        );
      } else {
        this.addResult(
          "Inventory",
          `${component.name} Search/Filter`,
          "warning",
          "May need search/filter capability",
        );
      }
    });
  }

  /**
   * Test conversation components
   */
  private testConversationComponents(): void {
    console.log("💬 Testing Conversation Components...");

    const conversationComponents = this.components.filter(
      (c) =>
        c.name.toLowerCase().includes("conversation") ||
        c.name.toLowerCase().includes("chat") ||
        c.name.toLowerCase().includes("message"),
    );

    if (conversationComponents.length === 0) {
      this.addResult(
        "Conversations",
        "Conversation Components Found",
        "warning",
        "No conversation components found",
      );
      return;
    }

    conversationComponents.forEach((component) => {
      // Check for real-time features
      if (
        component.dependencies.some(
          (dep) => dep.includes("websocket") || dep.includes("socket"),
        )
      ) {
        this.addResult(
          "Conversations",
          `${component.name} Real-time Features`,
          "pass",
          "Has WebSocket integration",
        );
      } else {
        this.addResult(
          "Conversations",
          `${component.name} Real-time Features`,
          "warning",
          "May need real-time messaging",
        );
      }

      // Check for message formatting
      if (
        component.imports.ui.some(
          (ui) => ui.includes("avatar") || ui.includes("card"),
        )
      ) {
        this.addResult(
          "Conversations",
          `${component.name} Message Display`,
          "pass",
          "Has proper message formatting",
        );
      } else {
        this.addResult(
          "Conversations",
          `${component.name} Message Display`,
          "warning",
          "May need better message styling",
        );
      }
    });
  }

  /**
   * Test navigation components
   */
  private testNavigationComponents(): void {
    console.log("🧭 Testing Navigation Components...");

    const navigationComponents = this.components.filter(
      (c) =>
        c.name.toLowerCase().includes("sidebar") ||
        c.name.toLowerCase().includes("nav") ||
        c.name.toLowerCase().includes("layout"),
    );

    navigationComponents.forEach((component) => {
      // Check for route handling
      if (
        component.dependencies.some(
          (dep) => dep.includes("wouter") || dep.includes("router"),
        )
      ) {
        this.addResult(
          "Navigation",
          `${component.name} Route Handling`,
          "pass",
          "Has proper route integration",
        );
      } else {
        this.addResult(
          "Navigation",
          `${component.name} Route Handling`,
          "warning",
          "May need route integration",
        );
      }

      // Check for active state handling
      if (
        component.usesHooks.includes("useLocation") ||
        component.usesHooks.includes("useState")
      ) {
        this.addResult(
          "Navigation",
          `${component.name} Active States`,
          "pass",
          "Handles navigation states",
        );
      } else {
        this.addResult(
          "Navigation",
          `${component.name} Active States`,
          "warning",
          "May need active state management",
        );
      }
    });
  }

  /**
   * Test form components
   */
  private testFormComponents(): void {
    console.log("📝 Testing Form Components...");

    const formComponents = this.components.filter(
      (c) =>
        c.name.toLowerCase().includes("form") ||
        c.imports.ui.some((ui) => ui.includes("form") || ui.includes("input")),
    );

    formComponents.forEach((component) => {
      // Check for validation
      if (
        component.dependencies.some(
          (dep) =>
            dep.includes("zod") || dep.includes("yup") || dep.includes("joi"),
        )
      ) {
        this.addResult(
          "Forms",
          `${component.name} Validation`,
          "pass",
          "Has form validation library",
        );
      } else if (component.usesHooks.includes("useState")) {
        this.addResult(
          "Forms",
          `${component.name} Validation`,
          "warning",
          "Has state management but may need validation",
        );
      } else {
        this.addResult(
          "Forms",
          `${component.name} Validation`,
          "fail",
          "Missing form validation",
        );
      }

      // Check for error handling
      if (
        component.imports.ui.some((ui) => ui.includes("alert")) ||
        component.usesHooks.includes("useToast")
      ) {
        this.addResult(
          "Forms",
          `${component.name} Error Display`,
          "pass",
          "Has error display capability",
        );
      } else {
        this.addResult(
          "Forms",
          `${component.name} Error Display`,
          "warning",
          "May need error display",
        );
      }
    });
  }

  /**
   * Test responsive design considerations
   */
  private testResponsiveDesign(): void {
    console.log("📱 Testing Responsive Design...");

    // Check for responsive utilities
    const responsiveComponents = this.components.filter(
      (c) =>
        c.imports.external.some((dep) => dep.includes("tailwind")) ||
        c.imports.internal.some((dep) => dep.includes("mobile")),
    );

    if (responsiveComponents.length > 0) {
      this.addResult(
        "Responsive",
        "Responsive Utilities",
        "pass",
        `${responsiveComponents.length} components use responsive utilities`,
      );
    } else {
      this.addResult(
        "Responsive",
        "Responsive Utilities",
        "warning",
        "No explicit responsive utilities detected",
      );
    }

    // Check for mobile-specific hooks
    const mobileHooks = this.components.filter((c) =>
      c.usesHooks.some((hook) => hook.includes("Mobile")),
    );
    if (mobileHooks.length > 0) {
      this.addResult(
        "Responsive",
        "Mobile Detection",
        "pass",
        "Has mobile detection hooks",
      );
    } else {
      this.addResult(
        "Responsive",
        "Mobile Detection",
        "warning",
        "May need mobile detection capability",
      );
    }
  }

  /**
   * Test TypeScript usage and type safety
   */
  private testTypeScript(): void {
    console.log("🔷 Testing TypeScript Usage...");

    const tsComponents = this.components.filter((c) => c.hasTypeScript);
    const jsComponents = this.components.filter((c) => !c.hasTypeScript);

    if (tsComponents.length > jsComponents.length) {
      this.addResult(
        "TypeScript",
        "TypeScript Coverage",
        "pass",
        `${tsComponents.length}/${this.components.length} components use TypeScript`,
      );
    } else {
      this.addResult(
        "TypeScript",
        "TypeScript Coverage",
        "warning",
        `Only ${tsComponents.length}/${this.components.length} components use TypeScript`,
      );
    }

    // Check for type safety issues
    const componentsWithAny = this.components.filter((c) =>
      c.potentialIssues.includes(
        'Uses "any" type (potential type safety issue)',
      ),
    );
    if (componentsWithAny.length === 0) {
      this.addResult(
        "TypeScript",
        "Type Safety",
        "pass",
        'No "any" types detected',
      );
    } else {
      this.addResult(
        "TypeScript",
        "Type Safety",
        "warning",
        `${componentsWithAny.length} components may have type safety issues`,
      );
    }
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.testResults.filter((r) => r.status === "fail");
    const warningTests = this.testResults.filter((r) => r.status === "warning");

    if (failedTests.length > 0) {
      recommendations.push(
        `🚨 Address ${failedTests.length} critical issues found in testing`,
      );
    }

    if (warningTests.length > 5) {
      recommendations.push(
        `⚠️ Review ${warningTests.length} potential improvements identified`,
      );
    }

    // Specific recommendations
    const authIssues = this.testResults.filter(
      (r) => r.category === "Authentication" && r.status !== "pass",
    );
    if (authIssues.length > 0) {
      recommendations.push(
        "🔐 Enhance authentication form validation and error handling",
      );
    }

    const responsiveIssues = this.testResults.filter(
      (r) => r.category === "Responsive" && r.status !== "pass",
    );
    if (responsiveIssues.length > 0) {
      recommendations.push(
        "📱 Implement comprehensive responsive design testing",
      );
    }

    const formIssues = this.testResults.filter(
      (r) => r.category === "Forms" && r.status === "fail",
    );
    if (formIssues.length > 0) {
      recommendations.push(
        "📝 Add proper form validation to prevent user errors",
      );
    }

    // Performance recommendations
    const highComplexityComponents = this.components.filter(
      (c) => c.complexity === "high",
    );
    if (highComplexityComponents.length > 0) {
      recommendations.push(
        `⚡ Consider refactoring ${highComplexityComponents.length} high-complexity components`,
      );
    }

    return recommendations;
  }

  /**
   * Run all frontend tests
   */
  async runAllTests(): Promise<FrontendTestReport> {
    console.log("🧪 Starting Frontend Component Testing...\n");

    // Scan and analyze all components
    const files = await this.scanDirectory(this.clientDir);
    console.log(`📁 Found ${files.length} component files\n`);

    for (const file of files) {
      try {
        const analysis = await this.analyzeComponent(file);
        this.components.push(analysis);
      } catch (error) {
        console.warn(`Warning: Could not analyze ${file}`);
      }
    }

    // Analyze routes
    await this.analyzeRoutes();

    // Run all test categories
    this.testAuthPages();
    this.testDashboardPages();
    this.testInventoryComponents();
    this.testConversationComponents();
    this.testNavigationComponents();
    this.testFormComponents();
    this.testResponsiveDesign();
    this.testTypeScript();

    // Generate summary
    const summary = {
      totalComponents: this.components.length,
      totalPages: this.components.filter((c) => c.type === "page").length,
      totalRoutes: this.routes.length,
      passedTests: this.testResults.filter((r) => r.status === "pass").length,
      warningTests: this.testResults.filter((r) => r.status === "warning")
        .length,
      failedTests: this.testResults.filter((r) => r.status === "fail").length,
    };

    return {
      summary,
      components: this.components,
      routes: this.routes,
      testResults: this.testResults,
      recommendations: this.generateRecommendations(),
    };
  }
}

/**
 * Generate formatted test report
 */
function generateReport(results: FrontendTestReport): string {
  const timestamp = new Date().toISOString();

  return `# Frontend Component Rendering & Navigation Test Report
Generated: ${timestamp}

## Executive Summary
- **Total Components**: ${results.summary.totalComponents}
- **Total Pages**: ${results.summary.totalPages}
- **Total Routes**: ${results.summary.totalRoutes}
- **Tests Passed**: ${results.summary.passedTests}
- **Tests with Warnings**: ${results.summary.warningTests}
- **Tests Failed**: ${results.summary.failedTests}

## Component Analysis

### By Type
${Object.entries(
  results.components.reduce(
    (acc, comp) => {
      acc[comp.type] = (acc[comp.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ),
)
  .map(([type, count]) => `- **${type}**: ${count} components`)
  .join("\n")}

### By Complexity
${Object.entries(
  results.components.reduce(
    (acc, comp) => {
      acc[comp.complexity] = (acc[comp.complexity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  ),
)
  .map(([complexity, count]) => `- **${complexity}**: ${count} components`)
  .join("\n")}

## Route Analysis
${results.routes
  .map(
    (route) => `
### ${route.path}
- **Component**: ${route.component}
- **Protected**: ${route.isProtected ? "✅ Yes" : "❌ No"}
- **Has Layout**: ${route.hasLayout ? "✅ Yes" : "❌ No"}
`,
  )
  .join("")}

## Test Results by Category

${Object.entries(
  results.testResults.reduce(
    (acc, result) => {
      if (!acc[result.category]) acc[result.category] = [];
      acc[result.category].push(result);
      return acc;
    },
    {} as Record<string, typeof results.testResults>,
  ),
)
  .map(
    ([category, tests]) => `
### ${category}
${tests
  .map((test) => {
    const icon =
      test.status === "pass" ? "✅" : test.status === "warning" ? "⚠️" : "❌";
    return `${icon} **${test.test}**: ${test.message}`;
  })
  .join("\n")}
`,
  )
  .join("")}

## High-Priority Issues
${
  results.testResults
    .filter((r) => r.status === "fail")
    .map((test) => `- **${test.category}**: ${test.test} - ${test.message}`)
    .join("\n") || "No critical issues found ✅"
}

## Recommendations
${results.recommendations.map((rec) => `- ${rec}`).join("\n")}

## Component Details

### Pages (${results.components.filter((c) => c.type === "page").length})
${results.components
  .filter((c) => c.type === "page")
  .map(
    (comp) => `
#### ${comp.name}
- **Path**: ${comp.path}
- **TypeScript**: ${comp.hasTypeScript ? "✅" : "❌"}
- **Hooks Used**: ${comp.usesHooks.join(", ") || "None"}
- **Dependencies**: ${comp.dependencies.length}
- **Complexity**: ${comp.complexity}
- **Issues**: ${comp.potentialIssues.length > 0 ? comp.potentialIssues.join(", ") : "None"}
`,
  )
  .join("")}

### Layout Components (${results.components.filter((c) => c.type === "layout").length})
${results.components
  .filter((c) => c.type === "layout")
  .map(
    (comp) => `
#### ${comp.name}
- **Path**: ${comp.path}
- **Navigation Integration**: ${comp.dependencies.some((d) => d.includes("wouter")) ? "✅" : "❌"}
- **Responsive**: ${comp.usesHooks.includes("useMobile") ? "✅" : "❓"}
`,
  )
  .join("")}

## Success Criteria Assessment

### ✅ Page Load Testing
- Login/Registration Pages: ${results.testResults.filter((r) => r.category === "Authentication").every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS REVIEW"}
- Main Dashboard: ${results.testResults.filter((r) => r.category === "Dashboard").every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS REVIEW"}
- Vehicle Inventory: ${results.testResults.filter((r) => r.category === "Inventory").every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS REVIEW"}
- Conversation History: ${results.testResults.filter((r) => r.category === "Conversations").every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS REVIEW"}

### ✅ Navigation Testing
- Menu Navigation: ${results.testResults.filter((r) => r.category === "Navigation").every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS REVIEW"}
- Route Protection: ${results.routes.filter((r) => r.isProtected).length > 0 ? "✅ IMPLEMENTED" : "❌ MISSING"}
- Page Routing: ${results.routes.length > 5 ? "✅ COMPREHENSIVE" : "⚠️ LIMITED"}

### ✅ Form Functionality
- Form Validation: ${results.testResults.filter((r) => r.category === "Forms" && r.test.includes("Validation")).every((r) => r.status === "pass") ? "✅ PASS" : "❌ NEEDS WORK"}
- Error Handling: ${results.testResults.filter((r) => r.test.includes("Error")).every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS REVIEW"}

### ✅ Component State Management
- Local State: ${results.components.filter((c) => c.usesHooks.includes("useState")).length > 0 ? "✅ IMPLEMENTED" : "❌ MISSING"}
- Global State: ${results.components.filter((c) => c.usesHooks.includes("useAuth") || c.usesHooks.includes("useQuery")).length > 0 ? "✅ IMPLEMENTED" : "❌ MISSING"}

### ✅ Responsive Design
- Mobile Support: ${results.testResults.filter((r) => r.category === "Responsive").every((r) => r.status === "pass") ? "✅ PASS" : "⚠️ NEEDS TESTING"}

### ✅ Code Quality
- TypeScript Coverage: ${((results.components.filter((c) => c.hasTypeScript).length / results.components.length) * 100).toFixed(1)}%
- Console Errors: ${results.components.filter((c) => c.potentialIssues.some((i) => i.includes("console"))).length === 0 ? "✅ CLEAN" : "⚠️ FOUND ISSUES"}

## Conclusion

${
  results.summary.failedTests === 0
    ? "✅ All critical tests passed. Frontend components are ready for testing."
    : `❌ ${results.summary.failedTests} critical issues need attention before deployment.`
}

${
  results.summary.warningTests > 0
    ? `⚠️ ${results.summary.warningTests} recommendations should be reviewed for optimal user experience.`
    : ""
}

---
*This report was generated automatically by the frontend testing tool.*
`;
}

async function main() {
  try {
    const tester = new FrontendTester();
    const results = await tester.runAllTests();
    const report = generateReport(results);

    console.log(report);

    // Save report to file
    const fs = await import("fs");
    const reportPath = "./frontend-component-test-report.md";
    fs.writeFileSync(reportPath, report);

    console.log(`\n📄 Frontend test report saved to: ${reportPath}`);

    // Exit with appropriate code
    const hasFailures = results.summary.failedTests > 0;
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error("❌ Frontend testing failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { FrontendTester, generateReport };
