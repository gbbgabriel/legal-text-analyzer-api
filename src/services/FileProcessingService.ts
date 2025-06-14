import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import chardet from 'chardet';
import iconv from 'iconv-lite';
import { config } from '../config';
import { logger } from '../utils/logger';
import { FileProcessingResult, ErrorCode } from '../types';

export class FileProcessingService {
  private uploadDir: string;
  private extractedDir: string;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.uploadDir = config.fileUpload.uploadDir;
    this.extractedDir = config.fileUpload.extractedDir;
    
    // Ensure directories exist
    void this.ensureDirectories();
    
    // Setup cleanup interval
    this.cleanupInterval = setInterval(
      () => void this.cleanupOldFiles(),
      config.fileUpload.cleanupInterval
    );
    
    logger.info('File processing service initialized');
  }

  /**
   * Process uploaded file and extract text
   */
  async processFile(
    filePath: string,
    originalName: string,
    mimeType: string
  ): Promise<FileProcessingResult> {
    const startTime = Date.now();
    const fileSize = await this.getFileSize(filePath);
    const extension = path.extname(originalName).toLowerCase().substring(1);
    
    logger.info(`Processing file: ${originalName} (${mimeType}, ${fileSize} bytes)`);
    
    try {
      let result: FileProcessingResult;
      
      switch (extension) {
        case 'txt':
          result = await this.processTxtFile(filePath, originalName, fileSize);
          break;
        case 'pdf':
          result = await this.processPdfFile(filePath, originalName, fileSize);
          break;
        case 'docx':
          result = await this.processDocxFile(filePath, originalName, fileSize);
          break;
        default:
          throw new Error(`Unsupported file type: ${extension}`);
      }
      
      result.processingTime = Date.now() - startTime;
      
      // Clean up uploaded file
      await this.deleteFile(filePath);
      
      return result;
    } catch (error) {
      // Clean up on error
      await this.deleteFile(filePath);
      throw error;
    }
  }

  /**
   * Process TXT file
   */
  private async processTxtFile(
    filePath: string,
    originalName: string,
    fileSize: number
  ): Promise<FileProcessingResult> {
    try {
      // Detect encoding
      const detectedEncoding = await chardet.detectFile(filePath);
      const encoding = detectedEncoding || 'utf-8';
      
      logger.info(`Detected encoding for ${originalName}: ${encoding}`);
      
      // Read file with detected encoding
      const buffer = await fs.readFile(filePath);
      let text: string;
      
      if (encoding.toLowerCase() === 'utf-8') {
        text = buffer.toString('utf-8');
      } else {
        text = iconv.decode(buffer, encoding);
      }
      
      if (!text || text.trim().length === 0) {
        throw new Error(ErrorCode.EMPTY_FILE);
      }
      
      return {
        extractedText: text,
        sourceType: 'txt',
        originalFilename: originalName,
        fileSize,
        processingTime: 0,
        encoding,
        extractionMethod: 'direct-read',
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      };
    } catch (error: any) {
      logger.error(`Error processing TXT file: ${originalName}`, error);
      if (error.message === ErrorCode.EMPTY_FILE) {
        throw error;
      }
      throw new Error(ErrorCode.ENCODING_ERROR);
    }
  }

  /**
   * Process PDF file
   */
  private async processPdfFile(
    filePath: string,
    originalName: string,
    fileSize: number
  ): Promise<FileProcessingResult> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      
      if (!data.text || data.text.trim().length === 0) {
        throw new Error(ErrorCode.EMPTY_FILE);
      }
      
      const warnings: string[] = [];
      
      // Check for potential issues
      if (data.numpages === 0) {
        warnings.push('PDF appears to have no pages');
      }
      
      if (data.info && data.info.IsAcroFormPresent) {
        warnings.push('PDF contains forms which may not be fully extracted');
      }
      
      return {
        extractedText: data.text,
        sourceType: 'pdf',
        originalFilename: originalName,
        fileSize,
        processingTime: 0,
        pageCount: data.numpages,
        extractionMethod: 'pdf-parse',
        wordCount: data.text.split(/\s+/).filter(w => w.length > 0).length,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error: any) {
      logger.error(`Error processing PDF file: ${originalName}`, error);
      
      if (error.message === ErrorCode.EMPTY_FILE) {
        throw error;
      }
      
      if (error.message && error.message.includes('password')) {
        throw new Error(ErrorCode.PASSWORD_PROTECTED_PDF);
      }
      
      if (error.message && error.message.includes('Invalid')) {
        throw new Error(ErrorCode.CORRUPTED_FILE);
      }
      
      throw new Error(ErrorCode.TEXT_EXTRACTION_FAILED);
    }
  }

  /**
   * Process DOCX file
   */
  private async processDocxFile(
    filePath: string,
    originalName: string,
    fileSize: number
  ): Promise<FileProcessingResult> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      
      if (!result.value || result.value.trim().length === 0) {
        throw new Error(ErrorCode.EMPTY_FILE);
      }
      
      const warnings: string[] = [];
      
      if (result.messages && result.messages.length > 0) {
        result.messages.forEach((msg: any) => {
          if (msg.type === 'warning') {
            warnings.push(msg.message);
          }
        });
      }
      
      return {
        extractedText: result.value,
        sourceType: 'docx',
        originalFilename: originalName,
        fileSize,
        processingTime: 0,
        extractionMethod: 'mammoth',
        wordCount: result.value.split(/\s+/).filter((w: string) => w.length > 0).length,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error: any) {
      logger.error(`Error processing DOCX file: ${originalName}`, error);
      
      if (error.message === ErrorCode.EMPTY_FILE) {
        throw error;
      }
      
      if (error.message && error.message.includes('corrupt')) {
        throw new Error(ErrorCode.CORRUPTED_FILE);
      }
      
      throw new Error(ErrorCode.DOCX_STRUCTURE_ERROR);
    }
  }

  /**
   * Validate file type and size
   */
  validateFile(
    filename: string,
    mimeType: string,
    size: number
  ): { valid: boolean; error?: string } {
    const extension = path.extname(filename).toLowerCase().substring(1);
    
    // Check if extension is supported
    const supportedExtensions = ['txt', 'pdf', 'docx'];
    if (!supportedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Tipo de arquivo não suportado: .${extension}`,
      };
    }
    
    // Check MIME type
    const expectedMimeTypes = config.fileFormats[extension as keyof typeof config.fileFormats]?.mimeTypes;
    if (expectedMimeTypes && !expectedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: 'Tipo MIME não corresponde à extensão do arquivo',
      };
    }
    
    // Check file size
    if (size > config.fileUpload.maxSize) {
      return {
        valid: false,
        error: `Arquivo muito grande (máximo ${config.fileUpload.maxSize / 1024 / 1024}MB)`,
      };
    }
    
    return { valid: true };
  }

  /**
   * Generate unique filename for uploaded file
   */
  generateFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const sanitized = path.basename(originalName, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    return `${timestamp}_${random}_${sanitized}${extension}`;
  }

  /**
   * Get file size
   */
  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  /**
   * Delete file
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug(`Deleted file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to delete file: ${filePath}`, error);
    }
  }

  /**
   * Ensure upload directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.extractedDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create directories', error);
    }
  }

  /**
   * Clean up old files
   */
  private async cleanupOldFiles(): Promise<void> {
    try {
      const maxAge = 3600000; // 1 hour
      const now = Date.now();
      
      // Clean uploads directory
      const uploadFiles = await fs.readdir(this.uploadDir);
      for (const file of uploadFiles) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await this.deleteFile(filePath);
        }
      }
      
      // Clean extracted directory
      const extractedFiles = await fs.readdir(this.extractedDir);
      for (const file of extractedFiles) {
        const filePath = path.join(this.extractedDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await this.deleteFile(filePath);
        }
      }
      
      logger.debug('Cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed', error);
    }
  }

  /**
   * Get temporary files count
   */
  async getTempFilesCount(): Promise<number> {
    try {
      const uploadFiles = await fs.readdir(this.uploadDir);
      const extractedFiles = await fs.readdir(this.extractedDir);
      return uploadFiles.length + extractedFiles.length;
    } catch {
      return 0;
    }
  }

  /**
   * Destroy service
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Export singleton instance
export const fileProcessingService = new FileProcessingService();