#!/usr/bin/env tsx

import { config } from "dotenv";
import { db } from "../server/db";
import { dealerships, personas, users } from "../shared/schema";
import { like, eq, and } from "drizzle-orm";

// Load environment variables
config();

/**
 * Test and validate Kunes RV dealership setup
 *
 * This script verifies that all Kunes dealerships are properly configured
 * and tests the ADF email routing functionality.
 */

async function testKunesSetup() {
  try {
    console.log("🧪 Testing Kunes RV Dealership Setup...\n");

    // 1. Check all Kunes dealerships
    console.log("📋 Checking Kunes dealerships in database...");
    const kunesDealerships = await db
      .select()
      .from(dealerships)
      .where(like(dealerships.name, "%Kunes%"));

    console.log(`✅ Found ${kunesDealerships.length} Kunes dealerships\n`);

    if (kunesDealerships.length === 0) {
      console.log(
        "❌ No Kunes dealerships found. Run setup-kunes-dealerships.ts first.",
      );
      return;
    }

    // 2. Validate each dealership
    let validationErrors = 0;
    const expectedCount = 11; // We expect 11 Kunes locations

    for (const dealership of kunesDealerships) {
      console.log(`🏢 ${dealership.name}`);

      // Check required fields
      const validations = [
        { field: "subdomain", value: dealership.subdomain, required: true },
        {
          field: "contactEmail",
          value: dealership.contactEmail,
          required: true,
        },
        {
          field: "contactPhone",
          value: dealership.contactPhone,
          required: true,
        },
        { field: "address", value: dealership.address, required: true },
        { field: "city", value: dealership.city, required: true },
        { field: "state", value: dealership.state, required: true },
        { field: "zip", value: dealership.zip, required: true },
      ];

      for (const validation of validations) {
        if (
          validation.required &&
          (!validation.value || validation.value.trim() === "")
        ) {
          console.log(`   ❌ Missing ${validation.field}`);
          validationErrors++;
        } else {
          console.log(`   ✅ ${validation.field}: ${validation.value}`);
        }
      }

      // Check ADF email format
      const adfEmail = dealership.contactEmail;
      if (adfEmail && adfEmail.includes("@localwerksmail.com")) {
        console.log(`   ✅ ADF Email: ${adfEmail}`);
      } else {
        console.log(`   ❌ Invalid ADF email format: ${adfEmail}`);
        validationErrors++;
      }

      // Check settings
      if (dealership.settings) {
        const settings = dealership.settings as any;
        console.log(`   ✅ Website: ${settings.website || "Not set"}`);
        console.log(
          `   ✅ Primary Persona: ${settings.primaryPersona || "Not set"}`,
        );
      }

      console.log("");
    }

    // 3. Check personas
    console.log("👤 Checking Kunes personas...");
    const kunesPersonas = await db
      .select({
        name: personas.name,
        role: personas.role,
        dealershipName: dealerships.name,
        isActive: personas.isActive,
      })
      .from(personas)
      .leftJoin(dealerships, eq(personas.dealershipId, dealerships.id))
      .where(like(dealerships.name, "%Kunes%"));

    console.log(`✅ Found ${kunesPersonas.length} Kunes personas\n`);

    kunesPersonas.forEach((persona) => {
      console.log(
        `   👤 ${persona.name} - ${persona.role} at ${persona.dealershipName} (${persona.isActive ? "Active" : "Inactive"})`,
      );
    });

    // 4. Test ADF email routing mapping
    console.log("\n📧 ADF Email Routing Test...");
    const adfEmailMap = new Map();

    kunesDealerships.forEach((dealership) => {
      if (dealership.contactEmail) {
        adfEmailMap.set(dealership.contactEmail, dealership.name);
      }
    });

    console.log(`✅ ${adfEmailMap.size} unique ADF email addresses mapped`);

    // Check for duplicates
    const emailCounts = new Map();
    kunesDealerships.forEach((dealership) => {
      const email = dealership.contactEmail;
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    });

    const duplicateEmails = Array.from(emailCounts.entries()).filter(
      ([email, count]) => count > 1,
    );
    if (duplicateEmails.length > 0) {
      console.log("⚠️  Duplicate ADF emails found:");
      duplicateEmails.forEach(([email, count]) => {
        console.log(`   - ${email}: used by ${count} dealerships`);
      });
      validationErrors += duplicateEmails.length;
    }

    // 5. Generate summary report
    console.log("\n📊 Setup Validation Summary");
    console.log("============================");
    console.log(
      `Total Kunes dealerships: ${kunesDealerships.length}/${expectedCount}`,
    );
    console.log(`Total personas created: ${kunesPersonas.length}`);
    console.log(`Validation errors: ${validationErrors}`);

    if (kunesDealerships.length === expectedCount && validationErrors === 0) {
      console.log("🎉 All Kunes dealerships are properly configured!");

      // 6. Generate CSV report for verification
      console.log("\n📄 Generating verification report...");
      const csvData = kunesDealerships.map((dealership) => {
        const settings = (dealership.settings as any) || {};
        return {
          name: dealership.name,
          subdomain: dealership.subdomain,
          address: `"${dealership.address}, ${dealership.city}, ${dealership.state} ${dealership.zip}"`,
          phone: dealership.contactPhone,
          website: settings.website || "",
          adfEmail: dealership.contactEmail,
          persona: settings.primaryPersona || "",
          isActive: dealership.isActive ? "Yes" : "No",
        };
      });

      console.log("\nCSV Report (copy to spreadsheet):");
      console.log(
        "Name,Subdomain,Address,Phone,Website,ADF Email,Persona,Active",
      );
      csvData.forEach((row) => {
        console.log(
          `"${row.name}","${row.subdomain}",${row.address},"${row.phone}","${row.website}","${row.adfEmail}","${row.persona}","${row.isActive}"`,
        );
      });
    } else {
      console.log(
        "❌ Setup validation failed. Please review and fix the errors above.",
      );
      if (kunesDealerships.length !== expectedCount) {
        console.log(
          `   Expected ${expectedCount} dealerships, found ${kunesDealerships.length}`,
        );
      }
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error testing Kunes setup:", error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testKunesSetup()
    .then(() => {
      console.log("\n✅ Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Test failed:", error);
      process.exit(1);
    });
}

export { testKunesSetup };
