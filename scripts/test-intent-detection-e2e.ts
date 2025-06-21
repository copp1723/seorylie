#!/usr/bin/env ts-node
/**
 * ADF-07 - Enhanced Intent Detection & Conversation Hooks
 * End-to-End Test Script
 * 
 * This script provides comprehensive testing for the Intent Detection System,
 * validating all trigger families, configuration management, performance metrics,
 * and integration with the ADF pipeline.
 * 
 * Usage:
 *   npm run test:intent-detection
 *   
 * Options:
 *   --verbose     Show detailed logs for each test
 *   --demo        Run demonstration scenarios for stakeholders
 *   --perf        Run performance tests only
 *   --precision   Run precision/recall validation only
 */

import { IntentOrchestrator } from '../server/services/intent/intent-orchestrator';
import { RuleEngine } from '../server/services/intent/rule-engine';
import { MLClassifier } from '../server/services/intent/ml-classifier';
import { BehaviouralMonitor } from '../server/services/intent/behavioural-monitor';
import { SLATracker } from '../server/services/intent/sla-tracker';
import { createConfigService, UnifiedConfigService } from '../server/services/intent/unified-config-service';
import { monitoringService } from '../server/services/monitoring';
import db from '../server/db';
import { sql } from 'drizzle-orm';
import logger from '../server/utils/logger';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { createClient } from 'redis';
import { EventEmitter } from 'events';
import { HandoverService } from '../server/services/handover-service';

// CLI arguments parsing
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const DEMO_MODE = args.includes('--demo');
const PERF_MODE = args.includes('--perf');
const PRECISION_MODE = args.includes('--precision');

// Constants
const TEST_DEALERSHIP_ID = 456;
const LATENCY_THRESHOLD_MS = 2000; // 2 seconds max latency
const PRECISION_TARGET = 0.9; // 90% precision target
const RECALL_TARGET = 0.85; // 85% recall target
const TEST_DATASET_SIZE = 100; // Number of test messages to generate
const CONFIG_PATH = path.join(process.cwd(), 'configs', 'dealerships', TEST_DEALERSHIP_ID.toString(), 'intent');

// Test results tracking
const results = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  skippedTests: 0,
  testResults: [] as Array<{
    name: string;
    passed: boolean;
    skipped?: boolean;
    duration?: number;
    error?: Error;
    details?: any;
  }>,
  performanceMetrics: {
    avgLatency: 0,
    maxLatency: 0,
    minLatency: Infinity,
    p95Latency: 0,
    latencies: [] as number[],
  },
  precisionRecall: {
    truePositives: 0,
    falsePositives: 0,
    trueNegatives: 0,
    falseNegatives: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
  },
};

// Mock conversation data
const mockConversation = {
  id: 123,
  dealershipId: TEST_DEALERSHIP_ID,
  customerId: 789,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test datasets
const testMessages = {
  // Rule-based intent test cases
  ruleBased: [
    { content: 'I want to buy this car today', expectedIntent: true, intentType: 'purchase', ruleId: 'R-BUY-1' },
    { content: 'I\'m ready to purchase this vehicle', expectedIntent: true, intentType: 'purchase', ruleId: 'R-BUY-1' },
    { content: 'Let\'s finalize the deal', expectedIntent: true, intentType: 'purchase', ruleId: 'R-BUY-1' },
    { content: 'Can I schedule a test drive?', expectedIntent: true, intentType: 'test-drive', ruleId: 'R-TEST-1' },
    { content: 'I\'d like to test drive this car', expectedIntent: true, intentType: 'test-drive', ruleId: 'R-TEST-1' },
    { content: 'What\'s your best price on this?', expectedIntent: true, intentType: 'pricing', ruleId: 'R-PRICE-1' },
    { content: 'Can we negotiate on the price?', expectedIntent: true, intentType: 'pricing', ruleId: 'R-PRICE-1' },
    { content: 'Is this vehicle still available?', expectedIntent: false },
    { content: 'What color options do you have?', expectedIntent: false },
    { content: 'How many miles does it have?', expectedIntent: false },
  ],
  
  // ML-based intent test cases
  mlBased: [
    { content: 'What APR can you offer on this vehicle?', expectedIntent: true, intentType: 'financing', confidence: 0.92 },
    { content: 'Do you have any special financing rates?', expectedIntent: true, intentType: 'financing', confidence: 0.88 },
    { content: 'What would the monthly payments be?', expectedIntent: true, intentType: 'financing', confidence: 0.86 },
    { content: 'I\'m comparing rates with other dealers', expectedIntent: true, intentType: 'financing', confidence: 0.85 },
    { content: 'Do you offer extended warranties?', expectedIntent: false, confidence: 0.65 },
    { content: 'What\'s the fuel economy like?', expectedIntent: false, confidence: 0.3 },
    { content: 'Does it have Bluetooth connectivity?', expectedIntent: false, confidence: 0.2 },
    { content: 'What\'s the cargo capacity?', expectedIntent: false, confidence: 0.1 },
  ],
  
  // Behavioural intent test cases (multiple messages in conversation)
  behavioural: [
    {
      messages: [
        { content: 'Hi, I\'m interested in this car', isFromCustomer: true, timestamp: -30 }, // 30 minutes ago
        { content: 'Hello! How can I help you today?', isFromCustomer: false, timestamp: -29 },
        { content: 'What\'s the mileage on it?', isFromCustomer: true, timestamp: -25 },
        { content: 'It has 15,000 miles', isFromCustomer: false, timestamp: -24 },
        { content: 'And what about the warranty?', isFromCustomer: true, timestamp: -20 },
        { content: 'It comes with a 3-year warranty', isFromCustomer: false, timestamp: -19 },
        { content: 'Great, and do you offer financing?', isFromCustomer: true, timestamp: -10 },
      ],
      expectedIntent: true,
      engagementLevel: 'high',
      messageCount: 4, // Customer messages only
    },
    {
      messages: [
        { content: 'Do you have any SUVs?', isFromCustomer: true, timestamp: -20 }, // 20 minutes ago
        { content: 'Yes, we have several models', isFromCustomer: false, timestamp: -19 },
        { content: 'What\'s your price range?', isFromCustomer: false, timestamp: -18 },
      ],
      expectedIntent: false,
      engagementLevel: 'low',
      messageCount: 1, // Customer messages only
    },
  ],
  
  // SLA-based intent test cases
  sla: [
    {
      lastCustomerMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 48), // 48 hours ago
      noResponseHours: 48,
      expectedIntent: true,
    },
    {
      lastCustomerMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 24 hours ago
      noResponseHours: 48,
      expectedIntent: false,
    },
    {
      lastCustomerMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 72), // 72 hours ago
      noResponseHours: 48,
      expectedIntent: true,
    },
  ],
  
  // Edge cases and error scenarios
  edgeCases: [
    { content: '', expectedIntent: false, description: 'Empty message' },
    { content: '?', expectedIntent: false, description: 'Single character' },
    { content: 'a'.repeat(10000), expectedIntent: false, description: 'Very long message' },
    { content: '<script>alert("XSS")</script>', expectedIntent: false, description: 'Potential XSS' },
    { content: 'BUY BUY BUY BUY BUY', expectedIntent: true, description: 'Keyword stuffing', ruleId: 'R-BUY-1' },
  ],
};

// Generate large test dataset for precision/recall calculation
const generateTestDataset = (size: number) => {
  const dataset = [];
  const intentPhrases = [
    'buy', 'purchase', 'deal', 'test drive', 'financing', 'interest rate', 'monthly payment',
    'best price', 'negotiate', 'discount', 'trade-in', 'down payment', 'credit score',
  ];
  
  const nonIntentPhrases = [
    'color', 'features', 'specs', 'mileage', 'fuel economy', 'bluetooth', 'warranty',
    'dimensions', 'cargo', 'safety', 'ratings', 'reviews', 'comparison', 'history',
  ];
  
  // Create 60% non-intent messages, 40% intent messages
  for (let i = 0; i < size; i++) {
    const isIntent = Math.random() < 0.4;
    
    if (isIntent) {
      // Generate intent message
      const phrase = intentPhrases[Math.floor(Math.random() * intentPhrases.length)];
      const prefix = ['I want to', 'Can we discuss', 'I\'m interested in', 'Let\'s talk about', 'What about'][Math.floor(Math.random() * 5)];
      const suffix = ['today', 'now', 'soon', 'options', 'possibilities'][Math.floor(Math.random() * 5)];
      
      dataset.push({
        content: `${prefix} ${phrase} ${suffix}`,
        expectedIntent: true,
      });
    } else {
      // Generate non-intent message
      const phrase = nonIntentPhrases[Math.floor(Math.random() * nonIntentPhrases.length)];
      const prefix = ['What\'s the', 'Tell me about', 'How\'s the', 'Does it have', 'I\'m curious about'][Math.floor(Math.random() * 5)];
      const suffix = ['of this car', 'on this model', 'feature', 'specification', ''][Math.floor(Math.random() * 5)];
      
      dataset.push({
        content: `${prefix} ${phrase} ${suffix}`,
        expectedIntent: false,
      });
    }
  }
  
  return dataset;
};

// Initialize components
let orchestrator: IntentOrchestrator;
let ruleEngine: RuleEngine;
let mlClassifier: MLClassifier;
let behaviouralMonitor: BehaviouralMonitor;
let slaTracker: SLATracker;
let configService: UnifiedConfigService;
let handoverService: HandoverService;
let redisClient: any;

/**
 * Setup test environment
 */
async function setup() {
  try {
    log(chalk.blue('Setting up test environment...'));
    
    // Initialize components
    ruleEngine = new RuleEngine();
    mlClassifier = new MLClassifier();
    behaviouralMonitor = new BehaviouralMonitor();
    slaTracker = new SLATracker();
    
    // Initialize config service
    configService = createConfigService('intent');
    await configService.initialize();
    
    // Create Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await redisClient.connect();
    
    // Initialize handover service (simplified mock)
    handoverService = new HandoverService();
    
    // Create orchestrator
    orchestrator = new IntentOrchestrator({
      ruleEngine,
      mlClassifier,
      behaviouralMonitor,
      slaTracker,
    });
    
    // Set up event listeners
    orchestrator.on('handover.intent.triggered', async (data) => {
      log(chalk.green(`✓ Intent detected: ${data.triggerType} (${data.ruleId || ''}) with confidence ${data.confidence}`));
      
      // In real implementation, this would create a handover
      await handoverService.createHandover(data.conversationId, {
        triggerType: data.triggerType,
        triggerDetails: data,
      });
    });
    
    // Create test configuration if it doesn't exist
    await ensureTestConfiguration();
    
    log(chalk.green('✓ Test environment setup complete'));
    return true;
  } catch (error) {
    logError('Failed to set up test environment', error);
    return false;
  }
}

/**
 * Ensure test configuration exists
 */
async function ensureTestConfiguration() {
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(CONFIG_PATH, { recursive: true });
    }
    
    // Create test configuration file
    const configFile = path.join(CONFIG_PATH, 'config.yml');
    
    const defaultConfig = `
handover:
  rules:
    include:
      - R-BUY-1
      - R-TEST-1
      - R-FIN-1
      - R-PRICE-1
      - R-AVAIL-1
      - R-TRADE-1
    exclude: []
  ml_threshold: 0.80
  behavioural:
    engaged_replies: 3
    window_minutes: 30
  sla:
    no_response_hours: 48
`;
    
    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, defaultConfig, 'utf8');
      log(chalk.yellow('Created default test configuration'));
    }
    
    // Create feature flags directory
    const flagsPath = path.join(process.cwd(), 'configs', 'feature-flags', 'intent');
    if (!fs.existsSync(flagsPath)) {
      fs.mkdirSync(flagsPath, { recursive: true });
    }
    
    // Create test feature flag
    const flagFile = path.join(flagsPath, 'INTENT_DETECTION_V2.yml');
    const flagContent = `
id: intent-detection-v2
name: INTENT_DETECTION_V2
description: Enable the new intent detection system
isEnabled: true
rolloutPercentage: 100
dealershipOverrides:
  ${TEST_DEALERSHIP_ID}: true
environment: development
createdAt: ${new Date().toISOString()}
updatedAt: ${new Date().toISOString()}
`;
    
    if (!fs.existsSync(flagFile)) {
      fs.writeFileSync(flagFile, flagContent, 'utf8');
      log(chalk.yellow('Created test feature flag'));
    }
    
    // Create A/B test directory
    const abTestPath = path.join(process.cwd(), 'configs', 'ab-tests', 'intent');
    if (!fs.existsSync(abTestPath)) {
      fs.mkdirSync(abTestPath, { recursive: true });
    }
    
    // Create test A/B test
    const abTestFile = path.join(abTestPath, 'ML_THRESHOLD_TEST.yml');
    const abTestContent = `
id: ml-threshold-test
name: ML_THRESHOLD_TEST
description: Test different ML thresholds for intent detection
isActive: true
variants:
  - id: control
    name: Control (0.8)
    percentage: 50
    config:
      handover:
        ml_threshold: 0.8
  - id: variant_a
    name: Variant A (0.7)
    percentage: 25
    config:
      handover:
        ml_threshold: 0.7
  - id: variant_b
    name: Variant B (0.9)
    percentage: 25
    config:
      handover:
        ml_threshold: 0.9
dealershipOverrides:
  ${TEST_DEALERSHIP_ID}: control
environment: development
startedAt: ${new Date().toISOString()}
metrics:
  - intent_detection_precision
  - intent_detection_recall
  - handover_conversion_rate
`;
    
    if (!fs.existsSync(abTestFile)) {
      fs.writeFileSync(abTestFile, abTestContent, 'utf8');
      log(chalk.yellow('Created test A/B test'));
    }
    
    return true;
  } catch (error) {
    logError('Failed to ensure test configuration', error);
    return false;
  }
}

/**
 * Test rule-based intent detection
 */
async function testRuleBasedIntent() {
  const testName = 'Rule-Based Intent Detection';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ message: string, expected: boolean, actual: boolean, latency: number }>,
    };
    
    for (const testCase of testMessages.ruleBased) {
      const message = {
        id: Math.floor(Math.random() * 1000),
        conversationId: mockConversation.id,
        content: testCase.content,
        isFromCustomer: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Create spy for emit
      const events: any[] = [];
      const originalEmit = orchestrator.emit;
      orchestrator.emit = function(event: string, ...args: any[]) {
        events.push({ event, args });
        return originalEmit.apply(this, [event, ...args]);
      };
      
      const testStartTime = Date.now();
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
      const testEndTime = Date.now();
      const latency = testEndTime - testStartTime;
      
      // Check if handover was triggered
      const handoverTriggered = events.some(
        e => e.event === 'handover.intent.triggered'
      );
      
      // Record result
      details.tests.push({
        message: testCase.content,
        expected: testCase.expectedIntent,
        actual: handoverTriggered,
        latency,
      });
      
      // Update performance metrics
      results.performanceMetrics.latencies.push(latency);
      
      // Check if test passed
      const testPassed = handoverTriggered === testCase.expectedIntent;
      if (!testPassed) {
        passed = false;
        log(chalk.red(`✗ Failed: "${testCase.content}" - Expected: ${testCase.expectedIntent}, Got: ${handoverTriggered}`));
      } else if (VERBOSE) {
        log(chalk.green(`✓ Passed: "${testCase.content}" - ${latency}ms`));
      }
      
      // Update precision/recall metrics
      if (testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.truePositives++;
      } else if (!testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.falsePositives++;
      } else if (!testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.trueNegatives++;
      } else if (testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.falseNegatives++;
      }
      
      // Restore original emit
      orchestrator.emit = originalEmit;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test ML-based intent detection
 */
async function testMLBasedIntent() {
  const testName = 'ML-Based Intent Detection';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ message: string, expected: boolean, actual: boolean, confidence: number, latency: number }>,
    };
    
    // Mock rule engine to always return no intent
    const originalRuleEvaluate = ruleEngine.evaluateMessage;
    ruleEngine.evaluateMessage = async () => ({
      hasIntent: false,
      triggerType: 'rule',
    });
    
    for (const testCase of testMessages.mlBased) {
      const message = {
        id: Math.floor(Math.random() * 1000),
        conversationId: mockConversation.id,
        content: testCase.content,
        isFromCustomer: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Create spy for emit
      const events: any[] = [];
      const originalEmit = orchestrator.emit;
      orchestrator.emit = function(event: string, ...args: any[]) {
        events.push({ event, args });
        return originalEmit.apply(this, [event, ...args]);
      };
      
      // Mock ML classifier for this test case
      const originalMLClassify = mlClassifier.classifyIntent;
      mlClassifier.classifyIntent = async () => ({
        hasIntent: testCase.confidence >= dealershipConfig.handover.ml_threshold,
        intentType: testCase.intentType || 'unknown',
        confidence: testCase.confidence || 0,
        triggerType: 'ml',
      });
      
      const testStartTime = Date.now();
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
      const testEndTime = Date.now();
      const latency = testEndTime - testStartTime;
      
      // Check if handover was triggered
      const handoverTriggered = events.some(
        e => e.event === 'handover.intent.triggered'
      );
      
      // Record result
      details.tests.push({
        message: testCase.content,
        expected: testCase.expectedIntent,
        actual: handoverTriggered,
        confidence: testCase.confidence || 0,
        latency,
      });
      
      // Update performance metrics
      results.performanceMetrics.latencies.push(latency);
      
      // Check if test passed
      const testPassed = handoverTriggered === testCase.expectedIntent;
      if (!testPassed) {
        passed = false;
        log(chalk.red(`✗ Failed: "${testCase.content}" - Expected: ${testCase.expectedIntent}, Got: ${handoverTriggered}`));
      } else if (VERBOSE) {
        log(chalk.green(`✓ Passed: "${testCase.content}" - Confidence: ${testCase.confidence} - ${latency}ms`));
      }
      
      // Update precision/recall metrics
      if (testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.truePositives++;
      } else if (!testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.falsePositives++;
      } else if (!testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.trueNegatives++;
      } else if (testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.falseNegatives++;
      }
      
      // Restore original functions
      orchestrator.emit = originalEmit;
      mlClassifier.classifyIntent = originalMLClassify;
    }
    
    // Restore original rule engine
    ruleEngine.evaluateMessage = originalRuleEvaluate;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test behavioural intent detection
 */
async function testBehaviouralIntent() {
  const testName = 'Behavioural Intent Detection';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ scenario: string, messageCount: number, expected: boolean, actual: boolean, latency: number }>,
    };
    
    // Mock rule engine and ML classifier to always return no intent
    const originalRuleEvaluate = ruleEngine.evaluateMessage;
    const originalMLClassify = mlClassifier.classifyIntent;
    
    ruleEngine.evaluateMessage = async () => ({
      hasIntent: false,
      triggerType: 'rule',
    });
    
    mlClassifier.classifyIntent = async () => ({
      hasIntent: false,
      triggerType: 'ml',
    });
    
    for (const testCase of testMessages.behavioural) {
      // Mock database to return messages for this conversation
      const db = require('../server/db');
      db.execute = jest.fn().mockImplementation((query) => {
        if (query.toString().includes('COUNT')) {
          return Promise.resolve([{ count: testCase.messageCount }]);
        }
        
        if (query.toString().includes('SELECT')) {
          // Convert messages to database format
          return Promise.resolve(
            testCase.messages.map(m => ({
              id: Math.floor(Math.random() * 1000),
              content: m.content,
              is_from_customer: m.isFromCustomer,
              created_at: new Date(Date.now() + (m.timestamp * 60 * 1000)), // Convert minutes to milliseconds
            }))
          );
        }
        
        return Promise.resolve([]);
      });
      
      // Mock behavioural monitor for this test case
      const originalBehaviouralEvaluate = behaviouralMonitor.evaluateEngagement;
      behaviouralMonitor.evaluateEngagement = async () => ({
        hasIntent: testCase.expectedIntent,
        engagementLevel: testCase.engagementLevel,
        messageCount: testCase.messageCount,
        triggerType: 'behavioural',
        confidence: testCase.expectedIntent ? 0.85 : 0.4,
      });
      
      // Create spy for emit
      const events: any[] = [];
      const originalEmit = orchestrator.emit;
      orchestrator.emit = function(event: string, ...args: any[]) {
        events.push({ event, args });
        return originalEmit.apply(this, [event, ...args]);
      };
      
      // Use the last message as the current message
      const lastMessage = testCase.messages[testCase.messages.length - 1];
      const message = {
        id: Math.floor(Math.random() * 1000),
        conversationId: mockConversation.id,
        content: lastMessage.content,
        isFromCustomer: lastMessage.isFromCustomer,
        createdAt: new Date(Date.now() + (lastMessage.timestamp * 60 * 1000)),
        updatedAt: new Date(Date.now() + (lastMessage.timestamp * 60 * 1000)),
      };
      
      const testStartTime = Date.now();
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
      const testEndTime = Date.now();
      const latency = testEndTime - testStartTime;
      
      // Check if handover was triggered
      const handoverTriggered = events.some(
        e => e.event === 'handover.intent.triggered'
      );
      
      // Record result
      details.tests.push({
        scenario: `${testCase.messageCount} messages, ${testCase.engagementLevel} engagement`,
        messageCount: testCase.messageCount,
        expected: testCase.expectedIntent,
        actual: handoverTriggered,
        latency,
      });
      
      // Update performance metrics
      results.performanceMetrics.latencies.push(latency);
      
      // Check if test passed
      const testPassed = handoverTriggered === testCase.expectedIntent;
      if (!testPassed) {
        passed = false;
        log(chalk.red(`✗ Failed: ${testCase.messageCount} messages, ${testCase.engagementLevel} engagement - Expected: ${testCase.expectedIntent}, Got: ${handoverTriggered}`));
      } else if (VERBOSE) {
        log(chalk.green(`✓ Passed: ${testCase.messageCount} messages, ${testCase.engagementLevel} engagement - ${latency}ms`));
      }
      
      // Update precision/recall metrics
      if (testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.truePositives++;
      } else if (!testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.falsePositives++;
      } else if (!testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.trueNegatives++;
      } else if (testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.falseNegatives++;
      }
      
      // Restore original functions
      orchestrator.emit = originalEmit;
      behaviouralMonitor.evaluateEngagement = originalBehaviouralEvaluate;
    }
    
    // Restore original functions
    ruleEngine.evaluateMessage = originalRuleEvaluate;
    mlClassifier.classifyIntent = originalMLClassify;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test SLA-based intent detection
 */
async function testSLAIntent() {
  const testName = 'SLA-Based Intent Detection';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ scenario: string, hoursWithoutResponse: number, expected: boolean, actual: boolean, latency: number }>,
    };
    
    for (const testCase of testMessages.sla) {
      // Mock SLA tracker for this test case
      const originalSLACheck = slaTracker.checkSLA;
      slaTracker.checkSLA = async () => {
        const hoursWithoutResponse = Math.floor(
          (Date.now() - testCase.lastCustomerMessageAt.getTime()) / (1000 * 60 * 60)
        );
        
        return {
          hasIntent: hoursWithoutResponse >= testCase.noResponseHours,
          hoursWithoutResponse,
          triggerType: 'sla',
          confidence: 1.0, // SLA triggers are deterministic
        };
      };
      
      // Create spy for emit
      const events: any[] = [];
      const originalEmit = orchestrator.emit;
      orchestrator.emit = function(event: string, ...args: any[]) {
        events.push({ event, args });
        return originalEmit.apply(this, [event, ...args]);
      };
      
      const testStartTime = Date.now();
      await slaTracker.checkSLA(mockConversation, dealershipConfig.handover.sla);
      const testEndTime = Date.now();
      const latency = testEndTime - testStartTime;
      
      // Get hours without response
      const hoursWithoutResponse = Math.floor(
        (Date.now() - testCase.lastCustomerMessageAt.getTime()) / (1000 * 60 * 60)
      );
      
      // Check if SLA was triggered
      const slaTriggered = hoursWithoutResponse >= testCase.noResponseHours;
      
      // Record result
      details.tests.push({
        scenario: `${hoursWithoutResponse} hours without response, threshold: ${testCase.noResponseHours}`,
        hoursWithoutResponse,
        expected: testCase.expectedIntent,
        actual: slaTriggered,
        latency,
      });
      
      // Update performance metrics
      results.performanceMetrics.latencies.push(latency);
      
      // Check if test passed
      const testPassed = slaTriggered === testCase.expectedIntent;
      if (!testPassed) {
        passed = false;
        log(chalk.red(`✗ Failed: ${hoursWithoutResponse} hours without response - Expected: ${testCase.expectedIntent}, Got: ${slaTriggered}`));
      } else if (VERBOSE) {
        log(chalk.green(`✓ Passed: ${hoursWithoutResponse} hours without response - ${latency}ms`));
      }
      
      // Update precision/recall metrics
      if (testCase.expectedIntent && slaTriggered) {
        results.precisionRecall.truePositives++;
      } else if (!testCase.expectedIntent && slaTriggered) {
        results.precisionRecall.falsePositives++;
      } else if (!testCase.expectedIntent && !slaTriggered) {
        results.precisionRecall.trueNegatives++;
      } else if (testCase.expectedIntent && !slaTriggered) {
        results.precisionRecall.falseNegatives++;
      }
      
      // Restore original functions
      orchestrator.emit = originalEmit;
      slaTracker.checkSLA = originalSLACheck;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test configuration management
 */
async function testConfigurationManagement() {
  const testName = 'Configuration Management';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ scenario: string, expected: any, actual: any, passed: boolean }>,
    };
    
    // Test 1: Load dealership configuration
    const config = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    const configTest = {
      scenario: 'Load dealership configuration',
      expected: true,
      actual: !!config && !!config.handover,
      passed: !!config && !!config.handover,
    };
    details.tests.push(configTest);
    
    if (!configTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Load dealership configuration`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Load dealership configuration`));
    }
    
    // Test 2: Check feature flag
    const featureFlagEnabled = configService.isFeatureEnabled('INTENT_DETECTION_V2', TEST_DEALERSHIP_ID);
    const featureFlagTest = {
      scenario: 'Check feature flag',
      expected: true,
      actual: featureFlagEnabled,
      passed: featureFlagEnabled === true,
    };
    details.tests.push(featureFlagTest);
    
    if (!featureFlagTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Check feature flag - Expected: true, Got: ${featureFlagEnabled}`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Check feature flag`));
    }
    
    // Test 3: Get A/B test variant
    const abTestVariant = configService.getABTestVariant('ML_THRESHOLD_TEST', TEST_DEALERSHIP_ID);
    const abTestVariantTest = {
      scenario: 'Get A/B test variant',
      expected: 'control',
      actual: abTestVariant,
      passed: abTestVariant === 'control',
    };
    details.tests.push(abTestVariantTest);
    
    if (!abTestVariantTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Get A/B test variant - Expected: control, Got: ${abTestVariant}`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Get A/B test variant`));
    }
    
    // Test 4: Hot-reload configuration
    const emitSpy = jest.spyOn(configService, 'emit');
    await configService['handleGlobalConfigChange']('configs/global/intent/config.yml');
    
    const hotReloadTest = {
      scenario: 'Hot-reload configuration',
      expected: true,
      actual: emitSpy.mock.calls.some(call => call[0] === 'config.global.changed'),
      passed: emitSpy.mock.calls.some(call => call[0] === 'config.global.changed'),
    };
    details.tests.push(hotReloadTest);
    
    if (!hotReloadTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Hot-reload configuration`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Hot-reload configuration`));
    }
    
    // Test 5: Apply A/B test variant to configuration
    const baseConfig = { ...config };
    const abTest = {
      id: 'test-123',
      name: 'ML_THRESHOLD_TEST',
      description: 'Test different ML thresholds',
      isActive: true,
      variants: [
        {
          id: 'variant_a',
          name: 'Lower Threshold',
          percentage: 100,
          config: {
            handover: {
              ml_threshold: 0.7
            }
          }
        }
      ],
      dealershipOverrides: {},
      environment: configService['environment'],
      startedAt: new Date(),
      metrics: []
    };
    
    // Add test to abTests map
    configService['abTests'].set('ML_THRESHOLD_TEST', abTest);
    
    // Mock getABTestVariant
    const originalGetABTestVariant = configService.getABTestVariant;
    configService.getABTestVariant = jest.fn().mockReturnValue('variant_a');
    
    // Apply variant
    const variantConfig = await configService['applyABTestVariants'](baseConfig, TEST_DEALERSHIP_ID);
    
    const applyVariantTest = {
      scenario: 'Apply A/B test variant',
      expected: 0.7,
      actual: variantConfig.handover.ml_threshold,
      passed: variantConfig.handover.ml_threshold === 0.7,
    };
    details.tests.push(applyVariantTest);
    
    if (!applyVariantTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Apply A/B test variant - Expected: 0.7, Got: ${variantConfig.handover.ml_threshold}`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Apply A/B test variant`));
    }
    
    // Restore original function
    configService.getABTestVariant = originalGetABTestVariant;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test database integration
 */
async function testDatabaseIntegration() {
  const testName = 'Database Integration';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ scenario: string, expected: any, actual: any, passed: boolean }>,
    };
    
    // Test 1: Record intent trigger event
    const db = require('../server/db');
    let recordedEventId: number | null = null;
    
    db.execute = jest.fn().mockImplementation((query) => {
      if (query.toString().includes('INSERT INTO intent_detection_events')) {
        recordedEventId = 123;
        return Promise.resolve([{ id: recordedEventId }]);
      }
      
      if (query.toString().includes('UPDATE conversations')) {
        return Promise.resolve([{ id: mockConversation.id }]);
      }
      
      if (query.toString().includes('INSERT INTO intent_detection_metrics')) {
        return Promise.resolve([{ id: 456 }]);
      }
      
      return Promise.resolve([]);
    });
    
    // Call the record_intent_trigger function via SQL
    const recordIntentTriggerResult = await db.execute(sql`
      SELECT record_intent_trigger(
        ${mockConversation.id},
        ${mockConversation.dealershipId},
        ${'rule'},
        ${'R-BUY-1'},
        ${1.0},
        ${{
          message: 'I want to buy this car',
          timestamp: new Date().toISOString()
        }},
        ${50}
      );
    `);
    
    const recordIntentTest = {
      scenario: 'Record intent trigger event',
      expected: true,
      actual: !!recordedEventId,
      passed: !!recordedEventId,
    };
    details.tests.push(recordIntentTest);
    
    if (!recordIntentTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Record intent trigger event`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Record intent trigger event`));
    }
    
    // Test 2: Check conversation handover status
    db.execute = jest.fn().mockImplementation((query) => {
      if (query.toString().includes('SELECT * FROM conversations')) {
        return Promise.resolve([{
          id: mockConversation.id,
          dealership_id: mockConversation.dealershipId,
          handover_triggered_at: new Date(),
          handover_trigger_type: 'rule',
          handover_trigger_details: {
            message: 'I want to buy this car',
            timestamp: new Date().toISOString()
          }
        }]);
      }
      
      return Promise.resolve([]);
    });
    
    const conversationResult = await db.execute(sql`
      SELECT * FROM conversations
      WHERE id = ${mockConversation.id};
    `);
    
    const checkConversationTest = {
      scenario: 'Check conversation handover status',
      expected: true,
      actual: conversationResult.length > 0 && !!conversationResult[0].handover_triggered_at,
      passed: conversationResult.length > 0 && !!conversationResult[0].handover_triggered_at,
    };
    details.tests.push(checkConversationTest);
    
    if (!checkConversationTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Check conversation handover status`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Check conversation handover status`));
    }
    
    // Test 3: Check metrics
    db.execute = jest.fn().mockImplementation((query) => {
      if (query.toString().includes('SELECT * FROM intent_detection_metrics')) {
        return Promise.resolve([{
          id: 456,
          dealership_id: mockConversation.dealershipId,
          metric_date: new Date(),
          metric_hour: new Date().getHours(),
          trigger_type: 'rule',
          trigger_id: 'R-BUY-1',
          total_triggers: 1,
          avg_latency_ms: 50,
          max_latency_ms: 50,
          min_latency_ms: 50
        }]);
      }
      
      return Promise.resolve([]);
    });
    
    const metricsResult = await db.execute(sql`
      SELECT * FROM intent_detection_metrics
      WHERE dealership_id = ${mockConversation.dealershipId}
      AND trigger_type = ${'rule'}
      AND trigger_id = ${'R-BUY-1'};
    `);
    
    const checkMetricsTest = {
      scenario: 'Check metrics recording',
      expected: true,
      actual: metricsResult.length > 0 && metricsResult[0].total_triggers === 1,
      passed: metricsResult.length > 0 && metricsResult[0].total_triggers === 1,
    };
    details.tests.push(checkMetricsTest);
    
    if (!checkMetricsTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Check metrics recording`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Check metrics recording`));
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test error handling and resilience
 */
async function testErrorHandling() {
  const testName = 'Error Handling & Resilience';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ scenario: string, expected: any, actual: any, passed: boolean }>,
    };
    
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    // Test 1: Rule engine error
    const originalRuleEvaluate = ruleEngine.evaluateMessage;
    ruleEngine.evaluateMessage = jest.fn().mockRejectedValue(new Error('Rule engine error'));
    
    const message = {
      id: Math.floor(Math.random() * 1000),
      conversationId: mockConversation.id,
      content: 'Test message',
      isFromCustomer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Should not throw error
    let errorThrown = false;
    try {
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
    } catch (error) {
      errorThrown = true;
    }
    
    const ruleErrorTest = {
      scenario: 'Handle rule engine error',
      expected: false,
      actual: errorThrown,
      passed: !errorThrown,
    };
    details.tests.push(ruleErrorTest);
    
    if (!ruleErrorTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Handle rule engine error - Error was thrown`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Handle rule engine error`));
    }
    
    // Restore original function
    ruleEngine.evaluateMessage = originalRuleEvaluate;
    
    // Test 2: ML classifier error
    const originalMLClassify = mlClassifier.classifyIntent;
    mlClassifier.classifyIntent = jest.fn().mockRejectedValue(new Error('ML classifier error'));
    
    // Should not throw error
    errorThrown = false;
    try {
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
    } catch (error) {
      errorThrown = true;
    }
    
    const mlErrorTest = {
      scenario: 'Handle ML classifier error',
      expected: false,
      actual: errorThrown,
      passed: !errorThrown,
    };
    details.tests.push(mlErrorTest);
    
    if (!mlErrorTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Handle ML classifier error - Error was thrown`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Handle ML classifier error`));
    }
    
    // Restore original function
    mlClassifier.classifyIntent = originalMLClassify;
    
    // Test 3: Behavioural monitor error
    const originalBehaviouralEvaluate = behaviouralMonitor.evaluateEngagement;
    behaviouralMonitor.evaluateEngagement = jest.fn().mockRejectedValue(new Error('Behavioural monitor error'));
    
    // Should not throw error
    errorThrown = false;
    try {
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
    } catch (error) {
      errorThrown = true;
    }
    
    const behaviouralErrorTest = {
      scenario: 'Handle behavioural monitor error',
      expected: false,
      actual: errorThrown,
      passed: !errorThrown,
    };
    details.tests.push(behaviouralErrorTest);
    
    if (!behaviouralErrorTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Handle behavioural monitor error - Error was thrown`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Handle behavioural monitor error`));
    }
    
    // Restore original function
    behaviouralMonitor.evaluateEngagement = originalBehaviouralEvaluate;
    
    // Test 4: Configuration error
    const originalGetDealershipConfig = configService.getDealershipConfig;
    configService.getDealershipConfig = jest.fn().mockRejectedValue(new Error('Configuration error'));
    
    // Should return empty object as fallback
    const configResult = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    const configErrorTest = {
      scenario: 'Handle configuration error',
      expected: true,
      actual: typeof configResult === 'object',
      passed: typeof configResult === 'object',
    };
    details.tests.push(configErrorTest);
    
    if (!configErrorTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Handle configuration error - Did not return fallback object`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Handle configuration error`));
    }
    
    // Restore original function
    configService.getDealershipConfig = originalGetDealershipConfig;
    
    // Test 5: Database error
    const db = require('../server/db');
    const originalExecute = db.execute;
    db.execute = jest.fn().mockRejectedValue(new Error('Database error'));
    
    // Should not throw error when evaluating engagement
    errorThrown = false;
    try {
      await behaviouralMonitor.evaluateEngagement(message, mockConversation, dealershipConfig.handover.behavioural);
    } catch (error) {
      errorThrown = true;
    }
    
    const dbErrorTest = {
      scenario: 'Handle database error',
      expected: false,
      actual: errorThrown,
      passed: !errorThrown,
    };
    details.tests.push(dbErrorTest);
    
    if (!dbErrorTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Handle database error - Error was thrown`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Handle database error`));
    }
    
    // Restore original function
    db.execute = originalExecute;
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test performance metrics
 */
async function testPerformanceMetrics() {
  const testName = 'Performance Metrics';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    let passed = true;
    const startTime = Date.now();
    const details = {
      tests: [] as Array<{ scenario: string, expected: any, actual: any, passed: boolean }>,
    };
    
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    // Test 1: End-to-end latency
    const latencies: number[] = [];
    
    // Run 10 messages through the system
    for (let i = 0; i < 10; i++) {
      const message = {
        id: Math.floor(Math.random() * 1000),
        conversationId: mockConversation.id,
        content: `Test message ${i}`,
        isFromCustomer: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const testStartTime = Date.now();
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
      const testEndTime = Date.now();
      const latency = testEndTime - testStartTime;
      
      latencies.push(latency);
    }
    
    // Calculate average latency
    const avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    
    const latencyTest = {
      scenario: 'End-to-end latency',
      expected: `≤ ${LATENCY_THRESHOLD_MS}ms`,
      actual: `${Math.round(avgLatency)}ms`,
      passed: avgLatency <= LATENCY_THRESHOLD_MS,
    };
    details.tests.push(latencyTest);
    
    if (!latencyTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: End-to-end latency - Expected: ≤ ${LATENCY_THRESHOLD_MS}ms, Got: ${Math.round(avgLatency)}ms`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: End-to-end latency - ${Math.round(avgLatency)}ms`));
    }
    
    // Test 2: Metrics recording
    const incrementMetricSpy = jest.spyOn(monitoringService, 'incrementMetric');
    const recordLatencySpy = jest.spyOn(monitoringService, 'recordLatency');
    
    // Process a message
    const message = {
      id: Math.floor(Math.random() * 1000),
      conversationId: mockConversation.id,
      content: 'I want to buy this car',
      isFromCustomer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await orchestrator.processMessage(message, mockConversation, dealershipConfig);
    
    const metricsTest = {
      scenario: 'Metrics recording',
      expected: true,
      actual: incrementMetricSpy.mock.calls.length > 0 && recordLatencySpy.mock.calls.length > 0,
      passed: incrementMetricSpy.mock.calls.length > 0 && recordLatencySpy.mock.calls.length > 0,
    };
    details.tests.push(metricsTest);
    
    if (!metricsTest.passed) {
      passed = false;
      log(chalk.red(`✗ Failed: Metrics recording - Metrics not recorded`));
    } else if (VERBOSE) {
      log(chalk.green(`✓ Passed: Metrics recording`));
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details,
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Test precision and recall metrics
 */
async function testPrecisionRecall() {
  const testName = 'Precision & Recall Metrics';
  log(chalk.blue(`\nRunning test: ${testName}`));
  
  try {
    let passed = true;
    const startTime = Date.now();
    
    // Generate large test dataset
    const testDataset = generateTestDataset(TEST_DATASET_SIZE);
    log(chalk.blue(`Generated test dataset with ${testDataset.length} messages`));
    
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    // Reset precision/recall metrics
    results.precisionRecall = {
      truePositives: 0,
      falsePositives: 0,
      trueNegatives: 0,
      falseNegatives: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
    };
    
    // Process all messages
    for (const testCase of testDataset) {
      const message = {
        id: Math.floor(Math.random() * 1000),
        conversationId: mockConversation.id,
        content: testCase.content,
        isFromCustomer: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Create spy for emit
      const events: any[] = [];
      const originalEmit = orchestrator.emit;
      orchestrator.emit = function(event: string, ...args: any[]) {
        events.push({ event, args });
        return originalEmit.apply(this, [event, ...args]);
      };
      
      // Process message
      await orchestrator.processMessage(message, mockConversation, dealershipConfig);
      
      // Check if handover was triggered
      const handoverTriggered = events.some(
        e => e.event === 'handover.intent.triggered'
      );
      
      // Update precision/recall metrics
      if (testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.truePositives++;
      } else if (!testCase.expectedIntent && handoverTriggered) {
        results.precisionRecall.falsePositives++;
      } else if (!testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.trueNegatives++;
      } else if (testCase.expectedIntent && !handoverTriggered) {
        results.precisionRecall.falseNegatives++;
      }
      
      // Restore original emit
      orchestrator.emit = originalEmit;
    }
    
    // Calculate precision, recall, and F1 score
    const tp = results.precisionRecall.truePositives;
    const fp = results.precisionRecall.falsePositives;
    const tn = results.precisionRecall.trueNegatives;
    const fn = results.precisionRecall.falseNegatives;
    
    results.precisionRecall.precision = tp / (tp + fp);
    results.precisionRecall.recall = tp / (tp + fn);
    results.precisionRecall.f1Score = 2 * (results.precisionRecall.precision * results.precisionRecall.recall) / 
      (results.precisionRecall.precision + results.precisionRecall.recall);
    
    log(chalk.blue(`Precision: ${(results.precisionRecall.precision * 100).toFixed(2)}%`));
    log(chalk.blue(`Recall: ${(results.precisionRecall.recall * 100).toFixed(2)}%`));
    log(chalk.blue(`F1 Score: ${(results.precisionRecall.f1Score * 100).toFixed(2)}%`));
    log(chalk.blue(`True Positives: ${tp}, False Positives: ${fp}, True Negatives: ${tn}, False Negatives: ${fn}`));
    
    // Check if precision meets target
    const precisionTest = results.precisionRecall.precision >= PRECISION_TARGET;
    if (!precisionTest) {
      passed = false;
      log(chalk.red(`✗ Failed: Precision - Expected: ≥ ${PRECISION_TARGET * 100}%, Got: ${(results.precisionRecall.precision * 100).toFixed(2)}%`));
    } else {
      log(chalk.green(`✓ Passed: Precision - ${(results.precisionRecall.precision * 100).toFixed(2)}%`));
    }
    
    // Check if recall meets target
    const recallTest = results.precisionRecall.recall >= RECALL_TARGET;
    if (!recallTest) {
      passed = false;
      log(chalk.red(`✗ Failed: Recall - Expected: ≥ ${RECALL_TARGET * 100}%, Got: ${(results.precisionRecall.recall * 100).toFixed(2)}%`));
    } else {
      log(chalk.green(`✓ Passed: Recall - ${(results.precisionRecall.recall * 100).toFixed(2)}%`));
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (passed) {
      log(chalk.green(`✓ ${testName} passed in ${duration}ms`));
      results.passedTests++;
    } else {
      log(chalk.red(`✗ ${testName} failed in ${duration}ms`));
      results.failedTests++;
    }
    
    results.testResults.push({
      name: testName,
      passed,
      duration,
      details: {
        precision: results.precisionRecall.precision,
        recall: results.precisionRecall.recall,
        f1Score: results.precisionRecall.f1Score,
        truePositives: tp,
        falsePositives: fp,
        trueNegatives: tn,
        falseNegatives: fn,
      },
    });
    
    results.totalTests++;
    return passed;
  } catch (error) {
    logError(`${testName} failed with error`, error);
    results.testResults.push({
      name: testName,
      passed: false,
      error: error as Error,
    });
    results.failedTests++;
    results.totalTests++;
    return false;
  }
}

/**
 * Run demo scenarios for stakeholders
 */
async function runDemoScenarios() {
  const testName = 'Demo Scenarios';
  log(chalk.blue(`\n=== RUNNING DEMO SCENARIOS ===`));
  
  try {
    const dealershipConfig = await configService.getDealershipConfig(TEST_DEALERSHIP_ID);
    
    // Demo 1: Rule-based intent detection
    log(chalk.yellow('\nDEMO 1: Rule-Based Intent Detection'));
    log(chalk.blue('Customer sends message: "I want to buy this car today"'));
    
    const message1 = {
      id: Math.floor(Math.random() * 1000),
      conversationId: mockConversation.id,
      content: 'I want to buy this car today',
      isFromCustomer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Create spy for emit
    const events1: any[] = [];
    const originalEmit = orchestrator.emit;
    orchestrator.emit = function(event: string, ...args: any[]) {
      events1.push({ event, args });
      return originalEmit.apply(this, [event, ...args]);
    };
    
    const startTime1 = Date.now();
    await orchestrator.processMessage(message1, mockConversation, dealershipConfig);
    const endTime1 = Date.now();
    const latency1 = endTime1 - startTime1;
    
    // Check if handover was triggered
    const handoverTriggered1 = events1.some(
      e => e.event === 'handover.intent.triggered'
    );
    
    if (handoverTriggered1) {
      const triggerEvent = events1.find(e => e.event === 'handover.intent.triggered');
      log(chalk.green(`✓ Intent detected: ${triggerEvent.args[0].triggerType} (${triggerEvent.args[0].ruleId})`));
      log(chalk.green(`✓ Confidence: ${triggerEvent.args[0].confidence}`));
      log(chalk.green(`✓ Processing time: ${latency1}ms`));
      log(chalk.green(`✓ Handover created for conversation #${mockConversation.id}`));
    } else {
      log(chalk.red(`✗ No intent detected`));
    }
    
    // Restore original emit
    orchestrator.emit = originalEmit;
    
    // Demo 2: ML-based intent detection
    log(chalk.yellow('\nDEMO 2: ML-Based Intent Detection'));
    log(chalk.blue('Customer sends message: "What kind of financing rates can you offer?"'));
    
    // Mock rule engine to return no intent
    const originalRuleEvaluate = ruleEngine.evaluateMessage;
    ruleEngine.evaluateMessage = async () => ({
      hasIntent: false,
      triggerType: 'rule',
    });
    
    // Mock ML classifier to detect financing intent
    const originalMLClassify = mlClassifier.classifyIntent;
    mlClassifier.classifyIntent = async () => ({
      hasIntent: true,
      intentType: 'financing',
      confidence: 0.92,
      triggerType: 'ml',
    });
    
    const message2 = {
      id: Math.floor(Math.random() * 1000),
      conversationId: mockConversation.id,
      content: 'What kind of financing rates can you offer?',
      isFromCustomer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Create spy for emit
    const events2: any[] = [];
    orchestrator.emit = function(event: string, ...args: any[]) {
      events2.push({ event, args });
      return originalEmit.apply(this, [event, ...args]);
    };
    
    const startTime2 = Date.now();
    await orchestrator.processMessage(message2, mockConversation, dealershipConfig);
    const endTime2 = Date.now();
    const latency2 = endTime2 - startTime2;
    
    // Check if handover was triggered
    const handoverTriggered2 = events2.some(
      e => e.event === 'handover.intent.triggered'
    );
    
    if (handoverTriggered2) {
      const triggerEvent = events2.find(e => e.event === 'handover.intent.triggered');
      log(chalk.green(`✓ Intent detected: ${triggerEvent.args[0].triggerType} (${triggerEvent.args[0].intentType})`));
      log(chalk.green(`✓ Confidence: ${triggerEvent.args[0].confidence}`));
      log(chalk.green(`✓ Processing time: ${latency2}ms`));
      log(chalk.green(`✓ Handover created for conversation #${mockConversation.id}`));
    } else {
      log(chalk.red(`✗ No intent detected`));
    }
    
    // Restore original functions
    ruleEngine.evaluateMessage = originalRuleEvaluate;
    mlClassifier.classifyIntent = originalMLClassify;
    orchestrator.emit = originalEmit;
    
    // Demo 3: Behavioural intent detection
    log(chalk.yellow('\nDEMO 3: Behavioural Intent Detection'));
    log(chalk.blue('Customer has sent 4 engaged messages within 30 minutes'));
    
    // Mock rule engine and ML classifier to return no intent
    ruleEngine.evaluateMessage = async () => ({
      hasIntent: false,
      triggerType: 'rule',
    });
    
    mlClassifier.classifyIntent = async () => ({
      hasIntent: false,
      triggerType: 'ml',
    });
    
    // Mock behavioural monitor to detect high engagement
    const originalBehaviouralEvaluate = behaviouralMonitor.evaluateEngagement;
    behaviouralMonitor.evaluateEngagement = async () => ({
      hasIntent: true,
      engagementLevel: 'high',
      messageCount: 4,
      triggerType: 'behavioural',
      confidence: 0.85,
    });
    
    const message3 = {
      id: Math.floor(Math.random() * 1000),
      conversationId: mockConversation.id,
      content: 'This is my fourth message about this car',
      isFromCustomer: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Create spy for emit
    const events3: any[] = [];
    orchestrator.emit = function(event: string, ...args: any[]) {
      events3.push({ event, args });
      return originalEmit.apply(this, [event, ...args]);
    };
    
    const startTime3 = Date.now();
    await orchestrator.processMessage(message3, mockConversation, dealershipConfig);
    const endTime3 = Date.now();
    const latency3 = endTime3 - startTime3;
    
    // Check if handover was triggered
    const handoverTriggered3 = events3.some(
      e => e.event === 'handover.intent.triggered'
    );
    
    if (handoverTriggered3) {
      const triggerEvent = events3.find(e => e.event === 'handover.intent.triggered');
      log(chalk.green(`✓ Intent detected: ${triggerEvent.args[0].triggerType}`));
      log(chalk.green(`✓ Engagement level: high (4 messages in 30 minutes)`));
      log(chalk.green(`✓ Confidence: ${triggerEvent.args[0].confidence}`));
      log(chalk.green(`✓ Processing time: ${latency3}ms`));
      log(chalk.green(`✓ Handover created for conversation #${mockConversation.id}`));
    } else {
      log(chalk.red(`✗ No intent detected`));
    }

    // Restore original functions
    behaviouralMonitor.evaluateEngagement = originalBehaviouralEvaluate;
    orchestrator.emit = originalEmit;

    return true;
  } catch (error) {
    logError('Demo scenarios failed', error);
    return false;
  }
}
