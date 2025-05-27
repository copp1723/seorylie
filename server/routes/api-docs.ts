import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { generateOpenApiSpec, getOpenApiJson, getOpenApiYaml } from '../utils/openapi-generator';
import logger from '../utils/logger';

const router = Router();

// Generate the OpenAPI specification
let openApiSpec: any;

try {
  openApiSpec = generateOpenApiSpec();
  logger.info('OpenAPI specification generated successfully');
} catch (error) {
  logger.error('Failed to generate OpenAPI specification', { error });
  openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Rylie AI API',
      version: '1.0.0',
      description: 'API documentation generation failed. Please check server logs.'
    },
    paths: {}
  };
}

// Swagger UI options
const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    url: '/api/docs/openapi.json',
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    filter: true,
    supportedSubmitMethods: ['get', 'post', 'put', 'patch', 'delete'],
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2
  },
  customSiteTitle: 'Rylie AI API Documentation',
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { color: #1f2937; }
    .swagger-ui .scheme-container { background: #f8fafc; padding: 20px; margin: 20px 0; border-radius: 8px; }
  `,
  customfavIcon: '/favicon.ico'
};

/**
 * @swagger
 * tags:
 *   - name: Documentation
 *     description: API documentation and specification endpoints
 */

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Interactive API documentation
 *     description: Swagger UI interface for exploring and testing the API
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: HTML page with interactive API documentation
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(openApiSpec, swaggerOptions));

/**
 * @swagger
 * /api/docs/openapi.json:
 *   get:
 *     summary: OpenAPI specification (JSON)
 *     description: Download the complete OpenAPI 3.0 specification in JSON format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification in JSON format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/openapi.json', (req: Request, res: Response) => {
  try {
    const spec = getOpenApiJson();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.json(spec);
  } catch (error) {
    logger.error('Failed to serve OpenAPI JSON', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate OpenAPI specification'
    });
  }
});

/**
 * @swagger
 * /api/docs/openapi.yaml:
 *   get:
 *     summary: OpenAPI specification (YAML)
 *     description: Download the complete OpenAPI 3.0 specification in YAML format
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: OpenAPI specification in YAML format
 *         content:
 *           application/x-yaml:
 *             schema:
 *               type: string
 */
router.get('/openapi.yaml', (req: Request, res: Response) => {
  try {
    const spec = getOpenApiYaml();
    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Content-Disposition', 'attachment; filename="rylie-api-spec.yaml"');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(spec);
  } catch (error) {
    logger.error('Failed to serve OpenAPI YAML', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate OpenAPI specification'
    });
  }
});

/**
 * @swagger
 * /api/docs/spec:
 *   get:
 *     summary: API specification metadata
 *     description: Get metadata about the API specification including version, endpoints count, etc.
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: API specification metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                 title:
 *                   type: string
 *                 endpointsCount:
 *                   type: integer
 *                 schemasCount:
 *                   type: integer
 *                 lastUpdated:
 *                   type: string
 *                   format: date-time
 */
router.get('/spec', (req: Request, res: Response) => {
  try {
    const spec = getOpenApiJson();
    const endpointsCount = Object.keys(spec.paths || {}).length;
    const schemasCount = Object.keys(spec.components?.schemas || {}).length;

    res.json({
      success: true,
      data: {
        version: spec.info?.version || '1.0.0',
        title: spec.info?.title || 'Rylie AI API',
        description: spec.info?.description || '',
        endpointsCount,
        schemasCount,
        lastUpdated: new Date().toISOString(),
        servers: spec.servers || [],
        tags: spec.tags || []
      }
    });
  } catch (error) {
    logger.error('Failed to get specification metadata', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get specification metadata'
    });
  }
});

/**
 * @swagger
 * /api/docs/health:
 *   get:
 *     summary: Documentation service health check
 *     description: Check if the API documentation service is running correctly
 *     tags: [Documentation]
 *     responses:
 *       200:
 *         description: Documentation service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'api-documentation',
    timestamp: new Date().toISOString()
  });
});

export default router;