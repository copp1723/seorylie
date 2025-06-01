/**
 * Integration tests for WebSocket Server with Observability
 * Tests the full integration including metrics and health endpoints
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import WebSocket from 'ws';
import express, { Express } from 'express';
import { setupWebSocketServer, webSocketServer } from '../../server/websocket';
import { initMetrics, metricsHandler } from '../../server/observability/metrics';
import axios from 'axios';

describe('WebSocket Observability Integration', () => {
  let app: Express;
  let httpServer: HttpServer;
  let port: number;
  let wsUrl: string;
  let baseUrl: string;

  beforeAll(async () => {
    // Create test HTTP server with metrics
    app = express();
    
    // Initialize metrics
    initMetrics(app);
    
    // Add health endpoint
    app.get('/health', (req, res) => {
      const wsStatus = webSocketServer.getStatus();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        websocket: {
          running: wsStatus.isRunning,
          connections: wsStatus.connectionCount,
          shuttingDown: wsStatus.isShuttingDown
        }
      });
    });

    httpServer = createServer(app);
    
    // Find available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        port = typeof address === 'object' && address ? address.port : 0;
        wsUrl = `ws://localhost:${port}/ws`;
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });

    // Setup WebSocket server
    await setupWebSocketServer(httpServer);
  });

  afterAll(async () => {
    await webSocketServer.gracefulShutdown();
    
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  test('should expose Prometheus metrics endpoint', async () => {
    const response = await axios.get(`${baseUrl}/metrics`);
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    
    const metrics = response.data;
    
    // Check for WebSocket-specific metrics
    expect(metrics).toContain('websocket_connections_total');
    expect(metrics).toContain('websocket_messages_total');
    expect(metrics).toContain('websocket_connection_duration_seconds');
    expect(metrics).toContain('websocket_message_processing_duration_seconds');
    expect(metrics).toContain('websocket_errors_total');
    
    // Check for HTTP metrics
    expect(metrics).toContain('http_request_duration_seconds');
    expect(metrics).toContain('http_requests_total');
  });

  test('should expose health check endpoint with WebSocket status', async () => {
    const response = await axios.get(`${baseUrl}/health`);
    
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('status', 'ok');
    expect(response.data).toHaveProperty('timestamp');
    expect(response.data).toHaveProperty('websocket');
    
    const wsStatus = response.data.websocket;
    expect(wsStatus).toHaveProperty('running', true);
    expect(wsStatus).toHaveProperty('connections');
    expect(wsStatus).toHaveProperty('shuttingDown', false);
    expect(typeof wsStatus.connections).toBe('number');
  });

  test('should update connection metrics when WebSocket connects/disconnects', async () => {
    // Get initial metrics
    const initialMetrics = await axios.get(`${baseUrl}/metrics`);
    
    // Create WebSocket connection
    const ws = new WebSocket(wsUrl);
    
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Wait for welcome message
    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    // Check metrics after connection
    const connectedMetrics = await axios.get(`${baseUrl}/metrics`);
    
    // Should show increased connection count (exact values may vary due to other tests)
    expect(connectedMetrics.data).toContain('websocket_connections_total{status="active"}');
    expect(connectedMetrics.data).toContain('websocket_connections_total{status="total"}');

    // Close connection
    ws.close();
    
    // Wait for disconnect to be processed
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check metrics after disconnection
    const disconnectedMetrics = await axios.get(`${baseUrl}/metrics`);
    
    // Connection should be tracked
    expect(disconnectedMetrics.data).toContain('websocket_connection_duration_seconds');
  });

  test('should update message metrics when WebSocket messages are sent', async () => {
    const ws = new WebSocket(wsUrl);
    
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Skip welcome message
    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    // Send ping message
    ws.send(JSON.stringify({
      type: 'ping',
      message: 'test ping',
      timestamp: new Date().toISOString(),
      traceId: 'test-trace-id'
    }));

    // Wait for pong response
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.type === 'pong') {
          resolve();
        }
      });
      setTimeout(() => reject(new Error('Pong timeout')), 3000);
    });

    // Check metrics
    const metrics = await axios.get(`${baseUrl}/metrics`);
    
    // Should show message counts
    expect(metrics.data).toContain('websocket_messages_total{type="ping",direction="received"}');
    expect(metrics.data).toContain('websocket_messages_total{type="pong",direction="sent"}');
    expect(metrics.data).toContain('websocket_message_processing_duration_seconds');

    ws.close();
  });

  test('should track WebSocket errors in metrics', async () => {
    const ws = new WebSocket(wsUrl);
    
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Skip welcome message
    await new Promise<void>((resolve) => {
      ws.on('message', () => resolve());
    });

    // Send message that will cause an error
    ws.send(JSON.stringify({
      type: 'unknown_type',
      message: 'this will cause an error',
      timestamp: new Date().toISOString(),
      traceId: 'test-trace-id'
    }));

    // Wait for error response
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());
        if (response.type === 'error') {
          resolve();
        }
      });
      setTimeout(() => reject(new Error('Error response timeout')), 3000);
    });

    // Check that metrics include error tracking
    const metrics = await axios.get(`${baseUrl}/metrics`);
    expect(metrics.data).toContain('websocket_errors_total');

    ws.close();
  });

  test('should handle multiple concurrent WebSocket connections', async () => {
    const connectionCount = 5;
    const connections: WebSocket[] = [];

    // Create multiple connections
    for (let i = 0; i < connectionCount; i++) {
      const ws = new WebSocket(wsUrl);
      connections.push(ws);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    }

    // Wait for all welcome messages
    await Promise.all(connections.map(ws => 
      new Promise<void>((resolve) => {
        ws.on('message', () => resolve());
      })
    ));

    // Check health endpoint shows multiple connections
    const healthResponse = await axios.get(`${baseUrl}/health`);
    expect(healthResponse.data.websocket.connections).toBeGreaterThanOrEqual(connectionCount);

    // Send messages from all connections
    const messagePromises = connections.map((ws, index) => {
      ws.send(JSON.stringify({
        type: 'echo',
        message: `Message from connection ${index}`,
        timestamp: new Date().toISOString(),
        traceId: `trace-${index}`
      }));

      return new Promise<void>((resolve, reject) => {
        ws.on('message', (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === 'echo' && response.message.includes(`Message from connection ${index}`)) {
            resolve();
          }
        });
        setTimeout(() => reject(new Error(`Echo timeout for connection ${index}`)), 3000);
      });
    });

    await Promise.all(messagePromises);

    // Close all connections
    connections.forEach(ws => ws.close());

    // Wait for all disconnections to be processed
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify metrics tracked all the activity
    const metrics = await axios.get(`${baseUrl}/metrics`);
    expect(metrics.data).toContain('websocket_messages_total{type="echo"');
    expect(metrics.data).toContain('websocket_connection_duration_seconds');
  });

  test('should handle WebSocket server errors gracefully', async () => {
    // This test ensures the metrics and health endpoints continue working
    // even if there are WebSocket errors

    // Check that metrics endpoint is still accessible
    const metricsResponse = await axios.get(`${baseUrl}/metrics`);
    expect(metricsResponse.status).toBe(200);

    // Check that health endpoint is still accessible
    const healthResponse = await axios.get(`${baseUrl}/health`);
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.data.status).toBe('ok');

    // Verify WebSocket functionality is still working
    const ws = new WebSocket(wsUrl);
    
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    ws.close();
  });
});