#!/usr/bin/env tsx
/**
 * ADF-015 Implementation Test Script
 * 
 * This script tests the complete implementation of the customer conversation viewing dashboard
 * including database migrations, API endpoints, WebSocket functionality, and frontend components.
 * 
 * Usage:
 *   npm run test:adf-015
 * 
 * Tests:
 *   1. Database migration and schema changes
 *   2. API endpoints with mock data
 *   3. WebSocket real-time functionality
 *   4. Conversation filtering and pagination
 *   5. Dealership isolation
 *   6. Error handling
 *   7. TypeScript compilation
 *   8. Frontend component rendering
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';
import axios from 'axios';
import WebSocket from 'ws';
import { JSDOM } from 'jsdom';
import { render } from '@testing-library/react';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { db } from '../server/db';
import { conversations, conversationMessages, adfLeads, adfSmsResponses } from '../shared/schema';
import { conversationService } from '../server/services/conversation-service';
import { formatApiResponse } from '../server/utils/api-response';
import { ApiError } from '../server/utils/error-handler';

// Promisify exec
const execAsync = promisify(exec);

// Test configuration
const CONFIG = {
  apiBaseUrl: 'http://localhost:3000/api',
  wsBaseUrl: 'ws://localhost:3000/ws',
  testDealershipId: 1,
  testDealershipId2: 2, // For isolation testing
  testUserId: 1,
  migrationFile: '0014_adf_conversation_integration.sql',
  rollbackFile: '0014_adf_conversation_integration_rollback.sql',
  serverStartTimeout: 10000, // 10 seconds
  testTimeout: 60000, // 60 seconds
};

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: [] as Array<{
    name: string;
    category: string;
    status: 'passed' | 'failed' | 'skipped';
    error?: Error;
    duration?: number;
  }>,
};

// Test utilities
const utils = {
  log: {
    info: (message: string) => console.log(chalk.blue(`[INFO] ${message}`)),
    success: (message: string) => console.log(chalk.green(`[SUCCESS] ${message}`)),
    error: (message: string) => console.log(chalk.red(`[ERROR] ${message}`)),
    warning: (message: string) => console.log(chalk.yellow(`[WARNING] ${message}`)),
    section: (title: string) => console.log(chalk.bold.cyan(`\n=== ${title} ===`)),
  },
  test: async (
    name: string,
    category: string,
    fn: () => Promise<void>
  ) => {
    results.total++;
    const startTime = Date.now();
    try {
      utils.log.info(`Running test: ${name}`);
      await fn();
      const duration = Date.now() - startTime;
      results.passed++;
      results.tests.push({ name, category, status: 'passed', duration });
      utils.log.success(`Test passed: ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      results.failed++;
      results.tests.push({ 
        name, 
        category, 
        status: 'failed', 
        error: error instanceof Error ? error : new Error(String(error)),
        duration 
      });
      utils.log.error(`Test failed: ${name} (${duration}ms)`);
      utils.log.error(error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.log(chalk.red(error.stack.split('\n').slice(1).join('\n')));
      }
    }
  },
  skip: (name: string, category: string, reason: string) => {
    results.total++;
    results.skipped++;
    results.tests.push({ name, category, status: 'skipped' });
    utils.log.warning(`Test skipped: ${name} - ${reason}`);
  },
  summarizeResults: () => {
    utils.log.section('Test Results Summary');
    console.log(chalk.bold(`Total: ${results.total}`));
    console.log(chalk.green(`Passed: ${results.passed}`));
    console.log(chalk.red(`Failed: ${results.failed}`));
    console.log(chalk.yellow(`Skipped: ${results.skipped}`));
    
    if (results.failed > 0) {
      utils.log.section('Failed Tests');
      results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(chalk.red(`- ${test.category}: ${test.name}`));
          if (test.error) {
            console.log(chalk.red(`  ${test.error.message}`));
          }
        });
    }
    
    return results.failed === 0;
  },
  waitForServerReady: async () => {
    const startTime = Date.now();
    while (Date.now() - startTime < CONFIG.serverStartTimeout) {
      try {
        await axios.get(`${CONFIG.apiBaseUrl}/health`);
        return true;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    throw new Error('Server failed to start within timeout period');
  },
  generateMockData: async () => {
    // Create test dealerships if they don't exist
    await db.execute(
      `INSERT INTO dealerships (id, name, status, created_at, updated_at)
       VALUES ($1, 'Test Dealership', 'active', NOW(), NOW()),
              ($2, 'Test Dealership 2', 'active', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [CONFIG.testDealershipId, CONFIG.testDealershipId2]
    );
    
    // Create test user if doesn't exist
    await db.execute(
      `INSERT INTO users (id, email, password_hash, dealership_id, role, created_at, updated_at)
       VALUES ($1, 'test@example.com', 'hash', $2, 'admin', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [CONFIG.testUserId, CONFIG.testDealershipId]
    );
    
    // Create test customers
    const customerIds = [];
    for (let i = 1; i <= 5; i++) {
      const [result] = await db.execute(
        `INSERT INTO customers (first_name, last_name, email, phone, dealership_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         RETURNING id`,
        [`Test${i}`, `Customer${i}`, `test${i}@example.com`, `555-000-${1000 + i}`, 
         i <= 3 ? CONFIG.testDealershipId : CONFIG.testDealershipId2]
      );
      customerIds.push(result.id);
    }
    
    // Create test ADF leads
    const leadIds = [];
    for (let i = 1; i <= 5; i++) {
      const [result] = await db.execute(
        `INSERT INTO adf_leads (
           dealership_id, customer_id, first_name, last_name, email, phone,
           vehicle_of_interest, request_type, source, status, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         RETURNING id`,
        [
          i <= 3 ? CONFIG.testDealershipId : CONFIG.testDealershipId2,
          customerIds[i - 1],
          `Test${i}`,
          `Customer${i}`,
          `test${i}@example.com`,
          `555-000-${1000 + i}`,
          `Test Vehicle ${i}`,
          'info',
          'adf',
          'new',
        ]
      );
      leadIds.push(result.id);
    }
    
    // Create test conversations
    const conversationIds = [];
    for (let i = 1; i <= 10; i++) {
      const leadIndex = (i - 1) % 5;
      const [result] = await db.execute(
        `INSERT INTO conversations (
           dealership_id, customer_id, subject, channel, status, source,
           adf_lead_id, created_at, updated_at, last_activity_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 
                 NOW() - INTERVAL '${i} days', 
                 NOW() - INTERVAL '${i % 3} days', 
                 NOW() - INTERVAL '${i % 3} days')
         RETURNING id`,
        [
          i <= 6 ? CONFIG.testDealershipId : CONFIG.testDealershipId2,
          customerIds[leadIndex],
          `Test Conversation ${i}`,
          i % 2 === 0 ? 'sms' : 'email',
          i % 3 === 0 ? 'completed' : i % 3 === 1 ? 'active' : 'handover',
          'adf',
          leadIds[leadIndex],
        ]
      );
      conversationIds.push(result.id);
    }
    
    // Create test messages
    for (let i = 0; i < conversationIds.length; i++) {
      const conversationId = conversationIds[i];
      const messageCount = 3 + (i % 5); // 3-7 messages per conversation
      
      for (let j = 0; j < messageCount; j++) {
        const isCustomer = j % 2 === 0;
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - i);
        createdAt.setHours(createdAt.getHours() - j);
        
        await db.execute(
          `INSERT INTO conversation_messages (
             conversation_id, content, role, delivery_status,
             ai_confidence, metadata, created_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            conversationId,
            `Test message ${j + 1} for conversation ${i + 1}`,
            isCustomer ? 'customer' : 'ai',
            'delivered',
            isCustomer ? null : 0.85 + (Math.random() * 0.1),
            isCustomer ? {} : { intent: 'test_intent' },
            createdAt,
          ]
        );
      }
      
      // Update conversation message count
      await db.execute(
        `UPDATE conversations 
         SET message_count = $1,
             customer_response_rate = $2,
             average_response_time = $3
         WHERE id = $4`,
        [
          messageCount,
          0.5 + (Math.random() * 0.5),
          30 + (Math.random() * 60),
          conversationId,
        ]
      );
    }
    
    // Create test SMS responses
    for (let i = 0; i < leadIds.length; i++) {
      const leadId = leadIds[i];
      
      await db.execute(
        `INSERT INTO adf_sms_responses (
           adf_lead_id, dealership_id, message, phone_number,
           direction, status, twilio_sid, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          leadId,
          i <= 2 ? CONFIG.testDealershipId : CONFIG.testDealershipId2,
          `Test SMS response for lead ${i + 1}`,
          `555-000-${1000 + i}`,
          'outbound',
          'delivered',
          `SM${Math.random().toString(36).substring(2, 15)}`,
        ]
      );
    }
    
    return {
      customerIds,
      leadIds,
      conversationIds,
    };
  },
  cleanupTestData: async () => {
    // Clean up in reverse order of dependencies
    await db.execute(`DELETE FROM conversation_messages WHERE conversation_id IN (
      SELECT id FROM conversations WHERE dealership_id IN ($1, $2)
    )`, [CONFIG.testDealershipId, CONFIG.testDealershipId2]);
    
    await db.execute(`DELETE FROM conversation_events WHERE conversation_id IN (
      SELECT id FROM conversations WHERE dealership_id IN ($1, $2)
    )`, [CONFIG.testDealershipId, CONFIG.testDealershipId2]);
    
    await db.execute(`DELETE FROM conversations WHERE dealership_id IN ($1, $2)`, 
      [CONFIG.testDealershipId, CONFIG.testDealershipId2]);
    
    await db.execute(`DELETE FROM adf_sms_responses WHERE dealership_id IN ($1, $2)`, 
      [CONFIG.testDealershipId, CONFIG.testDealershipId2]);
    
    await db.execute(`DELETE FROM adf_leads WHERE dealership_id IN ($1, $2)`, 
      [CONFIG.testDealershipId, CONFIG.testDealershipId2]);
    
    await db.execute(`DELETE FROM customers WHERE dealership_id IN ($1, $2)`, 
      [CONFIG.testDealershipId, CONFIG.testDealershipId2]);
  },
  createAuthToken: async (userId: number, dealershipId: number) => {
    // Create a simple JWT token for testing
    const payload = {
      id: userId,
      dealershipId,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    return `Bearer ${token}`;
  },
};

// Test implementation
async function runTests() {
  try {
    utils.log.section('Starting ADF-015 Implementation Tests');
    
    // 1. Test database migration and schema changes
    utils.log.section('Database Migration Tests');
    
    await utils.test('Migration file exists', 'Database', async () => {
      const migrationPath = path.join(__dirname, '../migrations', CONFIG.migrationFile);
      const exists = fs.existsSync(migrationPath);
      if (!exists) {
        throw new Error(`Migration file not found: ${CONFIG.migrationFile}`);
      }
    });
    
    await utils.test('Rollback file exists', 'Database', async () => {
      const rollbackPath = path.join(__dirname, '../migrations', CONFIG.rollbackFile);
      const exists = fs.existsSync(rollbackPath);
      if (!exists) {
        throw new Error(`Rollback file not found: ${CONFIG.rollbackFile}`);
      }
    });
    
    await utils.test('Apply migration', 'Database', async () => {
      const migrationPath = path.join(__dirname, '../migrations', CONFIG.migrationFile);
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute migration SQL directly
      await db.execute(migrationSql);
      
      // Verify migration by checking for new columns and tables
      const client = await db.getClient();
      try {
        // Check for adf_lead_id column in conversations table
        const { rows: columnResult } = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'conversations' AND column_name = 'adf_lead_id'
        `);
        
        if (columnResult.length === 0) {
          throw new Error('Migration failed: adf_lead_id column not found in conversations table');
        }
        
        // Check for conversation_events table
        const { rows: tableResult } = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'conversation_events'
        `);
        
        if (tableResult.length === 0) {
          throw new Error('Migration failed: conversation_events table not found');
        }
        
        // Check for views
        const { rows: viewResult } = await client.query(`
          SELECT table_name 
          FROM information_schema.views 
          WHERE table_name IN ('dealership_conversation_summary', 'customer_conversation_history', 'adf_conversation_metrics')
        `);
        
        if (viewResult.length !== 3) {
          throw new Error('Migration failed: one or more views not created');
        }
        
        // Check for triggers
        const { rows: triggerResult } = await client.query(`
          SELECT trigger_name 
          FROM information_schema.triggers 
          WHERE trigger_name IN ('adf_message_conversation_trigger', 'update_conversation_last_activity', 'update_conversation_status_trigger')
        `);
        
        if (triggerResult.length !== 3) {
          throw new Error('Migration failed: one or more triggers not created');
        }
      } finally {
        client.release();
      }
    });
    
    // Generate test data
    utils.log.section('Test Data Setup');
    let testData;
    
    await utils.test('Generate mock data', 'Setup', async () => {
      testData = await utils.generateMockData();
      if (!testData || !testData.conversationIds || testData.conversationIds.length === 0) {
        throw new Error('Failed to generate test data');
      }
    });
    
    // 2. Test API endpoints with mock data
    utils.log.section('API Endpoint Tests');
    
    // Create auth token for API tests
    const authToken = await utils.createAuthToken(CONFIG.testUserId, CONFIG.testDealershipId);
    
    await utils.test('GET /api/adf/conversations', 'API', async () => {
      const response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations`, {
        headers: { Authorization: authToken },
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      if (!data.conversations || !Array.isArray(data.conversations)) {
        throw new Error('Response does not contain conversations array');
      }
      
      // Verify conversations belong to the correct dealership
      const incorrectDealership = data.conversations.find(
        (c: any) => c.dealershipId !== CONFIG.testDealershipId
      );
      
      if (incorrectDealership) {
        throw new Error('Response contains conversations from incorrect dealership');
      }
      
      // Verify pagination data
      if (typeof data.total !== 'number' || typeof data.page !== 'number' || 
          typeof data.limit !== 'number' || typeof data.totalPages !== 'number') {
        throw new Error('Response missing pagination metadata');
      }
    });
    
    await utils.test('GET /api/adf/conversations with filtering', 'API', async () => {
      // Test status filter
      const statusResponse = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations?status=active`, {
        headers: { Authorization: authToken },
      });
      
      if (statusResponse.status !== 200) {
        throw new Error(`Unexpected status code: ${statusResponse.status}`);
      }
      
      const statusData = statusResponse.data.data;
      
      if (!statusData.conversations.every((c: any) => c.status === 'active')) {
        throw new Error('Status filter not working correctly');
      }
      
      // Test channel filter
      const channelResponse = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations?channel=sms`, {
        headers: { Authorization: authToken },
      });
      
      if (channelResponse.status !== 200) {
        throw new Error(`Unexpected status code: ${channelResponse.status}`);
      }
      
      const channelData = channelResponse.data.data;
      
      if (!channelData.conversations.every((c: any) => c.channel === 'sms')) {
        throw new Error('Channel filter not working correctly');
      }
    });
    
    await utils.test('GET /api/adf/conversations/:id', 'API', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      const conversationId = testData.conversationIds[0];
      const response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}`, {
        headers: { Authorization: authToken },
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      if (data.id !== conversationId) {
        throw new Error('Returned conversation does not match requested ID');
      }
      
      if (data.dealershipId !== CONFIG.testDealershipId) {
        throw new Error('Returned conversation has incorrect dealership ID');
      }
    });
    
    await utils.test('GET /api/adf/conversations/:id/messages', 'API', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      const conversationId = testData.conversationIds[0];
      const response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}/messages`, {
        headers: { Authorization: authToken },
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      if (!data.messages || !Array.isArray(data.messages)) {
        throw new Error('Response does not contain messages array');
      }
      
      // Verify all messages belong to the requested conversation
      const incorrectConversation = data.messages.find(
        (m: any) => m.conversationId !== conversationId
      );
      
      if (incorrectConversation) {
        throw new Error('Response contains messages from incorrect conversation');
      }
      
      // Verify cursor pagination
      if (typeof data.nextCursor !== 'string' && data.nextCursor !== undefined) {
        throw new Error('Response missing nextCursor');
      }
    });
    
    await utils.test('GET /api/adf/conversations/:id/lead-context', 'API', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      const conversationId = testData.conversationIds[0];
      const response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}/lead-context`, {
        headers: { Authorization: authToken },
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      // Lead context could be null if no ADF lead is associated
      if (data && typeof data === 'object') {
        if (data.dealershipId !== CONFIG.testDealershipId) {
          throw new Error('Lead context has incorrect dealership ID');
        }
      }
    });
    
    await utils.test('POST /api/adf/conversations/:id/status', 'API', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      const conversationId = testData.conversationIds[0];
      const response = await axios.post(
        `${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}/status`,
        { status: 'completed' },
        { headers: { Authorization: authToken } }
      );
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      if (data.conversationId !== conversationId || data.status !== 'completed') {
        throw new Error('Status update response incorrect');
      }
      
      // Verify the status was actually updated
      const verifyResponse = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}`, {
        headers: { Authorization: authToken },
      });
      
      if (verifyResponse.data.data.status !== 'completed') {
        throw new Error('Status was not updated in the database');
      }
    });
    
    await utils.test('GET /api/adf/conversations/stats', 'API', async () => {
      const response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/stats`, {
        headers: { Authorization: authToken },
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      // Verify stats structure
      if (typeof data.total !== 'number' || 
          typeof data.active !== 'number' || 
          typeof data.completed !== 'number' || 
          typeof data.messagesSent !== 'number' || 
          typeof data.messagesReceived !== 'number') {
        throw new Error('Stats response missing required fields');
      }
      
      // Verify byDay data if present
      if (data.byDay && !Array.isArray(data.byDay)) {
        throw new Error('byDay stats is not an array');
      }
    });
    
    // 3. Test WebSocket real-time functionality
    utils.log.section('WebSocket Tests');
    
    await utils.test('WebSocket connection and channel subscription', 'WebSocket', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${CONFIG.wsBaseUrl}/dealership/${CONFIG.testDealershipId}/conversations`);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
        
        ws.on('open', () => {
          // Send subscription message
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: `dealership/${CONFIG.testDealershipId}/conversations`,
            timestamp: new Date().toISOString()
          }));
          
          // Wait for confirmation or just assume it worked after a delay
          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }, 1000);
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`WebSocket error: ${error.message}`));
        });
      });
    });
    
    await utils.test('WebSocket real-time updates', 'WebSocket', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      return new Promise<void>((resolve, reject) => {
        const conversationId = testData.conversationIds[0];
        const ws = new WebSocket(`${CONFIG.wsBaseUrl}/dealership/${CONFIG.testDealershipId}/conversations`);
        
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket test timeout'));
        }, 10000);
        
        ws.on('open', async () => {
          // Subscribe to conversation updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: `dealership/${CONFIG.testDealershipId}/conversations`,
            timestamp: new Date().toISOString()
          }));
          
          // Wait a moment for subscription to be processed
          await new Promise(r => setTimeout(r, 1000));
          
          // Update conversation status to trigger event
          try {
            await axios.post(
              `${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}/status`,
              { status: 'active' },
              { headers: { Authorization: authToken } }
            );
          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`Failed to trigger conversation update: ${error}`));
          }
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            // Check if this is the update event we're expecting
            if (message.type === 'conversation_updated' && 
                message.data && 
                message.data.conversationId === conversationId) {
              clearTimeout(timeout);
              ws.close();
              resolve();
            }
          } catch (error) {
            // Ignore parsing errors
          }
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`WebSocket error: ${error.message}`));
        });
      });
    });
    
    // 4. Test conversation filtering and pagination
    utils.log.section('Filtering and Pagination Tests');
    
    await utils.test('Pagination with limit and page parameters', 'Pagination', async () => {
      // First page with limit=2
      const page1Response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations?limit=2&page=1`, {
        headers: { Authorization: authToken },
      });
      
      if (page1Response.status !== 200) {
        throw new Error(`Unexpected status code: ${page1Response.status}`);
      }
      
      const page1Data = page1Response.data.data;
      
      if (!page1Data.conversations || page1Data.conversations.length !== 2) {
        throw new Error('First page should contain exactly 2 conversations');
      }
      
      // Second page with limit=2
      const page2Response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations?limit=2&page=2`, {
        headers: { Authorization: authToken },
      });
      
      if (page2Response.status !== 200) {
        throw new Error(`Unexpected status code: ${page2Response.status}`);
      }
      
      const page2Data = page2Response.data.data;
      
      if (!page2Data.conversations) {
        throw new Error('Second page response missing conversations array');
      }
      
      // Verify different conversations on different pages
      if (page1Data.conversations[0].id === page2Data.conversations[0].id) {
        throw new Error('Pagination not working correctly - same conversations on different pages');
      }
    });
    
    await utils.test('Cursor-based pagination for messages', 'Pagination', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      const conversationId = testData.conversationIds[0];
      
      // First page
      const page1Response = await axios.get(
        `${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}/messages?limit=2`, 
        { headers: { Authorization: authToken } }
      );
      
      if (page1Response.status !== 200) {
        throw new Error(`Unexpected status code: ${page1Response.status}`);
      }
      
      const page1Data = page1Response.data.data;
      
      if (!page1Data.messages || !Array.isArray(page1Data.messages)) {
        throw new Error('First page response missing messages array');
      }
      
      if (!page1Data.nextCursor) {
        throw new Error('First page response missing nextCursor');
      }
      
      // Second page using cursor
      const page2Response = await axios.get(
        `${CONFIG.apiBaseUrl}/adf/conversations/${conversationId}/messages?cursor=${page1Data.nextCursor}&limit=2`, 
        { headers: { Authorization: authToken } }
      );
      
      if (page2Response.status !== 200) {
        throw new Error(`Unexpected status code: ${page2Response.status}`);
      }
      
      const page2Data = page2Response.data.data;
      
      if (!page2Data.messages || !Array.isArray(page2Data.messages)) {
        throw new Error('Second page response missing messages array');
      }
      
      // Verify different messages on different pages
      if (page1Data.messages.length > 0 && page2Data.messages.length > 0 &&
          page1Data.messages[0].id === page2Data.messages[0].id) {
        throw new Error('Cursor pagination not working correctly - same messages on different pages');
      }
    });
    
    await utils.test('Complex filtering combinations', 'Filtering', async () => {
      // Test multiple filters: status=active, channel=sms, date range
      const today = new Date();
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);
      
      const startDate = oneMonthAgo.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      const response = await axios.get(
        `${CONFIG.apiBaseUrl}/adf/conversations?status=active&channel=sms&startDate=${startDate}&endDate=${endDate}`, 
        { headers: { Authorization: authToken } }
      );
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      // Verify all returned conversations match all filters
      const invalidConversation = data.conversations.find(
        (c: any) => c.status !== 'active' || c.channel !== 'sms'
      );
      
      if (invalidConversation) {
        throw new Error('Complex filtering not working correctly');
      }
    });
    
    await utils.test('Search functionality', 'Filtering', async () => {
      // Test search parameter with a term that should match some conversations
      const response = await axios.get(
        `${CONFIG.apiBaseUrl}/adf/conversations?search=Test`, 
        { headers: { Authorization: authToken } }
      );
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      // Verify search returned results (we expect at least some matches)
      if (!data.conversations || data.conversations.length === 0) {
        throw new Error('Search functionality not working correctly - no results found');
      }
    });
    
    // 5. Test dealership isolation
    utils.log.section('Dealership Isolation Tests');
    
    await utils.test('Dealership isolation for conversations', 'Security', async () => {
      // Create auth token for second dealership
      const dealership2Token = await utils.createAuthToken(CONFIG.testUserId, CONFIG.testDealershipId2);
      
      // Get conversations for second dealership
      const response = await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations`, {
        headers: { Authorization: dealership2Token },
      });
      
      if (response.status !== 200) {
        throw new Error(`Unexpected status code: ${response.status}`);
      }
      
      const { data } = response.data;
      
      // Verify all conversations belong to the second dealership
      const incorrectDealership = data.conversations.find(
        (c: any) => c.dealershipId !== CONFIG.testDealershipId2
      );
      
      if (incorrectDealership) {
        throw new Error('Dealership isolation not working correctly');
      }
    });
    
    await utils.test('Dealership isolation for conversation details', 'Security', async () => {
      if (!testData || !testData.conversationIds) {
        throw new Error('Test data not available');
      }
      
      // Try to access a conversation from dealership 1 with dealership 2 token
      const dealership2Token = await utils.createAuthToken(CONFIG.testUserId, CONFIG.testDealershipId2);
      const dealership1ConversationId = testData.conversationIds[0]; // Should be from dealership 1
      
      try {
        await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/${dealership1ConversationId}`, {
          headers: { Authorization: dealership2Token },
        });
        
        // If we get here, the request succeeded when it should have failed
        throw new Error('Dealership isolation not working correctly - able to access conversation from different dealership');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          // Expect 403 or 404 status code
          if (error.response.status !== 403 && error.response.status !== 404) {
            throw new Error(`Expected 403 or 404 status code, got ${error.response.status}`);
          }
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    });
    
    // 6. Test error handling
    utils.log.section('Error Handling Tests');
    
    await utils.test('Invalid conversation ID', 'Error Handling', async () => {
      try {
        await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations/999999`, {
          headers: { Authorization: authToken },
        });
        
        // If we get here, the request succeeded when it should have failed
        throw new Error('Error handling not working correctly - invalid conversation ID should return error');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status !== 404) {
            throw new Error(`Expected 404 status code, got ${error.response.status}`);
          }
          
          // Verify error response format
          const { success, error: errorCode, message } = error.response.data;
          
          if (success !== false || !errorCode || !message) {
            throw new Error('Error response format incorrect');
          }
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    });
    
    await utils.test('Invalid query parameters', 'Error Handling', async () => {
      try {
        await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations?limit=invalid`, {
          headers: { Authorization: authToken },
        });
        
        // If we get here, the request succeeded when it should have failed
        throw new Error('Error handling not working correctly - invalid parameters should return error');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status !== 400) {
            throw new Error(`Expected 400 status code, got ${error.response.status}`);
          }
          
          // Verify error response format
          const { success, error: errorCode, details } = error.response.data;
          
          if (success !== false || !errorCode || !details) {
            throw new Error('Error response format incorrect');
          }
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    });
    
    await utils.test('Unauthorized access', 'Error Handling', async () => {
      try {
        await axios.get(`${CONFIG.apiBaseUrl}/adf/conversations`);
        
        // If we get here, the request succeeded when it should have failed
        throw new Error('Error handling not working correctly - unauthorized access should return error');
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          if (error.response.status !== 401 && error.response.status !== 403) {
            throw new Error(`Expected 401 or 403 status code, got ${error.response.status}`);
          }
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    });
    
    // 7. Test TypeScript compilation
    utils.log.section('TypeScript Compilation Tests');
    
    await utils.test('TypeScript compilation', 'TypeScript', async () => {
      const result = await execAsync('npx tsc --noEmit server/routes/adf-conversation-routes.ts');
      
      // If compilation fails, exec will throw an error
      // If we get here, compilation succeeded
    });
    
    // 8. Test frontend component rendering
    utils.log.section('Frontend Component Tests');
    
    // Skip frontend tests if running in CI environment
    if (process.env.CI) {
      utils.skip('Frontend component rendering', 'Frontend', 'Skipped in CI environment');
    } else {
      await utils.test('Chat message component rendering', 'Frontend', async () => {
        // Create a simple DOM environment for testing
        const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', {
          url: 'http://localhost/',
          runScripts: 'dangerously',
        });
        
        global.window = dom.window;
        global.document = dom.window.document;
        global.navigator = dom.window.navigator;
        
        // Import the component (this is simplified - in a real test you'd use a proper test renderer)
        const ChatMessage = require('../client/src/components/chat-message').ChatMessage;
        
        // Render the component with test props
        const { container } = render(
          ChatMessage({
            message: 'Test message',
            role: 'ai',
            timestamp: '2025-05-30T12:00:00Z',
            status: 'delivered',
            confidence: 0.95,
            metadata: { intent: 'test_intent' },
          })
        );
        
        // Basic check that the component rendered something
        if (!container || container.innerHTML.length === 0) {
          throw new Error('ChatMessage component failed to render');
        }
        
        // Check that the message text is present
        if (!container.innerHTML.includes('Test message')) {
          throw new Error('ChatMessage component did not render message text');
        }
      });
    }
    
    // Clean up test data
    utils.log.section('Test Cleanup');
    
    await utils.test('Clean up test data', 'Cleanup', async () => {
      await utils.cleanupTestData();
    });
    
    await utils.test('Rollback migration', 'Cleanup', async () => {
      const rollbackPath = path.join(__dirname, '../migrations', CONFIG.rollbackFile);
      const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
      
      // Execute rollback SQL directly
      await db.execute(rollbackSql);
      
      // Verify rollback by checking that new columns and tables are gone
      const client = await db.getClient();
      try {
        // Check that adf_lead_id column is gone from conversations table
        const { rows: columnResult } = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'conversations' AND column_name = 'adf_lead_id'
        `);
        
        if (columnResult.length > 0) {
          throw new Error('Rollback failed: adf_lead_id column still exists in conversations table');
        }
        
        // Check that conversation_events table is gone
        const { rows: tableResult } = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name = 'conversation_events'
        `);
        
        if (tableResult.length > 0) {
          throw new Error('Rollback failed: conversation_events table still exists');
        }
      } finally {
        client.release();
      }
    });
    
    // Summarize results
    const success = utils.summarizeResults();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  } catch (error) {
    utils.log.error('Test runner error:');
    utils.log.error(error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.log(chalk.red(error.stack));
    }
    process.exit(1);
  } finally {
    // Close database connection
    await db.end();
  }
}

// Run the tests
runTests();
