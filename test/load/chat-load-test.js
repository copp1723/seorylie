import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { config, generateChatMessage, getRandomDealership } from './config.js';

// Custom metrics
const wsConnectionTime = new Trend('ws_connection_time');
const messageLatency = new Trend('message_latency');
const messagesReceived = new Counter('messages_received');
const connectionErrors = new Counter('connection_errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 concurrent connections
    { duration: '1m', target: 10 },   // Stay at 10 connections
    { duration: '30s', target: 25 },  // Ramp up to 25 connections
    { duration: '2m', target: 25 },   // Stay at 25 connections
    { duration: '30s', target: 50 },  // Ramp up to 50 connections
    { duration: '2m', target: 50 },   // Stay at 50 connections
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    ws_connection_time: ['p(95)<500'],
    message_latency: ['p(95)<500', 'p(99)<1000'],
    connection_errors: ['rate<0.05'], // Less than 5% connection errors
  },
};

export function setup() {
  console.log('WebSocket/Chat Load Test Setup');
  return { 
    baseUrl: config.baseUrl.replace('http', 'ws'),
    wsPath: '/ws'
  };
}

export default function(data) {
  const wsUrl = `${data.baseUrl}${data.wsPath}`;
  const dealership = getRandomDealership();
  
  // Track connection time
  const connectionStart = Date.now();
  
  const response = ws.connect(wsUrl, {}, function (socket) {
    const connectionTime = Date.now() - connectionStart;
    wsConnectionTime.add(connectionTime);
    
    socket.on('open', function open() {
      console.log('WebSocket connection established');
      
      // Send initial connection message with user info
      const connectMessage = {
        type: 'connect',
        dealershipId: dealership.id,
        userId: Math.floor(Math.random() * 1000) + 1,
        userType: Math.random() > 0.5 ? 'customer' : 'agent',
        timestamp: new Date().toISOString()
      };
      
      socket.send(JSON.stringify(connectMessage));
    });
    
    socket.on('message', function (message) {
      messagesReceived.add(1);
      
      try {
        const data = JSON.parse(message);
        console.log('Received message:', data.type);
        
        // Calculate message latency if timestamp is available
        if (data.timestamp) {
          const latency = Date.now() - new Date(data.timestamp).getTime();
          messageLatency.add(latency);
        }
        
        // Respond to certain message types
        if (data.type === 'connect') {
          // Start sending chat messages
          sendChatMessages(socket, dealership);
        }
        
      } catch (e) {
        console.log('Error parsing message:', e);
      }
    });
    
    socket.on('error', function (e) {
      connectionErrors.add(1);
      console.log('WebSocket error:', e);
    });
    
    socket.on('close', function () {
      console.log('WebSocket connection closed');
    });
    
    // Keep connection alive for test duration
    socket.setTimeout(function () {
      console.log('Closing WebSocket connection');
      socket.close();
    }, 30000); // 30 seconds per connection
  });
  
  check(response, {
    'WebSocket connection successful': (r) => r && r.status === 101,
  });
  
  if (!response || response.status !== 101) {
    connectionErrors.add(1);
  }
}

function sendChatMessages(socket, dealership) {
  // Send multiple chat messages with delays
  const messageCount = Math.floor(Math.random() * 5) + 3; // 3-7 messages
  
  for (let i = 0; i < messageCount; i++) {
    setTimeout(() => {
      const messageStart = Date.now();
      
      const chatMessage = {
        type: 'chat_message',
        dealershipId: dealership.id,
        conversationId: `test-conv-${Math.floor(Math.random() * 100)}`,
        message: generateChatMessage(),
        timestamp: new Date().toISOString(),
        messageId: `msg-${Date.now()}-${Math.random()}`
      };
      
      socket.send(JSON.stringify(chatMessage));
      
      // Simulate typing indicator
      setTimeout(() => {
        const typingMessage = {
          type: 'typing',
          dealershipId: dealership.id,
          conversationId: chatMessage.conversationId,
          isTyping: Math.random() > 0.5,
          timestamp: new Date().toISOString()
        };
        
        socket.send(JSON.stringify(typingMessage));
      }, Math.random() * 2000 + 500); // 0.5-2.5 seconds
      
    }, i * (Math.random() * 3000 + 1000)); // 1-4 seconds between messages
  }
}

// Test AI conversation flow
function testAIConversation(socket, dealership) {
  const conversationId = `ai-test-${Date.now()}`;
  
  // Simulate customer inquiry
  const customerMessage = {
    type: 'chat_message',
    dealershipId: dealership.id,
    conversationId: conversationId,
    senderType: 'customer',
    message: "I'm looking for a reliable family car under $30,000",
    timestamp: new Date().toISOString()
  };
  
  socket.send(JSON.stringify(customerMessage));
  
  // Wait for AI response
  setTimeout(() => {
    // Simulate follow-up question
    const followUpMessage = {
      type: 'chat_message',
      dealershipId: dealership.id,
      conversationId: conversationId,
      senderType: 'customer',
      message: "Do you have any Toyota or Honda vehicles available?",
      timestamp: new Date().toISOString()
    };
    
    socket.send(JSON.stringify(followUpMessage));
  }, 5000);
}

// Test agent handover scenario
function testAgentHandover(socket, dealership) {
  const conversationId = `handover-test-${Date.now()}`;
  
  // Simulate escalation trigger
  const escalationMessage = {
    type: 'chat_message',
    dealershipId: dealership.id,
    conversationId: conversationId,
    senderType: 'customer',
    message: "I want to speak to a human agent right now!",
    timestamp: new Date().toISOString(),
    metadata: {
      escalationTrigger: true
    }
  };
  
  socket.send(JSON.stringify(escalationMessage));
  
  // Simulate agent joining
  setTimeout(() => {
    const agentJoinMessage = {
      type: 'agent_join',
      dealershipId: dealership.id,
      conversationId: conversationId,
      agentId: Math.floor(Math.random() * 10) + 1,
      timestamp: new Date().toISOString()
    };
    
    socket.send(JSON.stringify(agentJoinMessage));
  }, 2000);
}

export function teardown(data) {
  console.log('WebSocket/Chat Load Test Complete');
}
