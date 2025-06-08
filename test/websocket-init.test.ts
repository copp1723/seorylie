/**
 * Test for WebSocket Server Initialization Safety
 * Verifies that Ticket #6 fixes are working correctly
 */

import { createServer } from "http";
import WebSocketChatServer from "../server/ws-server";

describe("WebSocket Server Initialization Safety", () => {
  let server: ReturnType<typeof createServer>;
  let wsServer: WebSocketChatServer;

  beforeEach(() => {
    server = createServer();
    wsServer = new WebSocketChatServer();
  });

  afterEach(() => {
    if (wsServer) {
      wsServer.shutdown();
    }
    if (server) {
      server.close();
    }
  });

  test("should initialize WebSocket server without TS2564 errors", () => {
    // This test verifies that the definite assignment assertion works
    expect(() => {
      wsServer.initialize(server);
    }).not.toThrow();
  });

  test("should handle initialization errors gracefully", () => {
    // Test error handling during initialization
    const invalidServer = null as any;

    expect(() => {
      wsServer.initialize(invalidServer);
    }).toThrow("WebSocket server initialization failed");
  });

  test("should prevent operations before initialization", () => {
    // Test that operations fail before initialization
    expect(() => {
      // This would trigger ensureInitialized() check
      (wsServer as any).handleConnection({});
    }).toThrow("WebSocket server not initialized");
  });

  test("should allow operations after initialization", () => {
    wsServer.initialize(server);

    // This should not throw after initialization
    expect(() => {
      wsServer.shutdown();
    }).not.toThrow();
  });

  test("should properly clean up on shutdown", () => {
    wsServer.initialize(server);

    expect(() => {
      wsServer.shutdown();
    }).not.toThrow();

    // After shutdown, operations should fail again
    expect(() => {
      (wsServer as any).handleConnection({});
    }).toThrow("WebSocket server not initialized");
  });
});
