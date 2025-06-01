/**
 * Unit tests for WebSocket Server with Observability
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer, Server as HttpServer } from 'http';
import WebSocket from 'ws';
import { setupWebSocketServer, webSocketServer } from '../../server/websocket';
import { Express } from 'express';
import express from 'express';

// Mock logger to avoid console output during tests
vi.mock('../../server/utils/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock prometheus metrics
vi.mock('prom-client', () => ({
  default: {
    register: {
      registerMetric: vi.fn()
    },
    Gauge: vi.fn().mockImplementation(() => ({
      labels: vi.fn().mockReturnValue({
        inc: vi.fn(),
        dec: vi.fn(),
        set: vi.fn()
      }),
      inc: vi.fn(),
      dec: vi.fn(),
      set: vi.fn()
    })),
    Counter: vi.fn().mockImplementation(() => ({
      labels: vi.fn().mockReturnValue({
        inc: vi.fn()
      }),
      inc: vi.fn()
    })),
    Histogram: vi.fn().mockImplementation(() => ({
      labels: vi.fn().mockReturnValue({
        observe: vi.fn()
      }),
      observe: vi.fn()
    })),
    exponentialBuckets: vi.fn().mockReturnValue([1, 2, 4, 8])
  }
}));

// Mock OpenTelemetry
vi.mock('../../server/observability/tracing', () => ({
  withSpan: vi.fn().mockImplementation(async (name, fn) => fn(mockSpan)),
  createCrossServiceSpan: vi.fn().mockReturnValue(mockSpan),
  recordSpanError: vi.fn()
}));

const mockSpan = {
  setAttributes: vi.fn(),
  setAttribute: vi.fn(),
  end: vi.fn()
};

describe('WebSocket Server with Observability', () => {
  let app: Express;
  let httpServer: HttpServer;
  let port: number;
  let wsUrl: string;
  let activeConnections: WebSocket[] = [];

  beforeAll(async () => {
    // Create test HTTP server
    app = express();
    httpServer = createServer(app);

    // Find available port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        port = typeof address === 'object' && address ? address.port : 0;
        wsUrl = `ws://localhost:${port}/ws`;
        resolve();
      });
    });

    // Setup WebSocket server
    await setupWebSocketServer(httpServer);
  });

  afterAll(async () => {
    // Close all active connections
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    activeConnections = [];

    // Cleanup
    await webSocketServer.gracefulShutdown();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  beforeEach(() => {
    // Clear any existing connections
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Close any connections created during the test
    activeConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    activeConnections = [];
  });

  test('should establish WebSocket connection successfully', async () => {
    const ws = new WebSocket(wsUrl);
    activeConnections.push(ws);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        expect(webSocketServer.getConnectionCount()).toBeGreaterThan(0);
        resolve();
      });

      ws.on('error', reject);

      // Set timeout to avoid hanging
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Verify welcome message received
    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          expect(message.type).toBe('welcome');
          expect(message.message).toContain('WebSocket connection established');
          expect(message.metadata?.connectionId).toBeDefined();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      setTimeout(() => reject(new Error('Welcome message timeout')), 2000);
    });
  });

  test('should handle ping/pong echo functionality', async () => {
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

    // Test ping/pong
    const pingMessage = {
      type: 'ping',
      message: 'test ping',
      timestamp: new Date().toISOString(),
      traceId: 'test-trace-id'
    };

    ws.send(JSON.stringify(pingMessage));

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'pong') {
            expect(response.type).toBe('pong');
            expect(response.message).toBe('test ping');
            expect(response.traceId).toBeDefined();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      setTimeout(() => reject(new Error('Pong response timeout')), 3000);
    });

    ws.close();
  });

  test('should handle echo functionality', async () => {
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

    // Test echo
    const echoMessage = {
      type: 'echo',
      message: 'Hello WebSocket!',
      timestamp: new Date().toISOString(),
      traceId: 'test-trace-id'
    };

    ws.send(JSON.stringify(echoMessage));

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'echo') {
            expect(response.type).toBe('echo');
            expect(response.message).toBe('Echo: Hello WebSocket!');
            expect(response.metadata?.originalMessage).toBe('Hello WebSocket!');
            expect(response.traceId).toBeDefined();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      setTimeout(() => reject(new Error('Echo response timeout')), 3000);
    });

    ws.close();
  });

  test('should handle plain text messages as echo', async () => {
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

    // Send plain text message
    ws.send('Hello plain text!');

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'echo') {
            expect(response.type).toBe('echo');
            expect(response.message).toBe('Echo: Hello plain text!');
            expect(response.metadata?.originalMessage).toBe('Hello plain text!');
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      setTimeout(() => reject(new Error('Plain text echo timeout')), 3000);
    });

    ws.close();
  });

  test('should handle unknown message types', async () => {
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

    // Send unknown message type
    const unknownMessage = {
      type: 'unknown_type',
      message: 'test message',
      timestamp: new Date().toISOString(),
      traceId: 'test-trace-id'
    };

    ws.send(JSON.stringify(unknownMessage));

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === 'error') {
            expect(response.type).toBe('error');
            expect(response.message).toContain('Unknown message type: unknown_type');
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      setTimeout(() => reject(new Error('Error response timeout')), 3000);
    });

    ws.close();
  });

  test('should handle malformed JSON messages', async () => {
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

    // Send malformed JSON (should be treated as plain text)
    ws.send('{ invalid json }');

    await new Promise<void>((resolve, reject) => {
      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());
          // Should handle as echo since JSON parsing fails
          if (response.type === 'echo') {
            expect(response.type).toBe('echo');
            expect(response.message).toBe('Echo: { invalid json }');
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
      
      setTimeout(() => reject(new Error('Malformed JSON response timeout')), 3000);
    });

    ws.close();
  });

  test('should track connection count correctly', async () => {
    const initialCount = webSocketServer.getConnectionCount();
    
    const ws1 = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws1.on('open', resolve);
      ws1.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    expect(webSocketServer.getConnectionCount()).toBe(initialCount + 1);

    const ws2 = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws2.on('open', resolve);
      ws2.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    expect(webSocketServer.getConnectionCount()).toBe(initialCount + 2);

    ws1.close();
    
    // Wait for close event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(webSocketServer.getConnectionCount()).toBe(initialCount + 1);

    ws2.close();
    
    // Wait for close event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(webSocketServer.getConnectionCount()).toBe(initialCount);
  });

  test('should return correct server status', () => {
    const status = webSocketServer.getStatus();
    
    expect(status).toHaveProperty('isRunning');
    expect(status).toHaveProperty('connectionCount');
    expect(status).toHaveProperty('isShuttingDown');
    expect(typeof status.isRunning).toBe('boolean');
    expect(typeof status.connectionCount).toBe('number');
    expect(typeof status.isShuttingDown).toBe('boolean');
  });

  test('should handle connection errors gracefully', async () => {
    const ws = new WebSocket(wsUrl);
    
    await new Promise<void>((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    const initialCount = webSocketServer.getConnectionCount();

    // Force an error by sending invalid data types (this will be handled gracefully)
    // The WebSocket should remain open as our server handles errors gracefully
    ws.send(JSON.stringify({ type: 'ping', message: 'test' }));

    // Verify connection is still tracked correctly
    expect(webSocketServer.getConnectionCount()).toBe(initialCount);

    ws.close();
  });
});