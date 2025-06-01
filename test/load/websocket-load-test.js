/**
 * Load test for WebSocket Server
 * 
 * This test simulates multiple concurrent WebSocket connections
 * and measures performance characteristics.
 */

import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

// Custom metrics
const wsConnections = new Gauge('websocket_connections');
const wsMessages = new Counter('websocket_messages');
const wsErrors = new Counter('websocket_errors');
const wsConnectionTime = new Trend('websocket_connection_time');
const wsMessageLatency = new Trend('websocket_message_latency');
const wsSuccessRate = new Rate('websocket_success_rate');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 20 },   // Ramp up to 20 users
    { duration: '2m', target: 20 },   // Stay at 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    websocket_connections: ['value<=50'],           // Max 50 concurrent connections
    websocket_message_latency: ['p(95)<1000'],     // 95% of messages under 1s
    websocket_success_rate: ['rate>0.95'],         // 95% success rate
    websocket_connection_time: ['p(95)<5000'],     // 95% of connections under 5s
  },
};

// WebSocket URL - should match your server configuration
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000/ws';

export default function () {
  const startTime = Date.now();
  
  // Establish WebSocket connection
  const response = ws.connect(WS_URL, {}, function (socket) {
    const connectionTime = Date.now() - startTime;
    wsConnectionTime.add(connectionTime);
    wsConnections.add(1);

    let messageCount = 0;
    let welcomeReceived = false;

    socket.on('open', () => {
      console.log(`WebSocket connection established for VU ${__VU}`);
    });

    socket.on('message', (data) => {
      messageCount++;
      wsMessages.add(1);
      
      try {
        const message = JSON.parse(data);
        
        // Handle welcome message
        if (message.type === 'welcome' && !welcomeReceived) {
          welcomeReceived = true;
          console.log(`VU ${__VU}: Received welcome message`);
          
          // Start sending test messages after welcome
          setTimeout(() => {
            sendTestMessages(socket);
          }, 100);
          
          return;
        }

        // Validate message structure
        check(message, {
          'message has type': (msg) => msg.type !== undefined,
          'message has timestamp': (msg) => msg.timestamp !== undefined,
          'message has traceId': (msg) => msg.traceId !== undefined,
        });

        // Handle different message types
        switch (message.type) {
          case 'pong':
            console.log(`VU ${__VU}: Received pong response`);
            wsSuccessRate.add(1);
            break;
          case 'echo':
            console.log(`VU ${__VU}: Received echo response: ${message.message}`);
            wsSuccessRate.add(1);
            break;
          case 'error':
            console.log(`VU ${__VU}: Received error: ${message.message}`);
            wsErrors.add(1);
            wsSuccessRate.add(0);
            break;
          default:
            console.log(`VU ${__VU}: Received unknown message type: ${message.type}`);
        }

      } catch (error) {
        console.error(`VU ${__VU}: Error parsing message:`, error);
        wsErrors.add(1);
        wsSuccessRate.add(0);
      }
    });

    socket.on('close', () => {
      console.log(`VU ${__VU}: WebSocket connection closed, messages received: ${messageCount}`);
      wsConnections.add(-1);
    });

    socket.on('error', (error) => {
      console.error(`VU ${__VU}: WebSocket error:`, error);
      wsErrors.add(1);
      wsSuccessRate.add(0);
    });

    // Keep connection alive for test duration
    sleep(Math.random() * 10 + 30); // 30-40 seconds
  });

  // Check connection establishment
  check(response, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });

  if (!response || response.status !== 101) {
    wsErrors.add(1);
    wsSuccessRate.add(0);
    console.error(`VU ${__VU}: Failed to establish WebSocket connection`);
  }
}

/**
 * Send test messages through WebSocket
 */
function sendTestMessages(socket) {
  const messages = [
    {
      type: 'ping',
      message: 'load test ping',
      timestamp: new Date().toISOString(),
      traceId: `load-test-${__VU}-${Date.now()}`
    },
    {
      type: 'echo',
      message: `Load test message from VU ${__VU}`,
      timestamp: new Date().toISOString(),
      traceId: `load-test-echo-${__VU}-${Date.now()}`
    }
  ];

  // Send messages with intervals
  messages.forEach((message, index) => {
    setTimeout(() => {
      const sendTime = Date.now();
      
      try {
        socket.send(JSON.stringify(message));
        console.log(`VU ${__VU}: Sent ${message.type} message`);
        
        // Track message latency (simplified - in real scenario you'd correlate with responses)
        wsMessageLatency.add(Date.now() - sendTime);
        
      } catch (error) {
        console.error(`VU ${__VU}: Error sending message:`, error);
        wsErrors.add(1);
        wsSuccessRate.add(0);
      }
    }, index * 1000); // Send messages 1 second apart
  });

  // Send periodic ping messages
  const pingInterval = setInterval(() => {
    try {
      socket.send(JSON.stringify({
        type: 'ping',
        message: 'heartbeat',
        timestamp: new Date().toISOString(),
        traceId: `heartbeat-${__VU}-${Date.now()}`
      }));
    } catch (error) {
      console.error(`VU ${__VU}: Error sending heartbeat:`, error);
      clearInterval(pingInterval);
    }
  }, 10000); // Every 10 seconds

  // Clean up interval when connection closes
  setTimeout(() => {
    clearInterval(pingInterval);
  }, 35000); // Clean up after 35 seconds
}

/**
 * Setup function - runs once per VU before the main function
 */
export function setup() {
  console.log('Starting WebSocket load test...');
  console.log(`Target URL: ${WS_URL}`);
  console.log(`Test stages: ${JSON.stringify(options.stages)}`);
}

/**
 * Teardown function - runs once per VU after all iterations
 */
export function teardown() {
  console.log('WebSocket load test completed');
}