/**
 * Swagger UI Configuration
 *
 * Serves OpenAPI documentation at /api-docs
 */

import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

const router = Router();

// Load OpenAPI spec
const openapiPath = path.join(process.cwd(), 'docs', 'api', 'openapi.yaml');
let swaggerDocument: any;

try {
  const fileContents = fs.readFileSync(openapiPath, 'utf8');
  swaggerDocument = yaml.load(fileContents);
} catch (error) {
  console.error('Failed to load OpenAPI spec:', error);
  swaggerDocument = {
    openapi: '3.0.3',
    info: {
      title: 'Tibetan Translation API',
      version: '2.0.0',
      description: 'OpenAPI specification not found. Please check /docs/api/openapi.yaml'
    },
    paths: {}
  };
}

// Swagger UI options
const options = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Tibetan Translation API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai'
    }
  }
};

// Serve Swagger UI
router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerDocument, options));

export default router;
