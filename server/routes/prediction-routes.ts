import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation';
import logger from '../utils/logger';
import { 
  predictVINPrice, 
  predictWithMindsDB, 
  batchPredictWithMindsDB,
  getAvailableMindsDBModels
} from '../services/mindsdb-functions';
import { performance } from 'perf_hooks';

const router = Router();

// Schema for VIN price prediction
const vinPricePredictionSchema = z.object({
  vin: z.string().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'Invalid VIN format'),
  mileage: z.number().optional(),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  options: z.record(z.string(), z.any()).optional()
});

// Schema for custom prediction
const customPredictionSchema = z.object({
  modelName: z.string().min(1),
  inputs: z.record(z.string(), z.any()),
  options: z.record(z.string(), z.any()).optional()
});

// Schema for batch prediction
const batchPredictionSchema = z.object({
  modelName: z.string().min(1),
  inputs: z.array(z.record(z.string(), z.any())).min(1).max(100),
  options: z.record(z.string(), z.any()).optional()
});

/**
 * @route POST /api/predictions/vin-price
 * @description Predict vehicle price based on VIN
 * @access Private
 */
router.post(
  '/vin-price',
  validateRequest({ body: vinPricePredictionSchema }),
  async (req, res) => {
    const startTime = performance.now();
    const { vin, mileage, condition, options } = req.body;

    try {
      logger.info('VIN price prediction request', { vin, mileage, condition });
      
      const result = await predictVINPrice({
        vin,
        mileage,
        condition,
        options
      });

      const responseTime = performance.now() - startTime;
      
      // Log performance metrics
      logger.info('VIN price prediction completed', { 
        vin, 
        responseTime: `${responseTime.toFixed(2)}ms`,
        success: result.success
      });

      // Check if response time meets SLA
      if (responseTime > 1000) {
        logger.warn('VIN price prediction exceeded 1s SLA', { 
          vin, 
          responseTime: `${responseTime.toFixed(2)}ms` 
        });
      }

      return res.json({
        ...result,
        responseTime: `${responseTime.toFixed(2)}ms`
      });
    } catch (error) {
      logger.error('Error in VIN price prediction', { 
        vin, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to predict VIN price',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/predictions/custom
 * @description Make a custom prediction using any MindsDB model
 * @access Private
 */
router.post(
  '/custom',
  validateRequest({ body: customPredictionSchema }),
  async (req, res) => {
    const startTime = performance.now();
    const { modelName, inputs, options } = req.body;

    try {
      logger.info('Custom prediction request', { modelName, inputs });
      
      const result = await predictWithMindsDB({
        modelName,
        inputs,
        options
      });

      const responseTime = performance.now() - startTime;
      
      // Log performance metrics
      logger.info('Custom prediction completed', { 
        modelName, 
        responseTime: `${responseTime.toFixed(2)}ms`,
        success: result.success
      });

      // Check if response time meets SLA
      if (responseTime > 1000) {
        logger.warn('Custom prediction exceeded 1s SLA', { 
          modelName, 
          responseTime: `${responseTime.toFixed(2)}ms` 
        });
      }

      return res.json({
        ...result,
        responseTime: `${responseTime.toFixed(2)}ms`
      });
    } catch (error) {
      logger.error('Error in custom prediction', { 
        modelName, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to make custom prediction',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route POST /api/predictions/batch
 * @description Run batch predictions with MindsDB
 * @access Private
 */
router.post(
  '/batch',
  validateRequest({ body: batchPredictionSchema }),
  async (req, res) => {
    const startTime = performance.now();
    const { modelName, inputs, options } = req.body;

    try {
      logger.info('Batch prediction request', { 
        modelName, 
        batchSize: inputs.length 
      });
      
      const result = await batchPredictWithMindsDB({
        modelName,
        inputs,
        options
      });

      const responseTime = performance.now() - startTime;
      const avgTimePerItem = responseTime / inputs.length;
      
      // Log performance metrics
      logger.info('Batch prediction completed', { 
        modelName, 
        batchSize: inputs.length,
        responseTime: `${responseTime.toFixed(2)}ms`,
        avgTimePerItem: `${avgTimePerItem.toFixed(2)}ms`,
        success: result.success
      });

      // For batch operations, we allow longer processing but monitor avg time per item
      if (avgTimePerItem > 1000) {
        logger.warn('Batch prediction average time per item exceeded 1s', { 
          modelName, 
          avgTimePerItem: `${avgTimePerItem.toFixed(2)}ms` 
        });
      }

      return res.json({
        ...result,
        responseTime: `${responseTime.toFixed(2)}ms`,
        avgTimePerItem: `${avgTimePerItem.toFixed(2)}ms`
      });
    } catch (error) {
      logger.error('Error in batch prediction', { 
        modelName, 
        batchSize: inputs.length,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to process batch prediction',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * @route GET /api/predictions/models
 * @description Get available MindsDB prediction models
 * @access Private
 */
router.get('/models', async (req, res) => {
  const startTime = performance.now();

  try {
    logger.info('Request for available prediction models');
    
    const models = await getAvailableMindsDBModels();
    const responseTime = performance.now() - startTime;
    
    logger.info('Retrieved available prediction models', { 
      count: models.length,
      responseTime: `${responseTime.toFixed(2)}ms` 
    });

    return res.json({
      success: true,
      models,
      responseTime: `${responseTime.toFixed(2)}ms`
    });
  } catch (error) {
    logger.error('Error retrieving prediction models', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve prediction models',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/predictions/health
 * @description Check MindsDB service health
 * @access Private
 */
router.get('/health', async (req, res) => {
  const startTime = performance.now();

  try {
    // Perform a simple VIN price prediction as a health check
    const result = await predictVINPrice({
      vin: '1HGCM82633A123456', // Test VIN
      options: { healthCheck: true }
    });
    
    const responseTime = performance.now() - startTime;
    
    if (result.success) {
      return res.json({
        status: 'healthy',
        responseTime: `${responseTime.toFixed(2)}ms`
      });
    } else {
      return res.status(503).json({
        status: 'unhealthy',
        error: result.error || 'MindsDB service unavailable',
        responseTime: `${responseTime.toFixed(2)}ms`
      });
    }
  } catch (error) {
    logger.error('MindsDB health check failed', { 
      error: error instanceof Error ? error.message : String(error)
    });
    
    return res.status(503).json({
      status: 'unhealthy',
      error: 'MindsDB service unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
