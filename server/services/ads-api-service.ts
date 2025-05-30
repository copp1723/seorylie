/**
 * Google Ads API Service
 * 
 * Provides integration with Google Ads API v16, including OAuth2 authentication,
 * account management, and campaign creation capabilities.
 */

import { google } from 'googleapis';
import { GoogleAdsApi, Customer, Campaign, BudgetOperation, CampaignOperation, CampaignBudget } from 'google-ads-api';
import { OAuth2Client } from 'google-auth-library';
import CryptoJS from 'crypto-js';
import { db } from '../db';
import { gadsAccounts, gadsCampaigns, GadsAccount, GadsCampaign } from '../../shared/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { promClient } from '../observability/metrics';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { tools } from '../../shared/schema';

// Define metrics for monitoring
const adsApiMetrics = {
  requestCounter: new promClient.Counter({
    name: 'ads_api_requests_total',
    help: 'Total number of Google Ads API requests',
    labelNames: ['operation', 'status']
  }),
  requestDuration: new promClient.Histogram({
    name: 'ads_api_request_duration_seconds',
    help: 'Duration of Google Ads API requests in seconds',
    labelNames: ['operation'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
  }),
  tokenRefreshCounter: new promClient.Counter({
    name: 'ads_api_token_refresh_total',
    help: 'Total number of token refresh operations',
    labelNames: ['status']
  }),
  rateLimit: new promClient.Gauge({
    name: 'ads_api_rate_limit_remaining',
    help: 'Remaining Google Ads API rate limit quota',
    labelNames: ['account_id']
  })
};

// Configuration types
interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  developerToken: string;
  encryptionKey: string;
  encryptionIv?: string;
}

// Campaign creation types
export interface SearchCampaignParams {
  accountId: string;
  campaignName: string;
  budget: {
    amount: number;
    deliveryMethod?: 'STANDARD' | 'ACCELERATED';
  };
  bidStrategy?: {
    type: 'MAXIMIZE_CONVERSIONS' | 'MAXIMIZE_CONVERSION_VALUE' | 'TARGET_CPA' | 'TARGET_ROAS' | 'MANUAL_CPC';
    targetCpa?: number;
    targetRoas?: number;
  };
  startDate?: string; // YYYYMMDD format
  endDate?: string; // YYYYMMDD format
  networkSettings?: {
    targetGoogleSearch?: boolean;
    targetSearchNetwork?: boolean;
    targetContentNetwork?: boolean;
    targetPartnerSearchNetwork?: boolean;
  };
  locations?: Array<{
    id: number; // Google geo target ID
    negative?: boolean;
  }>;
  languages?: number[]; // Language criterion IDs
  isDryRun?: boolean;
  sandboxId?: number;
}

// Error types
export class AdsApiError extends Error {
  public code: string;
  public details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'AdsApiError';
    this.code = code;
    this.details = details;
  }
}

export class AuthenticationError extends AdsApiError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AdsApiError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_ERROR', details);
    this.name = 'RateLimitError';
  }
}

/**
 * Google Ads API Service
 */
export class AdsApiService {
  private config: GoogleAdsConfig;
  private oauth2Client: OAuth2Client;
  private googleAdsClient: GoogleAdsApi | null = null;
  private rateLimitRetryDelay = 5000; // 5 seconds
  private maxRetries = 3;

  constructor(config?: Partial<GoogleAdsConfig>) {
    // Load configuration from environment variables if not provided
    this.config = {
      clientId: config?.clientId || process.env.GOOGLE_ADS_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET || '',
      redirectUri: config?.redirectUri || process.env.GOOGLE_ADS_REDIRECT_URI || '',
      developerToken: config?.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      encryptionKey: config?.encryptionKey || process.env.ENCRYPTION_KEY || '',
      encryptionIv: config?.encryptionIv || process.env.ENCRYPTION_IV
    };

    // Validate required configuration
    if (!this.config.clientId || !this.config.clientSecret || !this.config.redirectUri || !this.config.developerToken) {
      throw new Error('Missing required Google Ads API configuration');
    }

    if (!this.config.encryptionKey) {
      throw new Error('Missing encryption key for secure token storage');
    }

    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );

    // Register the Google Ads tool in the tool registry
    this.registerGoogleAdsTool().catch(err => {
      logger.error('Failed to register Google Ads tool in registry', { error: err.message });
    });
  }

  /**
   * Register the Google Ads tool in the tool registry
   */
  private async registerGoogleAdsTool(): Promise<void> {
    try {
      // Check if the tool already exists
      const existingTool = await db.query.tools.findFirst({
        where: eq(tools.name, 'google_ads.createCampaign')
      });

      if (!existingTool) {
        // Create the tool
        await db.insert(tools).values({
          name: 'google_ads.createCampaign',
          description: 'Create a Google Ads search campaign',
          type: 'EXTERNAL_API',
          service: 'google_ads',
          endpoint: '/ads/campaigns',
          inputSchema: {
            type: 'object',
            properties: {
              accountId: { type: 'string', description: 'Google Ads account ID (CID)' },
              campaignName: { type: 'string', description: 'Name of the campaign' },
              budget: {
                type: 'object',
                properties: {
                  amount: { type: 'number', description: 'Daily budget amount in account currency' },
                  deliveryMethod: { type: 'string', enum: ['STANDARD', 'ACCELERATED'], description: 'Budget delivery method' }
                },
                required: ['amount']
              },
              bidStrategy: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['MAXIMIZE_CONVERSIONS', 'MAXIMIZE_CONVERSION_VALUE', 'TARGET_CPA', 'TARGET_ROAS', 'MANUAL_CPC'] },
                  targetCpa: { type: 'number' },
                  targetRoas: { type: 'number' }
                },
                required: ['type']
              },
              isDryRun: { type: 'boolean', description: 'Whether to perform a dry run without creating the actual campaign' }
            },
            required: ['accountId', 'campaignName', 'budget']
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              campaignId: { type: 'string' },
              campaignName: { type: 'string' },
              isDryRun: { type: 'boolean' },
              status: { type: 'string' }
            }
          },
          isActive: true,
          config: {
            requiresAuthentication: true,
            rateLimit: {
              maxRequests: 100,
              perTimeWindow: '1h'
            }
          }
        });

        logger.info('Registered Google Ads tool in registry');
      }
    } catch (error) {
      logger.error('Error registering Google Ads tool', { error });
      throw error;
    }
  }

  /**
   * Generate an authentication URL for OAuth2 flow
   */
  public getAuthUrl(userId: number, dealershipId?: number, sandboxId?: number, state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    // Include user and dealership information in the state parameter for security
    const stateData = JSON.stringify({
      userId,
      dealershipId,
      sandboxId,
      custom: state || '',
      timestamp: Date.now()
    });

    const encodedState = Buffer.from(stateData).toString('base64');

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to ensure we get a refresh token
      state: encodedState
    });
  }

  /**
   * Handle OAuth2 callback and store tokens
   */
  public async handleCallback(code: string, state: string): Promise<GadsAccount> {
    try {
      const startTime = Date.now();
      logger.info('Handling Google Ads OAuth callback');

      // Decode state parameter
      let stateData;
      try {
        const decodedState = Buffer.from(state, 'base64').toString();
        stateData = JSON.parse(decodedState);
      } catch (error) {
        logger.error('Invalid state parameter in OAuth callback', { error });
        throw new AuthenticationError('Invalid state parameter');
      }

      // Validate state data
      if (!stateData.userId) {
        throw new AuthenticationError('Missing user ID in state parameter');
      }

      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.refresh_token) {
        logger.error('No refresh token received from Google OAuth');
        throw new AuthenticationError('No refresh token received. Please try again and ensure you grant permission.');
      }

      // Set credentials to get user info
      this.oauth2Client.setCredentials(tokens);

      // Get user info to identify the Google Ads account
      const oauth2 = google.oauth2({
        auth: this.oauth2Client,
        version: 'v2'
      });

      const userInfo = await oauth2.userinfo.get();
      
      // Initialize Google Ads API client with the new tokens
      const googleAdsClient = new GoogleAdsApi({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        developer_token: this.config.developerToken,
        refresh_token: tokens.refresh_token,
        login_customer_id: undefined // Will be set later when we know the customer ID
      });

      // List accessible accounts to find the customer ID (CID)
      const accessibleCustomers = await googleAdsClient.listAccessibleCustomers();
      
      if (!accessibleCustomers.resource_names || accessibleCustomers.resource_names.length === 0) {
        logger.error('No accessible Google Ads accounts found');
        throw new AuthenticationError('No accessible Google Ads accounts found');
      }

      // Extract customer IDs from resource names
      const customerIds = accessibleCustomers.resource_names.map(name => {
        const match = name.match(/customers\/(\d+)/);
        return match ? match[1] : null;
      }).filter(id => id !== null) as string[];

      if (customerIds.length === 0) {
        throw new AuthenticationError('No valid customer IDs found');
      }

      // For each customer ID, get account details and store in database
      const accounts: GadsAccount[] = [];

      for (const customerId of customerIds) {
        try {
          // Get account details
          const customer = googleAdsClient.Customer({
            customer_id: customerId
          });

          const accountInfo = await customer.query(`
            SELECT
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.time_zone,
              customer.manager
            FROM customer
            WHERE customer.id = ${customerId}
          `);

          if (!accountInfo || !accountInfo.results || accountInfo.results.length === 0) {
            logger.warn(`Could not get details for account ${customerId}`);
            continue;
          }

          const accountData = accountInfo.results[0].customer;
          
          // Encrypt tokens before storing
          const encryptedRefreshToken = this.encryptToken(tokens.refresh_token);
          const encryptedAccessToken = tokens.access_token ? this.encryptToken(tokens.access_token) : null;

          // Check if account already exists for this user
          const existingAccount = await db.query.gadsAccounts.findFirst({
            where: and(
              eq(gadsAccounts.cid, customerId),
              eq(gadsAccounts.userId, stateData.userId)
            )
          });

          let account;
          
          if (existingAccount) {
            // Update existing account
            await db.update(gadsAccounts)
              .set({
                name: accountData.descriptiveName || existingAccount.name,
                currencyCode: accountData.currencyCode || existingAccount.currencyCode,
                timezone: accountData.timeZone || existingAccount.timezone,
                isManagerAccount: accountData.manager || existingAccount.isManagerAccount,
                refreshToken: encryptedRefreshToken,
                accessToken: encryptedAccessToken,
                tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                sandboxId: stateData.sandboxId || existingAccount.sandboxId,
                dealershipId: stateData.dealershipId || existingAccount.dealershipId,
                isActive: true,
                updatedAt: new Date()
              })
              .where(eq(gadsAccounts.id, existingAccount.id));
            
            account = {
              ...existingAccount,
              name: accountData.descriptiveName || existingAccount.name,
              currencyCode: accountData.currencyCode || existingAccount.currencyCode,
              timezone: accountData.timeZone || existingAccount.timezone,
              isManagerAccount: accountData.manager || existingAccount.isManagerAccount,
              updatedAt: new Date()
            };
          } else {
            // Insert new account
            const [newAccount] = await db.insert(gadsAccounts)
              .values({
                cid: customerId,
                name: accountData.descriptiveName || null,
                currencyCode: accountData.currencyCode || null,
                timezone: accountData.timeZone || null,
                isManagerAccount: accountData.manager || false,
                refreshToken: encryptedRefreshToken,
                accessToken: encryptedAccessToken,
                tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                sandboxId: stateData.sandboxId || null,
                userId: stateData.userId,
                dealershipId: stateData.dealershipId || null,
                isActive: true
              })
              .returning();
            
            account = newAccount;
          }

          accounts.push(account);
        } catch (error) {
          logger.error(`Error processing account ${customerId}`, { error });
          // Continue with other accounts even if one fails
        }
      }

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      adsApiMetrics.requestDuration.labels('oauth_callback').observe(duration);
      adsApiMetrics.requestCounter.labels('oauth_callback', 'success').inc();

      // Return the first account (typically the MCC if available)
      if (accounts.length === 0) {
        throw new AuthenticationError('Failed to store any Google Ads accounts');
      }

      // Return the MCC account if available, otherwise the first account
      const mccAccount = accounts.find(a => a.isManagerAccount);
      return mccAccount || accounts[0];
    } catch (error) {
      logger.error('Error handling OAuth callback', { error });
      adsApiMetrics.requestCounter.labels('oauth_callback', 'error').inc();
      
      if (error instanceof AdsApiError) {
        throw error;
      }
      
      throw new AuthenticationError(
        'Failed to authenticate with Google Ads: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * List Google Ads accounts for a user
   */
  public async listAccounts(userId: number, dealershipId?: number): Promise<GadsAccount[]> {
    try {
      const startTime = Date.now();
      logger.info('Listing Google Ads accounts', { userId, dealershipId });

      let query = db.select().from(gadsAccounts).where(eq(gadsAccounts.userId, userId));
      
      if (dealershipId) {
        query = query.where(eq(gadsAccounts.dealershipId, dealershipId));
      }

      const accounts = await query;

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      adsApiMetrics.requestDuration.labels('list_accounts').observe(duration);
      adsApiMetrics.requestCounter.labels('list_accounts', 'success').inc();

      return accounts;
    } catch (error) {
      logger.error('Error listing Google Ads accounts', { error, userId });
      adsApiMetrics.requestCounter.labels('list_accounts', 'error').inc();
      throw new AdsApiError(
        'Failed to list Google Ads accounts: ' + (error instanceof Error ? error.message : String(error)),
        'DATABASE_ERROR'
      );
    }
  }

  /**
   * Get account details from Google Ads API
   */
  public async getAccountDetails(accountId: number): Promise<GadsAccount> {
    try {
      const startTime = Date.now();
      logger.info('Getting Google Ads account details', { accountId });

      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.id, accountId)
      });

      if (!account) {
        throw new AdsApiError('Account not found', 'NOT_FOUND');
      }

      // Initialize API client with this account
      const customer = await this.getCustomerInstance(account);

      // Get fresh account details from the API
      const accountInfo = await customer.query(`
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager,
          customer.status
        FROM customer
        WHERE customer.id = ${account.cid}
      `);

      if (!accountInfo || !accountInfo.results || accountInfo.results.length === 0) {
        throw new AdsApiError('Could not retrieve account details from Google Ads API', 'API_ERROR');
      }

      const accountData = accountInfo.results[0].customer;

      // Update account in database with fresh data
      await db.update(gadsAccounts)
        .set({
          name: accountData.descriptiveName || account.name,
          currencyCode: accountData.currencyCode || account.currencyCode,
          timezone: accountData.timeZone || account.timezone,
          isManagerAccount: accountData.manager || account.isManagerAccount,
          isActive: accountData.status === 'ENABLED',
          updatedAt: new Date()
        })
        .where(eq(gadsAccounts.id, accountId));

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      adsApiMetrics.requestDuration.labels('get_account_details').observe(duration);
      adsApiMetrics.requestCounter.labels('get_account_details', 'success').inc();

      return {
        ...account,
        name: accountData.descriptiveName || account.name,
        currencyCode: accountData.currencyCode || account.currencyCode,
        timezone: accountData.timeZone || account.timezone,
        isManagerAccount: accountData.manager || account.isManagerAccount,
        isActive: accountData.status === 'ENABLED',
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error getting account details', { error, accountId });
      adsApiMetrics.requestCounter.labels('get_account_details', 'error').inc();
      
      if (error instanceof AdsApiError) {
        throw error;
      }
      
      throw new AdsApiError(
        'Failed to get account details: ' + (error instanceof Error ? error.message : String(error)),
        'API_ERROR'
      );
    }
  }

  /**
   * Create a search campaign in Google Ads
   */
  public async createSearchCampaign(params: SearchCampaignParams): Promise<GadsCampaign> {
    const startTime = Date.now();
    logger.info('Creating search campaign', { params });
    adsApiMetrics.requestCounter.labels('create_search_campaign', 'attempt').inc();

    try {
      // Get the account from the database
      const account = await db.query.gadsAccounts.findFirst({
        where: eq(gadsAccounts.cid, params.accountId)
      });

      if (!account) {
        throw new AdsApiError('Google Ads account not found', 'NOT_FOUND');
      }

      // Initialize API client with this account
      const customer = await this.getCustomerInstance(account);

      // Create campaign with retry logic for rate limiting
      let campaignResult;
      let retries = 0;
      
      while (retries <= this.maxRetries) {
        try {
          campaignResult = await this.executeCreateSearchCampaign(customer, params);
          break; // Success, exit the retry loop
        } catch (error) {
          if (this.isRateLimitError(error) && retries < this.maxRetries) {
            retries++;
            logger.warn(`Rate limit hit, retrying (${retries}/${this.maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, this.rateLimitRetryDelay * retries));
          } else {
            throw error; // Rethrow if not a rate limit error or max retries reached
          }
        }
      }

      if (!campaignResult) {
        throw new AdsApiError('Failed to create campaign after retries', 'OPERATION_FAILED');
      }

      // If this is a dry run, don't store in database
      if (params.isDryRun) {
        logger.info('Dry run completed successfully', { campaignResult });
        
        // Record metrics
        const duration = (Date.now() - startTime) / 1000;
        adsApiMetrics.requestDuration.labels('create_search_campaign').observe(duration);
        adsApiMetrics.requestCounter.labels('create_search_campaign', 'success').inc();
        
        return {
          id: 0, // Placeholder ID for dry run
          gadsAccountId: account.id,
          campaignId: 'dry-run-' + Date.now(),
          campaignName: params.campaignName,
          campaignType: 'SEARCH',
          status: 'DRY_RUN',
          budgetAmount: params.budget.amount,
          isDryRun: true,
          createdByAgent: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

      // Store campaign in database
      const [campaign] = await db.insert(gadsCampaigns)
        .values({
          gadsAccountId: account.id,
          campaignId: campaignResult.id,
          campaignName: params.campaignName,
          campaignType: 'SEARCH',
          status: campaignResult.status || 'ENABLED',
          budgetAmount: params.budget.amount,
          isDryRun: false,
          createdByAgent: null // Can be set by caller if needed
        })
        .returning();

      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      adsApiMetrics.requestDuration.labels('create_search_campaign').observe(duration);
      adsApiMetrics.requestCounter.labels('create_search_campaign', 'success').inc();

      return campaign;
    } catch (error) {
      logger.error('Error creating search campaign', { error, params });
      adsApiMetrics.requestCounter.labels('create_search_campaign', 'error').inc();
      
      if (error instanceof AdsApiError) {
        throw error;
      }
      
      throw new AdsApiError(
        'Failed to create search campaign: ' + (error instanceof Error ? error.message : String(error)),
        'CAMPAIGN_CREATION_ERROR'
      );
    }
  }

  /**
   * Execute the actual search campaign creation
   * This is separated to allow for retry logic
   */
  private async executeCreateSearchCampaign(customer: Customer, params: SearchCampaignParams): Promise<{
    id: string;
    status: string;
  }> {
    try {
      // Step 1: Create a campaign budget
      const budgetOperation = new BudgetOperation();
      const budget = new CampaignBudget();
      
      budget.name = `Budget for ${params.campaignName}`;
      budget.amountMicros = params.budget.amount * 1000000; // Convert to micros
      budget.deliveryMethod = params.budget.deliveryMethod || 'STANDARD';
      
      budgetOperation.create = budget;
      
      let budgetResponse;
      
      // If this is a dry run, don't actually create the budget
      if (params.isDryRun) {
        budgetResponse = { results: [{ resourceName: 'customers/' + params.accountId + '/campaignBudgets/dry-run-budget' }] };
      } else {
        budgetResponse = await customer.campaignBudgets.create([budgetOperation]);
      }
      
      if (!budgetResponse.results || budgetResponse.results.length === 0) {
        throw new AdsApiError('Failed to create campaign budget', 'BUDGET_CREATION_ERROR');
      }
      
      const budgetResourceName = budgetResponse.results[0].resourceName;
      
      // Step 2: Create the campaign
      const campaignOperation = new CampaignOperation();
      const campaign = new Campaign();
      
      campaign.name = params.campaignName;
      campaign.advertisingChannelType = 'SEARCH';
      campaign.status = 'ENABLED';
      campaign.campaignBudget = budgetResourceName;
      
      // Set bid strategy
      if (params.bidStrategy) {
        switch (params.bidStrategy.type) {
          case 'MAXIMIZE_CONVERSIONS':
            campaign.maximizeConversions = {};
            break;
          case 'MAXIMIZE_CONVERSION_VALUE':
            campaign.maximizeConversionValue = {};
            break;
          case 'TARGET_CPA':
            if (params.bidStrategy.targetCpa) {
              campaign.targetCpa = {
                targetCpaMicros: params.bidStrategy.targetCpa * 1000000
              };
            }
            break;
          case 'TARGET_ROAS':
            if (params.bidStrategy.targetRoas) {
              campaign.targetRoas = {
                targetRoas: params.bidStrategy.targetRoas
              };
            }
            break;
          case 'MANUAL_CPC':
            campaign.manualCpc = {
              enhancedCpcEnabled: true
            };
            break;
        }
      } else {
        // Default to maximize conversions if not specified
        campaign.maximizeConversions = {};
      }
      
      // Set campaign dates
      if (params.startDate) {
        campaign.startDate = params.startDate;
      } else {
        // Default to today
        const today = new Date();
        campaign.startDate = today.toISOString().split('T')[0].replace(/-/g, '');
      }
      
      if (params.endDate) {
        campaign.endDate = params.endDate;
      }
      
      // Set network settings
      if (params.networkSettings) {
        campaign.networkSettings = {
          targetGoogleSearch: params.networkSettings.targetGoogleSearch ?? true,
          targetSearchNetwork: params.networkSettings.targetSearchNetwork ?? true,
          targetContentNetwork: params.networkSettings.targetContentNetwork ?? false,
          targetPartnerSearchNetwork: params.networkSettings.targetPartnerSearchNetwork ?? false
        };
      } else {
        // Default network settings for search campaigns
        campaign.networkSettings = {
          targetGoogleSearch: true,
          targetSearchNetwork: true,
          targetContentNetwork: false,
          targetPartnerSearchNetwork: false
        };
      }
      
      campaignOperation.create = campaign;
      
      let campaignResponse;
      
      // If this is a dry run, don't actually create the campaign
      if (params.isDryRun) {
        campaignResponse = { 
          results: [{ 
            resourceName: 'customers/' + params.accountId + '/campaigns/dry-run-' + Date.now() 
          }] 
        };
      } else {
        campaignResponse = await customer.campaigns.create([campaignOperation]);
      }
      
      if (!campaignResponse.results || campaignResponse.results.length === 0) {
        throw new AdsApiError('Failed to create campaign', 'CAMPAIGN_CREATION_ERROR');
      }
      
      const campaignResourceName = campaignResponse.results[0].resourceName;
      const campaignId = campaignResourceName.split('/').pop() || 'unknown';
      
      // Step 3: Set geo targeting if specified
      if (params.locations && params.locations.length > 0 && !params.isDryRun) {
        // Implementation for geo targeting would go here
        // This requires additional operations to create campaign criteria
      }
      
      // Step 4: Set language targeting if specified
      if (params.languages && params.languages.length > 0 && !params.isDryRun) {
        // Implementation for language targeting would go here
        // This requires additional operations to create campaign criteria
      }
      
      return {
        id: campaignId,
        status: 'ENABLED'
      };
    } catch (error) {
      logger.error('Error in executeCreateSearchCampaign', { error });
      
      if (this.isRateLimitError(error)) {
        throw new RateLimitError('Google Ads API rate limit exceeded', error);
      }
      
      throw new AdsApiError(
        'Campaign creation failed: ' + (error instanceof Error ? error.message : String(error)),
        'CAMPAIGN_CREATION_ERROR',
        error
      );
    }
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    // Google Ads API rate limit errors typically have status codes 429 or specific error codes
    if (error.response?.status === 429) {
      return true;
    }
    
    // Check for rate limit error codes in the error details
    if (error.details?.errors) {
      for (const err of error.details.errors) {
        if (err.errorCode?.quotaError || err.errorCode?.rateExceededError) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get a Customer instance for the Google Ads API
   */
  private async getCustomerInstance(account: GadsAccount): Promise<Customer> {
    try {
      // Decrypt the refresh token
      const refreshToken = this.decryptToken(account.refreshToken || '');
      
      if (!refreshToken) {
        throw new AuthenticationError('Missing or invalid refresh token');
      }
      
      // Initialize Google Ads API client
      if (!this.googleAdsClient) {
        this.googleAdsClient = new GoogleAdsApi({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          developer_token: this.config.developerToken,
          refresh_token: refreshToken,
          login_customer_id: account.isManagerAccount ? account.cid : undefined
        });
      } else {
        // Update refresh token if needed
        this.googleAdsClient.setRefreshToken(refreshToken);
        
        // Set login customer ID if this is a manager account
        if (account.isManagerAccount) {
          this.googleAdsClient.setLoginCustomerId(account.cid);
        }
      }
      
      // Create customer instance
      return this.googleAdsClient.Customer({
        customer_id: account.cid
      });
    } catch (error) {
      logger.error('Error getting customer instance', { error, accountId: account.id });
      
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new AdsApiError(
        'Failed to initialize Google Ads API client: ' + (error instanceof Error ? error.message : String(error)),
        'API_INITIALIZATION_ERROR'
      );
    }
  }

  /**
   * Refresh the access token for a Google Ads account
   */
  private async refreshAccessToken(account: GadsAccount): Promise<string> {
    try {
      const startTime = Date.now();
      logger.info('Refreshing access token', { accountId: account.id });
      
      // Decrypt the refresh token
      const refreshToken = this.decryptToken(account.refreshToken || '');
      
      if (!refreshToken) {
        throw new AuthenticationError('Missing or invalid refresh token');
      }
      
      // Set the refresh token on the OAuth client
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });
      
      // Refresh the access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new AuthenticationError('Failed to refresh access token');
      }
      
      // Encrypt the new access token
      const encryptedAccessToken = this.encryptToken(credentials.access_token);
      
      // Update the account in the database
      await db.update(gadsAccounts)
        .set({
          accessToken: encryptedAccessToken,
          tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
          updatedAt: new Date()
        })
        .where(eq(gadsAccounts.id, account.id));
      
      // Record metrics
      const duration = (Date.now() - startTime) / 1000;
      adsApiMetrics.requestDuration.labels('refresh_token').observe(duration);
      adsApiMetrics.tokenRefreshCounter.labels('success').inc();
      
      return credentials.access_token;
    } catch (error) {
      logger.error('Error refreshing access token', { error, accountId: account.id });
      adsApiMetrics.tokenRefreshCounter.labels('error').inc();
      
      throw new AuthenticationError(
        'Failed to refresh access token: ' + (error instanceof Error ? error.message : String(error))
      );
    }
  }

  /**
   * Encrypt a token for secure storage
   */
  private encryptToken(token: string): string {
    try {
      // Use provided IV or generate a random one
      const iv = this.config.encryptionIv 
        ? Buffer.from(this.config.encryptionIv, 'hex') 
        : randomBytes(16);
      
      const cipher = createCipheriv(
        'aes-256-cbc', 
        Buffer.from(this.config.encryptionKey.slice(0, 32).padEnd(32, '0')), 
        iv
      );
      
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Store IV with the encrypted data if we generated it
      if (!this.config.encryptionIv) {
        return iv.toString('hex') + ':' + encrypted;
      }
      
      return encrypted;
    } catch (error) {
      logger.error('Error encrypting token', { error });
      throw new Error('Token encryption failed');
    }
  }

  /**
   * Decrypt a token from secure storage
   */
  private decryptToken(encryptedToken: string): string {
    try {
      let iv: Buffer;
      let encrypted: string;
      
      // Check if IV is stored with the encrypted data
      if (encryptedToken.includes(':')) {
        const parts = encryptedToken.split(':');
        iv = Buffer.from(parts[0], 'hex');
        encrypted = parts[1];
      } else if (this.config.encryptionIv) {
        // Use provided IV
        iv = Buffer.from(this.config.encryptionIv, 'hex');
        encrypted = encryptedToken;
      } else {
        throw new Error('Missing encryption IV');
      }
      
      const decipher = createDecipheriv(
        'aes-256-cbc', 
        Buffer.from(this.config.encryptionKey.slice(0, 32).padEnd(32, '0')), 
        iv
      );
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Error decrypting token', { error });
      throw new Error('Token decryption failed');
    }
  }
}

// Export a singleton instance for convenience
export const adsApiService = new AdsApiService();
