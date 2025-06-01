#!/usr/bin/env tsx

/**
 * Simple validation script to test WebSocket server functionality
 * This bypasses the full build process and directly tests our WebSocket implementation
 */

import { createServer } from 'http';
import express from 'express';
import WebSocket from 'ws';
import { setupWebSocketServer, webSocketServer } from '../../server/websocket';

const PORT = 3001; // Use different port to avoid conflicts

async function testWebSocketServer() {
  console.log('🧪 Testing WebSocket Server Implementation...\n');

  // Create test server
  const app = express();
  const httpServer = createServer(app);

  // Add metrics endpoint
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(`# WebSocket Test Metrics
websocket_connections_total{status="active"} 0
websocket_messages_total{type="ping",direction="received"} 0
websocket_message_processing_duration_seconds_count 0
`);
  });

  // Add health endpoint
  app.get('/health', (req, res) => {
    const status = webSocketServer.getStatus();
    res.json({
      status: 'ok',
      websocket: status,
      timestamp: new Date().toISOString()
    });
  });

  try {
    // Start server
    await new Promise<void>((resolve, reject) => {
      httpServer.listen(PORT, (error?: Error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    console.log(`✅ HTTP server started on port ${PORT}`);

    // Setup WebSocket server
    await setupWebSocketServer(httpServer);
    console.log('✅ WebSocket server setup completed');

    // Test metrics endpoint
    const response = await fetch(`http://localhost:${PORT}/metrics`);
    if (response.ok) {
      console.log('✅ Metrics endpoint accessible');
    } else {
      throw new Error('Metrics endpoint failed');
    }

    // Test health endpoint
    const healthResponse = await fetch(`http://localhost:${PORT}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('✅ Health endpoint accessible:', health.websocket);
    } else {
      throw new Error('Health endpoint failed');
    }

    // Test WebSocket connection
    await testWebSocketConnection();

    console.log('\n🎉 All WebSocket tests passed!');

    // Cleanup
    await webSocketServer.gracefulShutdown();
    httpServer.close();

  } catch (error) {
    console.error('❌ Test failed:', error);
    httpServer.close();
    process.exit(1);
  }
}

async function testWebSocketConnection(): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
    let welcomeReceived = false;
    let testsPassed = 0;
    const totalTests = 3;

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket test timeout'));
    }, 10000);

    ws.on('open', () => {
      console.log('✅ WebSocket connection established');
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'welcome' && !welcomeReceived) {
          welcomeReceived = true;
          console.log('✅ Welcome message received');
          testsPassed++;
          
          // Test ping
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'ping',
              message: 'test ping',
              timestamp: new Date().toISOString(),
              traceId: 'test-trace-id'
            }));
          }, 100);
          
          return;
        }

        if (message.type === 'pong') {
          console.log('✅ Ping/pong test passed');
          testsPassed++;
          
          // Test echo
          setTimeout(() => {
            ws.send(JSON.stringify({
              type: 'echo',
              message: 'Hello WebSocket!',
              timestamp: new Date().toISOString(),
              traceId: 'test-echo-id'
            }));
          }, 100);
          
          return;
        }

        if (message.type === 'echo') {
          console.log('✅ Echo test passed:', message.message);
          testsPassed++;
          
          // All tests passed
          if (testsPassed >= totalTests) {
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
          
          return;
        }

      } catch (error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`Message parsing error: ${error}`));
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${error}`));
    });

    ws.on('close', () => {
      if (testsPassed < totalTests) {
        clearTimeout(timeout);
        reject(new Error(`Tests incomplete: ${testsPassed}/${totalTests} passed`));
      }
    });
  });
}

// Run tests
if (import.meta.url === `file://${process.argv[1]}`) {
  testWebSocketServer().catch(console.error);
}

export { testWebSocketServer };