import {
  sanitizeFilePath,
  isPathSafe,
  generateSecureHash,
  sanitizeInput,
  isValidApiKeyFormat,
  maskSensitiveData,
} from '../../../src/utils/security';
// import path from 'path'; // Not needed in this test file

describe('Security Utils', () => {
  describe('sanitizeFilePath', () => {
    it('should remove directory traversal attempts', () => {
      expect(sanitizeFilePath('../../../etc/passwd')).toBe('passwd');
      expect(sanitizeFilePath('../../file.txt')).toBe('file.txt');
      expect(sanitizeFilePath('/etc/passwd')).toBe('passwd');
    });

    it('should replace special characters with underscores', () => {
      expect(sanitizeFilePath('file name with spaces.txt')).toBe('file_name_with_spaces.txt');
      expect(sanitizeFilePath('file@#$%^&*().txt')).toBe('file_________.txt');
      expect(sanitizeFilePath('file<script>alert()</script>.txt')).toBe('script_.txt');
    });

    it('should preserve valid characters', () => {
      expect(sanitizeFilePath('valid-file_name.txt')).toBe('valid-file_name.txt');
      expect(sanitizeFilePath('123.txt')).toBe('123.txt');
      expect(sanitizeFilePath('file-2023.backup')).toBe('file-2023.backup');
    });

    it('should handle empty and edge cases', () => {
      expect(sanitizeFilePath('')).toBe('');
      expect(sanitizeFilePath('.')).toBe('.');
      expect(sanitizeFilePath('..')).toBe('..');
    });
  });

  describe('isPathSafe', () => {
    const allowedDir = '/tmp/uploads';

    it('should allow paths within allowed directory', () => {
      expect(isPathSafe('/tmp/uploads/file.txt', allowedDir)).toBe(true);
      expect(isPathSafe('/tmp/uploads/subfolder/file.txt', allowedDir)).toBe(true);
    });

    it('should reject paths outside allowed directory', () => {
      expect(isPathSafe('/etc/passwd', allowedDir)).toBe(false);
      expect(isPathSafe('/tmp/other/file.txt', allowedDir)).toBe(false);
      expect(isPathSafe('/tmp/uploads/../../../etc/passwd', allowedDir)).toBe(false);
    });

    it('should handle relative paths correctly', () => {
      process.cwd();
      const allowedRelativeDir = 'uploads';
      
      expect(isPathSafe('uploads/file.txt', allowedRelativeDir)).toBe(true);
      expect(isPathSafe('../../../etc/passwd', allowedRelativeDir)).toBe(false);
    });
  });

  describe('generateSecureHash', () => {
    it('should generate consistent SHA256 hashes', () => {
      const input = 'test data';
      const hash1 = generateSecureHash(input);
      const hash2 = generateSecureHash(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // 64-char hex string
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = generateSecureHash('input1');
      const hash2 = generateSecureHash('input2');

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = generateSecureHash('');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle special characters', () => {
      const hash = generateSecureHash('Special chars: ñáéíóú@#$%^&*()');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove angle brackets', () => {
      expect(sanitizeInput('<script>alert("XSS")</script>')).toBe('scriptalert("XSS")/script');
      expect(sanitizeInput('Normal text')).toBe('Normal text');
    });

    it('should remove javascript: protocol', () => {
      expect(sanitizeInput('javascript:alert("XSS")')).toBe('alert("XSS")');
      expect(sanitizeInput('JAVASCRIPT:malicious()')).toBe('malicious()');
    });

    it('should remove event handlers', () => {
      expect(sanitizeInput('onclick="malicious()"')).toBe('"malicious()"');
      expect(sanitizeInput('onload="bad()"')).toBe('"bad()"');
      expect(sanitizeInput('onmouseover="evil()"')).toBe('"evil()"');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  trimmed text  ')).toBe('trimmed text');
      expect(sanitizeInput('\n\ttext\n\t')).toBe('text');
    });

    it('should handle complex XSS attempts', () => {
      const malicious = '<img src="x" onerror="javascript:alert(1)">';
      const sanitized = sanitizeInput(malicious);
      
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).not.toContain('onerror=');
    });

    it('should preserve legitimate content', () => {
      expect(sanitizeInput('Normal text with numbers 123')).toBe('Normal text with numbers 123');
      expect(sanitizeInput('Email: user@domain.com')).toBe('Email: user@domain.com');
    });
  });

  describe('isValidApiKeyFormat', () => {
    it('should validate correct API key formats', () => {
      expect(isValidApiKeyFormat('abcd1234-5678-90ef-ghij-klmnopqrstuv')).toBe(true);
      expect(isValidApiKeyFormat('1234567890abcdef1234567890abcdef')).toBe(true);
      expect(isValidApiKeyFormat('a'.repeat(32))).toBe(true);
      expect(isValidApiKeyFormat('a'.repeat(128))).toBe(true);
    });

    it('should reject invalid API key formats', () => {
      expect(isValidApiKeyFormat('too-short')).toBe(false);
      expect(isValidApiKeyFormat('a'.repeat(31))).toBe(false); // Too short
      expect(isValidApiKeyFormat('a'.repeat(129))).toBe(false); // Too long
      expect(isValidApiKeyFormat('invalid@chars!')).toBe(false);
      expect(isValidApiKeyFormat('has spaces in it')).toBe(false);
      expect(isValidApiKeyFormat('')).toBe(false);
    });

    it('should handle special characters correctly', () => {
      expect(isValidApiKeyFormat('key-with-dashes-1234567890abcdef')).toBe(true);
      expect(isValidApiKeyFormat('key_with_underscores_1234567890')).toBe(false); // Underscores not allowed
      expect(isValidApiKeyFormat('key.with.dots.1234567890abcdef')).toBe(false); // Dots not allowed
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask long sensitive data', () => {
      const apiKey = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
      const masked = maskSensitiveData(apiKey);
      
      expect(masked).toBe('sk-p...3456');
      expect(masked.length).toBeLessThan(apiKey.length);
    });

    it('should handle short data', () => {
      expect(maskSensitiveData('short')).toBe('***');
      expect(maskSensitiveData('1234567')).toBe('***');
    });

    it('should handle edge cases', () => {
      expect(maskSensitiveData('')).toBe('***');
      expect(maskSensitiveData('12345678')).toBe('1234...5678');
    });

    it('should preserve first and last 4 characters for long strings', () => {
      const longString = 'abcdefghijklmnopqrstuvwxyz';
      const masked = maskSensitiveData(longString);
      
      expect(masked.startsWith('abcd')).toBe(true);
      expect(masked.endsWith('wxyz')).toBe(true);
      expect(masked).toContain('...');
    });
  });
});