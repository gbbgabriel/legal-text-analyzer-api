import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCode } from '../types';

// Validation schemas
export const schemas = {
  textAnalysis: Joi.object({
    text: Joi.string()
      .required()
      .min(1)
      .max(2000000) // 2MB
      .messages({
        'string.empty': 'Texto não pode estar vazio',
        'string.max': 'Texto não pode exceder 2MB',
        'any.required': 'Campo texto é obrigatório',
      }),
  }),

  searchTerm: Joi.object({
    term: Joi.string()
      .required()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-ZÀ-ÿ0-9\s\-_]+$/)
      .messages({
        'string.pattern.base': 'Termo deve conter apenas letras, números, espaços e hífens',
        'string.min': 'Termo deve ter pelo menos 2 caracteres',
        'string.max': 'Termo não pode exceder 100 caracteres',
        'any.required': 'Parâmetro term é obrigatório',
      }),
  }),

  fileUpload: Joi.object({
    fieldname: Joi.string().valid('file').required(),
    originalname: Joi.string().required(),
    mimetype: Joi.string().valid(
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ).required(),
    size: Joi.number().max(10485760).required(), // 10MB
  }),

  analysisId: Joi.object({
    id: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'ID da análise deve ser um UUID válido',
        'any.required': 'ID da análise é obrigatório',
      }),
  }),
};

/**
 * Generic validation middleware factory
 */
export function validate(
  schema: Joi.ObjectSchema,
  source: 'body' | 'query' | 'params' | 'file' = 'body'
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    let dataToValidate: any;
    
    switch (source) {
      case 'body':
        dataToValidate = req.body;
        break;
      case 'query':
        dataToValidate = req.query;
        break;
      case 'params':
        dataToValidate = req.params;
        break;
      case 'file':
        dataToValidate = req.file;
        break;
    }
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      }));
      
      res.status(400).json({
        success: false,
        error: 'Dados de entrada inválidos',
        code: ErrorCode.INVALID_REQUEST,
        details: {
          validationErrors,
        },
        timestamp: new Date().toISOString(),
        requestId: uuidv4(),
      });
      return;
    }
    
    // Replace original data with validated/cleaned data
    switch (source) {
      case 'body':
        req.body = value;
        break;
      case 'query':
        req.query = value;
        break;
      case 'params':
        req.params = value;
        break;
    }
    
    next();
  };
}

/**
 * Validate text analysis request
 */
export const validateTextAnalysis = validate(schemas.textAnalysis, 'body');

/**
 * Validate search term request
 */
export const validateSearchTerm = validate(schemas.searchTerm, 'query');

/**
 * Validate analysis ID parameter
 */
export const validateAnalysisId = validate(schemas.analysisId, 'params');

/**
 * Validate file upload
 */
export const validateFileUpload = validate(schemas.fileUpload, 'file');