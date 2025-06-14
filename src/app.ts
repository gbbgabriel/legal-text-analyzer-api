import express from 'express';
import morgan from 'morgan';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { config } from './config';
import { stream } from './utils/logger';
import routes from './routes';
import {
  securityHeaders,
  corsOptions,
  compressionMiddleware,
  requestSizeLimit,
  sanitizeInput,
  addSecurityContext,
} from './middleware/SecurityMiddleware';
import { errorHandler, notFoundHandler } from './middleware/ErrorHandlerMiddleware';
import cors from 'cors';

const app = express();

// Trust proxy (for accurate IP addresses behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(compressionMiddleware);
app.use(requestSizeLimit);

// Body parsing middleware
app.use(express.json({ limit: config.security.requestSizeLimit }));
app.use(express.urlencoded({ extended: true, limit: config.security.requestSizeLimit }));

// Logging middleware (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream }));
}

// Security context
app.use(addSecurityContext);
app.use(sanitizeInput);

// Swagger documentation setup

// Swagger documentation
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Legal Text Analyzer API',
    version: '1.0.0',
    description: 'API robusta para análise de textos jurídicos com integração de IA',
    contact: {
      name: 'API Support',
      email: 'vagas+dev@arbitralis.com.br',
    },
  },
  servers: [
    {
      url: `http://75.119.134.70:${config.port}`,
      description: 'Production server',
    },
    {
      url: `http://localhost:${config.port}`,
      description: 'Local development server',
    },
  ],
  tags: [
    {
      name: 'Analysis',
      description: 'Análise de textos e arquivos jurídicos',
    },
    {
      name: 'Search',
      description: 'Busca de termos em análises',
    },
    {
      name: 'Health',
      description: 'Status e informações do sistema',
    },
  ],
};

// Determine the correct path for API files based on environment
const getApiFiles = () => {
  const isCompiled = __filename.endsWith('.js');
  if (isCompiled) {
    // Running compiled JavaScript - look for source files
    return [
      path.join(__dirname, '../src/routes/*.ts'),
      path.join(__dirname, '../src/routes/**/*.ts'),
      path.join(__dirname, './routes/*.js'),
      path.join(__dirname, './routes/**/*.js'),
    ];
  } else {
    // Running TypeScript
    return [path.join(__dirname, './routes/*.ts'), path.join(__dirname, './routes/**/*.ts')];
  }
};

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: getApiFiles(),
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// API routes
app.use(config.api.basePath, routes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Legal Text Analyzer API',
    version: '1.0.0',
    description: 'API robusta para análise de textos jurídicos',
    endpoints: {
      docs: '/api-docs',
      health: `${config.api.basePath}/health`,
      stats: `${config.api.basePath}/stats`,
      debug: `${config.api.basePath}/debug`,
      analyzeText: `${config.api.basePath}/analyze-text`,
      analyzeFile: `${config.api.basePath}/analyze-file`,
      searchTerm: `${config.api.basePath}/search-term`,
      supportedFormats: `${config.api.basePath}/supported-formats`,
    },
    features: [
      'Análise de texto direto e upload de arquivos (TXT, PDF, DOCX)',
      'Processamento assíncrono para textos grandes',
      'Análise de sentimento com OpenAI',
      'Extração de termos jurídicos',
      'Cache otimizado para performance',
      'Busca em análises históricas',
      'Monitoramento e métricas',
    ],
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
