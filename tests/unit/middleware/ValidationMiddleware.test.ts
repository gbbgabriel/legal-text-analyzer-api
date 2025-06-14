import { Request, Response, NextFunction } from 'express';
import {
  validateTextAnalysis,
  validateFileUpload,
  validateSearchTerm,
  validateAnalysisId,
} from '../../../src/middleware/ValidationMiddleware';
// import { ErrorCode } from '../../../src/types';

describe('ValidationMiddleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn();
    
    mockReq = {
      body: {},
      params: {},
      query: {},
    };
    
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    
    mockNext = jest.fn();
  });

  describe('validateTextAnalysis', () => {
    it('should pass validation with valid text', () => {
      mockReq.body = { text: 'This is a valid legal text for analysis.' };

      validateTextAnalysis(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should fail validation when text is missing', () => {
      mockReq.query = {};

      validateTextAnalysis(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should fail validation when text is empty', () => {
      mockReq.body = { text: '' };

      validateTextAnalysis(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation when text is too short', () => {
      mockReq.body = { text: 'Hi' };

      validateTextAnalysis(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should fail validation when text is too long', () => {
      mockReq.body = { text: 'a'.repeat(2000001) }; // Over 2MB

      validateTextAnalysis(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation when text is not a string', () => {
      mockReq.body = { text: 123 };

      validateTextAnalysis(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });
  });

  describe('validateFileUpload', () => {
    it('should pass validation with valid file', () => {
      mockReq.file = {
        fieldname: 'file',
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
        path: '/tmp/upload.pdf',
        filename: 'upload.pdf',
        destination: '/tmp',
        encoding: '7bit',
        buffer: Buffer.from(''),
        stream: {} as any,
      } as Express.Multer.File;

      validateFileUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should fail validation when no file is uploaded', () => {
      mockReq.file = undefined;

      validateFileUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid file type', () => {
      mockReq.file = {
        fieldname: 'file',
        originalname: 'image.jpg',
        mimetype: 'image/jpeg',
        size: 1024,
        path: '/tmp/upload.jpg',
        filename: 'upload.jpg',
        destination: '/tmp',
        encoding: '7bit',
        buffer: Buffer.from(''),
        stream: {} as any,
      } as Express.Multer.File;

      validateFileUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation with file too large', () => {
      mockReq.file = {
        fieldname: 'file',
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 11 * 1024 * 1024, // 11MB (over 10MB limit)
        path: '/tmp/upload.pdf',
        filename: 'upload.pdf',
        destination: '/tmp',
        encoding: '7bit',
        buffer: Buffer.from(''),
        stream: {} as any,
      } as Express.Multer.File;

      validateFileUpload(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });
  });

  describe('validateSearchTerm', () => {
    it('should pass validation with valid search term', () => {
      mockReq.query = { term: 'contrato' };

      validateSearchTerm(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should pass validation with valid limit', () => {
      mockReq.query = { term: 'contrato', limit: '10' };

      validateSearchTerm(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation when term is missing', () => {
      mockReq.query = {};

      validateSearchTerm(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation when term is too short', () => {
      mockReq.query = { term: 'a' };

      validateSearchTerm(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation when term is too long', () => {
      mockReq.query = { term: 'a'.repeat(101) };

      validateSearchTerm(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation with invalid limit', () => {
      mockReq.query = { term: 'contrato', limit: '101' };

      validateSearchTerm(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('validateAnalysisId', () => {
    it('should pass validation with valid UUID', () => {
      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      validateAnalysisId(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should fail validation with invalid UUID format', () => {
      mockReq.params = { id: 'invalid-uuid' };

      validateAnalysisId(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });

    it('should fail validation when ID is missing', () => {
      mockReq.params = {};

      validateAnalysisId(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'INVALID_REQUEST',
          error: expect.stringContaining('Dados de entrada inválidos'),
        })
      );
    });
  });
});