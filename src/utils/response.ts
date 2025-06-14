import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse, ErrorCode } from '../types';
import { logger } from './logger';

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  requestId?: string
): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: requestId || uuidv4(),
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: any,
  suggestions?: string[],
  requestId?: string
): ApiResponse<null> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
      suggestions,
    },
    data: null,
    timestamp: new Date().toISOString(),
    requestId: requestId || uuidv4(),
  };
}

/**
 * Send a successful response
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  requestId?: string
): void {
  const response = createSuccessResponse(data, requestId);
  res.status(statusCode).json(response);
}

/**
 * Send an error response
 */
export function sendErrorResponse(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number,
  details?: any,
  suggestions?: string[],
  requestId?: string
): void {
  const response = createErrorResponse(code, message, details, suggestions, requestId);
  logger.warn(`Error response sent: ${code} - ${message}`, { 
    statusCode, 
    requestId: response.requestId,
    details 
  });
  res.status(statusCode).json(response);
}

/**
 * Send a validation error response
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: any,
  requestId?: string
): void {
  sendErrorResponse(
    res,
    ErrorCode.VALIDATION_ERROR,
    message,
    400,
    details,
    ['Verifique os dados enviados e tente novamente'],
    requestId
  );
}

/**
 * Send a not found error response
 */
export function sendNotFoundError(
  res: Response,
  resource: string,
  requestId?: string
): void {
  sendErrorResponse(
    res,
    ErrorCode.NOT_FOUND,
    `${resource} não encontrado`,
    404,
    undefined,
    ['Verifique se o recurso existe e tente novamente'],
    requestId
  );
}

/**
 * Send an internal server error response
 */
export function sendInternalServerError(
  res: Response,
  message: string = 'Erro interno do servidor',
  requestId?: string
): void {
  sendErrorResponse(
    res,
    ErrorCode.INTERNAL_ERROR,
    message,
    500,
    undefined,
    ['Tente novamente mais tarde ou entre em contato com o suporte'],
    requestId
  );
}

/**
 * Send a rate limit error response
 */
export function sendRateLimitError(
  res: Response,
  requestId?: string
): void {
  sendErrorResponse(
    res,
    ErrorCode.RATE_LIMIT_EXCEEDED,
    'Muitas requisições. Tente novamente mais tarde.',
    429,
    undefined,
    ['Aguarde um momento antes de fazer nova requisição'],
    requestId
  );
}

/**
 * Send an unauthorized error response
 */
export function sendUnauthorizedError(
  res: Response,
  message: string = 'Acesso não autorizado',
  requestId?: string
): void {
  sendErrorResponse(
    res,
    ErrorCode.UNAUTHORIZED,
    message,
    401,
    undefined,
    ['Verifique suas credenciais e tente novamente'],
    requestId
  );
}

/**
 * Send a service unavailable error response
 */
export function sendServiceUnavailableError(
  res: Response,
  service: string,
  requestId?: string
): void {
  sendErrorResponse(
    res,
    ErrorCode.SERVICE_UNAVAILABLE,
    `Serviço ${service} temporariamente indisponível`,
    503,
    undefined,
    ['Tente novamente em alguns minutos'],
    requestId
  );
}