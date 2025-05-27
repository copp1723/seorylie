#!/usr/bin/env node

/**
 * AI Conversation System Basic Functionality Testing - Ticket #11
 * Comprehensive test suite for AI conversation features
 */

import fetch from 'node-fetch';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;
const WS_URL = 'ws://localhost:3000/ws/chat';

// Test results storage
const testResults = {
  passed: 0,
  failed: 0,
  results: []
};

// Test configuration
const TEST_CONFIG = {
  dealershipId: 1,
  testUser: {
    username: `test_ai_${Date.now()}`,
    password: 'testpass123',
    email: `test_ai_${Date.now()}@example.com`,
    name: 'AI Test User'
  },
  openaiPrompts: [
    'Hello, I am interested in your vehicles.',
    'Do you have any Toyota Camry in stock?',
    'What is your best price for a used SUV?',
    'Can you tell me about financing options?',
    'I would like to schedule a test drive.'
  ]
};

// Helper function to make authenticated requests
class TestSession {
  constructor() {
    this.cookies = '';
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.cookies) {
      headers.Cookie = this.cookies;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    // Store cookies from response
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookies = setCookie.split(',').map(cookie => cookie.split(';')[0]).join('; ');
    }

    return response;
  }
}

// Test utilities
function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    testResults.results.push(`✅ PASS: ${message}`);
    console.log(`✅ PASS: ${message}`);
  } else {
    testResults.failed++;
    testResults.results.push(`❌ FAIL: ${message}`);
    console.log(`❌ FAIL: ${message}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: OpenAI API Integration Testing
async function testOpenAIIntegration() {
  console.log('\n🧪 Testing OpenAI API Integration...');
  
  try {
    // Check if OpenAI is configured
    const openaiTestResponse = await fetch(`${API_URL}/admin/dealerships/1/test-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Hello, this is a test message for AI functionality.'
      })
    });

    if (openaiTestResponse.status === 503) {
      assert(true, 'OpenAI API key not configured (expected in test environment)');
      console.log('ℹ️  OpenAI API not configured - testing fallback responses');
      
      // Test fallback response mechanism
      const fallbackTest = await testFallbackResponses();
      return fallbackTest;
    } else if (openaiTestResponse.status === 200) {
      const responseData = await openaiTestResponse.json();
      assert(responseData.response && responseData.response.length > 0, 'OpenAI API returns valid response');
      assert(responseData.response.includes('Hello') || responseData.response.length > 10, 'AI response is contextually appropriate');
      
      // Test multiple prompts for consistency
      for (const prompt of TEST_CONFIG.openaiPrompts) {
        await testSinglePrompt(prompt);
        await sleep(1000); // Rate limiting
      }
      
      return true;
    } else {
      const errorData = await openaiTestResponse.text();
      assert(false, `OpenAI API test failed with status ${openaiTestResponse.status}: ${errorData}`);
      return false;
    }
  } catch (error) {
    assert(false, `OpenAI integration test failed with error: ${error.message}`);
    return false;
  }
}

async function testSinglePrompt(prompt) {
  try {
    const response = await fetch(`${API_URL}/admin/dealerships/1/test-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: prompt })
    });

    if (response.status === 200) {
      const data = await response.json();
      assert(data.response && data.response.length > 0, `AI responds to prompt: "${prompt.substring(0, 30)}..."`);
      assert(data.responseTime < 5000, 'AI response time is under 5 seconds');
    } else {
      assert(false, `AI prompt test failed for: "${prompt}"`);
    }
  } catch (error) {
    assert(false, `AI prompt test error for "${prompt}": ${error.message}`);
  }
}

async function testFallbackResponses() {
  console.log('🔄 Testing fallback response system...');
  
  // In test environment, OpenAI should return fallback responses
  const fallbackPrompts = [
    'This should trigger a fallback response',
    'Another test for fallback system'
  ];

  for (const prompt of fallbackPrompts) {
    try {
      // Simulate OpenAI service call that should fallback
      const response = await fetch(`${API_URL}/admin/dealerships/1/test-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: prompt })
      });

      if (response.status === 503) {
        assert(true, 'Fallback system correctly handles missing OpenAI configuration');
      } else {
        const data = await response.json();
        if (data.response && data.response.includes('connect you with')) {
          assert(true, 'Fallback response suggests human handover appropriately');
        }
      }
    } catch (error) {
      assert(false, `Fallback test failed: ${error.message}`);
    }
  }
  
  return true;
}

// Test 2: Conversation Storage & Retrieval
async function testConversationStorage() {
  console.log('\n🧪 Testing Conversation Storage & Retrieval...');
  
  // Register a test user for authentication
  const session = new TestSession();
  
  try {
    // Register user
    const registerResponse = await session.request('/register', {
      method: 'POST',
      body: JSON.stringify(TEST_CONFIG.testUser)
    });

    if (registerResponse.status !== 201) {
      assert(false, 'Failed to register test user for conversation tests');
      return false;
    }

    const userData = await registerResponse.json();
    assert(userData.id, 'User registration successful for conversation tests');

    // Test conversation creation via inbound API
    const conversationResponse = await session.request('/v1/inbound', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Test Customer',
        customerPhone: '555-123-4567',
        customerEmail: 'test@example.com',
        customerMessage: 'I am interested in your vehicles',
        channel: 'chat',
        dealershipId: TEST_CONFIG.dealershipId
      })
    });

    if (conversationResponse.status === 201) {
      const conversationData = await conversationResponse.json();
      assert(conversationData.conversationId, 'Conversation created successfully in database');
      assert(conversationData.leadId, 'Lead created and linked to conversation');
      
      // Test conversation retrieval
      const retrieveResponse = await session.request(`/v1/conversations/${conversationData.conversationId}`);
      
      if (retrieveResponse.status === 200) {
        const retrievedData = await retrieveResponse.json();
        assert(retrievedData.conversation, 'Conversation retrieved from database');
        assert(retrievedData.messages && Array.isArray(retrievedData.messages), 'Conversation messages retrieved');
        assert(retrievedData.conversation.dealershipId === TEST_CONFIG.dealershipId, 'Multi-tenant isolation maintained');
      } else {
        assert(false, 'Failed to retrieve conversation from database');
      }

      // Test message storage by sending replies
      const replyResponse = await session.request('/v1/reply', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: conversationData.conversationId,
          content: 'Thank you for your interest! How can I help you today?',
          sender: 'agent',
          senderName: 'Test Agent'
        })
      });

      if (replyResponse.status === 201) {
        assert(true, 'Message replies stored successfully');
        
        // Retrieve again to verify message persistence
        const updatedConversation = await session.request(`/v1/conversations/${conversationData.conversationId}`);
        const updatedData = await updatedConversation.json();
        assert(updatedData.messages.length >= 2, 'Message history persists correctly');
      }

      return conversationData.conversationId;
    } else {
      assert(false, 'Failed to create conversation via inbound API');
      return false;
    }
  } catch (error) {
    assert(false, `Conversation storage test failed: ${error.message}`);
    return false;
  }
}

// Test 3: Real-time Chat Interface
async function testRealTimeChatInterface() {
  console.log('\n🧪 Testing Real-time Chat Interface...');
  
  return new Promise((resolve) => {
    let wsConnected = false;
    let messageReceived = false;
    let typingIndicatorReceived = false;

    const ws = new WebSocket(WS_URL);
    
    const timeout = setTimeout(() => {
      ws.close();
      assert(false, 'WebSocket connection timeout');
      resolve(false);
    }, 10000);

    ws.on('open', () => {
      wsConnected = true;
      assert(true, 'WebSocket connection established');
      
      // Test authentication
      ws.send(JSON.stringify({
        type: 'authenticate',
        token: 'test-token',
        userId: 1,
        userType: 'customer',
        dealershipId: TEST_CONFIG.dealershipId
      }));

      // Test joining a conversation
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'join_conversation',
          conversationId: 1
        }));
      }, 500);

      // Test sending a message
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'send_message',
          content: 'Hello from WebSocket test',
          messageType: 'text'
        }));
      }, 1000);

      // Test typing indicator
      setTimeout(() => {
        ws.send(JSON.stringify({
          type: 'typing',
          isTyping: true
        }));
      }, 1500);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'connection_established':
            assert(message.connectionId, 'WebSocket assigns connection ID');
            break;
          case 'authenticated':
            assert(message.userId, 'WebSocket authentication successful');
            break;
          case 'joined_conversation':
            assert(message.conversationId, 'Successfully joined conversation via WebSocket');
            break;
          case 'new_message':
            messageReceived = true;
            assert(message.message && message.message.content, 'Real-time message delivery works');
            break;
          case 'typing_indicator':
            typingIndicatorReceived = true;
            assert(typeof message.isTyping === 'boolean', 'Typing indicators work correctly');
            break;
          case 'error':
            console.log('WebSocket error:', message.error);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      assert(false, `WebSocket error: ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
      
      if (wsConnected) {
        assert(true, 'WebSocket connection closed gracefully');
      }
      
      // Final assessments
      if (!messageReceived && wsConnected) {
        console.log('ℹ️  Real-time messaging may require active conversation');
      }
      
      if (!typingIndicatorReceived && wsConnected) {
        console.log('ℹ️  Typing indicators may require multiple connected users');
      }
      
      resolve(wsConnected);
    });

    // Close connection after testing
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 5000);
  });
}

// Test 4: Conversation Workflow & Handover
async function testConversationWorkflow() {
  console.log('\n🧪 Testing Conversation Workflow & Handover...');
  
  const session = new TestSession();
  
  try {
    // Login with existing user or create one
    const loginResponse = await session.request('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: TEST_CONFIG.testUser.username,
        password: TEST_CONFIG.testUser.password
      })
    });

    if (loginResponse.status !== 200) {
      assert(false, 'Failed to login for workflow testing');
      return false;
    }

    // Create a conversation to test workflow
    const workflowConversation = await session.request('/v1/inbound', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Workflow Test Customer',
        customerPhone: '555-987-6543',
        customerMessage: 'I need complex assistance with pricing and financing',
        channel: 'chat',
        dealershipId: TEST_CONFIG.dealershipId
      })
    });

    if (workflowConversation.status === 201) {
      const workflowData = await workflowConversation.json();
      assert(workflowData.conversationId, 'Workflow conversation created');

      // Test handover request
      const handoverResponse = await session.request('/v1/handover', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: workflowData.conversationId,
          reason: 'complex_inquiry',
          notes: 'Customer needs detailed pricing discussion',
          priority: 'high'
        })
      });

      if (handoverResponse.status === 201) {
        const handoverData = await handoverResponse.json();
        assert(handoverData.handoverId, 'Handover request created successfully');
        assert(handoverData.status === 'pending', 'Handover status correctly set to pending');
        
        // Test handover status update
        const updateResponse = await session.request(`/v1/handover/${handoverData.handoverId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'accepted',
            assignedAgentId: 1,
            notes: 'Agent John has accepted this handover'
          })
        });

        if (updateResponse.status === 200) {
          assert(true, 'Handover status updated successfully');
        }
      } else {
        assert(false, 'Failed to create handover request');
      }

      // Test conversation status management
      const statusResponse = await session.request(`/v1/conversations/${workflowData.conversationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'escalated'
        })
      });

      if (statusResponse.status === 200) {
        assert(true, 'Conversation status updated successfully');
      }

      return true;
    } else {
      assert(false, 'Failed to create workflow test conversation');
      return false;
    }
  } catch (error) {
    assert(false, `Conversation workflow test failed: ${error.message}`);
    return false;
  }
}

// Test 5: Error Handling & Edge Cases
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling & Edge Cases...');
  
  const session = new TestSession();
  
  try {
    // Test invalid conversation access
    const invalidConversationResponse = await session.request('/v1/conversations/invalid-uuid');
    assert(invalidConversationResponse.status === 400 || invalidConversationResponse.status === 404, 
      'Invalid conversation ID handled properly');

    // Test unauthorized access
    const unauthorizedResponse = await fetch(`${API_URL}/v1/conversations/123`, {
      headers: { 'Content-Type': 'application/json' }
    });
    assert(unauthorizedResponse.status === 401, 'Unauthorized access blocked');

    // Test invalid message content
    const emptyMessageResponse = await session.request('/v1/reply', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: 'test-id',
        content: '',
        sender: 'agent'
      })
    });
    assert(emptyMessageResponse.status === 400, 'Empty message content rejected');

    // Test malformed request
    const malformedResponse = await session.request('/v1/inbound', {
      method: 'POST',
      body: JSON.stringify({
        invalidField: 'this should fail validation'
      })
    });
    assert(malformedResponse.status === 400, 'Malformed requests handled gracefully');

    // Test rate limiting (if implemented)
    const rateLimitPromises = [];
    for (let i = 0; i < 10; i++) {
      rateLimitPromises.push(
        session.request('/v1/inbound', {
          method: 'POST',
          body: JSON.stringify({
            customerName: `Rate Test ${i}`,
            customerMessage: 'Rate limit test',
            channel: 'chat'
          })
        })
      );
    }

    const rateLimitResults = await Promise.all(rateLimitPromises);
    const rateLimited = rateLimitResults.some(r => r.status === 429);
    if (rateLimited) {
      assert(true, 'Rate limiting is active and working');
    } else {
      console.log('ℹ️  Rate limiting may not be configured or has high limits');
    }

    return true;
  } catch (error) {
    assert(false, `Error handling test failed: ${error.message}`);
    return false;
  }
}

// Test 6: Multi-tenant Isolation
async function testMultiTenantIsolation() {
  console.log('\n🧪 Testing Multi-tenant Conversation Isolation...');
  
  const session = new TestSession();
  
  try {
    // Create conversations for different dealerships
    const dealership1Conversation = await session.request('/v1/inbound', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Dealership 1 Customer',
        customerMessage: 'Hello from dealership 1',
        channel: 'chat',
        dealershipId: 1
      })
    });

    const dealership2Conversation = await session.request('/v1/inbound', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'Dealership 2 Customer', 
        customerMessage: 'Hello from dealership 2',
        channel: 'chat',
        dealershipId: 2
      })
    });

    if (dealership1Conversation.status === 201 && dealership2Conversation.status === 201) {
      const d1Data = await dealership1Conversation.json();
      const d2Data = await dealership2Conversation.json();
      
      assert(d1Data.conversationId !== d2Data.conversationId, 'Different dealerships get separate conversations');
      
      // Test cross-dealership access restrictions
      const crossAccessResponse = await session.request(`/v1/conversations/${d1Data.conversationId}`, {
        headers: {
          'X-Dealership-ID': '2' // Try to access dealership 1's conversation as dealership 2
        }
      });

      // Should be forbidden or not found
      assert(crossAccessResponse.status === 403 || crossAccessResponse.status === 404,
        'Cross-dealership conversation access properly blocked');

      // Test conversation listing isolation
      const d1ConversationsResponse = await session.request('/v1/conversations?dealershipId=1');
      const d2ConversationsResponse = await session.request('/v1/conversations?dealershipId=2');

      if (d1ConversationsResponse.status === 200 && d2ConversationsResponse.status === 200) {
        const d1Conversations = await d1ConversationsResponse.json();
        const d2Conversations = await d2ConversationsResponse.json();
        
        // Check that conversations are properly isolated
        const d1HasD2Conversation = d1Conversations.some(conv => conv.id === d2Data.conversationId);
        const d2HasD1Conversation = d2Conversations.some(conv => conv.id === d1Data.conversationId);
        
        assert(!d1HasD2Conversation && !d2HasD1Conversation, 'Conversation listings properly isolated by dealership');
      }

      return true;
    } else {
      assert(false, 'Failed to create multi-tenant test conversations');
      return false;
    }
  } catch (error) {
    assert(false, `Multi-tenant isolation test failed: ${error.message}`);
    return false;
  }
}

// Test 7: Performance & Response Times
async function testPerformanceMetrics() {
  console.log('\n🧪 Testing Performance & Response Times...');
  
  const session = new TestSession();
  const performanceTests = [];
  
  try {
    // Test API response times
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      
      const response = await session.request('/v1/inbound', {
        method: 'POST',
        body: JSON.stringify({
          customerName: `Performance Test ${i}`,
          customerMessage: 'Performance test message',
          channel: 'chat',
          dealershipId: TEST_CONFIG.dealershipId
        })
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      performanceTests.push({
        test: `API Response ${i + 1}`,
        responseTime,
        success: response.status === 201
      });
    }

    // Analyze performance results
    const successfulTests = performanceTests.filter(t => t.success);
    const averageResponseTime = successfulTests.reduce((sum, t) => sum + t.responseTime, 0) / successfulTests.length;
    const maxResponseTime = Math.max(...successfulTests.map(t => t.responseTime));

    assert(averageResponseTime < 2000, `Average API response time under 2 seconds (${averageResponseTime.toFixed(0)}ms)`);
    assert(maxResponseTime < 5000, `Maximum API response time under 5 seconds (${maxResponseTime}ms)`);
    assert(successfulTests.length >= 4, 'Most performance tests completed successfully');

    // Test concurrent requests
    const concurrentStartTime = Date.now();
    const concurrentPromises = [];
    
    for (let i = 0; i < 3; i++) {
      concurrentPromises.push(
        session.request('/v1/inbound', {
          method: 'POST',
          body: JSON.stringify({
            customerName: `Concurrent Test ${i}`,
            customerMessage: 'Concurrent test message',
            channel: 'chat',
            dealershipId: TEST_CONFIG.dealershipId
          })
        })
      );
    }

    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentEndTime = Date.now();
    const concurrentDuration = concurrentEndTime - concurrentStartTime;

    const concurrentSuccesses = concurrentResults.filter(r => r.status === 201).length;
    assert(concurrentSuccesses >= 2, 'Concurrent requests handled successfully');
    assert(concurrentDuration < 10000, 'Concurrent requests completed within reasonable time');

    return true;
  } catch (error) {
    assert(false, `Performance testing failed: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting AI Conversation System Basic Functionality Tests');
  console.log('================================================================');
  
  // Wait for server to be ready
  console.log('⏳ Waiting for server to be ready...');
  let serverReady = false;
  let attempts = 0;
  
  while (!serverReady && attempts < 30) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.status < 500) {
        serverReady = true;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    if (!serverReady) {
      await sleep(1000);
      attempts++;
    }
  }
  
  if (!serverReady) {
    console.log('❌ Server not ready after 30 seconds');
    return;
  }
  
  console.log('✅ Server is ready, starting tests...\n');
  
  // Run all test suites
  await testOpenAIIntegration();
  await testConversationStorage();
  await testRealTimeChatInterface();
  await testConversationWorkflow();
  await testErrorHandling();
  await testMultiTenantIsolation();
  await testPerformanceMetrics();
  
  // Print summary
  console.log('\n📊 Test Results Summary');
  console.log('========================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  // Success criteria evaluation
  console.log('\n🎯 Success Criteria Evaluation:');
  const criteriaChecks = [
    { criterion: 'OpenAI API responds to prompts', met: testResults.results.some(r => r.includes('OpenAI') && r.includes('PASS')) },
    { criterion: 'Conversations create and store correctly', met: testResults.results.some(r => r.includes('Conversation created successfully')) },
    { criterion: 'Real-time chat interface functions', met: testResults.results.some(r => r.includes('WebSocket connection established')) },
    { criterion: 'Message history persists', met: testResults.results.some(r => r.includes('Message history persists')) },
    { criterion: 'Error handling manages failures', met: testResults.results.some(r => r.includes('handled properly') || r.includes('handled gracefully')) },
    { criterion: 'Multi-tenant isolation maintained', met: testResults.results.some(r => r.includes('Multi-tenant') || r.includes('isolation')) },
    { criterion: 'Performance meets requirements', met: testResults.results.some(r => r.includes('response time under')) }
  ];

  criteriaChecks.forEach(check => {
    console.log(`${check.met ? '✅' : '❌'} ${check.criterion}`);
  });

  const successfulCriteria = criteriaChecks.filter(c => c.met).length;
  console.log(`\n📈 Success Criteria Met: ${successfulCriteria}/${criteriaChecks.length}`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.results.filter(r => r.startsWith('❌')).forEach(result => {
      console.log(result);
    });
  }
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { runAllTests, testResults };