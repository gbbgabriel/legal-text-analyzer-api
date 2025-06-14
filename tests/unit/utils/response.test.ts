import { Response } from 'express';
import {
  createSuccessResponse,
  createErrorResponse,
  sendSuccessResponse,
  sendErrorResponse,
  sendValidationError,
  sendNotFoundError,
  sendInternalServerError,
  sendRateLimitError,
  sendUnauthorizedError,
  sendServiceUnavailableError,
} from '../../../src/utils/response';
import { ErrorCode } from '../../../src/types';

describe('Response Utils', () => {
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();
    mockRes = {
      json: jsonMock,
      status: statusMock,
    };
  });

  describe('createSuccessResponse', () => {
    it('should create success response with data', () => {
      const data = { test: 'value' };
      const response = createSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.timestamp).toBeDefined();
      expect(response.requestId).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should use provided requestId', () => {
      const data = { test: 'value' };
      const requestId = 'custom-id';
      const response = createSuccessResponse(data, requestId);

      expect(response.requestId).toBe(requestId);
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response', () => {
      const response = createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Validation failed',
        { field: 'email' },
        ['Check email format']
      );

      expect(response.success).toBe(false);
      expect(response.data).toBeNull();
      expect(response.error).toEqual({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: { field: 'email' },
        suggestions: ['Check email format'],
      });
    });

    it('should handle missing optional parameters', () => {
      const response = createErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Server error'
      );

      expect(response.error?.details).toBeUndefined();
      expect(response.error?.suggestions).toBeUndefined();
    });
  });

  describe('sendSuccessResponse', () => {
    it('should send success response with default status 200', () => {
      const data = { result: 'success' };
      sendSuccessResponse(mockRes as Response, data);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
        })
      );
    });

    it('should send success response with custom status', () => {
      const data = { created: true };
      sendSuccessResponse(mockRes as Response, data, 201);

      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('sendErrorResponse', () => {
    it('should send error response and log warning', () => {
      const loggerWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      sendErrorResponse(
        mockRes as Response,
        ErrorCode.NOT_FOUND,
        'Resource not found',
        404,
        { id: '123' },
        ['Check the ID']
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
            message: 'Resource not found',
            details: { id: '123' },
            suggestions: ['Check the ID'],
          }),
        })
      );

      loggerWarnSpy.mockRestore();
    });
  });

  describe('sendValidationError', () => {
    it('should send validation error with 400 status', () => {
      sendValidationError(
        mockRes as Response,
        'Invalid email format',
        { field: 'email', value: 'invalid' }
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid email format',
            details: { field: 'email', value: 'invalid' },
            suggestions: ['Verifique os dados enviados e tente novamente'],
          }),
        })
      );
    });
  });

  describe('sendNotFoundError', () => {
    it('should send not found error with resource name', () => {
      sendNotFoundError(mockRes as Response, 'Análise');

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.NOT_FOUND,
            message: 'Análise não encontrado',
            suggestions: ['Verifique se o recurso existe e tente novamente'],
          }),
        })
      );
    });
  });

  describe('sendInternalServerError', () => {
    it('should send internal server error with default message', () => {
      sendInternalServerError(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Erro interno do servidor',
            suggestions: ['Tente novamente mais tarde ou entre em contato com o suporte'],
          }),
        })
      );
    });

    it('should send internal server error with custom message', () => {
      sendInternalServerError(mockRes as Response, 'Database connection failed');

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Database connection failed',
          }),
        })
      );
    });
  });

  describe('sendRateLimitError', () => {
    it('should send rate limit error', () => {
      sendRateLimitError(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: 'Muitas requisições. Tente novamente mais tarde.',
            suggestions: ['Aguarde um momento antes de fazer nova requisição'],
          }),
        })
      );
    });
  });

  describe('sendUnauthorizedError', () => {
    it('should send unauthorized error with default message', () => {
      sendUnauthorizedError(mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.UNAUTHORIZED,
            message: 'Acesso não autorizado',
            suggestions: ['Verifique suas credenciais e tente novamente'],
          }),
        })
      );
    });
  });

  describe('sendServiceUnavailableError', () => {
    it('should send service unavailable error', () => {
      sendServiceUnavailableError(mockRes as Response, 'OpenAI');

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.SERVICE_UNAVAILABLE,
            message: 'Serviço OpenAI temporariamente indisponível',
            suggestions: ['Tente novamente em alguns minutos'],
          }),
        })
      );
    });
  });
});