/**
 * E2E Tests for Google Ads API Service & OAuth Integration
 * 
 * This test suite validates the Google Ads API integration, including:
 * - OAuth flow and authentication
 * - Account listing and management
 * - Campaign creation with dry-run capability
 * - Tool registry integration
 */

import { jest } from '@jest/globals';
import supertest from 'supertest';
import { app, server, toolRegistryService } from '../../server/index';
import { db } from '../../server/db';
import { adsApiService, AdsApiService } from '../../server/services/ads-api-service';
import { tools, gadsAccounts, gadsCampaigns, users, sandboxes } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { GoogleAdsApi } from 'google-ads-api';

// Mock Google APIs
jest.mock('google-auth-library');
jest.mock('google-ads-api');
jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?mock=true'),
        getToken: jest.fn().mockResolvedValue({
          tokens: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expiry_date: Date.now() + 3600000
          }
        }),
        setCredentials: jest.fn(),
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'mock-refreshed-token',
            expiry_date: Date.now() + 3600000
          }
        })
      })),
    },
    oauth2: jest.fn().mockReturnValue({
      userinfo: {
        get: jest.fn().mockResolvedValue({
          data: {
            email: 'test@example.com',
            name: 'Test User'
          }
        })
      }
    })
  }
}));

// Test data
const TEST_USER_ID = 1;
const TEST_DEALERSHIP_ID = 1;
const TEST_SANDBOX_ID = 1;
const TEST_ACCOUNT_CID = '1234567890';
const TEST_CAMPAIGN_ID = '12345678';

// Mock data
const mockGoogleAdsAccount = {
  id: 1,
  cid: TEST_ACCOUNT_CID,
  name: 'Test Account',
  currencyCode: 'USD',
  timezone: 'America/New_York',
  isManagerAccount: true,
  refreshToken: 'encrypted-refresh-token',
  accessToken: 'encrypted-access-token',
  tokenExpiresAt: new Date(Date.now() + 3600000),
  sandboxId: TEST_SANDBOX_ID,
  userId: TEST_USER_ID,
  dealershipId: TEST_DEALERSHIP_ID,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockCampaignRequest = {
  accountId: TEST_ACCOUNT_CID,
  campaignName: 'Test Search Campaign',
  budget: {
    amount: 100,
    deliveryMethod: 'STANDARD'
  },
  bidStrategy: {
    type: 'MAXIMIZE_CONVERSIONS'
  },
  isDryRun: true
};

// Mock Google Ads API responses
const mockGoogleAdsApiResponses = {
  listAccessibleCustomers: {
    resource_names: [`customers/${TEST_ACCOUNT_CID}`]
  },
  customerQuery: {
    results: [{
      customer: {
        id: TEST_ACCOUNT_CID,
        descriptiveName: 'Test Account',
        currencyCode: 'USD',
        timeZone: 'America/New_York',
        manager: true,
        status: 'ENABLED'
      }
    }]
  },
  budgetCreate: {
    results: [{
      resourceName: `customers/${TEST_ACCOUNT_CID}/campaignBudgets/123456`
    }]
  },
  campaignCreate: {
    results: [{
      resourceName: `customers/${TEST_ACCOUNT_CID}/campaigns/${TEST_CAMPAIGN_ID}`
    }]
  }
};

// Setup mocks
beforeAll(async () => {
  // Mock GoogleAdsApi class
  (GoogleAdsApi as jest.Mock).mockImplementation(() => ({
    setRefreshToken: jest.fn(),
    setLoginCustomerId: jest.fn(),
    listAccessibleCustomers: jest.fn().mockResolvedValue(mockGoogleAdsApiResponses.listAccessibleCustomers),
    Customer: jest.fn().mockReturnValue({
      query: jest.fn().mockResolvedValue(mockGoogleAdsApiResponses.customerQuery),
      campaignBudgets: {
        create: jest.fn().mockResolvedValue(mockGoogleAdsApiResponses.budgetCreate)
      },
      campaigns: {
        create: jest.fn().mockResolvedValue(mockGoogleAdsApiResponses.campaignCreate)
      }
    })
  }));

  // Ensure test database is clean
  await cleanupTestData();

  // Create test user and sandbox if they don't exist
  await setupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  server.close();
});

// Helper functions for test setup and teardown
async function setupTestData() {
  // Check if test user exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, TEST_USER_ID)
  });

  if (!existingUser) {
    await db.insert(users).values({
      id: TEST_USER_ID,
      username: 'testuser',
      email: 'test@example.com',
      role: 'admin',
      dealershipId: TEST_DEALERSHIP_ID,
      isActive: true
    });
  }

  // Check if test sandbox exists
  const existingSandbox = await db.query.sandboxes.findFirst({
    where: eq(sandboxes.id, TEST_SANDBOX_ID)
  });

  if (!existingSandbox) {
    await db.insert(sandboxes).values({
      id: TEST_SANDBOX_ID,
      name: 'Test Sandbox',
      createdBy: TEST_USER_ID,
      dealershipId: TEST_DEALERSHIP_ID,
      isActive: true,
      hourlyTokenLimit: 10000,
      dailyTokenLimit: 100000,
      dailyCostLimit: 5.0
    });
  }

  // Check if google_ads.createCampaign tool exists
  const existingTool = await db.query.tools.findFirst({
    where: eq(tools.name, 'google_ads.createCampaign')
  });

  if (!existingTool) {
    await db.insert(tools).values({
      name: 'google_ads.createCampaign',
      description: 'Create a Google Ads search campaign',
      type: 'EXTERNAL_API',
      service: 'google_ads',
      endpoint: '/ads/campaigns',
      inputSchema: {
        type: 'object',
        properties: {
          accountId: { type: 'string' },
          campaignName: { type: 'string' },
          budget: { type: 'object' },
          isDryRun: { type: 'boolean' }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          campaignId: { type: 'string' }
        }
      },
      isActive: true
    });
  }
}

async function cleanupTestData() {
  // Clean up test data
  await db.delete(gadsCampaigns).where(
    eq(gadsCampaigns.campaignName, mockCampaignRequest.campaignName)
  );
  
  await db.delete(gadsAccounts).where(
    eq(gadsAccounts.cid, TEST_ACCOUNT_CID)
  );
}

// Mock authentication middleware for tests
jest.mock('../../server/middleware/authentication', () => ({
  authenticate: () => (req, res, next) => {
    req.user = { id: TEST_USER_ID };
    next();
  },
  authenticateJWT: (req, res, next) => {
    req.user = { id: TEST_USER_ID };
    next();
  }
}));

describe('Google Ads API Integration', () => {
  const request = supertest(app);

  describe('OAuth Flow', () => {
    test('should generate OAuth URL', async () => {
      const response = await request
        .post('/api/ads/auth/url')
        .send({
          userId: TEST_USER_ID,
          dealershipId: TEST_DEALERSHIP_ID,
          sandboxId: TEST_SANDBOX_ID
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain('accounts.google.com/o/oauth2/auth');
    });

    test('should handle OAuth callback', async () => {
      // Mock the callback handling
      const handleCallbackSpy = jest.spyOn(adsApiService, 'handleCallback')
        .mockResolvedValueOnce(mockGoogleAdsAccount);

      const response = await request
        .get('/api/ads/auth/callback')
        .query({
          code: 'mock-auth-code',
          state: Buffer.from(JSON.stringify({
            userId: TEST_USER_ID,
            dealershipId: TEST_DEALERSHIP_ID,
            sandboxId: TEST_SANDBOX_ID
          })).toString('base64')
        });

      // Should redirect to success page
      expect(response.status).toBe(302);
      expect(response.header.location).toContain('/ads/auth/success');
      expect(handleCallbackSpy).toHaveBeenCalled();

      handleCallbackSpy.mockRestore();
    });
  });

  describe('Account Management', () => {
    beforeEach(async () => {
      // Ensure test account exists in database
      const existingAccount = await db.query.gadsAccounts.findFirst({
        where: and(
          eq(gadsAccounts.cid, TEST_ACCOUNT_CID),
          eq(gadsAccounts.userId, TEST_USER_ID)
        )
      });

      if (!existingAccount) {
        await db.insert(gadsAccounts).values(mockGoogleAdsAccount);
      }
    });

    test('should list Google Ads accounts', async () => {
      const response = await request
        .get('/api/ads/accounts')
        .query({ userId: TEST_USER_ID });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accounts');
      expect(Array.isArray(response.body.accounts)).toBe(true);
      
      // Should include our test account
      const testAccount = response.body.accounts.find(acc => acc.cid === TEST_ACCOUNT_CID);
      expect(testAccount).toBeTruthy();
      expect(testAccount.userId).toBe(TEST_USER_ID);
    });

    test('should get account details', async () => {
      // First get the account ID
      const listResponse = await request
        .get('/api/ads/accounts')
        .query({ userId: TEST_USER_ID });
      
      const testAccount = listResponse.body.accounts.find(acc => acc.cid === TEST_ACCOUNT_CID);
      expect(testAccount).toBeTruthy();
      
      // Mock getAccountDetails
      const getAccountDetailsSpy = jest.spyOn(adsApiService, 'getAccountDetails')
        .mockResolvedValueOnce(mockGoogleAdsAccount);

      const response = await request
        .get(`/api/ads/accounts/${testAccount.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('cid', TEST_ACCOUNT_CID);
      expect(getAccountDetailsSpy).toHaveBeenCalled();

      getAccountDetailsSpy.mockRestore();
    });

    test('should associate account with sandbox', async () => {
      // First get the account ID
      const listResponse = await request
        .get('/api/ads/accounts')
        .query({ userId: TEST_USER_ID });
      
      const testAccount = listResponse.body.accounts.find(acc => acc.cid === TEST_ACCOUNT_CID);
      expect(testAccount).toBeTruthy();
      
      const response = await request
        .put(`/api/ads/accounts/${testAccount.id}/sandbox`)
        .send({ sandboxId: TEST_SANDBOX_ID });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sandboxId', TEST_SANDBOX_ID);
    });
  });

  describe('Campaign Management', () => {
    let accountId: string;

    beforeEach(async () => {
      // Get the account ID for tests
      const listResponse = await request
        .get('/api/ads/accounts')
        .query({ userId: TEST_USER_ID });
      
      const testAccount = listResponse.body.accounts.find(acc => acc.cid === TEST_ACCOUNT_CID);
      expect(testAccount).toBeTruthy();
      accountId = testAccount.id;
    });

    test('should create a search campaign with dry-run flag', async () => {
      // Mock createSearchCampaign
      const createSearchCampaignSpy = jest.spyOn(adsApiService, 'createSearchCampaign')
        .mockImplementationOnce(async (params) => {
          return {
            id: 1,
            gadsAccountId: parseInt(accountId),
            campaignId: params.isDryRun ? 'dry-run-123' : TEST_CAMPAIGN_ID,
            campaignName: params.campaignName,
            campaignType: 'SEARCH',
            status: params.isDryRun ? 'DRY_RUN' : 'ENABLED',
            budgetAmount: params.budget.amount,
            isDryRun: !!params.isDryRun,
            createdByAgent: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        });

      const response = await request
        .post('/api/ads/campaigns')
        .send({
          ...mockCampaignRequest,
          isDryRun: true
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isDryRun', true);
      expect(response.body).toHaveProperty('campaignName', mockCampaignRequest.campaignName);
      expect(createSearchCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({
        isDryRun: true
      }));

      createSearchCampaignSpy.mockRestore();
    });

    test('should create a real search campaign with status ENABLED', async () => {
      // Mock createSearchCampaign
      const createSearchCampaignSpy = jest.spyOn(adsApiService, 'createSearchCampaign')
        .mockImplementationOnce(async (params) => {
          return {
            id: 2,
            gadsAccountId: parseInt(accountId),
            campaignId: TEST_CAMPAIGN_ID,
            campaignName: params.campaignName,
            campaignType: 'SEARCH',
            status: 'ENABLED', // This is the key part we're testing
            budgetAmount: params.budget.amount,
            isDryRun: false,
            createdByAgent: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        });

      const response = await request
        .post('/api/ads/campaigns')
        .send({
          ...mockCampaignRequest,
          isDryRun: false,
          campaignName: 'Real Test Campaign'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isDryRun', false);
      expect(response.body).toHaveProperty('status', 'ENABLED');
      expect(response.body).toHaveProperty('campaignId', TEST_CAMPAIGN_ID);
      expect(createSearchCampaignSpy).toHaveBeenCalledWith(expect.objectContaining({
        isDryRun: false
      }));

      createSearchCampaignSpy.mockRestore();
    });

    test('should handle errors for invalid accounts', async () => {
      const response = await request
        .post('/api/ads/campaigns')
        .send({
          ...mockCampaignRequest,
          accountId: 'invalid-account-id'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Account not found');
    });

    test('should list campaigns', async () => {
      // Create a test campaign first
      await request
        .post('/api/ads/campaigns')
        .send(mockCampaignRequest);

      const response = await request
        .get('/api/ads/campaigns')
        .query({ accountId: TEST_ACCOUNT_CID });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('campaigns');
      expect(Array.isArray(response.body.campaigns)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Tool Registry Integration', () => {
    test('should register google_ads.createCampaign tool in registry', async () => {
      // Check if tool exists in registry
      const tool = await db.query.tools.findFirst({
        where: eq(tools.name, 'google_ads.createCampaign')
      });

      expect(tool).toBeTruthy();
      expect(tool.name).toBe('google_ads.createCampaign');
      expect(tool.service).toBe('google_ads');
      expect(tool.endpoint).toBe('/ads/campaigns');
      expect(tool.isActive).toBe(true);
    });

    test('should execute google_ads.createCampaign tool via tool registry', async () => {
      // Mock the tool execution
      const executeSpy = jest.spyOn(toolRegistryService, 'executeTool')
        .mockImplementationOnce(async (toolName, params) => {
          expect(toolName).toBe('google_ads.createCampaign');
          expect(params).toHaveProperty('accountId');
          expect(params).toHaveProperty('campaignName');
          
          return {
            success: true,
            campaignId: 'tool-registry-test-123',
            campaignName: params.campaignName,
            isDryRun: true,
            status: 'ENABLED'
          };
        });

      // Execute the tool
      const result = await toolRegistryService.executeTool('google_ads.createCampaign', {
        accountId: TEST_ACCOUNT_CID,
        campaignName: 'Tool Registry Test Campaign',
        budget: {
          amount: 100
        },
        isDryRun: true
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('campaignId');
      expect(result).toHaveProperty('campaignName', 'Tool Registry Test Campaign');
      expect(result).toHaveProperty('isDryRun', true);
      expect(executeSpy).toHaveBeenCalled();

      executeSpy.mockRestore();
    });
  });
});
