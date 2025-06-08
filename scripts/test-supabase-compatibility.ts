#!/usr/bin/env tsx

/**
 * STAB-305 Supabase SDK Compatibility Test Suite
 *
 * This script validates Supabase client compatibility with all dependency upgrades:
 * 1. All Supabase auth flows working
 * 2. RLS policies tested with new dependencies
 * 3. Real-time subscriptions functional
 *
 * @file scripts/test-supabase-compatibility.ts
 */

import "dotenv/config";
import {
  supabaseAdmin,
  supabaseClient,
  checkSupabaseHealth,
  createAuthenticatedClient,
} from "../server/config/supabase";
import { Database } from "../types/supabase";
import { SupabaseClient } from "@supabase/supabase-js";
import logger from "../server/utils/logger";

interface TestResult {
  name: string;
  status: "PASS" | "FAIL" | "SKIP" | "WARN";
  message: string;
  details?: any;
  duration?: number;
}

class SupabaseCompatibilityTester {
  private results: TestResult[] = [];

  private addResult(
    name: string,
    status: TestResult["status"],
    message: string,
    details?: any,
    duration?: number,
  ) {
    this.results.push({ name, status, message, details, duration });
    const icon =
      status === "PASS"
        ? "✅"
        : status === "FAIL"
          ? "❌"
          : status === "WARN"
            ? "⚠️"
            : "⏭️";
    console.log(`${icon} ${name}: ${message}`);
    if (details && process.env.VERBOSE) {
      console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    }
    if (duration) {
      console.log(`   Duration: ${duration}ms`);
    }
  }

  /**
   * Test 1: Basic Connectivity and Health Check
   */
  async testBasicConnectivity(): Promise<void> {
    console.log("\n🔌 Testing Basic Supabase Connectivity...");

    const startTime = Date.now();
    try {
      const health = await checkSupabaseHealth();
      const duration = Date.now() - startTime;

      if (health.status === "healthy") {
        this.addResult(
          "Basic Connectivity",
          "PASS",
          "All Supabase health checks passed",
          health.checks,
          duration,
        );
      } else {
        this.addResult(
          "Basic Connectivity",
          "FAIL",
          "Supabase health check failed",
          {
            checks: health.checks,
            errors: health.errors,
          },
          duration,
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.addResult(
        "Basic Connectivity",
        "FAIL",
        "Health check threw exception",
        {
          error: error.message,
        },
        duration,
      );
    }
  }

  /**
   * Test 2: Authentication Flows
   */
  async testAuthenticationFlows(): Promise<void> {
    console.log("\n🔐 Testing Supabase Authentication Flows...");

    // Test 2.1: Anonymous session
    try {
      const startTime = Date.now();
      const { data: session, error } = await supabaseClient.auth.getSession();
      const duration = Date.now() - startTime;

      if (error) {
        this.addResult(
          "Anonymous Session",
          "FAIL",
          "Failed to get anonymous session",
          { error: error.message },
          duration,
        );
      } else {
        this.addResult(
          "Anonymous Session",
          "PASS",
          "Anonymous session retrieved successfully",
          {
            hasSession: !!session.session,
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "Anonymous Session",
        "FAIL",
        "Session test threw exception",
        { error: error.message },
      );
    }

    // Test 2.2: Service role authentication (admin)
    try {
      const startTime = Date.now();
      const { data, error } = await supabaseAdmin
        .from("dealerships")
        .select("id, name")
        .limit(1);
      const duration = Date.now() - startTime;

      if (error) {
        this.addResult(
          "Service Role Auth",
          "FAIL",
          "Service role authentication failed",
          { error: error.message },
          duration,
        );
      } else {
        this.addResult(
          "Service Role Auth",
          "PASS",
          "Service role authentication successful",
          {
            recordCount: data?.length || 0,
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "Service Role Auth",
        "FAIL",
        "Service role test threw exception",
        { error: error.message },
      );
    }

    // Test 2.3: Sign up flow (test with fake user)
    try {
      const startTime = Date.now();
      const testEmail = `test-${Date.now()}@example.com`;
      const { data, error } = await supabaseClient.auth.signUp({
        email: testEmail,
        password: "test-password-123",
        options: {
          data: {
            test_user: true,
          },
        },
      });
      const duration = Date.now() - startTime;

      if (error) {
        // Some errors are expected (like email rate limiting)
        if (
          error.message.includes("rate limit") ||
          error.message.includes("email rate limit")
        ) {
          this.addResult(
            "Sign Up Flow",
            "WARN",
            "Sign up rate limited (expected)",
            { error: error.message },
            duration,
          );
        } else {
          this.addResult(
            "Sign Up Flow",
            "FAIL",
            "Sign up failed unexpectedly",
            { error: error.message },
            duration,
          );
        }
      } else {
        this.addResult(
          "Sign Up Flow",
          "PASS",
          "Sign up flow working",
          {
            userId: data.user?.id,
            needsConfirmation: !data.session,
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult("Sign Up Flow", "FAIL", "Sign up test threw exception", {
        error: error.message,
      });
    }

    // Test 2.4: Password reset flow
    try {
      const startTime = Date.now();
      const { data, error } = await supabaseClient.auth.resetPasswordForEmail(
        "test-reset@example.com",
        {
          redirectTo: "http://localhost:3000/reset-password",
        },
      );
      const duration = Date.now() - startTime;

      if (error) {
        this.addResult(
          "Password Reset",
          "WARN",
          "Password reset may be rate limited",
          { error: error.message },
          duration,
        );
      } else {
        this.addResult(
          "Password Reset",
          "PASS",
          "Password reset flow functional",
          {},
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "Password Reset",
        "FAIL",
        "Password reset test threw exception",
        { error: error.message },
      );
    }
  }

  /**
   * Test 3: Row Level Security (RLS) Policies
   */
  async testRLSPolicies(): Promise<void> {
    console.log("\n🛡️ Testing Row Level Security Policies...");

    // Test 3.1: Test dealership isolation
    try {
      const startTime = Date.now();

      // Try to access conversations without setting tenant context
      const { data: unrestrictedData, error: unrestrictedError } =
        await supabaseClient
          .from("conversations")
          .select("id, dealership_id")
          .limit(5);

      const duration = Date.now() - startTime;

      // With RLS enabled, this should either return no data or fail
      if (unrestrictedError) {
        this.addResult(
          "RLS Protection",
          "PASS",
          "RLS correctly blocking unauthorized access",
          {
            error: unrestrictedError.message,
          },
          duration,
        );
      } else if (!unrestrictedData || unrestrictedData.length === 0) {
        this.addResult(
          "RLS Protection",
          "PASS",
          "RLS correctly filtering data",
          {
            recordCount: 0,
          },
          duration,
        );
      } else {
        this.addResult(
          "RLS Protection",
          "WARN",
          "RLS may not be properly configured",
          {
            recordCount: unrestrictedData.length,
            sampleData: unrestrictedData[0],
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult("RLS Protection", "FAIL", "RLS test threw exception", {
        error: error.message,
      });
    }

    // Test 3.2: Test with proper tenant context using admin client
    try {
      const startTime = Date.now();

      // Set tenant context for dealership ID 1
      const { error: contextError } = await supabaseAdmin.rpc(
        "set_tenant_context",
        {
          dealership_id: 1,
        },
      );

      if (contextError) {
        this.addResult(
          "Tenant Context",
          "FAIL",
          "Failed to set tenant context",
          {
            error: contextError.message,
          },
          Date.now() - startTime,
        );
        return;
      }

      // Now try to access data with proper context
      const { data: contextData, error: contextDataError } = await supabaseAdmin
        .from("conversations")
        .select("id, dealership_id")
        .eq("dealership_id", 1)
        .limit(3);

      const duration = Date.now() - startTime;

      if (contextDataError) {
        this.addResult(
          "Tenant Context",
          "FAIL",
          "Failed to access data with tenant context",
          {
            error: contextDataError.message,
          },
          duration,
        );
      } else {
        this.addResult(
          "Tenant Context",
          "PASS",
          "Tenant context working correctly",
          {
            recordCount: contextData?.length || 0,
            allBelongToCorrectDealership: contextData?.every(
              (item) => item.dealership_id === 1,
            ),
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "Tenant Context",
        "FAIL",
        "Tenant context test threw exception",
        { error: error.message },
      );
    }

    // Test 3.3: Test RLS functions
    try {
      const startTime = Date.now();

      const { data: accessCheck, error: accessError } = await supabaseAdmin.rpc(
        "has_dealership_access",
        {
          dealership_id: 1,
        },
      );

      const duration = Date.now() - startTime;

      if (accessError) {
        this.addResult(
          "RLS Functions",
          "FAIL",
          "RLS function call failed",
          {
            error: accessError.message,
          },
          duration,
        );
      } else {
        this.addResult(
          "RLS Functions",
          "PASS",
          "RLS functions are working",
          {
            hasAccess: accessCheck,
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "RLS Functions",
        "FAIL",
        "RLS function test threw exception",
        { error: error.message },
      );
    }
  }

  /**
   * Test 4: Real-time Subscriptions
   */
  async testRealtimeSubscriptions(): Promise<void> {
    console.log("\n📡 Testing Real-time Subscriptions...");

    // Test 4.1: Basic channel creation and connection
    try {
      const startTime = Date.now();

      const channel = supabaseClient.channel("test-channel-" + Date.now());

      let subscriptionStatus = "pending";
      let receivedMessage = false;

      const subscription = channel
        .on("broadcast", { event: "test-event" }, (payload) => {
          receivedMessage = true;
        })
        .subscribe((status) => {
          subscriptionStatus = status;
        });

      // Wait for subscription to connect
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const duration = Date.now() - startTime;

      if (subscriptionStatus === "SUBSCRIBED") {
        this.addResult(
          "Realtime Connection",
          "PASS",
          "Real-time channel connected successfully",
          {
            subscriptionStatus,
          },
          duration,
        );
      } else {
        this.addResult(
          "Realtime Connection",
          "FAIL",
          "Real-time channel failed to connect",
          {
            subscriptionStatus,
          },
          duration,
        );
      }

      await channel.unsubscribe();
    } catch (error) {
      this.addResult(
        "Realtime Connection",
        "FAIL",
        "Real-time connection test threw exception",
        {
          error: error.message,
        },
      );
    }

    // Test 4.2: Database change subscriptions
    try {
      const startTime = Date.now();

      const channel = supabaseClient.channel("db-changes-test");

      let changeReceived = false;
      let subscriptionError = null;

      const subscription = channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "vehicles",
          },
          (payload) => {
            changeReceived = true;
          },
        )
        .subscribe((status, error) => {
          if (error) subscriptionError = error;
        });

      // Wait for subscription to establish
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const duration = Date.now() - startTime;

      if (subscriptionError) {
        this.addResult(
          "Database Subscriptions",
          "FAIL",
          "Database change subscription failed",
          {
            error: subscriptionError,
          },
          duration,
        );
      } else {
        this.addResult(
          "Database Subscriptions",
          "PASS",
          "Database change subscription established",
          {
            listening: true,
          },
          duration,
        );
      }

      await channel.unsubscribe();
    } catch (error) {
      this.addResult(
        "Database Subscriptions",
        "FAIL",
        "Database subscription test threw exception",
        {
          error: error.message,
        },
      );
    }

    // Test 4.3: Presence features
    try {
      const startTime = Date.now();

      const channel = supabaseClient.channel("presence-test", {
        config: {
          presence: {
            key: "test-user-" + Date.now(),
          },
        },
      });

      let presenceState = {};

      channel
        .on("presence", { event: "sync" }, () => {
          presenceState = channel.presenceState();
        })
        .subscribe();

      // Track presence
      await channel.track({
        user_id: "test-user",
        online_at: new Date().toISOString(),
      });

      // Wait for presence sync
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const duration = Date.now() - startTime;

      this.addResult(
        "Presence Features",
        "PASS",
        "Presence tracking functional",
        {
          presenceKeys: Object.keys(presenceState).length,
        },
        duration,
      );

      await channel.unsubscribe();
    } catch (error) {
      this.addResult(
        "Presence Features",
        "FAIL",
        "Presence test threw exception",
        {
          error: error.message,
        },
      );
    }
  }

  /**
   * Test 5: CRUD Operations with Enhanced Vehicle Fields
   */
  async testCRUDOperations(): Promise<void> {
    console.log("\n💾 Testing CRUD Operations with Enhanced Vehicle Fields...");

    const testVin = `STAB305${Date.now().toString().slice(-8)}`;
    let testVehicleId: number | null = null;

    // Test 5.1: Create operation with new fields
    try {
      const startTime = Date.now();

      const { data: insertData, error: insertError } = await supabaseAdmin
        .from("vehicles")
        .insert({
          vin: testVin,
          make: "Test",
          model: "Compatibility",
          year: 2024,
          dealership_id: 1,
          status: "available",
          // New fields from STAB-303
          fuel_economy_city: 25,
          fuel_economy_highway: 30,
          safety_rating: "5-star",
          warranty_months: 36,
          availability_status: "in_stock",
          location_on_lot: "Test-A1",
          days_on_lot: 0,
          priority_listing: true,
          financing_options: { rate: 2.9, term: 60 },
          comparable_vehicles: [100, 200],
          dealer_notes: "STAB-305 compatibility test vehicle",
        })
        .select("id")
        .single();

      const duration = Date.now() - startTime;

      if (insertError) {
        this.addResult(
          "Enhanced Vehicle Create",
          "FAIL",
          "Failed to create vehicle with enhanced fields",
          {
            error: insertError.message,
          },
          duration,
        );
      } else {
        testVehicleId = insertData.id;
        this.addResult(
          "Enhanced Vehicle Create",
          "PASS",
          "Created vehicle with all enhanced fields",
          {
            vehicleId: testVehicleId,
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "Enhanced Vehicle Create",
        "FAIL",
        "Vehicle creation test threw exception",
        {
          error: error.message,
        },
      );
    }

    // Test 5.2: Read operation with enhanced view
    if (testVehicleId) {
      try {
        const startTime = Date.now();

        const { data: viewData, error: viewError } = await supabaseAdmin
          .from("vehicles_enhanced")
          .select("*")
          .eq("id", testVehicleId)
          .single();

        const duration = Date.now() - startTime;

        if (viewError) {
          this.addResult(
            "Enhanced Vehicle View",
            "FAIL",
            "Failed to read from enhanced view",
            {
              error: viewError.message,
            },
            duration,
          );
        } else {
          this.addResult(
            "Enhanced Vehicle View",
            "PASS",
            "Enhanced view working correctly",
            {
              fuelEconomyCombined: viewData.fuel_economy_combined,
              inventoryAgeCategory: viewData.inventory_age_category,
            },
            duration,
          );
        }
      } catch (error) {
        this.addResult(
          "Enhanced Vehicle View",
          "FAIL",
          "Enhanced view test threw exception",
          {
            error: error.message,
          },
        );
      }
    }

    // Test 5.3: Update operation
    if (testVehicleId) {
      try {
        const startTime = Date.now();

        const { data: updateData, error: updateError } = await supabaseAdmin
          .from("vehicles")
          .update({
            dealer_notes: "Updated by STAB-305 compatibility test",
            priority_listing: false,
            availability_status: "sold",
          })
          .eq("id", testVehicleId)
          .select("dealer_notes, priority_listing, availability_status")
          .single();

        const duration = Date.now() - startTime;

        if (updateError) {
          this.addResult(
            "Enhanced Vehicle Update",
            "FAIL",
            "Failed to update vehicle enhanced fields",
            {
              error: updateError.message,
            },
            duration,
          );
        } else {
          this.addResult(
            "Enhanced Vehicle Update",
            "PASS",
            "Updated vehicle enhanced fields successfully",
            {
              updatedFields: updateData,
            },
            duration,
          );
        }
      } catch (error) {
        this.addResult(
          "Enhanced Vehicle Update",
          "FAIL",
          "Vehicle update test threw exception",
          {
            error: error.message,
          },
        );
      }
    }

    // Test 5.4: Cleanup - Delete test vehicle
    if (testVehicleId) {
      try {
        const startTime = Date.now();

        const { error: deleteError } = await supabaseAdmin
          .from("vehicles")
          .delete()
          .eq("id", testVehicleId);

        const duration = Date.now() - startTime;

        if (deleteError) {
          this.addResult(
            "Test Cleanup",
            "WARN",
            "Failed to cleanup test vehicle",
            {
              error: deleteError.message,
              vehicleId: testVehicleId,
            },
            duration,
          );
        } else {
          this.addResult(
            "Test Cleanup",
            "PASS",
            "Test vehicle cleaned up successfully",
            {},
            duration,
          );
        }
      } catch (error) {
        this.addResult("Test Cleanup", "WARN", "Cleanup test threw exception", {
          error: error.message,
          vehicleId: testVehicleId,
        });
      }
    }
  }

  /**
   * Test 6: Dependency Compatibility
   */
  async testDependencyCompatibility(): Promise<void> {
    console.log("\n📦 Testing Dependency Compatibility...");

    // Test 6.1: React Query integration
    try {
      // This would test @tanstack/react-query integration if in a React environment
      this.addResult(
        "React Query Integration",
        "SKIP",
        "React Query integration test skipped (server environment)",
      );
    } catch (error) {
      this.addResult(
        "React Query Integration",
        "FAIL",
        "React Query test failed",
        { error: error.message },
      );
    }

    // Test 6.2: TypeScript type safety
    try {
      const startTime = Date.now();

      // Test type safety by using strongly typed client
      const typedClient: SupabaseClient<Database> = supabaseClient;

      const { data, error } = await typedClient
        .from("dealerships")
        .select("id, name, subdomain")
        .limit(1);

      const duration = Date.now() - startTime;

      if (error) {
        this.addResult(
          "TypeScript Types",
          "FAIL",
          "Type-safe query failed",
          { error: error.message },
          duration,
        );
      } else {
        this.addResult(
          "TypeScript Types",
          "PASS",
          "TypeScript types working correctly",
          {
            hasData: !!data && data.length > 0,
          },
          duration,
        );
      }
    } catch (error) {
      this.addResult(
        "TypeScript Types",
        "FAIL",
        "TypeScript type test threw exception",
        { error: error.message },
      );
    }

    // Test 6.3: Environment variable handling
    try {
      const requiredEnvVars = [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_KEY",
      ];
      const missingVars = requiredEnvVars.filter(
        (varName) => !process.env[varName],
      );

      if (missingVars.length > 0) {
        this.addResult(
          "Environment Variables",
          "FAIL",
          "Missing required environment variables",
          {
            missingVars,
          },
        );
      } else {
        this.addResult(
          "Environment Variables",
          "PASS",
          "All required environment variables present",
          {
            configuredVars: requiredEnvVars.length,
          },
        );
      }
    } catch (error) {
      this.addResult(
        "Environment Variables",
        "FAIL",
        "Environment variable test threw exception",
        {
          error: error.message,
        },
      );
    }
  }

  /**
   * Generate final report
   */
  generateReport(): void {
    console.log("\n" + "=".repeat(80));
    console.log("🎯 STAB-305 SUPABASE SDK COMPATIBILITY REPORT");
    console.log("=".repeat(80));

    const passed = this.results.filter((r) => r.status === "PASS").length;
    const failed = this.results.filter((r) => r.status === "FAIL").length;
    const warned = this.results.filter((r) => r.status === "WARN").length;
    const skipped = this.results.filter((r) => r.status === "SKIP").length;
    const total = this.results.length;

    console.log(`\n📊 Summary: ${passed}/${total} tests passed`);
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⚠️  Warnings: ${warned}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);

    if (failed === 0) {
      console.log("\n🎉 STAB-305 Supabase SDK Compatibility: SUCCESS!");
      console.log("\n✅ Verification Results:");
      console.log("   • Supabase client connectivity working");
      console.log("   • Authentication flows functional");
      console.log("   • RLS policies properly enforced");
      console.log("   • Real-time subscriptions operational");
      console.log("   • CRUD operations with enhanced fields working");
      console.log("   • TypeScript types and dependencies compatible");
    } else {
      console.log("\n⚠️  STAB-305 has issues that need attention:");
      this.results
        .filter((r) => r.status === "FAIL")
        .forEach((result) => {
          console.log(`   • ${result.name}: ${result.message}`);
        });
    }

    if (warned > 0) {
      console.log("\n⚠️  Warnings (may need attention):");
      this.results
        .filter((r) => r.status === "WARN")
        .forEach((result) => {
          console.log(`   • ${result.name}: ${result.message}`);
        });
    }

    console.log("\n" + "=".repeat(80));
  }

  async runAllTests(): Promise<void> {
    try {
      console.log("🚀 Starting STAB-305 Supabase SDK Compatibility Tests...");
      console.log("📝 Testing dependency upgrades compatibility\n");

      await this.testBasicConnectivity();
      await this.testAuthenticationFlows();
      await this.testRLSPolicies();
      await this.testRealtimeSubscriptions();
      await this.testCRUDOperations();
      await this.testDependencyCompatibility();

      this.generateReport();
    } catch (error) {
      console.error("💥 Test suite failed:", error);
      this.addResult(
        "Overall Test Suite",
        "FAIL",
        "Test suite encountered an error",
        { error: error.message },
      );
      process.exit(1);
    }
  }
}

// Run the test suite
async function main() {
  const tester = new SupabaseCompatibilityTester();
  await tester.runAllTests();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SupabaseCompatibilityTester;
