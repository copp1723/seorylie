#!/usr/bin/env tsx

/**
 * Simple ADF Parser Test Script
 *
 * Tests the ADF parser directly to isolate issues
 */

import { AdfParser } from "../server/services/adf-parser";

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

async function testAdfParser() {
  console.log("🧪 Testing ADF Parser directly...\n");

  try {
    const parser = new AdfParser();
    console.log("✅ ADF Parser instantiated successfully");

    const result = await parser.parseAdfXml(SAMPLE_ADF_XML);
    console.log("✅ ADF XML parsed successfully");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ ADF Parser test failed:");
    console.error(error);
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAdfParser().catch(console.error);
}

export { testAdfParser };
