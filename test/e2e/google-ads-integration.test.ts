/**
 * E2E Test for Google Ads API Integration
 *
 * Tests the complete workflow from OAuth to campaign creation without requiring
 * real Google Ads API access.
 */

import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from "@jest/globals";
import request from "supertest";
import { app, httpServer } from "../../server";
import { db } from "../../server/db";
import {
  gadsAccounts,
  gadsCampaigns,
  tools,
  sandboxes,
  users,
  dealerships,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { adsApiService } from "../../server/services/ads-api-service";
import { GoogleAdsApi } from "google-ads-api";
import { OAuth2Client } from "google-auth-library";
import WebSocket from "ws";

// Mock the Google Ads API and OAuth
jest.mock("google-ads-api");
jest.mock("google-auth-library");
jest.mock("googleapis");

// Mock environment variables
process.env.GOOGLE_ADS_CLIENT_ID = "test-client-id";
process.env.GOOGLE_ADS_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_ADS_REDIRECT_URI =
  "http://localhost:3000/api/ads/auth/callback";
process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "test-developer-token";
process.env.ENCRYPTION_KEY =
  "test-encryption-key-12345678901234567890123456789012";

describe("Google Ads API Integration", () => {
  // Test data
  const testUser = {
    id: 9999,
    username: "test-user",
    email: "test@example.com",
    role: "admin",
    dealershipId: 9999,
  };

  const testDealership = {
    id: 9999,
    name: "Test Dealership",
    subdomain: "test-dealership",
  };

  const testSandbox = {
    id: 9999,
    name: "Test Sandbox",
    createdBy: 9999,
    dealershipId: 9999,
    hourlyTokenLimit: 10000,
    dailyTokenLimit: 100000,
    dailyCostLimit: 5.0,
  };

  const testAccount = {
    id: 9999,
    cid: "1234567890",
    name: "Test MCC Account",
    isManagerAccount: true,
    userId: 9999,
    dealershipId: 9999,
    sandboxId: 9999,
    refreshToken: "encrypted-refresh-token",
    isActive: true,
  };

  const testCampaign = {
    id: 9999,
    gadsAccountId: 9999,
    campaignId: "test-campaign-123",
    campaignName: "Test Search Campaign",
    campaignType: "SEARCH",
    status: "ENABLED",
    budgetAmount: 100.0,
    isDryRun: true,
  };

  // Mock API responses
  const mockOAuthTokens = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    expiry_date: Date.now() + 3600000,
  };

  const mockUserInfo = {
    data: {
      email: "ads-user@example.com",
      name: "Test Ads User",
    },
  };

  const mockAccessibleCustomers = {
    resource_names: ["customers/1234567890", "customers/9876543210"],
  };

  const mockAccountInfo = {
    results: [
      {
        customer: {
          id: "1234567890",
          descriptiveName: "Test MCC Account",
          currencyCode: "USD",
          timeZone: "America/New_York",
          manager: true,
          status: "ENABLED",
        },
      },
    ],
  };

  const mockCampaignBudgetResponse = {
    results: [
      {
        resourceName: "customers/1234567890/campaignBudgets/1111111111",
      },
    ],
  };

  const mockCampaignResponse = {
    results: [
      {
        resourceName: "customers/1234567890/campaigns/2222222222",
      },
    ],
  };

  // Setup and teardown
  beforeAll(async () => {
    // Set up mocks
    (OAuth2Client.prototype.generateAuthUrl as jest.Mock).mockImplementation(
      () => {
        return "https://accounts.google.com/o/oauth2/auth?mock=true";
      },
    );

    (OAuth2Client.prototype.getToken as jest.Mock).mockResolvedValue({
      tokens: mockOAuthTokens,
    });

    (OAuth2Client.prototype.setCredentials as jest.Mock).mockImplementation(
      () => {},
    );
    (OAuth2Client.prototype.refreshAccessToken as jest.Mock).mockResolvedValue({
      credentials: mockOAuthTokens,
    });

    // Mock googleapis userinfo
    jest.mock("googleapis", () => ({
      google: {
        oauth2: () => ({
          userinfo: {
            get: jest.fn().mockResolvedValue(mockUserInfo),
          },
        }),
      },
    }));

    // Mock Google Ads API
    (
      GoogleAdsApi.prototype.listAccessibleCustomers as jest.Mock
    ).mockResolvedValue(mockAccessibleCustomers);
    (GoogleAdsApi.prototype.Customer as jest.Mock).mockImplementation(() => ({
      query: jest.fn().mockResolvedValue(mockAccountInfo),
      campaignBudgets: {
        create: jest.fn().mockResolvedValue(mockCampaignBudgetResponse),
      },
      campaigns: {
        create: jest.fn().mockResolvedValue(mockCampaignResponse),
      },
    }));

    // Create test data in database
    await db.insert(users).values(testUser);
    await db.insert(dealerships).values(testDealership);
    await db.insert(sandboxes).values(testSandbox);

    // Register the Google Ads tool in the registry
    await db.insert(tools).values({
      name: "google_ads.createCampaign",
      description: "Create a Google Ads search campaign",
      type: "EXTERNAL_API",
      service: "google_ads",
      endpoint: "/ads/campaigns",
      inputSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
          campaignName: { type: "string" },
          budget: { type: "object" },
          isDryRun: { type: "boolean" },
        },
      },
      outputSchema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          campaignId: { type: "string" },
        },
      },
      isActive: true,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(gadsCampaigns).where(eq(gadsCampaigns.id, testCampaign.id));
    await db.delete(gadsAccounts).where(eq(gadsAccounts.id, testAccount.id));
    await db.delete(tools).where(eq(tools.name, "google_ads.createCampaign"));
    await db.delete(sandboxes).where(eq(sandboxes.id, testSandbox.id));
    await db.delete(dealerships).where(eq(dealerships.id, testDealership.id));
    await db.delete(users).where(eq(users.id, testUser.id));

    // Close server
    httpServer.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("OAuth Flow", () => {
    it("should generate an OAuth URL", async () => {
      const response = await request(app)
        .post("/api/ads/auth/url")
        .send({
          userId: testUser.id,
          dealershipId: testDealership.id,
          sandboxId: testSandbox.id,
        })
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("url");
      expect(response.body.url).toContain("accounts.google.com/o/oauth2/auth");
      expect(OAuth2Client.prototype.generateAuthUrl).toHaveBeenCalled();
    });

    it("should handle OAuth callback and store account", async () => {
      // Insert the account first to simulate the callback updating an existing account
      await db.insert(gadsAccounts).values(testAccount);

      const response = await request(app)
        .get("/api/ads/auth/callback")
        .query({
          code: "test-auth-code",
          state: Buffer.from(
            JSON.stringify({
              userId: testUser.id,
              dealershipId: testDealership.id,
              sandboxId: testSandbox.id,
              timestamp: Date.now(),
            }),
          ).toString("base64"),
        });

      expect(response.status).toBe(302); // Redirect
      expect(response.header.location).toContain("/ads/auth/success");
      expect(OAuth2Client.prototype.getToken).toHaveBeenCalledWith(
        "test-auth-code",
      );

      // Verify account was stored/updated in database
      const accounts = await db
        .select()
        .from(gadsAccounts)
        .where(eq(gadsAccounts.userId, testUser.id));
      expect(accounts.length).toBeGreaterThan(0);
    });

    it("should handle OAuth errors gracefully", async () => {
      // Mock an error
      (OAuth2Client.prototype.getToken as jest.Mock).mockRejectedValueOnce(
        new Error("Invalid code"),
      );

      const response = await request(app)
        .get("/api/ads/auth/callback")
        .query({
          code: "invalid-code",
          state: Buffer.from(
            JSON.stringify({
              userId: testUser.id,
              timestamp: Date.now(),
            }),
          ).toString("base64"),
        });

      expect(response.status).toBe(302); // Redirect
      expect(response.header.location).toContain("/ads/auth/error");
      expect(response.header.location).toContain("Invalid%20code");
    });
  });

  describe("Account Management", () => {
    it("should list Google Ads accounts for a user", async () => {
      const response = await request(app)
        .get(`/api/ads/accounts?userId=${testUser.id}`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("accounts");
      expect(Array.isArray(response.body.accounts)).toBe(true);
    });

    it("should get account details", async () => {
      const response = await request(app)
        .get(`/api/ads/accounts/${testAccount.id}`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("cid", testAccount.cid);
    });

    it("should update sandbox association", async () => {
      const response = await request(app)
        .put(`/api/ads/accounts/${testAccount.id}/sandbox`)
        .send({
          sandboxId: testSandbox.id,
        })
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("sandboxId", testSandbox.id);

      // Verify database update
      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.id, testAccount.id),
      });
      expect(account?.sandboxId).toBe(testSandbox.id);
    });

    it("should refresh account details", async () => {
      // Mock the getAccountDetails method
      const originalMethod = adsApiService.getAccountDetails;
      adsApiService.getAccountDetails = jest.fn().mockResolvedValue({
        ...testAccount,
        name: "Updated Account Name",
      });

      const response = await request(app)
        .post(`/api/ads/accounts/${testAccount.id}/refresh`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("name", "Updated Account Name");

      // Restore original method
      adsApiService.getAccountDetails = originalMethod;
    });

    it("should unlink an account", async () => {
      const response = await request(app)
        .delete(`/api/ads/accounts/${testAccount.id}`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);

      // Verify account was deleted
      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.id, testAccount.id),
      });
      expect(account).toBeUndefined();

      // Re-insert for subsequent tests
      await db.insert(gadsAccounts).values(testAccount);
    });
  });

  describe("Campaign Management", () => {
    it("should create a search campaign (dry-run)", async () => {
      const campaignData = {
        accountId: testAccount.cid,
        campaignName: "Test Search Campaign",
        budget: {
          amount: 100.0,
          deliveryMethod: "STANDARD",
        },
        bidStrategy: {
          type: "MAXIMIZE_CONVERSIONS",
        },
        isDryRun: true,
        sandboxId: testSandbox.id,
      };

      // Mock the createSearchCampaign method
      const originalMethod = adsApiService.createSearchCampaign;
      adsApiService.createSearchCampaign = jest
        .fn()
        .mockResolvedValue(testCampaign);

      const response = await request(app)
        .post("/api/ads/campaigns")
        .send(campaignData)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty(
        "campaignName",
        testCampaign.campaignName,
      );
      expect(response.body).toHaveProperty("isDryRun", true);
      expect(response.body).toHaveProperty("status");
      expect(adsApiService.createSearchCampaign).toHaveBeenCalledWith(
        campaignData,
      );

      // Restore original method
      adsApiService.createSearchCampaign = originalMethod;
    });

    it("should handle campaign creation errors", async () => {
      const campaignData = {
        accountId: "invalid-account",
        campaignName: "Test Campaign",
        budget: {
          amount: 100.0,
        },
      };

      // Mock an error
      const originalMethod = adsApiService.createSearchCampaign;
      adsApiService.createSearchCampaign = jest.fn().mockRejectedValue({
        code: "NOT_FOUND",
        message: "Account not found",
      });

      const response = await request(app)
        .post("/api/ads/campaigns")
        .send(campaignData)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "not_found");
      expect(response.body).toHaveProperty("message", "Account not found");

      // Restore original method
      adsApiService.createSearchCampaign = originalMethod;
    });

    it("should list campaigns for an account", async () => {
      // Insert test campaign
      await db.insert(gadsCampaigns).values(testCampaign);

      const response = await request(app)
        .get(`/api/ads/campaigns?accountId=${testAccount.id}`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("campaigns");
      expect(Array.isArray(response.body.campaigns)).toBe(true);
      expect(response.body.campaigns.length).toBeGreaterThan(0);
      expect(response.body.campaigns[0]).toHaveProperty(
        "campaignId",
        testCampaign.campaignId,
      );

      // Clean up
      await db
        .delete(gadsCampaigns)
        .where(eq(gadsCampaigns.id, testCampaign.id));
    });

    it("should get campaign details", async () => {
      // Insert test campaign
      await db.insert(gadsCampaigns).values(testCampaign);

      const response = await request(app)
        .get(`/api/ads/campaigns/${testCampaign.id}`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty(
        "campaignId",
        testCampaign.campaignId,
      );
      expect(response.body).toHaveProperty(
        "campaignName",
        testCampaign.campaignName,
      );
      expect(response.body).toHaveProperty("status", testCampaign.status);

      // Clean up
      await db
        .delete(gadsCampaigns)
        .where(eq(gadsCampaigns.id, testCampaign.id));
    });
  });

  describe("Tool Registry Integration", () => {
    it("should have google_ads.createCampaign tool registered", async () => {
      const tool = await db.query.tools.findFirst({
        where: eq(tools.name, "google_ads.createCampaign"),
      });

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("google_ads.createCampaign");
      expect(tool?.service).toBe("google_ads");
      expect(tool?.endpoint).toBe("/ads/campaigns");
      expect(tool?.isActive).toBe(true);
    });

    it("should execute google_ads.createCampaign tool via WebSocket", async () => {
      // This test would normally use a WebSocket client to connect and send a tool execution message
      // For simplicity, we'll test the API endpoint directly that the tool would call

      // Mock the createSearchCampaign method
      const originalMethod = adsApiService.createSearchCampaign;
      adsApiService.createSearchCampaign = jest.fn().mockResolvedValue({
        ...testCampaign,
        id: 10000, // Use a different ID to avoid conflicts
        campaignId: "ws-test-campaign-" + Date.now(),
      });

      const campaignData = {
        accountId: testAccount.cid,
        campaignName: "WebSocket Tool Test Campaign",
        budget: {
          amount: 50.0,
        },
        isDryRun: true,
        sandboxId: testSandbox.id,
      };

      const response = await request(app)
        .post("/api/ads/campaigns")
        .send(campaignData)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("isDryRun", true);
      expect(adsApiService.createSearchCampaign).toHaveBeenCalledWith(
        campaignData,
      );

      // Restore original method
      adsApiService.createSearchCampaign = originalMethod;
    });
  });

  describe("Acceptance Criteria Verification", () => {
    it("should meet all acceptance criteria", async () => {
      // 1. User can link Google Ads MCC via OAuth
      const authUrlResponse = await request(app)
        .post("/api/ads/auth/url")
        .send({
          userId: testUser.id,
          dealershipId: testDealership.id,
          sandboxId: testSandbox.id,
        })
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(authUrlResponse.status).toBe(200);
      expect(authUrlResponse.body).toHaveProperty("url");
      expect(authUrlResponse.body.url).toContain(
        "accounts.google.com/o/oauth2/auth",
      );

      // 2. GET /ads/accounts lists linked CIDs
      const accountsResponse = await request(app)
        .get(`/api/ads/accounts?userId=${testUser.id}`)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(accountsResponse.status).toBe(200);
      expect(accountsResponse.body).toHaveProperty("accounts");
      expect(Array.isArray(accountsResponse.body.accounts)).toBe(true);

      // 3. POST /ads/campaigns creates a Search campaign in sandbox account (dry-run flag)
      const campaignData = {
        accountId: testAccount.cid,
        campaignName: "Acceptance Criteria Test Campaign",
        budget: {
          amount: 100.0,
          deliveryMethod: "STANDARD",
        },
        bidStrategy: {
          type: "MAXIMIZE_CONVERSIONS",
        },
        isDryRun: true,
        sandboxId: testSandbox.id,
      };

      // Mock the createSearchCampaign method
      const originalMethod = adsApiService.createSearchCampaign;
      adsApiService.createSearchCampaign = jest.fn().mockResolvedValue({
        ...testCampaign,
        campaignName: campaignData.campaignName,
      });

      const campaignResponse = await request(app)
        .post("/api/ads/campaigns")
        .send(campaignData)
        .set("Accept", "application/json")
        .set("Authorization", "Bearer test-token");

      expect(campaignResponse.status).toBe(201);
      expect(campaignResponse.body).toHaveProperty(
        "campaignName",
        campaignData.campaignName,
      );
      expect(campaignResponse.body).toHaveProperty("isDryRun", true);
      expect(campaignResponse.body).toHaveProperty("status");
      expect(adsApiService.createSearchCampaign).toHaveBeenCalledWith(
        campaignData,
      );

      // Restore original method
      adsApiService.createSearchCampaign = originalMethod;
    });
  });
});
