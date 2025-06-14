import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Database
  database: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
  
  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4000', 10),
  },
  
  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL || '',
    enabled: !!process.env.REDIS_URL,
  },
  
  // Rate Limiting
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  },
  
  // File Upload
  fileUpload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '1800000', 10), // 30 minutes
    uploadDir: path.join(process.cwd(), 'tmp', 'uploads'),
    extractedDir: path.join(process.cwd(), 'tmp', 'extracted'),
  },
  
  // Metrics
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT || '9090', 10),
  },
  
  // Cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '7200000', 10), // 2 hours
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600000', 10), // 10 minutes
  },
  
  // Queue
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '2', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '3', 10),
  },
  
  // Security
  security: {
    corsOrigin: process.env.CORS_ORIGIN || '*',
    requestSizeLimit: process.env.REQUEST_SIZE_LIMIT || '50mb',
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
  },
  
  // API
  api: {
    version: 'v1',
    basePath: '/api/v1',
  },
  
  // Text Processing
  textProcessing: {
    maxTextSize: 2000000, // 2MB
    chunkSize: 3000, // characters per chunk
    minChunkSize: 500,
    stopwordsJuridicas: [
      'considerando', 'outrossim', 'art', 'artigo', 'parágrafo',
      'inciso', 'alínea', 'caput', 'dispositivo', 'normativo',
      'legal', 'lei', 'decreto', 'portaria', 'resolução',
      'instrução', 'normativa', 'regulamento', 'código',
    ],
    legalTerms: [
      'contrato', 'cláusula', 'rescisão', 'indenização', 'multa',
      'fiador', 'locatário', 'locador', 'devedor', 'credor',
      'obrigação', 'direito', 'dever', 'responsabilidade', 'prazo',
      'notificação', 'intimação', 'citação', 'sentença', 'acórdão',
      'recurso', 'apelação', 'agravo', 'embargo', 'mandado',
      'petição', 'contestação', 'réplica', 'tréplica', 'parecer',
      'laudo', 'perícia', 'prova', 'testemunha', 'depoimento',
      'jurisprudência', 'súmula', 'precedente', 'coisa julgada',
      'trânsito em julgado', 'prescrição', 'decadência', 'nulidade',
      'anulabilidade', 'vício', 'defeito', 'dano', 'prejuízo',
      'lucro cessante', 'dano emergente', 'mora', 'inadimplemento',
      'cumprimento', 'execução', 'penhora', 'arresto', 'sequestro',
      'hipoteca', 'penhor', 'fiança', 'caução', 'garantia',
    ],
  },
  
  // Supported file formats
  fileFormats: {
    txt: {
      mimeTypes: ['text/plain'],
      maxSize: 10485760, // 10MB
    },
    pdf: {
      mimeTypes: ['application/pdf'],
      maxSize: 10485760, // 10MB
    },
    docx: {
      mimeTypes: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      maxSize: 10485760, // 10MB
    },
  },
};

// Validate required environment variables
export function validateConfig(): void {
  const requiredEnvVars = [
    'DATABASE_URL',
  ];
  
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}`
    );
  }
  
  // Warn about optional but recommended variables
  if (!process.env.OPENAI_API_KEY) {
    console.warn(
      'Warning: OPENAI_API_KEY not set. OpenAI integration will be disabled.'
    );
  }
}