import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { ErrorCode, ErrorResponse } from '../types';
import { config } from '../config';

/**
 * Error interface for structured error handling
 */
interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Custom error class
 */
export class ApiError extends Error implements AppError {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = ErrorCode.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = uuidv4();
  
  // Log error with context
  logger.error('Request error', {
    requestId,
    error: {
      message: error.message,
      stack: config.isDevelopment ? error.stack : undefined,
      code: error.code,
      statusCode: error.statusCode,
    },
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  // Don't leak error details in production
  let message = error.message;
  let statusCode = error.statusCode || 500;
  let code = error.code || ErrorCode.INTERNAL_SERVER_ERROR;

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    code = ErrorCode.INVALID_REQUEST;
    message = 'Dados de entrada inválidos';
  } else if (error.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    code = ErrorCode.INVALID_REQUEST;
    message = 'Erro de banco de dados';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    code = ErrorCode.UPLOAD_FAILED;
    message = getMulterErrorMessage(error);
  } else if (config.isProduction && !error.isOperational) {
    // Don't leak internal errors in production
    message = 'Erro interno do servidor';
    statusCode = 500;
    code = ErrorCode.INTERNAL_SERVER_ERROR;
  }

  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
    requestId,
  };

  // Add stack trace in development
  if (config.isDevelopment) {
    (errorResponse as any).stack = error.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Handle Multer-specific errors
 */
function getMulterErrorMessage(error: any): string {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return 'Arquivo muito grande (máximo 10MB)';
    case 'LIMIT_FILE_COUNT':
      return 'Muitos arquivos enviados';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Campo de arquivo inesperado';
    case 'MISSING_FIELD_NAME':
      return 'Nome do campo obrigatório';
    default:
      return 'Erro durante upload do arquivo';
  }
}

/**
 * Handle 404 - Not Found
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error = new ApiError(
    `Rota não encontrada: ${req.method} ${req.path}`,
    404,
    'ROUTE_NOT_FOUND'
  );
  
  next(error);
}

/**
 * Handle async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Graceful shutdown handler
 */
export function gracefulShutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  // Close server connections
  process.exit(0);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', reason);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));