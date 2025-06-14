import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { config } from '../config';
import { fileProcessingService } from '../services/FileProcessingService';
import { ApiError } from './ErrorHandlerMiddleware';
import { ErrorCode } from '../types';

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.fileUpload.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = fileProcessingService.generateFilename(file.originalname);
    cb(null, uniqueName);
  },
});

/**
 * File filter to validate file types
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  // Check extension
  const extension = path.extname(file.originalname).toLowerCase().substring(1);
  const allowedExtensions = ['txt', 'pdf', 'docx'];
  
  if (!allowedExtensions.includes(extension)) {
    cb(new ApiError(
      `Tipo de arquivo não suportado: .${extension}`,
      400,
      ErrorCode.INVALID_FILE_TYPE
    ));
    return;
  }
  
  // Check MIME type
  const allowedMimeTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    cb(new ApiError(
      'Tipo MIME não corresponde à extensão do arquivo',
      400,
      ErrorCode.INVALID_MIME_TYPE
    ));
    return;
  }
  
  // Additional validation for specific types
  const validation = fileProcessingService.validateFile(
    file.originalname,
    file.mimetype,
    0 // Size will be checked by multer limits
  );
  
  if (!validation.valid) {
    cb(new ApiError(
      validation.error || 'Arquivo inválido',
      400,
      ErrorCode.INVALID_FILE_TYPE
    ));
    return;
  }
  
  cb(null, true);
};

/**
 * Configure multer upload
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.fileUpload.maxSize, // 10MB
    files: 1, // Only one file at a time
    fields: 10, // Maximum number of non-file fields
    fieldSize: 1024 * 1024, // 1MB max field size
    headerPairs: 2000, // Maximum number of header key-value pairs
  },
  preservePath: false,
});

/**
 * Single file upload middleware
 */
export const uploadSingle = upload.single('file');

/**
 * File upload error handler
 */
export function handleUploadError(
  error: any,
  _req: Request,
  res: any,
  next: any
): void {
  if (error instanceof multer.MulterError) {
    let message: string;
    let code: string = ErrorCode.UPLOAD_FAILED;
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `Arquivo muito grande (máximo ${config.fileUpload.maxSize / 1024 / 1024}MB)`;
        code = ErrorCode.FILE_TOO_LARGE;
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Apenas um arquivo por vez é permitido';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de arquivo inesperado. Use o campo "file"';
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Nome do campo muito longo';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Valor do campo muito longo';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Muitos campos no formulário';
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Muitas partes no formulário';
        break;
      default:
        message = 'Erro durante upload do arquivo';
    }
    
    res.status(400).json({
      success: false,
      error: message,
      code,
      details: {
        maxFileSize: config.fileUpload.maxSize,
        allowedTypes: ['txt', 'pdf', 'docx'],
      },
      suggestions: [
        'Verifique o tamanho do arquivo',
        'Verifique o tipo do arquivo',
        'Use apenas o campo "file" para upload',
      ],
      timestamp: new Date().toISOString(),
      requestId: 'upload-error',
    });
    return;
  }
  
  next(error);
}

/**
 * Validate file after upload
 */
export function validateUploadedFile(
  req: Request,
  res: any,
  next: any
): void {
  if (!req.file) {
    res.status(400).json({
      success: false,
      error: 'Nenhum arquivo enviado',
      code: ErrorCode.INVALID_REQUEST,
      details: {
        expectedField: 'file',
        supportedTypes: ['txt', 'pdf', 'docx'],
        maxSize: config.fileUpload.maxSize,
      },
      suggestions: [
        'Certifique-se de enviar um arquivo no campo "file"',
        'Verifique se o Content-Type é multipart/form-data',
        'Verifique o tamanho e tipo do arquivo',
      ],
      timestamp: new Date().toISOString(),
      requestId: 'no-file',
    });
    return;
  }
  
  // Additional file validation
  const { originalname, mimetype, size } = req.file;
  const validation = fileProcessingService.validateFile(originalname, mimetype, size);
  
  if (!validation.valid) {
    res.status(400).json({
      success: false,
      error: validation.error,
      code: ErrorCode.INVALID_FILE_TYPE,
      details: {
        filename: originalname,
        mimetype,
        size,
      },
      suggestions: [
        'Use apenas arquivos TXT, PDF ou DOCX',
        'Verifique se o arquivo não está corrompido',
        'Reduza o tamanho do arquivo se necessário',
      ],
      timestamp: new Date().toISOString(),
      requestId: 'invalid-file',
    });
    return;
  }
  
  next();
}