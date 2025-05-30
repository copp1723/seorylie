/**
 * Google Ads Automation Worker
 * 
 * Handles automated tasks related to Google Ads campaigns:
 * - Budget pacing and optimization
 * - Campaign performance monitoring
 * - Bid adjustment recommendations
 * - Keyword performance analysis
 * - Alert generation for budget overruns
 * 
 * Subscribes to orchestrator events and processes ads.tasks queue.
 */

import { Queue, Worker, Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { EventBus, EventType } from './event-bus';
import { AdsApiService } from './ads-api-service';
import { db } from '../db';
import { gadsAccounts, gadsCampaigns } from '../../shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { promClient } from '../observability/metrics';

// Define automation strategies
export enum AutomationStrategy {
  CONSERVATIVE = 'conservative',
  BALANCED = 'balanced',
  AGGRESSIVE = 'aggressive'
}

// Define task types
export enum AdsTaskType {
  BUDGET_PACING = 'budget_pacing',
  PERFORMANCE_MONITORING = 'performance_monitoring',
  BID_ADJUSTMENT = 'bid_adjustment',
  KEYWORD_ANALYSIS = 'keyword_analysis',
  CAMPAIGN_CREATION = 'campaign_creation'
}

// Define task data interfaces
export interface AdsTaskData {
  taskType: AdsTaskType;
  accountId: string;
  correlationId?: string;
  sandboxId?: number;
  userId?: number;
  dealershipId?: number;
  strategy?: AutomationStrategy;
  [key: string]: any; // Additional task-specific data
}

// Budget pacing task data
export interface BudgetPacingTaskData extends AdsTaskData {
  taskType: AdsTaskType.BUDGET_PACING;
  campaignIds: string[];
  dailyBudget: number;
  maxAdjustmentPercentage?: number;
  minDailySpend?: number;
}

// Performance monitoring task data
export interface PerformanceMonitoringTaskData extends AdsTaskData {
  taskType: AdsTaskType.PERFORMANCE_MONITORING;
  campaignIds: string[];
  metrics: string[];
  thresholds: Record<string, number>;
}

// Campaign creation task data
export interface CampaignCreationTaskData extends AdsTaskData {
  taskType: AdsTaskType.CAMPAIGN_CREATION;
  campaignName: string;
  budget: {
    amount: number;
    deliveryMethod: string;
  };
  bidStrategy: {
    type: string;
    [key: string]: any;
  };
  isDryRun?: boolean;
}

// Metrics for monitoring
const taskCounter = new promClient.Counter({
  name: 'ads_automation_tasks_total',
  help: 'Total number of ads automation tasks processed',
  labelNames: ['task_type', 'status', 'strategy']
});

const taskDurationHistogram = new promClient.Histogram({
  name: 'ads_automation_task_duration_seconds',
  help: 'Duration of ads automation tasks in seconds',
  labelNames: ['task_type', 'strategy'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120]
});

const budgetUtilizationGauge = new promClient.Gauge({
  name: 'ads_campaign_budget_utilization_percent',
  help: 'Campaign budget utilization percentage',
  labelNames: ['account_id', 'campaign_id']
});

/**
 * Google Ads Automation Worker class
 * Processes ads tasks and subscribes to orchestrator events
 */
export class AdsAutomationWorker {
  private taskQueue: Queue;
  private worker: Worker;
  private eventBus: EventBus;
  private adsApiService: AdsApiService;
  private isRunning: boolean = false;
  private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  private eventConsumerId: string;

  constructor(
    eventBus: EventBus,
    adsApiService: AdsApiService,
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379'
  ) {
    this.eventBus = eventBus;
    this.adsApiService = adsApiService;
    this.eventConsumerId = `ads-automation-worker-${uuidv4().substring(0, 8)}`;

    // Initialize task queue
    this.taskQueue = new Queue('ads.tasks', {
      connection: {
        host: new URL(redisUrl).hostname,
        port: parseInt(new URL(redisUrl).port || '6379')
      }
    });

    // Initialize worker
    this.worker = new Worker(
      'ads.tasks',
      async (job: Job) => this.processTask(job),
      {
        connection: {
          host: new URL(redisUrl).hostname,
          port: parseInt(new URL(redisUrl).port || '6379')
        },
        concurrency: 5,
        limiter: {
          max: 10,
          duration: 1000
        }
      }
    );

    // Set up worker event handlers
    this.worker.on('completed', (job) => {
      logger.info(`Ads automation task completed: ${job.id}`, {
        taskType: job.data.taskType,
        accountId: job.data.accountId
      });
      taskCounter.inc({ task_type: job.data.taskType, status: 'completed', strategy: job.data.strategy || 'balanced' });
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Ads automation task failed: ${job?.id}`, {
        taskType: job?.data.taskType,
        accountId: job?.data.accountId,
        error: err.message,
        stack: err.stack
      });
      taskCounter.inc({ task_type: job?.data.taskType, status: 'failed', strategy: job?.data.strategy || 'balanced' });
    });

    this.worker.on('error', (err) => {
      logger.error('Ads automation worker error', { error: err.message, stack: err.stack });
      this.healthStatus = 'degraded';
    });
  }

  /**
   * Start the automation worker and event subscriptions
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      logger.info('Starting Ads Automation Worker');
      
      // Subscribe to orchestrator events
      await this.subscribeToEvents();
      
      this.isRunning = true;
      this.healthStatus = 'healthy';
      
      // Publish worker started event
      await this.eventBus.publish(EventType.AUTOMATION_STARTED, {
        workerId: this.eventConsumerId,
        timestamp: new Date().toISOString(),
        service: 'ads-automation-worker'
      });
      
      logger.info('Ads Automation Worker started successfully');
    } catch (error) {
      logger.error('Failed to start Ads Automation Worker', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      this.healthStatus = 'unhealthy';
      throw error;
    }
  }

  /**
   * Stop the automation worker and clean up
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping Ads Automation Worker');
      
      // Unsubscribe from events
      await this.eventBus.unsubscribe(this.eventConsumerId);
      
      // Close the worker
      await this.worker.close();
      
      // Close the queue
      await this.taskQueue.close();
      
      this.isRunning = false;
      
      // Publish worker stopped event
      await this.eventBus.publish(EventType.AUTOMATION_STOPPED, {
        workerId: this.eventConsumerId,
        timestamp: new Date().toISOString(),
        service: 'ads-automation-worker'
      });
      
      logger.info('Ads Automation Worker stopped successfully');
    } catch (error) {
      logger.error('Error stopping Ads Automation Worker', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Get the health status of the worker
   */
  public getHealth(): { status: string; details: any } {
    return {
      status: this.healthStatus,
      details: {
        isRunning: this.isRunning,
        workerId: this.eventConsumerId,
        queueName: 'ads.tasks',
        activeJobs: this.worker.activeJobs?.size || 0
      }
    };
  }

  /**
   * Add a task to the queue
   */
  public async addTask(taskData: AdsTaskData): Promise<string> {
    try {
      // Generate correlation ID if not provided
      const correlationId = taskData.correlationId || uuidv4();
      
      // Add task to queue
      const job = await this.taskQueue.add(
        taskData.taskType,
        { ...taskData, correlationId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000
          },
          removeOnComplete: 100, // Keep last 100 completed jobs
          removeOnFail: 200 // Keep last 200 failed jobs
        }
      );
      
      logger.info(`Ads automation task added to queue: ${job.id}`, {
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId
      });
      
      // Publish task queued event
      await this.eventBus.publish(EventType.TASK_QUEUED, {
        taskId: job.id as string,
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId,
        timestamp: new Date().toISOString(),
        sandboxId: taskData.sandboxId
      });
      
      return job.id as string;
    } catch (error) {
      logger.error('Failed to add task to queue', {
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Subscribe to relevant events from the event bus
   */
  private async subscribeToEvents(): Promise<void> {
    try {
      // Subscribe to task.completed events
      await this.eventBus.subscribe(
        this.eventConsumerId,
        [EventType.TASK_COMPLETED],
        async (event) => {
          logger.debug(`Received task.completed event`, { eventData: event });
          
          // Process completed task event
          if (event.taskType === 'google_ads.createCampaign') {
            await this.handleCampaignCreationCompleted(event);
          }
        }
      );
      
      // Subscribe to orchestration events
      await this.eventBus.subscribe(
        this.eventConsumerId,
        [EventType.ORCHESTRATION_SEQUENCE_STARTED, EventType.ORCHESTRATION_SEQUENCE_COMPLETED],
        async (event) => {
          logger.debug(`Received orchestration event: ${event.type}`, { eventData: event });
          
          // Process orchestration events
          if (event.type === EventType.ORCHESTRATION_SEQUENCE_STARTED) {
            // If sequence involves ads, prepare resources
            if (event.tools?.includes('google_ads.createCampaign')) {
              await this.prepareForAdsOperation(event);
            }
          } else if (event.type === EventType.ORCHESTRATION_SEQUENCE_COMPLETED) {
            // If sequence involves ads, check results
            if (event.tools?.includes('google_ads.createCampaign')) {
              await this.processSequenceResults(event);
            }
          }
        }
      );
      
      logger.info('Successfully subscribed to events', {
        consumerId: this.eventConsumerId,
        events: [EventType.TASK_COMPLETED, EventType.ORCHESTRATION_SEQUENCE_STARTED, EventType.ORCHESTRATION_SEQUENCE_COMPLETED]
      });
    } catch (error) {
      logger.error('Failed to subscribe to events', {
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      throw error;
    }
  }

  /**
   * Process a task from the queue
   */
  private async processTask(job: Job): Promise<any> {
    const startTime = Date.now();
    const taskData = job.data as AdsTaskData;
    
    logger.info(`Processing ads automation task: ${job.id}`, {
      taskType: taskData.taskType,
      accountId: taskData.accountId,
      correlationId: taskData.correlationId
    });
    
    try {
      // Publish task started event
      await this.eventBus.publish(EventType.TASK_STARTED, {
        taskId: job.id as string,
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId: taskData.correlationId,
        timestamp: new Date().toISOString(),
        sandboxId: taskData.sandboxId
      });
      
      let result;
      
      // Process task based on type
      switch (taskData.taskType) {
        case AdsTaskType.BUDGET_PACING:
          result = await this.processBudgetPacingTask(taskData as BudgetPacingTaskData);
          break;
          
        case AdsTaskType.PERFORMANCE_MONITORING:
          result = await this.processPerformanceMonitoringTask(taskData as PerformanceMonitoringTaskData);
          break;
          
        case AdsTaskType.BID_ADJUSTMENT:
          result = await this.processBidAdjustmentTask(taskData);
          break;
          
        case AdsTaskType.KEYWORD_ANALYSIS:
          result = await this.processKeywordAnalysisTask(taskData);
          break;
          
        case AdsTaskType.CAMPAIGN_CREATION:
          result = await this.processCampaignCreationTask(taskData as CampaignCreationTaskData);
          break;
          
        default:
          throw new Error(`Unknown task type: ${taskData.taskType}`);
      }
      
      // Calculate task duration
      const duration = (Date.now() - startTime) / 1000;
      taskDurationHistogram.observe(
        { task_type: taskData.taskType, strategy: taskData.strategy || 'balanced' },
        duration
      );
      
      // Publish task completed event
      await this.eventBus.publish(EventType.TASK_COMPLETED, {
        taskId: job.id as string,
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId: taskData.correlationId,
        timestamp: new Date().toISOString(),
        duration,
        result,
        sandboxId: taskData.sandboxId
      });
      
      logger.info(`Completed ads automation task: ${job.id}`, {
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId: taskData.correlationId,
        duration
      });
      
      return result;
    } catch (error) {
      logger.error(`Error processing ads automation task: ${job.id}`, {
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId: taskData.correlationId,
        error: (error as Error).message,
        stack: (error as Error).stack
      });
      
      // Publish task failed event
      await this.eventBus.publish(EventType.TASK_FAILED, {
        taskId: job.id as string,
        taskType: taskData.taskType,
        accountId: taskData.accountId,
        correlationId: taskData.correlationId,
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
        sandboxId: taskData.sandboxId
      });
      
      throw error;
    }
  }

  /**
   * Process budget pacing task
   */
  private async processBudgetPacingTask(taskData: BudgetPacingTaskData): Promise<any> {
    logger.info('Processing budget pacing task', {
      accountId: taskData.accountId,
      campaignIds: taskData.campaignIds,
      dailyBudget: taskData.dailyBudget
    });
    
    const results = [];
    const strategy = taskData.strategy || AutomationStrategy.BALANCED;
    const maxAdjustment = taskData.maxAdjustmentPercentage || this.getDefaultMaxAdjustment(strategy);
    
    try {
      // Get account details
      const account = await this.getGoogleAdsAccount(taskData.accountId);
      
      // For each campaign, check spend rate and adjust if needed
      for (const campaignId of taskData.campaignIds) {
        // Get campaign performance data
        const campaignPerformance = await this.adsApiService.getCampaignPerformance(
          account.cid,
          campaignId,
          ['metrics.cost_micros', 'metrics.impressions', 'metrics.clicks']
        );
        
        // Calculate current spend rate
        const currentTime = new Date();
        const dayProgress = (currentTime.getHours() * 60 + currentTime.getMinutes()) / (24 * 60);
        const dailyBudgetMicros = taskData.dailyBudget * 1000000;
        const spentMicros = campaignPerformance.metrics?.cost_micros || 0;
        const spendRate = spentMicros / (dailyBudgetMicros * dayProgress);
        
        // Update budget utilization metric
        budgetUtilizationGauge.set(
          { account_id: taskData.accountId, campaign_id: campaignId },
          (spentMicros / dailyBudgetMicros) * 100
        );
        
        // Determine if adjustment is needed
        let adjustmentNeeded = false;
        let newBudgetAmount = taskData.dailyBudget;
        
        if (strategy === AutomationStrategy.CONSERVATIVE) {
          // Conservative: Slow down if spending too fast
          if (spendRate > 1.1) {
            adjustmentNeeded = true;
            // Calculate new budget to slow down spending
            const adjustment = Math.min(maxAdjustment / 100, (spendRate - 1) * 0.8);
            newBudgetAmount = taskData.dailyBudget * (1 + adjustment);
          }
        } else if (strategy === AutomationStrategy.AGGRESSIVE) {
          // Aggressive: Increase budget if performing well
          const ctr = campaignPerformance.metrics?.clicks / campaignPerformance.metrics?.impressions;
          if (spendRate > 0.9 && ctr > 0.02) { // Good CTR and high spend rate
            adjustmentNeeded = true;
            // Increase budget to capture more traffic
            newBudgetAmount = taskData.dailyBudget * (1 + (maxAdjustment / 100));
          }
        } else {
          // Balanced: Moderate adjustments
          if (spendRate > 1.2) {
            adjustmentNeeded = true;
            // Moderate increase to avoid running out
            newBudgetAmount = taskData.dailyBudget * (1 + (maxAdjustment / 200));
          } else if (spendRate < 0.5 && dayProgress > 0.5) {
            // Spending too slowly in second half of day
            adjustmentNeeded = true;
            // Small decrease since unlikely to use full budget
            newBudgetAmount = taskData.dailyBudget * (1 - (maxAdjustment / 300));
          }
        }
        
        // Apply adjustment if needed
        if (adjustmentNeeded) {
          logger.info(`Adjusting budget for campaign ${campaignId}`, {
            accountId: taskData.accountId,
            campaignId,
            currentBudget: taskData.dailyBudget,
            newBudget: newBudgetAmount,
            spendRate,
            strategy
          });
          
          // Update campaign budget
          const updateResult = await this.adsApiService.updateCampaignBudget(
            account.cid,
            campaignId,
            newBudgetAmount
          );
          
          results.push({
            campaignId,
            adjustmentApplied: true,
            previousBudget: taskData.dailyBudget,
            newBudget: newBudgetAmount,
            spendRate,
            updateResult
          });
        } else {
          results.push({
            campaignId,
            adjustmentApplied: false,
            currentBudget: taskData.dailyBudget,
            spendRate
          });
        }
      }
      
      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in budget pacing task', {
        accountId: taskData.accountId,
        campaignIds: taskData.campaignIds,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process performance monitoring task
   */
  private async processPerformanceMonitoringTask(taskData: PerformanceMonitoringTaskData): Promise<any> {
    logger.info('Processing performance monitoring task', {
      accountId: taskData.accountId,
      campaignIds: taskData.campaignIds,
      metrics: taskData.metrics
    });
    
    try {
      // Get account details
      const account = await this.getGoogleAdsAccount(taskData.accountId);
      
      const results = [];
      const alerts = [];
      
      // For each campaign, check metrics against thresholds
      for (const campaignId of taskData.campaignIds) {
        // Get campaign performance data
        const campaignPerformance = await this.adsApiService.getCampaignPerformance(
          account.cid,
          campaignId,
          taskData.metrics
        );
        
        const metricResults = {};
        const campaignAlerts = [];
        
        // Check each metric against threshold
        for (const metric of taskData.metrics) {
          const metricValue = this.getMetricValue(campaignPerformance, metric);
          const threshold = taskData.thresholds[metric];
          
          metricResults[metric] = metricValue;
          
          // Check if metric exceeds threshold
          if (threshold !== undefined && this.isThresholdExceeded(metric, metricValue, threshold)) {
            campaignAlerts.push({
              metric,
              value: metricValue,
              threshold,
              timestamp: new Date().toISOString()
            });
          }
        }
        
        results.push({
          campaignId,
          metrics: metricResults,
          alerts: campaignAlerts
        });
        
        // Add campaign alerts to overall alerts
        if (campaignAlerts.length > 0) {
          alerts.push({
            campaignId,
            alerts: campaignAlerts
          });
        }
      }
      
      // If there are alerts, publish alert event
      if (alerts.length > 0) {
        await this.eventBus.publish(EventType.ALERT_GENERATED, {
          alertType: 'campaign_performance',
          accountId: taskData.accountId,
          alerts,
          timestamp: new Date().toISOString(),
          correlationId: taskData.correlationId,
          sandboxId: taskData.sandboxId
        });
      }
      
      return {
        success: true,
        results,
        alerts,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in performance monitoring task', {
        accountId: taskData.accountId,
        campaignIds: taskData.campaignIds,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process bid adjustment task
   */
  private async processBidAdjustmentTask(taskData: AdsTaskData): Promise<any> {
    logger.info('Processing bid adjustment task', {
      accountId: taskData.accountId,
      campaignIds: taskData.campaignIds
    });
    
    try {
      // Get account details
      const account = await this.getGoogleAdsAccount(taskData.accountId);
      
      // Implement bid adjustment logic
      // This is a simplified implementation
      const results = [];
      
      for (const campaignId of taskData.campaignIds) {
        // Get campaign performance by device
        const devicePerformance = await this.adsApiService.getCampaignPerformanceByDevice(
          account.cid,
          campaignId
        );
        
        const adjustments = [];
        
        // Calculate device bid adjustments based on performance
        for (const device of devicePerformance) {
          const convRate = device.metrics.conversions / device.metrics.clicks;
          const avgCvr = devicePerformance.reduce((sum, d) => 
            sum + (d.metrics.conversions / d.metrics.clicks), 0) / devicePerformance.length;
          
          // Calculate adjustment factor based on relative performance
          let adjustmentFactor = 1.0;
          if (convRate > 0) {
            adjustmentFactor = convRate / avgCvr;
          }
          
          // Cap adjustment between 0.7 and 1.3
          adjustmentFactor = Math.max(0.7, Math.min(1.3, adjustmentFactor));
          
          // Apply adjustment if significant difference
          if (Math.abs(adjustmentFactor - 1.0) > 0.05) {
            const bidModifier = adjustmentFactor;
            
            // Apply device bid adjustment
            const result = await this.adsApiService.setDeviceBidModifier(
              account.cid,
              campaignId,
              device.device,
              bidModifier
            );
            
            adjustments.push({
              device: device.device,
              bidModifier,
              previousBidModifier: device.bidModifier,
              conversionRate: convRate,
              avgConversionRate: avgCvr,
              result
            });
          }
        }
        
        results.push({
          campaignId,
          adjustments
        });
      }
      
      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in bid adjustment task', {
        accountId: taskData.accountId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process keyword analysis task
   */
  private async processKeywordAnalysisTask(taskData: AdsTaskData): Promise<any> {
    logger.info('Processing keyword analysis task', {
      accountId: taskData.accountId,
      campaignIds: taskData.campaignIds
    });
    
    try {
      // Get account details
      const account = await this.getGoogleAdsAccount(taskData.accountId);
      
      const results = [];
      const recommendations = [];
      
      // For each campaign, analyze keywords
      for (const campaignId of taskData.campaignIds) {
        // Get keyword performance data
        const keywordPerformance = await this.adsApiService.getKeywordPerformance(
          account.cid,
          campaignId
        );
        
        const campaignRecommendations = {
          campaignId,
          increaseKeywords: [],
          decreaseKeywords: [],
          pauseKeywords: []
        };
        
        // Analyze each keyword
        for (const keyword of keywordPerformance) {
          // Skip keywords with very low impressions
          if (keyword.metrics.impressions < 100) continue;
          
          const ctr = keyword.metrics.clicks / keyword.metrics.impressions;
          const convRate = keyword.metrics.conversions / keyword.metrics.clicks;
          const costPerConv = keyword.metrics.cost_micros / (keyword.metrics.conversions * 1000000);
          
          // Identify poor performing keywords
          if (keyword.metrics.clicks > 50 && convRate < 0.01) {
            // High clicks but very low conversion rate
            campaignRecommendations.pauseKeywords.push({
              keywordId: keyword.keywordId,
              text: keyword.text,
              metrics: {
                impressions: keyword.metrics.impressions,
                clicks: keyword.metrics.clicks,
                ctr,
                convRate,
                costPerConv
              },
              reason: 'High clicks with very low conversion rate'
            });
          } else if (convRate > 0.05 && ctr > 0.03) {
            // High performing keywords - increase bids
            campaignRecommendations.increaseKeywords.push({
              keywordId: keyword.keywordId,
              text: keyword.text,
              metrics: {
                impressions: keyword.metrics.impressions,
                clicks: keyword.metrics.clicks,
                ctr,
                convRate,
                costPerConv
              },
              reason: 'High conversion and click-through rates'
            });
          } else if (keyword.metrics.clicks > 30 && convRate < 0.02 && costPerConv > 50) {
            // Expensive keywords with low conversion - decrease bids
            campaignRecommendations.decreaseKeywords.push({
              keywordId: keyword.keywordId,
              text: keyword.text,
              metrics: {
                impressions: keyword.metrics.impressions,
                clicks: keyword.metrics.clicks,
                ctr,
                convRate,
                costPerConv
              },
              reason: 'High cost per conversion with low conversion rate'
            });
          }
        }
        
        // Add recommendations if any exist
        if (
          campaignRecommendations.increaseKeywords.length > 0 ||
          campaignRecommendations.decreaseKeywords.length > 0 ||
          campaignRecommendations.pauseKeywords.length > 0
        ) {
          recommendations.push(campaignRecommendations);
        }
        
        results.push({
          campaignId,
          keywordCount: keywordPerformance.length,
          recommendations: campaignRecommendations
        });
      }
      
      // If there are recommendations, publish recommendation event
      if (recommendations.length > 0) {
        await this.eventBus.publish(EventType.RECOMMENDATION_GENERATED, {
          recommendationType: 'keyword_optimization',
          accountId: taskData.accountId,
          recommendations,
          timestamp: new Date().toISOString(),
          correlationId: taskData.correlationId,
          sandboxId: taskData.sandboxId
        });
      }
      
      return {
        success: true,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in keyword analysis task', {
        accountId: taskData.accountId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Process campaign creation task
   */
  private async processCampaignCreationTask(taskData: CampaignCreationTaskData): Promise<any> {
    logger.info('Processing campaign creation task', {
      accountId: taskData.accountId,
      campaignName: taskData.campaignName,
      isDryRun: taskData.isDryRun
    });
    
    try {
      // Get account details
      const account = await this.getGoogleAdsAccount(taskData.accountId);
      
      // Create the campaign
      const campaign = await this.adsApiService.createSearchCampaign({
        accountId: account.cid,
        campaignName: taskData.campaignName,
        budget: taskData.budget,
        bidStrategy: taskData.bidStrategy,
        isDryRun: taskData.isDryRun
      });
      
      // Publish campaign creation event
      await this.eventBus.publish(
        taskData.isDryRun ? EventType.CAMPAIGN_DRY_RUN : EventType.CAMPAIGN_CREATED,
        {
          accountId: taskData.accountId,
          campaignId: campaign.campaignId,
          campaignName: taskData.campaignName,
          isDryRun: taskData.isDryRun,
          timestamp: new Date().toISOString(),
          correlationId: taskData.correlationId,
          sandboxId: taskData.sandboxId
        }
      );
      
      return {
        success: true,
        campaign,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error in campaign creation task', {
        accountId: taskData.accountId,
        campaignName: taskData.campaignName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Handle campaign creation completed event
   */
  private async handleCampaignCreationCompleted(event: any): Promise<void> {
    logger.info('Handling campaign creation completed event', {
      taskId: event.taskId,
      result: event.result
    });
    
    try {
      // If campaign was created successfully and not a dry run
      if (event.result?.success && event.result?.campaign && !event.result?.campaign.isDryRun) {
        const campaign = event.result.campaign;
        
        // Schedule performance monitoring task
        await this.addTask({
          taskType: AdsTaskType.PERFORMANCE_MONITORING,
          accountId: event.accountId,
          campaignIds: [campaign.campaignId],
          correlationId: event.correlationId,
          sandboxId: event.sandboxId,
          metrics: ['metrics.impressions', 'metrics.clicks', 'metrics.cost_micros', 'metrics.conversions'],
          thresholds: {
            'metrics.cost_micros': campaign.budgetAmount * 1000000 * 0.8 // 80% of budget
          }
        });
        
        // Schedule budget pacing task
        await this.addTask({
          taskType: AdsTaskType.BUDGET_PACING,
          accountId: event.accountId,
          campaignIds: [campaign.campaignId],
          correlationId: event.correlationId,
          sandboxId: event.sandboxId,
          dailyBudget: campaign.budgetAmount,
          strategy: AutomationStrategy.BALANCED
        });
        
        logger.info('Scheduled follow-up tasks for new campaign', {
          campaignId: campaign.campaignId,
          accountId: event.accountId
        });
      }
    } catch (error) {
      logger.error('Error handling campaign creation completed event', {
        taskId: event.taskId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Prepare for ads operation in an orchestration sequence
   */
  private async prepareForAdsOperation(event: any): Promise<void> {
    logger.info('Preparing for ads operation in orchestration sequence', {
      sequenceId: event.sequenceId,
      tools: event.tools
    });
    
    // This could involve pre-allocating resources, validating accounts, etc.
    // For now, just log the preparation
  }

  /**
   * Process results of an orchestration sequence
   */
  private async processSequenceResults(event: any): Promise<void> {
    logger.info('Processing results of orchestration sequence', {
      sequenceId: event.sequenceId,
      results: event.results
    });
    
    try {
      // Check if there are Google Ads results to process
      const adsResults = event.results?.find(r => r.tool === 'google_ads.createCampaign');
      
      if (adsResults && adsResults.result?.success) {
        // Process successful ads operation
        const campaign = adsResults.result.campaign;
        
        // Publish analytics event with campaign data
        await this.eventBus.publish(EventType.ANALYTICS_DATA, {
          dataType: 'campaign_creation',
          accountId: adsResults.accountId,
          campaignId: campaign.campaignId,
          campaignName: campaign.campaignName,
          budgetAmount: campaign.budgetAmount,
          isDryRun: campaign.isDryRun,
          timestamp: new Date().toISOString(),
          correlationId: event.correlationId,
          sequenceId: event.sequenceId,
          sandboxId: event.sandboxId
        });
        
        logger.info('Published analytics data for campaign creation', {
          campaignId: campaign.campaignId,
          sequenceId: event.sequenceId
        });
      }
    } catch (error) {
      logger.error('Error processing orchestration sequence results', {
        sequenceId: event.sequenceId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Get Google Ads account by ID
   */
  private async getGoogleAdsAccount(accountId: string): Promise<any> {
    try {
      // First check if it's a numeric ID (database ID) or CID (account ID)
      let account;
      
      if (/^\d+$/.test(accountId)) {
        // Numeric ID - get from database
        account = await db.query.gadsAccounts.findFirst({
          where: eq(gadsAccounts.id, parseInt(accountId))
        });
      } else {
        // CID - get from database
        account = await db.query.gadsAccounts.findFirst({
          where: eq(gadsAccounts.cid, accountId)
        });
      }
      
      if (!account) {
        throw new Error(`Google Ads account not found: ${accountId}`);
      }
      
      return account;
    } catch (error) {
      logger.error('Error getting Google Ads account', {
        accountId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get default max adjustment percentage based on strategy
   */
  private getDefaultMaxAdjustment(strategy: AutomationStrategy): number {
    switch (strategy) {
      case AutomationStrategy.CONSERVATIVE:
        return 10; // 10% max adjustment
      case AutomationStrategy.AGGRESSIVE:
        return 30; // 30% max adjustment
      case AutomationStrategy.BALANCED:
      default:
        return 20; // 20% max adjustment
    }
  }

  /**
   * Get metric value from campaign performance data
   */
  private getMetricValue(performance: any, metricPath: string): number {
    const parts = metricPath.split('.');
    let value = performance;
    
    for (const part of parts) {
      if (value && value[part] !== undefined) {
        value = value[part];
      } else {
        return 0;
      }
    }
    
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Check if a metric exceeds its threshold
   */
  private isThresholdExceeded(metric: string, value: number, threshold: number): boolean {
    // For cost metrics, exceeding means going over threshold
    if (metric.includes('cost') || metric.includes('spend')) {
      return value > threshold;
    }
    
    // For performance metrics (CTR, conversion rate), exceeding means going under threshold
    if (metric.includes('ctr') || metric.includes('rate') || metric.includes('percentage')) {
      return value < threshold;
    }
    
    // Default to over threshold
    return value > threshold;
  }
}

// Export singleton instance
export const adsAutomationWorker = new AdsAutomationWorker(
  // These will be injected when the module is imported
  null as any, // eventBus will be injected
  null as any  // adsApiService will be injected
);

export default adsAutomationWorker;
