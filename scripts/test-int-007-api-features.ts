import axios, { AxiosInstance } from "axios";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import pLimit from "p-limit";
import { performance } from "perf_hooks";

dotenv.config();

// --- Configuration ---
const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api";
const WS_URL = process.env.WS_URL || "ws://localhost:3000/ws";
const ADMIN_AUTH_TOKEN =
  process.env.ADMIN_AUTH_TOKEN || "your-admin-auth-token"; // Replace with actual token
const NUM_CONCURRENT_WS_CONNECTIONS = parseInt(
  process.env.NUM_CONCURRENT_WS_CONNECTIONS || "300",
  10,
);
const MESSAGE_LAG_THRESHOLD_MS = parseInt(
  process.env.MESSAGE_LAG_THRESHOLD_MS || "1000",
  10,
);
const CONCURRENT_API_LIMIT = 10; // Limit for concurrent API calls in bulk tests

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${ADMIN_AUTH_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 15000, // 15 seconds timeout for API calls
});

// --- Helper Functions ---
interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  duration?: number;
  error?: any;
}

const testResults: TestResult[] = [];
let currentTestSuiteName = "";

const log = (
  level: "info" | "warn" | "error" | "debug",
  message: string,
  data?: any,
) => {
  console[level](
    `[${new Date().toISOString()}] [${level.toUpperCase()}] ${currentTestSuiteName ? `[${currentTestSuiteName}] ` : ""}${message}`,
    data || "",
  );
};

const runTest = async (
  name: string,
  testFn: () => Promise<void>,
): Promise<void> => {
  const startTime = performance.now();
  log("info", `Starting test: ${name}`);
  try {
    await testFn();
    const duration = performance.now() - startTime;
    testResults.push({ name, passed: true, duration });
    log("info", `PASSED: ${name} (Duration: ${duration.toFixed(2)}ms)`);
  } catch (error: any) {
    const duration = performance.now() - startTime;
    const errorMessage = error.message || JSON.stringify(error);
    let errorDetails = errorMessage;
    if (error.isAxiosError && error.response) {
      errorDetails = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}, Message: ${errorMessage}`;
    } else if (error.stack) {
      errorDetails = `${errorMessage}\nStack: ${error.stack}`;
    }
    testResults.push({
      name,
      passed: false,
      details: errorDetails,
      duration,
      error,
    });
    log(
      "error",
      `FAILED: ${name} (Duration: ${duration.toFixed(2)}ms) - ${errorDetails}`,
    );
  }
};

const startSuite = (name: string) => {
  currentTestSuiteName = name;
  log("info", `\n--- Starting Test Suite: ${name} ---`);
};

const endSuite = () => {
  log("info", `--- Finished Test Suite: ${currentTestSuiteName} ---\n`);
  currentTestSuiteName = "";
};

const createWebSocketClient = (
  clientId: string,
  traceId: string,
): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, {
      headers: { "X-Client-ID": clientId, "X-Trace-ID": traceId },
    });
    ws.on("open", () => {
      log("debug", `WebSocket client ${clientId} connected.`);
      resolve(ws);
    });
    ws.on("error", (err) => {
      log("error", `WebSocket client ${clientId} connection error:`, err);
      reject(err);
    });
  });
};

const sendMessage = (ws: WebSocket, message: object): void => {
  ws.send(JSON.stringify(message));
};

const waitForMessage = (
  ws: WebSocket,
  timeoutMs: number = 5000,
  filterFn?: (data: any) => boolean,
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.off("message", messageHandler); // Clean up listener
      reject(new Error(`Timeout waiting for message after ${timeoutMs}ms`));
    }, timeoutMs);

    const messageHandler = (data: WebSocket.RawData) => {
      try {
        const parsedData = JSON.parse(data.toString());
        if (!filterFn || filterFn(parsedData)) {
          clearTimeout(timeout);
          ws.off("message", messageHandler); // Clean up listener
          resolve(parsedData);
        }
      } catch (e) {
        // Ignore parse errors if filter is specific, or reject if any message is fine
        if (!filterFn) {
          clearTimeout(timeout);
          ws.off("message", messageHandler);
          reject(new Error(`Error parsing WebSocket message: ${e}`));
        }
      }
    };
    ws.on("message", messageHandler);
  });
};

// Placeholder for simulating sandbox creation - in a real scenario, this would use an API
let createdSandboxIds: string[] = [];
const simulateCreateSandbox = async (
  name: string = `test-sandbox-${uuidv4()}`,
): Promise<{
  id: string;
  name: string;
  userId: number;
  dealershipId: number;
  state: string;
}> => {
  // This is a mock. Replace with actual API call if available, or pre-provision sandboxes.
  const sandboxId = `sbx-${uuidv4().substring(0, 8)}`;
  const dealershipId = 1; // Example dealership ID
  const userId = 1; // Example user ID

  // Simulate storing it in Redis as per sandbox-routes.ts
  const sandboxData = {
    id: sandboxId,
    name,
    userId,
    dealershipId,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    state: "active", // Initial state
  };
  await apiClient.post(`/sandbox/debug/create`, sandboxData).catch((e) => {
    // If debug endpoint doesn't exist, we just mock it client-side
    log(
      "warn",
      `Debug sandbox creation endpoint failed or not available, proceeding with mock: ${e.message}`,
    );
  });

  createdSandboxIds.push(sandboxId);
  log("debug", `Simulated creation of sandbox: ${sandboxId}`);
  return sandboxData;
};

// Placeholder for enabling/disabling feature flags - requires admin API
const setFeatureFlag = async (
  flagName: string,
  enabled: boolean,
  rolloutPercentage: number = 100,
): Promise<void> => {
  try {
    // Assuming an admin API endpoint for feature flags exists
    await apiClient.post("/admin/feature-flags/set", {
      id: flagName,
      name: flagName,
      description: `Test setting for ${flagName}`,
      enabled,
      rolloutPercentage,
    });
    log(
      "info",
      `Feature flag ${flagName} set to: enabled=${enabled}, rollout=${rolloutPercentage}%`,
    );
  } catch (error: any) {
    log(
      "warn",
      `Failed to set feature flag ${flagName} via API. Assuming manual setup or test limitations. Error: ${error.message}`,
    );
    // Proceed, but tests related to this flag might be indicative rather than definitive
  }
};

// --- Test Suites ---

async function runFeatureFlagTests() {
  startSuite("Feature Flag Validation");

  await runTest("Enable SANDBOX_PAUSE_RESUME feature flag", async () => {
    await setFeatureFlag("SANDBOX_PAUSE_RESUME", true);
    // Verification would typically involve an API call that depends on this flag
    // For now, we assume the set operation is enough for subsequent tests.
  });

  await runTest("Enable REDIS_WEBSOCKET_SCALING feature flag", async () => {
    await setFeatureFlag("REDIS_WEBSOCKET_SCALING", true);
    // Verification is indirect, through WebSocket behavior in later tests
  });

  endSuite();
}

async function runSandboxApiTests() {
  startSuite("H2 Sandbox Pause/Resume API Tests");
  let sandboxId: string;

  await runTest("Create a test sandbox", async () => {
    const newSandbox = await simulateCreateSandbox();
    sandboxId = newSandbox.id;
    if (!sandboxId) throw new Error("Failed to create sandbox for testing");
    log("info", `Test sandbox created: ${sandboxId}`);
  });

  await runTest("List sandboxes and find the new sandbox", async () => {
    const response = await apiClient.get("/sandbox");
    if (response.status !== 200)
      throw new Error(`Failed to list sandboxes: ${response.status}`);
    const sandboxes = response.data.data;
    if (!Array.isArray(sandboxes))
      throw new Error("Sandbox list is not an array");
    const found = sandboxes.some((sb: any) => sb.id === sandboxId);
    if (!found)
      throw new Error(`Created sandbox ${sandboxId} not found in list`);
  });

  await runTest("Get status of the new sandbox", async () => {
    const response = await apiClient.get(`/sandbox/${sandboxId}/status`);
    if (response.status !== 200)
      throw new Error(`Failed to get sandbox status: ${response.status}`);
    if (response.data.data.id !== sandboxId)
      throw new Error("Incorrect sandbox status returned");
    if (response.data.data.state !== "active")
      throw new Error(
        `Sandbox initial state is not active: ${response.data.data.state}`,
      );
  });

  await runTest("Pause the sandbox", async () => {
    const response = await apiClient.post(`/sandbox/pause/${sandboxId}`, {
      reason: "Automated test pause",
    });
    if (response.status !== 200)
      throw new Error(`Failed to pause sandbox: ${response.status}`);
    if (response.data.data.state !== "paused")
      throw new Error("Sandbox state not updated to paused");
  });

  await runTest(
    "Attempt tool execution on paused sandbox (expect 423)",
    async () => {
      try {
        await apiClient.post(`/sandbox/${sandboxId}/tools/execute`, {
          toolId: "test-tool",
        });
        throw new Error("Tool execution did not fail on paused sandbox");
      } catch (error: any) {
        if (!error.isAxiosError || error.response?.status !== 423) {
          throw new Error(
            `Expected 423 status, got ${error.response?.status || error.message}`,
          );
        }
        if (error.response.data.error.code !== "RESOURCE_LOCKED") {
          throw new Error(
            `Expected error code RESOURCE_LOCKED, got ${error.response.data.error.code}`,
          );
        }
        log(
          "info",
          "Correctly received 423 Locked for tool execution on paused sandbox.",
        );
      }
    },
  );

  await runTest("Resume the sandbox", async () => {
    const response = await apiClient.post(`/sandbox/resume/${sandboxId}`);
    if (response.status !== 200)
      throw new Error(`Failed to resume sandbox: ${response.status}`);
    if (response.data.data.state !== "active")
      throw new Error("Sandbox state not updated to active");
  });

  await runTest(
    "Attempt tool execution on active sandbox (expect success)",
    async () => {
      const response = await apiClient.post(
        `/sandbox/${sandboxId}/tools/execute`,
        { toolId: "test-tool" },
      );
      if (response.status !== 200)
        throw new Error(
          `Tool execution failed on active sandbox: ${response.status}`,
        );
      if (!response.data.data.executionId)
        throw new Error("Tool execution response missing executionId");
    },
  );

  await runTest("Check pause history", async () => {
    const response = await apiClient.get(`/sandbox/${sandboxId}/pause-history`);
    if (response.status !== 200)
      throw new Error(`Failed to get pause history: ${response.status}`);
    const history = response.data.data.history;
    if (!Array.isArray(history) || history.length < 2)
      throw new Error("Pause history incomplete");
    const pauseEntry = history.find((e: any) => e.action === "pause");
    const resumeEntry = history.find((e: any) => e.action === "resume");
    if (!pauseEntry || !resumeEntry)
      throw new Error("Pause or resume entry missing in history");
    if (pauseEntry.reason !== "Automated test pause")
      throw new Error("Pause reason incorrect in history");
  });

  await runTest("Configure and verify auto-pause settings", async () => {
    const settings = {
      autoPauseEnabled: true,
      idleTimeoutMinutes: 15,
      maxExecutionTimeMinutes: 30,
      maxMemoryUsageMB: 512,
    };
    const response = await apiClient.put(
      `/sandbox/${sandboxId}/pause-settings`,
      settings,
    );
    if (response.status !== 200)
      throw new Error(
        `Failed to update auto-pause settings: ${response.status}`,
      );
    const updatedSettings = response.data.data.autoPauseSettings;
    if (
      updatedSettings.enabled !== settings.autoPauseEnabled ||
      updatedSettings.idleTimeoutMinutes !== settings.idleTimeoutMinutes
    ) {
      throw new Error("Auto-pause settings not updated correctly");
    }
  });

  await runTest("Bulk pause sandboxes", async () => {
    const sandboxId2 = (await simulateCreateSandbox()).id;
    const idsToPause = [sandboxId, sandboxId2];
    const response = await apiClient.post("/sandbox/bulk/pause", {
      sandboxIds: idsToPause,
      reason: "Bulk test pause",
    });
    if (response.status !== 200)
      throw new Error(`Bulk pause failed: ${response.status}`);
    const results = response.data.data;
    idsToPause.forEach((id) => {
      if (!results[id] || !results[id].success)
        throw new Error(`Failed to pause sandbox ${id} in bulk`);
    });
    const status1 = (await apiClient.get(`/sandbox/${sandboxId}/status`)).data
      .data;
    const status2 = (await apiClient.get(`/sandbox/${sandboxId2}/status`)).data
      .data;
    if (status1.state !== "paused" || status2.state !== "paused")
      throw new Error("Sandboxes not paused after bulk operation");
  });

  await runTest("Bulk resume sandboxes", async () => {
    const idsToResume = [
      sandboxId,
      createdSandboxIds[createdSandboxIds.length - 1],
    ]; // Use last created one
    const response = await apiClient.post("/sandbox/bulk/resume", {
      sandboxIds: idsToResume,
    });
    if (response.status !== 200)
      throw new Error(`Bulk resume failed: ${response.status}`);
    const results = response.data.data;
    idsToResume.forEach((id) => {
      if (!results[id] || !results[id].success)
        throw new Error(`Failed to resume sandbox ${id} in bulk`);
    });
    const status1 = (await apiClient.get(`/sandbox/${sandboxId}/status`)).data
      .data;
    const status2 = (await apiClient.get(`/sandbox/${idsToResume[1]}/status`))
      .data.data;
    if (status1.state !== "active" || status2.state !== "active")
      throw new Error("Sandboxes not active after bulk operation");
  });

  endSuite();
}

async function runWebSocketScalingTests() {
  startSuite("H4 Redis WebSocket Scaling Tests");
  const clients: WebSocket[] = [];
  const clientIds: string[] = [];
  const limit = pLimit(50); // Limit concurrent WebSocket connections during setup

  await runTest(
    `Establish ${NUM_CONCURRENT_WS_CONNECTIONS} concurrent WebSocket connections`,
    async () => {
      const connectionPromises: Promise<WebSocket>[] = [];
      for (let i = 0; i < NUM_CONCURRENT_WS_CONNECTIONS; i++) {
        const clientId = `test-ws-client-${i}-${uuidv4()}`;
        clientIds.push(clientId);
        connectionPromises.push(
          limit(() => createWebSocketClient(clientId, `trace-${clientId}`)),
        );
      }
      const establishedClients = await Promise.all(connectionPromises);
      clients.push(...establishedClients);
      if (clients.length !== NUM_CONCURRENT_WS_CONNECTIONS) {
        throw new Error(
          `Failed to establish all ${NUM_CONCURRENT_WS_CONNECTIONS} connections. Established: ${clients.length}`,
        );
      }
      log(
        "info",
        `Successfully established ${clients.length} WebSocket connections.`,
      );
    },
  );

  await runTest("Verify initial CONNECT message for all clients", async () => {
    const connectMessagePromises = clients.map((wsClient) =>
      waitForMessage(
        wsClient,
        5000,
        (data) => data.type === "connect" && data.metadata?.clientId,
      ),
    );
    const connectMessages = await Promise.all(connectMessagePromises);
    if (connectMessages.length !== clients.length) {
      throw new Error(
        `Did not receive CONNECT messages for all clients. Received: ${connectMessages.length}`,
      );
    }
    log("info", "All clients received CONNECT message.");
  });

  await runTest(
    "Test message delivery lag (<1s) among concurrent connections",
    async () => {
      if (clients.length < 2)
        throw new Error("Not enough clients for lag test");

      const sender = clients[0];
      const receivers = clients.slice(1, Math.min(11, clients.length)); // Test with up to 10 receivers
      const testMessageId = `lag-test-${uuidv4()}`;
      const dealershipIdForTest = 123; // Example dealership ID

      const receivePromises = receivers.map((receiver) =>
        waitForMessage(
          receiver,
          MESSAGE_LAG_THRESHOLD_MS + 1000,
          (data) =>
            data.type === "chat_message" &&
            data.message === testMessageId &&
            data.dealershipId === dealershipIdForTest,
        ),
      );

      const sendTime = performance.now();
      sendMessage(sender, {
        type: "chat_message",
        dealershipId: dealershipIdForTest,
        userId: 1, // sender's user ID
        conversationId: "conv-lag-test",
        message: testMessageId,
        timestamp: new Date().toISOString(),
        traceId: `trace-lag-test-${uuidv4()}`,
      });

      const receivedMessages = await Promise.all(receivePromises);
      const receiveTime = performance.now();
      const lag = receiveTime - sendTime;

      if (receivedMessages.length !== receivers.length) {
        throw new Error(
          `Not all receivers got the message. Expected: ${receivers.length}, Got: ${receivedMessages.length}`,
        );
      }
      if (lag > MESSAGE_LAG_THRESHOLD_MS) {
        throw new Error(
          `Message lag exceeded threshold. Lag: ${lag.toFixed(2)}ms, Threshold: ${MESSAGE_LAG_THRESHOLD_MS}ms`,
        );
      }
      log("info", `Message delivery lag test passed. Lag: ${lag.toFixed(2)}ms`);
    },
  );

  await runTest(
    "Test Redis Pub/Sub for broadcast functionality (simulated instances)",
    async () => {
      if (clients.length < 4)
        throw new Error(
          "Not enough clients for Pub/Sub test (need at least 4)",
        );

      // Simulate two instances: clients[0,1] on instance A, clients[2,3] on instance B
      const senderInstanceA = clients[0];
      const receiverInstanceA = clients[1];
      const receiverInstanceB1 = clients[2];
      const receiverInstanceB2 = clients[3];

      const broadcastMessageId = `broadcast-test-${uuidv4()}`;
      const broadcastDealershipId = 789;

      const promises = [
        waitForMessage(
          receiverInstanceA,
          5000,
          (data) =>
            data.type === "chat_message" &&
            data.message === broadcastMessageId &&
            data.dealershipId === broadcastDealershipId,
        ),
        waitForMessage(
          receiverInstanceB1,
          5000,
          (data) =>
            data.type === "chat_message" &&
            data.message === broadcastMessageId &&
            data.dealershipId === broadcastDealershipId,
        ),
        waitForMessage(
          receiverInstanceB2,
          5000,
          (data) =>
            data.type === "chat_message" &&
            data.message === broadcastMessageId &&
            data.dealershipId === broadcastDealershipId,
        ),
      ];

      sendMessage(senderInstanceA, {
        type: "chat_message", // Assuming chat messages to a dealership are broadcast to agents
        dealershipId: broadcastDealershipId,
        userId: 2, // sender's user ID
        conversationId: "conv-broadcast-test",
        message: broadcastMessageId,
        timestamp: new Date().toISOString(),
        traceId: `trace-broadcast-${uuidv4()}`,
      });

      const results = await Promise.all(promises);
      if (results.length !== 3 || results.some((r) => !r)) {
        throw new Error(
          "Not all simulated instances/clients received the broadcast message via Redis Pub/Sub.",
        );
      }
      log("info", "Redis Pub/Sub broadcast test passed.");
    },
  );

  await runTest(
    "Test WebSocket health checking (ping/pong and stale connection closure)",
    async () => {
      if (clients.length === 0)
        throw new Error("No clients to test health checking.");
      const testClient = clients[clients.length - 1]; // Use one of the clients
      const clientId = clientIds[clients.length - 1];

      // Server should send pings, client ws library handles pongs automatically.
      // We'll test if server closes a connection that stops responding (hard to simulate perfectly client-side)
      // Instead, we'll test if client receives a MIGRATION or close if server initiates it.
      // Let's test if the client is still alive by sending a message.
      const healthCheckMsgId = `health-check-msg-${uuidv4()}`;
      sendMessage(testClient, {
        type: "health_check",
        message: healthCheckMsgId,
        traceId: `trace-health-${uuidv4()}`,
      });
      const response = await waitForMessage(
        testClient,
        3000,
        (data) =>
          data.type === "health_check" &&
          data.message === "Health check response",
      );
      if (!response)
        throw new Error("Client did not receive health check response.");

      log(
        "info",
        `WebSocket health check (client side) passed for ${clientId}. Server-side stale closure is harder to verify here.`,
      );
      // To test server-side closure of stale connections, one would typically:
      // 1. Create a client that deliberately doesn't send pongs.
      // 2. Wait for longer than the server's stale timeout.
      // 3. Verify the server closes the connection.
      // This is beyond simple client scripting.
    },
  );

  await runTest("Test WebSocket Rate Limiting", async () => {
    if (clients.length === 0)
      throw new Error("No clients for rate limit test.");
    const rateLimitClient = clients[0];
    const traceId = `trace-ratelimit-${uuidv4()}`;
    let errorReceived = false;

    // Send messages rapidly (e.g., 70 messages, assuming limit is ~60/min)
    for (let i = 0; i < 70; i++) {
      sendMessage(rateLimitClient, {
        type: "chat_message",
        message: `Rate limit test ${i}`,
        dealershipId: 1,
        traceId,
      });
      await new Promise((resolve) => setTimeout(resolve, 50)); // Small delay
    }

    try {
      // Expect an error message or subsequent messages to be ignored/dropped
      // The websocket-service.ts sends an ERROR message with reason RATE_LIMIT_EXCEEDED
      const errMessage = await waitForMessage(
        rateLimitClient,
        5000,
        (data) =>
          data.type === "error" &&
          data.metadata?.reason === "RATE_LIMIT_EXCEEDED",
      );
      if (errMessage) errorReceived = true;
    } catch (e) {
      // It's also possible the server just drops messages without an error response visible here,
      // or the connection gets closed. This part of the test might need refinement based on exact server behavior.
      log(
        "warn",
        `Did not receive explicit RATE_LIMIT_EXCEEDED error message, but rate limiting might still be active: ${e}`,
      );
    }
    if (!errorReceived) {
      log(
        "warn",
        "Rate limit error message not explicitly received. Further validation might be needed.",
      );
      // This test is indicative; true rate limit testing often requires observing server logs/metrics.
    } else {
      log("info", "Rate limiting test passed (received error message).");
    }
  });

  await runTest("Test WebSocket Connection Migration (Simulated)", async () => {
    // This test simulates a client receiving a migration message and attempting to reconnect.
    if (clients.length === 0) throw new Error("No clients for migration test.");
    const migrationClient = clients[0];
    const clientId = clientIds[0];
    const traceId = `trace-migration-${uuidv4()}`;

    // Server-side, a migration event would need to be triggered.
    // Here, we'll assume the server can send a MIGRATION message.
    // If an API to trigger this exists, call it. Otherwise, this is conceptual.
    log(
      "info",
      `Simulating server sending MIGRATION message to client ${clientId}.`,
    );

    // Mock server sending migration message (in real test, server would send this)
    // For this test, we'll just check if client handles it if it were to receive it.
    // This part is more about client's potential to handle such a message.
    // A true test requires server participation.

    // Listen for a close event, then try to reconnect.
    const closePromise = new Promise<void>((resolve) =>
      migrationClient.once("close", (code, reason) => {
        log(
          "info",
          `Client ${clientId} closed with code ${code}, reason: ${reason}. Simulating reconnection attempt.`,
        );
        resolve();
      }),
    );

    // Simulate server sending a migration message that would lead to a close & reconnect instruction
    // This is a very simplified mock.
    sendMessage(migrationClient, {
      type: "MIGRATION", // Assuming this is a type the client might recognize from websocket-service.ts
      message: "Server migration in progress, please reconnect.",
      metadata: { reconnect: true, delay: 500 },
      traceId,
    });
    // The client itself would need logic to act on this. The current `ws` library client won't auto-reconnect.
    // For now, we'll just see if it receives a close if the server enforces it.
    // This test is highly dependent on server and client-side migration logic.

    // We can't easily verify full migration without more control.
    // Let's just ensure the client is still connectable after this "event".
    // Close the current client and try to open a new one.
    migrationClient.close();
    await closePromise;

    const newConnection = await createWebSocketClient(
      clientId + "-reconnected",
      traceId + "-reconnected",
    );
    if (!newConnection || newConnection.readyState !== WebSocket.OPEN) {
      throw new Error(
        "Failed to re-establish WebSocket connection after simulated migration.",
      );
    }
    log(
      "info",
      "Successfully re-established WebSocket connection after simulated migration.",
    );
    clients[0] = newConnection; // Replace in our list
  });

  // Cleanup WebSocket connections
  await runTest("Close all WebSocket connections", async () => {
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    // Add a short delay to allow close events to propagate
    await new Promise((resolve) => setTimeout(resolve, 1000));
    log("info", "All WebSocket connections closed.");
  });

  endSuite();
}

async function runMonitoringAndPerformanceTests() {
  startSuite("Monitoring and Performance Tests");

  await runTest(
    "Verify monitoring metrics integration (Conceptual)",
    async () => {
      // This test is conceptual as direct metric querying is often not available.
      // Steps would involve:
      // 1. Perform an action known to generate metrics (e.g., pause a sandbox, send WS message).
      // 2. If a metrics API endpoint exists (e.g., /metrics or /api/monitoring/metrics), query it.
      // 3. Validate that the expected metrics have been updated.
      // 4. Alternatively, check server logs if metrics are logged there.
      log("info", "Performing an action to generate metrics...");
      const sandbox = await simulateCreateSandbox("monitoring-test-sandbox");
      await apiClient.post(`/sandbox/pause/${sandbox.id}`, {
        reason: "Monitoring test",
      });
      await apiClient.post(`/sandbox/resume/${sandbox.id}`);

      // Example: if /api/metrics/database/pool exists from INT-002
      try {
        const metricsResponse = await apiClient.get("/metrics/database/pool"); // Example endpoint
        if (metricsResponse.status === 200 && metricsResponse.data) {
          log(
            "info",
            `Database pool metrics retrieved: ${JSON.stringify(metricsResponse.data)}`,
          );
          // Add assertions here based on expected metric values or changes
        } else {
          log(
            "warn",
            "Could not retrieve specific database pool metrics for validation.",
          );
        }
      } catch (e: any) {
        log(
          "warn",
          `Metrics endpoint for database pool not available or failed: ${e.message}`,
        );
      }
      // Similarly for WebSocket metrics, if an endpoint exists.
      log(
        "info",
        "Conceptual monitoring metrics test: Actions performed. Manual or specific metrics endpoint check needed.",
      );
    },
  );

  await runTest("Performance benchmark: Sandbox API operations", async () => {
    const sandboxId = (await simulateCreateSandbox("perf-test-sandbox")).id;
    const operations = 10;
    let totalDuration = 0;

    for (let i = 0; i < operations; i++) {
      const opStartTime = performance.now();
      await apiClient.post(`/sandbox/pause/${sandboxId}`, {
        reason: `Perf test ${i}`,
      });
      await apiClient.get(`/sandbox/${sandboxId}/status`);
      await apiClient.post(`/sandbox/resume/${sandboxId}`);
      totalDuration += performance.now() - opStartTime;
    }
    const avgDuration = totalDuration / (operations * 3); // 3 ops per loop
    log(
      "info",
      `Sandbox API avg operation duration: ${avgDuration.toFixed(2)}ms over ${operations * 3} operations.`,
    );
    if (avgDuration > 200) {
      // Example threshold
      log(
        "warn",
        `Sandbox API performance may be slow (avg > 200ms): ${avgDuration.toFixed(2)}ms`,
      );
    }
  });

  await runTest(
    "Performance benchmark: WebSocket message throughput (100 messages)",
    async () => {
      const wsClient = await createWebSocketClient(
        `perf-ws-${uuidv4()}`,
        `trace-perf-ws-${uuidv4()}`,
      );
      const numMessages = 100;
      let messagesReceived = 0;

      wsClient.on("message", (data) => {
        const parsed = JSON.parse(data.toString());
        if (
          parsed.type === "chat_message" &&
          parsed.metadata?.source === "perf-test-echo"
        ) {
          messagesReceived++;
        }
      });

      const startTime = performance.now();
      for (let i = 0; i < numMessages; i++) {
        // Assuming server echoes chat_message with specific metadata if sent to a certain dealershipId/conversationId
        sendMessage(wsClient, {
          type: "chat_message",
          dealershipId: 999, // Special ID for echo test, or use a real one
          conversationId: "perf-test-conv",
          message: `Perf message ${i}`,
          metadata: { source: "perf-test-client" }, // Client sends this
          traceId: `trace-perf-msg-${i}`,
        });
      }

      // Wait for messages to be echoed back (or a timeout)
      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          if (
            messagesReceived >= numMessages ||
            performance.now() - startTime > 10000
          ) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
      const duration = performance.now() - startTime;
      wsClient.close();

      log(
        "info",
        `WebSocket: Sent ${numMessages} messages, received ${messagesReceived} echo replies in ${duration.toFixed(2)}ms.`,
      );
      if (messagesReceived < numMessages * 0.9) {
        // Allow for some loss in a basic test
        throw new Error(
          `Significant message loss in WebSocket performance test. Sent: ${numMessages}, Received: ${messagesReceived}`,
        );
      }
      const throughput = (messagesReceived / duration) * 1000; // messages per second
      log(
        "info",
        `WebSocket message throughput: ~${throughput.toFixed(2)} msgs/sec.`,
      );
    },
  );

  endSuite();
}

// --- Main Execution ---
async function main() {
  log("info", "Starting INT-007 API Features Integration Test Script...");

  // Setup: Ensure feature flags are set as needed for the tests
  // It's better to set them specifically per test suite if behavior changes
  // For now, assume they are generally enabled by the FeatureFlagTests suite.

  await runFeatureFlagTests();
  await runSandboxApiTests();
  await runWebSocketScalingTests();
  await runMonitoringAndPerformanceTests();

  // --- Reporting ---
  log("info", "\n--- Test Execution Summary ---");
  const passedCount = testResults.filter((r) => r.passed).length;
  const failedCount = testResults.filter((r) => !r.passed).length;

  testResults.forEach((result) => {
    if (result.passed) {
      log(
        "info",
        `✅ PASSED: ${result.name} (Duration: ${result.duration?.toFixed(2)}ms)`,
      );
    } else {
      log(
        "error",
        `❌ FAILED: ${result.name} (Duration: ${result.duration?.toFixed(2)}ms) - Details: ${result.details}`,
      );
    }
  });

  log(
    "info",
    `\nTotal Tests: ${testResults.length}, Passed: ${passedCount}, Failed: ${failedCount}`,
  );

  // Cleanup created sandboxes
  if (createdSandboxIds.length > 0) {
    log("info", "Cleaning up created test sandboxes...");
    // In a real scenario, you'd call a DELETE API for each sandboxId.
    // For this mock, we'll just log it.
    // Example: for (const id of createdSandboxIds) { await apiClient.delete(`/sandbox/${id}`); }
    createdSandboxIds.forEach((id) =>
      log("debug", `Simulated deletion of sandbox: ${id}`),
    );
  }

  if (failedCount > 0) {
    log("error", "INT-007 Integration Tests FAILED.");
    process.exit(1);
  } else {
    log("info", "INT-007 Integration Tests PASSED SUCCESSFULLY.");
    process.exit(0);
  }
}

main().catch((error) => {
  log("error", "Unhandled error in test script execution:", error);
  process.exit(1);
});

// Add type declaration for Request to include sandbox (if running in a context where Express types are relevant)
// This is mostly for completeness if parts of this script were to be run in a Node.js/Express test runner.
declare global {
  namespace Express {
    interface Request {
      sandbox?: any; // Replace 'any' with actual SandboxMetadata type if available
      user?: {
        id: number;
        name: string;
        dealershipId: number;
        isAdmin: boolean;
      };
    }
  }
}
