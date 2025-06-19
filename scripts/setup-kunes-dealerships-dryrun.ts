#!/usr/bin/env tsx

/**
 * Kunes RV Dealership Data Setup Script - DRY RUN VERSION
 *
 * This script shows what would be created without actually touching the database.
 * Use this to validate the data structure before running the real setup.
 */

interface KunesLocation {
  name: string;
  address: string;
  phone: string;
  website: string;
  adfEmail: string;
  personaName: string;
}

const kunesLocations: KunesLocation[] = [
  {
    name: "Kunes RV of Fox Valley",
    address: "2615 W American Dr, Neenah, WI 54956",
    phone: "(920) 274-2102",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-fox-valley",
    adfEmail: "crm_kunes-rv-fox-valley@localwerksmail.com",
    personaName: "Kelsey Brunner",
  },
  {
    name: "Kunes Freedom RV",
    address: "825 Addison Rd, Slinger, WI 53086",
    phone: "(262) 276-4541",
    website: "https://kunesrv.com/locations?dealer=kunes-freedom-rv",
    adfEmail: "crm_kunes-rv-freedom@localwerksmail.com",
    personaName: "Brianna Meyer",
  },
  {
    name: "Kunes RV of Elkhorn",
    address: "9 Deere Rd, Elkhorn, WI 53121",
    phone: "(262) 276-4530",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-elkhorn",
    adfEmail: "crm_kunes-rv-elkhorn@localwerksmail.com",
    personaName: "Courtney Carlson",
  },
  {
    name: "Kunes RV of Frankfort",
    address: "20450 LaGrange Rd, Frankfort, IL 60423",
    phone: "(815) 464-7510",
    website: "https://www.terrysrv.net/",
    adfEmail: "crm_kunes-rv-frankfort@localwerksmail.com",
    personaName: "Alyssa Wozniak",
  },
  {
    name: "Kunes RV of Green Bay",
    address: "1751 Wildwood Dr, Suamico, WI 54173",
    phone: "(920) 238-8286",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-green-bay",
    adfEmail: "crm_kunes-rv-green-bay@localwerksmail.com",
    personaName: "Sydney Hoffmann",
  },
  {
    name: "Kunes RV of LaCrosse",
    address: "306 N Holmen Dr, Holmen, WI 54636",
    phone: "(608) 390-1272",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-lacrosse",
    adfEmail: "crm_kunes-rv-lacrosse@localwerksmail.com",
    personaName: "Rachel Schroeder",
  },
  {
    name: "Kunes RV Lake Mills",
    address: "County Road V, W7419 E Tyranena Park Rd, Lake Mills, WI 53551",
    phone: "(920) 274-2114",
    website: "https://kunesrv.com/locations/kunes-rv-of-lake-mills",
    adfEmail: "crm_kunes-rv-lake-mills@localwerksmail.com",
    personaName: "Emily Krueger",
  },
  {
    name: "Kunes RV Super Center",
    address: "8120 Frontage Rd, Sheboygan, WI 53081",
    phone: "(920) 274-2123",
    website:
      "https://kunesrv.com/locations?dealer=kunes-rv-of-sheboygan---south",
    adfEmail: "crm_kunes-rv-sheboygan-south@localwerksmail.com",
    personaName: "Natalie Becker",
  },
  {
    name: "Kunes RV of Sterling",
    address: "2502 Locust St, Sterling, IL 61081",
    phone: "(815) 301-0913",
    website: "https://kunesrv.com/locations?dealer=kunes-rv-of-sterling",
    adfEmail: "crm_kunes-rv-sterling@localwerksmail.com",
    personaName: "Taylor Lindgren",
  },
  {
    name: "Kunes Wisconsin RV World",
    address: "5920 Haase Rd, DeForest, Wisconsin 53532",
    phone: "(608) 396-4836",
    website: "https://kunesrv.com/locations?dealer=kunes-wisconsin-rv-world",
    adfEmail: "crm_kunes-rv-madison@localwerksmail.com",
    personaName: "Lauren Novak",
  },
  {
    name: "Kunes RV Wisconsin Rapids",
    address: "8410 State Hwy 13, Wisconsin Rapids, WI 54494",
    phone: "(715) 230-0164",
    website: "https://kunesrv.com/locations?dealer=kunes-rapids-rv",
    adfEmail: "crm_kunes-rv-wisconsin-rapids@localwerksmail.com",
    personaName: "Madison Thompson",
  },
];

function parseAddress(fullAddress: string) {
  // Extract city, state, zip from address string
  const addressParts = fullAddress.split(",").map((part) => part.trim());

  if (addressParts.length >= 3) {
    const streetAddress = addressParts.slice(0, -2).join(", ");
    const cityState = addressParts[addressParts.length - 2];
    const stateZip = addressParts[addressParts.length - 1];

    // Extract state and zip from "STATE ZIP" format
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(\d{5})$/);

    return {
      address: streetAddress,
      city: cityState,
      state: stateZipMatch ? stateZipMatch[1] : "WI",
      zip: stateZipMatch ? stateZipMatch[2] : "",
      country: "USA",
    };
  }

  // Fallback if parsing fails
  return {
    address: fullAddress,
    city: "",
    state: "WI",
    zip: "",
    country: "USA",
  };
}

function generateSubdomain(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple consecutive hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading and trailing hyphens
}

async function dryRunKunesSetup() {
  console.log("🧪 DRY RUN: Kunes RV Dealership Setup Preview\n");
  console.log(
    "This shows what would be created without touching the database.\n",
  );

  console.log("📊 Summary:");
  console.log(`   Total locations: ${kunesLocations.length}`);
  console.log(`   States covered: Wisconsin (WI), Illinois (IL)`);
  console.log(`   Business type: RV Dealership\n`);

  kunesLocations.forEach((location, index) => {
    console.log(`${index + 1}. 🏢 ${location.name}`);

    const addressInfo = parseAddress(location.address);
    const subdomain = generateSubdomain(location.name);

    console.log(`   📍 Address: ${addressInfo.address}`);
    console.log(
      `   🏙️  Location: ${addressInfo.city}, ${addressInfo.state} ${addressInfo.zip}`,
    );
    console.log(`   📞 Phone: ${location.phone}`);
    console.log(`   🌐 Website: ${location.website}`);
    console.log(`   📧 ADF Email: ${location.adfEmail}`);
    console.log(`   👤 Persona: ${location.personaName}`);
    console.log(`   🔗 Subdomain: ${subdomain}`);
    console.log(`   🕐 Timezone: America/Chicago`);

    // Preview of database records that would be created
    console.log("   📝 Database Record Preview:");
    console.log("      Dealership:");
    console.log(`         name: "${location.name}"`);
    console.log(`         subdomain: "${subdomain}"`);
    console.log(`         contactEmail: "${location.adfEmail}"`);
    console.log(`         contactPhone: "${location.phone}"`);
    console.log(`         address: "${addressInfo.address}"`);
    console.log(`         city: "${addressInfo.city}"`);
    console.log(`         state: "${addressInfo.state}"`);
    console.log(`         zip: "${addressInfo.zip}"`);
    console.log(`         timezone: "America/Chicago"`);
    console.log("         settings: {");
    console.log(`           website: "${location.website}",`);
    console.log(`           adfEmail: "${location.adfEmail}",`);
    console.log('           businessType: "RV Dealership",');
    console.log('           brand: "Kunes RV",');
    console.log(`           primaryPersona: "${location.personaName}"`);
    console.log("         }");

    console.log("      Persona:");
    console.log(`         name: "${location.personaName}"`);
    console.log('         role: "Sales Associate"');
    console.log(
      `         personality: "Friendly and knowledgeable RV sales associate at ${location.name}..."`,
    );
    console.log(
      `         systemPrompt: "You are ${location.personaName}, a sales associate at ${location.name}..."`,
    );

    console.log("");
  });

  // Validation checks
  console.log("🔍 Validation Checks:");

  // Check for duplicate ADF emails
  const emailCounts = new Map();
  kunesLocations.forEach((location) => {
    const email = location.adfEmail;
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
  });

  const duplicateEmails = Array.from(emailCounts.entries()).filter(
    ([email, count]) => count > 1,
  );
  if (duplicateEmails.length > 0) {
    console.log("   ⚠️  Duplicate ADF emails found:");
    duplicateEmails.forEach(([email, count]) => {
      console.log(`      - ${email}: used by ${count} dealerships`);
    });
  } else {
    console.log("   ✅ All ADF emails are unique");
  }

  // Check for duplicate persona names
  const personaCounts = new Map();
  kunesLocations.forEach((location) => {
    const persona = location.personaName;
    personaCounts.set(persona, (personaCounts.get(persona) || 0) + 1);
  });

  const duplicatePersonas = Array.from(personaCounts.entries()).filter(
    ([persona, count]) => count > 1,
  );
  if (duplicatePersonas.length > 0) {
    console.log("   ⚠️  Duplicate persona names found:");
    duplicatePersonas.forEach(([persona, count]) => {
      console.log(`      - ${persona}: used by ${count} dealerships`);
    });
  } else {
    console.log("   ✅ All persona names are unique");
  }

  // Check ADF email format
  const invalidEmails = kunesLocations.filter(
    (location) => !location.adfEmail.includes("@localwerksmail.com"),
  );
  if (invalidEmails.length > 0) {
    console.log("   ⚠️  Invalid ADF email formats:");
    invalidEmails.forEach((location) => {
      console.log(`      - ${location.name}: ${location.adfEmail}`);
    });
  } else {
    console.log("   ✅ All ADF emails follow proper format");
  }

  console.log("\n🚀 Next Steps:");
  console.log("   1. Review the data above for accuracy");
  console.log("   2. Ensure database is available and configured");
  console.log("   3. Run the actual setup: npm run setup:kunes");
  console.log("   4. Validate the setup: npm run test:kunes");

  console.log("\n📋 CSV Preview for Spreadsheet:");
  console.log("Name,Address,Phone,Website,ADF Email,Persona");
  kunesLocations.forEach((location) => {
    console.log(
      `"${location.name}","${location.address}","${location.phone}","${location.website}","${location.adfEmail}","${location.personaName}"`,
    );
  });
}

// Run the dry run
dryRunKunesSetup()
  .then(() => {
    console.log("\n✅ Dry run completed successfully");
  })
  .catch((error) => {
    console.error("❌ Dry run failed:", error);
    process.exit(1);
  });
