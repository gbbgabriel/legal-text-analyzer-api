// Core Types for Legal Text Analyzer API

export interface LegalAnalysisResult {
  wordCount: number;
  characterCount: number;
  topWords: Array<{ word: string; count: number }>;
  legalTerms: Array<{ term: string; count: number }>;
  sentiment?: {
    overall: string;
    score: number;
    sections?: Array<{
      text: string;
      sentiment: string;
      score: number;
    }>;
  };
  structure: {
    paragraphs: number;
    articles: number;
    sections: number;
  };
  processingTime: number;
  chunksProcessed?: number;
}

export interface AnalysisJob {
  analysisId: string;
  text: string;
  priority: number;
  attempts: number;
  sourceType?: string;
  originalFilename?: string;
  fileSize?: number;
}

export interface FileProcessingResult {
  extractedText: string;
  sourceType: string;
  originalFilename: string;
  fileSize: number;
  processingTime: number;
  encoding?: string; // para TXT
  pageCount?: number; // para PDF
  wordCount?: number; // para DOCX
  extractionMethod?: string;
  warnings?: string[];
}

export interface ChunkResult {
  chunkIndex: number;
  sentiment?: string;
  topWords: Array<{ word: string; count: number }>;
  legalTerms: Array<{ term: string; count: number }>;
  wordCount: number;
  error?: string;
}

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: any;
  suggestions?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: ApiError;
  timestamp: string;
  requestId: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
  suggestions?: string[];
  supportUrl?: string;
  timestamp: string;
  requestId: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface AnalysisStatus {
  analysisId: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  sourceType?: string;
  originalFilename?: string;
  result?: LegalAnalysisResult;
  error?: string;
  processingTime?: number;
  completedAt?: Date;
  estimatedTime?: number;
}

export interface SearchResult {
  term: string;
  found: boolean;
  analyses: Array<{
    id: string;
    text: string;
    createdAt: Date;
  }>;
  totalOccurrences: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  components: {
    database: ComponentHealth;
    openai?: ComponentHealth;
    redis?: ComponentHealth;
    queue?: QueueHealth;
    fileSystem?: FileSystemHealth;
  };
  metrics?: {
    totalAnalyses: number;
    analysesToday: number;
    averageResponseTime: string;
    cacheHitRate: string;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy';
  responseTime: string;
  lastChecked: string;
  error?: string;
}

export interface QueueHealth extends ComponentHealth {
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export interface FileSystemHealth extends ComponentHealth {
  tempFiles: number;
  diskUsage: string;
}

export interface SupportedFormat {
  extension: string;
  mimeTypes: string[];
  maxSize: number;
  description: string;
  limitations?: string[];
}

// Error Codes
export enum ErrorCode {
  // File Upload Errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  INVALID_MIME_TYPE = 'INVALID_MIME_TYPE',
  
  // Processing Errors
  TEXT_EXTRACTION_FAILED = 'TEXT_EXTRACTION_FAILED',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  PASSWORD_PROTECTED_PDF = 'PASSWORD_PROTECTED_PDF',
  EMPTY_FILE = 'EMPTY_FILE',
  ENCODING_ERROR = 'ENCODING_ERROR',
  UNSUPPORTED_PDF_VERSION = 'UNSUPPORTED_PDF_VERSION',
  DOCX_STRUCTURE_ERROR = 'DOCX_STRUCTURE_ERROR',
  
  // System Errors
  DISK_FULL = 'DISK_FULL',
  TEMP_FILE_ERROR = 'TEMP_FILE_ERROR',
  CLEANUP_FAILED = 'CLEANUP_FAILED',
  
  // API Errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  ANALYSIS_NOT_FOUND = 'ANALYSIS_NOT_FOUND',
  OPENAI_API_ERROR = 'OPENAI_API_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

// Metric Types for Prometheus
export interface MetricLabels {
  [key: string]: string | number;
}

export interface TimerFunction {
  end: (labels?: MetricLabels) => void;
}

// Statistics Types
export interface SystemStats {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: number;
}

export interface CacheStatsResponse {
  size: number;
  hitRate: string;
}

export interface ApiStatsResponse {
  database: any; // Will be properly typed later
  queue: {
    pendingJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeJobs: number;
  };
  cache: CacheStatsResponse;
  openai: any; // Will be properly typed later
  system: SystemStats;
}

export interface SupportedFormatsResponse {
  formats: SupportedFormat[];
  globalMaxSize: number;
  notes: string[];
}

// Health Check Result Types
export interface ComponentHealthCheck {
  status: 'healthy' | 'unhealthy';
  responseTime: string;
  lastChecked: string;
  error?: string;
}

export interface DatabaseHealthCheck extends ComponentHealthCheck {
  // database specific fields can be added here
}

export interface QueueHealthCheck extends ComponentHealthCheck {
  pendingJobs: number;
  completedJobs: number;
  failedJobs: number;
}

export interface FileSystemHealthCheck extends ComponentHealthCheck {
  tempFiles: number;
  diskUsage: string;
}

export interface RedisHealthCheck extends ComponentHealthCheck {
  // redis specific fields can be added here
}