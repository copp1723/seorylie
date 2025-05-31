#!/usr/bin/env ts-node
/**
 * ADF Test Fixtures Validation Script
 * 
 * This script validates all test fixtures to ensure they are valid, complete,
 * and suitable for testing purposes. It checks XML schema compliance, data quality,
 * coverage of test scenarios, and performance characteristics.
 * 
 * Usage: npm run test:fixtures [options]
 * Options:
 *   --report-file=<path>  Output detailed report to specified file
 *   --fix                 Attempt to fix common issues in fixtures
 *   --verbose             Show detailed validation output
 *   --ci                  CI mode with structured output and exit code
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { performance } from 'perf_hooks';
import colors from 'colors/safe';
import { adfParser } from '../../server/services/adf-parser';
import { z } from 'zod';
import crypto from 'crypto';

// Promisify fs functions
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);
const stat = promisify(fs.stat);

// Configuration
const FIXTURES_DIR = path.join(__dirname, '../fixtures');
const ADF_FIXTURES_DIR = path.join(FIXTURES_DIR, 'adf');
const MOCK_DATA_DIR = path.join(FIXTURES_DIR, 'mock-data');
const PERFORMANCE_THRESHOLD_MS = 100; // Maximum time for parsing a fixture
const REPORT_DIR = path.join(__dirname, '../../reports');
const PII_PATTERNS = [
  /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/, // SSN
  /\b(?:\d[ -]*?){13,16}\b/, // Credit card
  /\b[A-Za-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook|aol|icloud)\.[A-Za-z]{2,}\b/, // Real email domains
  /\b(?:\+1[ -]?)?(?:\([0-9]{3}\)[ -]?|[0-9]{3}[ -]?)[0-9]{3}[ -]?[0-9]{4}\b/, // Phone numbers
];

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  reportFile: args.find(arg => arg.startsWith('--report-file='))?.split('=')[1],
  fix: args.includes('--fix'),
  verbose: args.includes('--verbose'),
  ci: args.includes('--ci'),
};

// Schema definitions for fixture validation
const fixtureMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  type: z.enum(['adf', 'email', 'sms', 'response', 'handover', 'intent']),
  tags: z.array(z.string()).optional(),
  scenarios: z.array(z.string()),
  performance: z.object({
    expectedParseTimeMs: z.number().optional(),
    complexity: z.enum(['simple', 'medium', 'complex']).optional(),
  }).optional(),
  edgeCases: z.array(z.string()).optional(),
  mockData: z.boolean().default(true),
  version: z.string().optional(),
});

// Statistics and results
const stats = {
  total: 0,
  valid: 0,
  invalid: 0,
  fixed: 0,
  warnings: 0,
  byType: {} as Record<string, { total: number, valid: number, invalid: number }>,
  performance: {
    min: Number.MAX_SAFE_INTEGER,
    max: 0,
    avg: 0,
    total: 0,
  },
  coverage: {
    scenarios: new Set<string>(),
    edgeCases: new Set<string>(),
    missingScenarios: [] as string[],
  },
  piiDetections: 0,
};

// Required test scenarios that must be covered by fixtures
const requiredScenarios = [
  'valid_lead',
  'invalid_lead',
  'duplicate_lead',
  'missing_customer',
  'missing_vehicle',
  'multiple_vehicles',
  'special_characters',
  'minimal_data',
  'maximal_data',
  'purchase_intent',
  'test_drive_request',
  'financing_question',
  'international_phone',
  'opt_out_request',
];

// Required edge cases
const requiredEdgeCases = [
  'empty_fields',
  'extremely_long_values',
  'unicode_characters',
  'malformed_xml',
  'invalid_dates',
  'missing_required_fields',
  'extra_fields',
  'nested_cdata',
  'zero_values',
  'negative_values',
];

/**
 * Main validation function
 */
async function validateFixtures() {
  try {
    console.log(colors.cyan('🔍 ADF Test Fixtures Validation'));
    console.log(colors.cyan('=============================='));

    // Create report directory if it doesn't exist
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    // Ensure fixtures directories exist
    if (!fs.existsSync(FIXTURES_DIR)) {
      throw new Error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    }
    
    // Create ADF fixtures directory if it doesn't exist
    if (!fs.existsSync(ADF_FIXTURES_DIR)) {
      fs.mkdirSync(ADF_FIXTURES_DIR, { recursive: true });
      console.log(colors.yellow(`Created missing ADF fixtures directory: ${ADF_FIXTURES_DIR}`));
    }

    // Create mock data directory if it doesn't exist
    if (!fs.existsSync(MOCK_DATA_DIR)) {
      fs.mkdirSync(MOCK_DATA_DIR, { recursive: true });
      console.log(colors.yellow(`Created missing mock data directory: ${MOCK_DATA_DIR}`));
    }

    // Validate ADF fixtures
    await validateAdfFixtures();

    // Validate fixture coverage
    validateCoverage();

    // Generate report
    await generateReport();

    // Print summary
    printSummary();

    // Exit with appropriate code in CI mode
    if (options.ci && stats.invalid > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(colors.red(`❌ Error: ${error instanceof Error ? error.message : String(error)}`));
    if (options.ci) {
      process.exit(1);
    }
  }
}

/**
 * Validate all ADF XML fixtures
 */
async function validateAdfFixtures() {
  console.log(colors.cyan('\n📋 Validating ADF XML Fixtures...'));
  
  try {
    const files = await readdir(ADF_FIXTURES_DIR);
    const xmlFiles = files.filter(file => file.endsWith('.xml'));
    
    if (xmlFiles.length === 0) {
      console.log(colors.yellow('⚠️ No ADF XML fixtures found'));
      stats.warnings++;
      return;
    }

    // Initialize stats for ADF type
    stats.byType['adf'] = { total: 0, valid: 0, invalid: 0 };
    
    // Process each XML file
    for (const file of xmlFiles) {
      const filePath = path.join(ADF_FIXTURES_DIR, file);
      await validateAdfXmlFile(filePath);
    }
    
    console.log(colors.green(`✅ Validated ${xmlFiles.length} ADF XML fixtures`));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(colors.yellow('⚠️ ADF fixtures directory not found'));
      stats.warnings++;
    } else {
      throw error;
    }
  }
}

/**
 * Validate a single ADF XML file
 */
async function validateAdfXmlFile(filePath: string) {
  const fileName = path.basename(filePath);
  const startTime = performance.now();
  
  try {
    // Read file content
    const xmlContent = await readFile(filePath, 'utf8');
    stats.total++;
    stats.byType['adf'].total++;
    
    // Validate XML structure
    const xmlValidationResult = XMLValidator.validate(xmlContent);
    if (xmlValidationResult !== true) {
      const error = xmlValidationResult as { err: { code: string, msg: string, line: number } };
      throw new Error(`Invalid XML: ${error.err.msg} at line ${error.err.line}`);
    }
    
    // Parse XML
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsedXml = parser.parse(xmlContent);
    
    // Check for ADF structure
    if (!parsedXml.adf) {
      throw new Error('Missing root <adf> element');
    }
    
    // Try parsing with ADF parser
    const adfParseResult = await adfParser.parseAdfXml(xmlContent);
    if (!adfParseResult.success) {
      throw new Error(`ADF parsing failed: ${adfParseResult.error}`);
    }
    
    // Check for PII
    const piiResults = checkForPII(xmlContent);
    if (piiResults.detected) {
      console.log(colors.yellow(`⚠️ ${fileName}: Possible PII detected: ${piiResults.matches.join(', ')}`));
      stats.piiDetections++;
      stats.warnings++;
    }
    
    // Check for metadata file
    const metadataPath = filePath.replace('.xml', '.meta.json');
    await validateFixtureMetadata(metadataPath, fileName);
    
    // Measure performance
    const endTime = performance.now();
    const parseTime = endTime - startTime;
    
    // Update performance stats
    stats.performance.total += parseTime;
    stats.performance.min = Math.min(stats.performance.min, parseTime);
    stats.performance.max = Math.max(stats.performance.max, parseTime);
    
    // Check if performance is within threshold
    if (parseTime > PERFORMANCE_THRESHOLD_MS) {
      console.log(colors.yellow(`⚠️ ${fileName}: Slow parsing (${parseTime.toFixed(2)}ms > ${PERFORMANCE_THRESHOLD_MS}ms threshold)`));
      stats.warnings++;
    }
    
    // Success
    stats.valid++;
    stats.byType['adf'].valid++;
    
    if (options.verbose) {
      console.log(colors.green(`✅ ${fileName}: Valid ADF XML (${parseTime.toFixed(2)}ms)`));
    }
  } catch (error) {
    stats.invalid++;
    stats.byType['adf'].invalid++;
    console.log(colors.red(`❌ ${fileName}: ${error.message}`));
    
    // Attempt to fix if enabled
    if (options.fix) {
      const fixed = await attemptToFixXml(filePath);
      if (fixed) {
        stats.fixed++;
        console.log(colors.green(`🔧 ${fileName}: Fixed common issues`));
      }
    }
  }
}

/**
 * Validate fixture metadata file
 */
async function validateFixtureMetadata(metadataPath: string, originalFileName: string) {
  try {
    // Check if metadata file exists
    if (!fs.existsSync(metadataPath)) {
      if (options.fix) {
        // Create default metadata
        const defaultMetadata = {
          name: originalFileName.replace('.xml', ''),
          description: `Test fixture for ${originalFileName}`,
          type: 'adf',
          scenarios: ['valid_lead'],
          performance: {
            expectedParseTimeMs: 50,
            complexity: 'medium'
          },
          mockData: true,
          version: '1.0'
        };
        
        await writeFile(metadataPath, JSON.stringify(defaultMetadata, null, 2));
        console.log(colors.yellow(`⚠️ Created missing metadata file: ${path.basename(metadataPath)}`));
        stats.warnings++;
        stats.fixed++;
        
        // Add scenarios to coverage
        defaultMetadata.scenarios.forEach(scenario => {
          stats.coverage.scenarios.add(scenario);
        });
        
        return;
      } else {
        console.log(colors.yellow(`⚠️ Missing metadata file: ${path.basename(metadataPath)}`));
        stats.warnings++;
        return;
      }
    }
    
    // Read and parse metadata
    const metadataContent = await readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataContent);
    
    // Validate against schema
    const validationResult = fixtureMetadataSchema.safeParse(metadata);
    if (!validationResult.success) {
      console.log(colors.yellow(`⚠️ Invalid metadata in ${path.basename(metadataPath)}: ${validationResult.error.message}`));
      stats.warnings++;
      return;
    }
    
    // Add scenarios to coverage
    metadata.scenarios.forEach((scenario: string) => {
      stats.coverage.scenarios.add(scenario);
    });
    
    // Add edge cases to coverage
    if (metadata.edgeCases) {
      metadata.edgeCases.forEach((edgeCase: string) => {
        stats.coverage.edgeCases.add(edgeCase);
      });
    }
    
    if (options.verbose) {
      console.log(colors.green(`✅ ${path.basename(metadataPath)}: Valid metadata`));
    }
  } catch (error) {
    console.log(colors.yellow(`⚠️ Error validating metadata for ${originalFileName}: ${error.message}`));
    stats.warnings++;
  }
}

/**
 * Check for personally identifiable information (PII)
 */
function checkForPII(content: string): { detected: boolean, matches: string[] } {
  const matches: string[] = [];
  
  for (const pattern of PII_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      matches.push(`${match[0].substring(0, 3)}***${match[0].substring(match[0].length - 3)}`);
    }
  }
  
  return {
    detected: matches.length > 0,
    matches
  };
}

/**
 * Attempt to fix common XML issues
 */
async function attemptToFixXml(filePath: string): Promise<boolean> {
  try {
    let content = await readFile(filePath, 'utf8');
    let fixed = false;
    
    // Fix common XML issues
    
    // 1. Add XML declaration if missing
    if (!content.trim().startsWith('<?xml')) {
      content = '<?xml version="1.0" encoding="UTF-8"?>\n' + content;
      fixed = true;
    }
    
    // 2. Fix unclosed tags (simple cases only)
    const unclosedTagRegex = /<([a-zA-Z0-9_]+)([^>]*)>([^<]*)/g;
    content = content.replace(unclosedTagRegex, (match, tag, attrs, text) => {
      // Only fix if there's no < in the text (to avoid false positives)
      if (!text.includes('<')) {
        fixed = true;
        return `<${tag}${attrs}>${text}</${tag}>`;
      }
      return match;
    });
    
    // 3. Replace invalid characters in XML
    const invalidChars = ['\u0000', '\u0001', '\u0002', '\u0003', '\u0004', '\u0005', '\u0006', '\u0007', '\u0008', '\u000B', '\u000C', '\u000E', '\u000F'];
    for (const char of invalidChars) {
      if (content.includes(char)) {
        content = content.replace(new RegExp(char, 'g'), '');
        fixed = true;
      }
    }
    
    // 4. Ensure root element is <adf>
    if (!/<adf[^>]*>/.test(content)) {
      const rootMatch = /<([a-zA-Z0-9_]+)[^>]*>/.exec(content);
      if (rootMatch && rootMatch[1] !== 'adf') {
        content = content.replace(new RegExp(`<${rootMatch[1]}([^>]*)>`, 'g'), '<adf$1>');
        content = content.replace(new RegExp(`</${rootMatch[1]}>`, 'g'), '</adf>');
        fixed = true;
      }
    }
    
    // 5. Anonymize potential PII
    for (const pattern of PII_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const hashedValue = crypto.createHash('sha256').update(match).digest('hex').substring(0, 10);
          content = content.replace(match, `mock-${hashedValue}`);
          fixed = true;
        }
      }
    }
    
    // Write fixed content back to file
    if (fixed) {
      await writeFile(filePath, content);
    }
    
    return fixed;
  } catch (error) {
    console.log(colors.red(`❌ Failed to fix ${path.basename(filePath)}: ${error.message}`));
    return false;
  }
}

/**
 * Validate coverage of test scenarios
 */
function validateCoverage() {
  console.log(colors.cyan('\n📊 Validating Test Coverage...'));
  
  // Check required scenarios
  for (const scenario of requiredScenarios) {
    if (!stats.coverage.scenarios.has(scenario)) {
      stats.coverage.missingScenarios.push(scenario);
    }
  }
  
  // Print coverage results
  console.log(`Total scenarios covered: ${stats.coverage.scenarios.size}/${requiredScenarios.length}`);
  console.log(`Edge cases covered: ${stats.coverage.edgeCases.size}/${requiredEdgeCases.length}`);
  
  if (stats.coverage.missingScenarios.length > 0) {
    console.log(colors.yellow(`⚠️ Missing scenarios: ${stats.coverage.missingScenarios.join(', ')}`));
    stats.warnings += stats.coverage.missingScenarios.length;
  }
  
  // Check missing edge cases
  const missingEdgeCases = requiredEdgeCases.filter(edgeCase => !stats.coverage.edgeCases.has(edgeCase));
  if (missingEdgeCases.length > 0) {
    console.log(colors.yellow(`⚠️ Missing edge cases: ${missingEdgeCases.join(', ')}`));
    stats.warnings += missingEdgeCases.length;
  }
}

/**
 * Generate detailed report
 */
async function generateReport() {
  if (!options.reportFile && !options.ci) {
    return;
  }
  
  const reportFile = options.reportFile || path.join(REPORT_DIR, `fixture-validation-${new Date().toISOString().replace(/:/g, '-')}.json`);
  
  // Calculate average performance
  stats.performance.avg = stats.performance.total / (stats.valid || 1);
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: stats.total,
      valid: stats.valid,
      invalid: stats.invalid,
      warnings: stats.warnings,
      fixed: stats.fixed,
      piiDetections: stats.piiDetections,
    },
    byType: stats.byType,
    performance: {
      min: stats.performance.min,
      max: stats.performance.max,
      avg: stats.performance.avg,
      threshold: PERFORMANCE_THRESHOLD_MS,
    },
    coverage: {
      scenarios: {
        covered: Array.from(stats.coverage.scenarios),
        missing: stats.coverage.missingScenarios,
        total: requiredScenarios.length,
        percentage: Math.round((stats.coverage.scenarios.size / requiredScenarios.length) * 100),
      },
      edgeCases: {
        covered: Array.from(stats.coverage.edgeCases),
        missing: requiredEdgeCases.filter(edgeCase => !stats.coverage.edgeCases.has(edgeCase)),
        total: requiredEdgeCases.length,
        percentage: Math.round((stats.coverage.edgeCases.size / requiredEdgeCases.length) * 100),
      },
    },
    recommendations: generateRecommendations(),
  };
  
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(colors.green(`\n📝 Report generated: ${reportFile}`));
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(): string[] {
  const recommendations: string[] = [];
  
  // Coverage recommendations
  if (stats.coverage.missingScenarios.length > 0) {
    recommendations.push(`Add fixtures for missing scenarios: ${stats.coverage.missingScenarios.join(', ')}`);
  }
  
  const missingEdgeCases = requiredEdgeCases.filter(edgeCase => !stats.coverage.edgeCases.has(edgeCase));
  if (missingEdgeCases.length > 0) {
    recommendations.push(`Add fixtures for missing edge cases: ${missingEdgeCases.join(', ')}`);
  }
  
  // Performance recommendations
  if (stats.performance.max > PERFORMANCE_THRESHOLD_MS) {
    recommendations.push(`Optimize slow fixtures (max parse time: ${stats.performance.max.toFixed(2)}ms)`);
  }
  
  // PII recommendations
  if (stats.piiDetections > 0) {
    recommendations.push(`Remove or anonymize PII from ${stats.piiDetections} fixtures`);
  }
  
  // General recommendations
  if (stats.total < 10) {
    recommendations.push('Add more test fixtures to improve coverage');
  }
  
  if (stats.invalid > 0) {
    recommendations.push(`Fix ${stats.invalid} invalid fixtures`);
  }
  
  return recommendations;
}

/**
 * Print summary of validation results
 */
function printSummary() {
  // Calculate average performance
  stats.performance.avg = stats.performance.total / (stats.valid || 1);
  
  console.log(colors.cyan('\n📈 Validation Summary'));
  console.log(colors.cyan('==================='));
  console.log(`Total fixtures: ${stats.total}`);
  console.log(`Valid: ${colors.green(stats.valid.toString())}`);
  console.log(`Invalid: ${stats.invalid > 0 ? colors.red(stats.invalid.toString()) : stats.invalid}`);
  console.log(`Warnings: ${stats.warnings > 0 ? colors.yellow(stats.warnings.toString()) : stats.warnings}`);
  console.log(`Fixed: ${stats.fixed > 0 ? colors.green(stats.fixed.toString()) : stats.fixed}`);
  
  console.log(colors.cyan('\nPerformance Metrics'));
  console.log(`Min parse time: ${stats.performance.min.toFixed(2)}ms`);
  console.log(`Max parse time: ${stats.performance.max.toFixed(2)}ms`);
  console.log(`Avg parse time: ${stats.performance.avg.toFixed(2)}ms`);
  
  console.log(colors.cyan('\nCoverage Metrics'));
  console.log(`Scenarios: ${stats.coverage.scenarios.size}/${requiredScenarios.length} (${Math.round((stats.coverage.scenarios.size / requiredScenarios.length) * 100)}%)`);
  console.log(`Edge cases: ${stats.coverage.edgeCases.size}/${requiredEdgeCases.length} (${Math.round((stats.coverage.edgeCases.size / requiredEdgeCases.length) * 100)}%)`);
  
  // Generate recommendations
  const recommendations = generateRecommendations();
  if (recommendations.length > 0) {
    console.log(colors.cyan('\n🔍 Recommendations'));
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }
  
  // Overall status
  const status = stats.invalid === 0 && stats.warnings < 5 ? 'PASS' : 'FAIL';
  console.log(colors.cyan(`\n🏁 Overall Status: ${status === 'PASS' ? colors.green(status) : colors.red(status)}`));
}

// Run the validation
validateFixtures().catch(error => {
  console.error(colors.red(`❌ Fatal error: ${error.message}`));
  process.exit(1);
});
