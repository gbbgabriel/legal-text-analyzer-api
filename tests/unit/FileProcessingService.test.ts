import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileProcessingService } from '../../src/services/FileProcessingService';

describe('FileProcessingService', () => {
  const testFilesDir = path.join(__dirname, '../fixtures');
  
  beforeEach(async () => {
    // Create test files directory
    try {
      await fs.mkdir(testFilesDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(testFilesDir);
      for (const file of files) {
        await fs.unlink(path.join(testFilesDir, file));
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('validateFile', () => {
    it('should validate supported file types', () => {
      const validations = [
        fileProcessingService.validateFile('test.txt', 'text/plain', 1000),
        fileProcessingService.validateFile('test.pdf', 'application/pdf', 1000),
        fileProcessingService.validateFile('test.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1000),
      ];
      
      validations.forEach(validation => {
        expect(validation.valid).toBe(true);
      });
    });

    it('should reject unsupported file types', () => {
      const validation = fileProcessingService.validateFile('test.exe', 'application/octet-stream', 1000);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('não suportado');
    });

    it('should reject files that are too large', () => {
      const largeSize = 20 * 1024 * 1024; // 20MB
      const validation = fileProcessingService.validateFile('test.txt', 'text/plain', largeSize);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('muito grande');
    });

    it('should validate MIME type matches extension', () => {
      const validation = fileProcessingService.validateFile('test.txt', 'application/pdf', 1000);
      
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('MIME');
    });
  });

  describe('generateFilename', () => {
    it('should generate unique filenames', () => {
      const filename1 = fileProcessingService.generateFilename('test.txt');
      const filename2 = fileProcessingService.generateFilename('test.txt');
      
      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^\d+_[a-f0-9]+_test\.txt$/);
      expect(filename2).toMatch(/^\d+_[a-f0-9]+_test\.txt$/);
    });

    it('should sanitize dangerous characters in filenames', () => {
      const filename = fileProcessingService.generateFilename('../../../dangerous.txt');
      
      expect(filename).not.toContain('../');
      expect(filename).toMatch(/^\d+_[a-f0-9]+_dangerous\.txt$/);
    });

    it('should handle long filenames', () => {
      const longName = 'a'.repeat(100) + '.txt';
      const filename = fileProcessingService.generateFilename(longName);
      
      expect(filename.length).toBeLessThan(100);
      expect(filename.endsWith('.txt')).toBe(true);
    });
  });

  describe('processFile - TXT', () => {
    it('should process a simple TXT file', async () => {
      const testContent = 'Este é um texto de teste em português.';
      const testFile = path.join(testFilesDir, 'test.txt');
      
      await fs.writeFile(testFile, testContent, 'utf-8');
      
      const result = await fileProcessingService.processFile(
        testFile,
        'test.txt',
        'text/plain'
      );
      
      expect(result.extractedText).toContain('texto de teste');
      expect(result.sourceType).toBe('txt');
      expect(result.originalFilename).toBe('test.txt');
      expect(result.encoding).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle different encodings', async () => {
      const testContent = 'Texto com acentuação: ção, ão, ê';
      const testFile = path.join(testFilesDir, 'test-encoding.txt');
      
      await fs.writeFile(testFile, testContent, 'utf-8');
      
      const result = await fileProcessingService.processFile(
        testFile,
        'test-encoding.txt',
        'text/plain'
      );
      
      expect(result.extractedText).toContain('acentuação');
      expect(result.extractedText).toContain('ção');
    });

    it('should reject empty TXT files', async () => {
      const testFile = path.join(testFilesDir, 'empty.txt');
      
      await fs.writeFile(testFile, '', 'utf-8');
      
      await expect(
        fileProcessingService.processFile(testFile, 'empty.txt', 'text/plain')
      ).rejects.toThrow();
    });
  });

  describe('getTempFilesCount', () => {
    it('should return current temp files count', async () => {
      const count = await fileProcessingService.getTempFilesCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});