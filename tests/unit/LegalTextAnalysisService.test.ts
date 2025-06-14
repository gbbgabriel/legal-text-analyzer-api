import { describe, it, expect, beforeEach } from '@jest/globals';
import { legalTextAnalysisService } from '../../src/services/LegalTextAnalysisService';
import { cacheService } from '../../src/services/CacheService';

describe('LegalTextAnalysisService', () => {
  beforeEach(() => {
    // Clear cache before each test
    cacheService.clear();
  });

  describe('analyzeLegalText', () => {
    it('should analyze a simple legal text', async () => {
      const text = 'Contrato de locação residencial conforme artigo 1º da Lei do Inquilinato.';
      
      const result = await legalTextAnalysisService.analyzeLegalText(text);
      
      expect(result).toHaveProperty('wordCount');
      expect(result).toHaveProperty('characterCount');
      expect(result).toHaveProperty('topWords');
      expect(result).toHaveProperty('legalTerms');
      expect(result).toHaveProperty('structure');
      expect(result).toHaveProperty('processingTime');
      
      expect(result.wordCount).toBeGreaterThan(0);
      expect(result.characterCount).toBe(text.length);
      expect(Array.isArray(result.topWords)).toBe(true);
      expect(Array.isArray(result.legalTerms)).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should identify legal terms correctly', async () => {
      const text = 'Este contrato estabelece as obrigações do locatário e do fiador.';
      
      const result = await legalTextAnalysisService.analyzeLegalText(text);
      
      expect(result.legalTerms.length).toBeGreaterThan(0);
      
      const termNames = result.legalTerms.map(term => term.term);
      expect(termNames).toContain('contrato');
      expect(termNames).toContain('locatário');
      expect(termNames).toContain('fiador');
    });

    it('should analyze text structure correctly', async () => {
      const text = `
        Art. 1º Este é o primeiro artigo.
        
        § 1º Este é o primeiro parágrafo.
        § 2º Este é o segundo parágrafo.
        
        Art. 2º Este é o segundo artigo.
      `;
      
      const result = await legalTextAnalysisService.analyzeLegalText(text);
      
      expect(result.structure.articles).toBe(2);
      expect(result.structure.paragraphs).toBeGreaterThan(0);
    });

    it('should use cache for repeated texts', async () => {
      const text = 'Texto de teste para cache.';
      
      // First call
      const result1 = await legalTextAnalysisService.analyzeLegalText(text);
      
      // Second call (should use cache)
      const result2 = await legalTextAnalysisService.analyzeLegalText(text);
      
      expect(result1).toEqual(result2);
      expect(result2.processingTime).toBeLessThanOrEqual(result1.processingTime);
    });

    it('should handle chunking for large texts', async () => {
      // Create a large text (>6000 characters to trigger chunking)
      // chunkSize is 3000, so we need more than 6000 to get 3+ chunks
      const largeText = 'Este é um texto jurídico muito longo para análise. '.repeat(200);
      
      const result = await legalTextAnalysisService.analyzeLegalText(largeText);
      
      expect(result).toHaveProperty('chunksProcessed');
      expect(result.chunksProcessed).toBeGreaterThanOrEqual(1);
    });

    it('should validate input correctly', async () => {
      // Test empty text
      await expect(legalTextAnalysisService.analyzeLegalText('')).rejects.toThrow();
      
      // Test null/undefined
      await expect(legalTextAnalysisService.analyzeLegalText(null as any)).rejects.toThrow();
      await expect(legalTextAnalysisService.analyzeLegalText(undefined as any)).rejects.toThrow();
    });

    it('should emit progress events for large texts', async () => {
      const largeText = 'Contrato de locação que precisa ser analisado em múltiplos chunks. '.repeat(200);
      const progressEvents: any[] = [];
      
      legalTextAnalysisService.on('progress', (data) => {
        progressEvents.push(data);
      });
      
      await legalTextAnalysisService.analyzeLegalText(largeText);
      
      // Should have received at least one progress event
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Clean up listener
      legalTextAnalysisService.removeAllListeners('progress');
    });
  });

  describe('isLegalText', () => {
    it('should identify legal text correctly', () => {
      const legalText = 'Contrato de locação conforme artigo 5º da lei.';
      const regularText = 'Hoje está um dia muito bonito.';
      
      expect(legalTextAnalysisService.isLegalText(legalText)).toBe(true);
      expect(legalTextAnalysisService.isLegalText(regularText)).toBe(false);
    });

    it('should require multiple legal indicators', () => {
      const textWithOneIndicator = 'Este é um contrato simples.';
      const textWithMultipleIndicators = 'Este contrato estabelece as cláusulas necessárias.';
      
      expect(legalTextAnalysisService.isLegalText(textWithOneIndicator)).toBe(false);
      expect(legalTextAnalysisService.isLegalText(textWithMultipleIndicators)).toBe(true);
    });
  });
});