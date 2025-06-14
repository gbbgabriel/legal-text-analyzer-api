import { EventEmitter } from 'events';
import { config } from '../config';
import { logger } from '../utils/logger';
import { LegalAnalysisResult, ChunkResult } from '../types';
import { openAIService } from './OpenAIService';
import { cacheService } from './CacheService';

export class LegalTextAnalysisService extends EventEmitter {
  private stopwords: Set<string>;
  private legalTerms: Set<string>;

  constructor() {
    super();
    this.stopwords = new Set([
      // Portuguese common stopwords
      'a', 'o', 'e', 'de', 'da', 'do', 'em', 'para', 'com', 'por', 'que',
      'os', 'as', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'um', 'uma',
      'ao', 'à', 'pelo', 'pela', 'este', 'esta', 'esse', 'essa', 'aquele',
      'aquela', 'seu', 'sua', 'nosso', 'nossa', 'ele', 'ela', 'eles', 'elas',
      // Legal stopwords
      ...config.textProcessing.stopwordsJuridicas,
    ]);
    
    this.legalTerms = new Set(config.textProcessing.legalTerms);
  }

  /**
   * Main analysis method
   */
  async analyzeLegalText(text: string): Promise<LegalAnalysisResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = cacheService.generateKey(text);
    const cached = cacheService.get<LegalAnalysisResult>(cacheKey);
    if (cached) {
      logger.info('Returning cached analysis result');
      return cached;
    }
    
    // Validate input
    this.validateInput(text);
    
    // Determine if we need chunking
    const needsChunking = text.length > config.textProcessing.chunkSize * 2;
    
    let result: LegalAnalysisResult;
    
    if (needsChunking) {
      result = await this.analyzeWithChunking(text);
    } else {
      result = await this.analyzeDirectly(text);
    }
    
    result.processingTime = Date.now() - startTime;
    
    // Cache the result
    cacheService.set(cacheKey, result);
    
    return result;
  }

  /**
   * Analyze text directly (no chunking)
   */
  private async analyzeDirectly(text: string): Promise<LegalAnalysisResult> {
    const basicAnalysis = this.performBasicAnalysis(text);
    const sentiment = await openAIService.analyzeSentiment(text);
    
    return {
      ...basicAnalysis,
      sentiment,
      chunksProcessed: 1,
      processingTime: 0, // Will be set by calling function
    };
  }

  /**
   * Analyze text with chunking
   */
  private async analyzeWithChunking(text: string): Promise<LegalAnalysisResult> {
    const chunks = this.createChunks(text);
    const totalChunks = chunks.length;
    
    logger.info(`Analyzing text in ${totalChunks} chunks`);
    
    const chunkResults: ChunkResult[] = [];
    let processedChunks = 0;
    
    // Process chunks in batches for better performance
    const BATCH_SIZE = 5; // Process 5 chunks in parallel
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        
        try {
          const chunkAnalysis = await this.analyzeChunk(chunk, chunkIndex);
          processedChunks++;
          
          // Emit progress
          this.emit('progress', {
            current: processedChunks,
            total: totalChunks,
            percentage: Math.round((processedChunks / totalChunks) * 100),
          });
          
          return chunkAnalysis;
        } catch (error) {
          logger.error(`Error analyzing chunk ${chunkIndex}`, error);
          return {
            chunkIndex,
            wordCount: 0,
            topWords: [],
            legalTerms: [],
            error: 'Falha ao analisar chunk',
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      chunkResults.push(...batchResults);
    }
    
    // Consolidate results
    const consolidated = this.consolidateChunkResults(chunkResults, text);
    
    return {
      ...consolidated,
      chunksProcessed: processedChunks,
      processingTime: 0, // Will be set by calling function
    };
  }

  /**
   * Analyze a single chunk
   */
  private async analyzeChunk(chunk: string, index: number): Promise<ChunkResult> {
    const words = this.extractWords(chunk);
    const wordFrequency = this.calculateWordFrequency(words);
    const topWords = this.getTopWords(wordFrequency, 10);
    const legalTerms = this.extractLegalTerms(words);
    
    let sentiment: string | undefined;
    
    // Only analyze sentiment for first few chunks to save API calls
    if (index < 3) {
      const sentimentResult = await openAIService.analyzeSentiment(chunk);
      sentiment = sentimentResult.overall;
    }
    
    return {
      chunkIndex: index,
      sentiment,
      topWords,
      legalTerms,
      wordCount: words.length,
    };
  }

  /**
   * Create intelligent chunks preserving legal structure
   */
  private createChunks(text: string): string[] {
    const chunks: string[] = [];
    const { chunkSize, minChunkSize } = config.textProcessing;
    
    // Try to split by articles first
    const articlePattern = /(?=\n\s*[Aa]rt\.?\s*\d+)/g;
    const articleSplits = text.split(articlePattern).filter(s => s.trim());
    
    if (articleSplits.length > 1) {
      // Merge small articles together
      let currentChunk = '';
      
      for (const article of articleSplits) {
        if (currentChunk.length + article.length > chunkSize && currentChunk.length > minChunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = article;
        } else {
          currentChunk += '\n' + article;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    } else {
      // Fallback to paragraph splitting
      const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
      let currentChunk = '';
      
      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > minChunkSize) {
          chunks.push(currentChunk.trim());
          currentChunk = paragraph;
        } else {
          currentChunk += '\n\n' + paragraph;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    }
    
    return chunks;
  }

  /**
   * Perform basic text analysis
   */
  private performBasicAnalysis(text: string): Omit<LegalAnalysisResult, 'sentiment' | 'processingTime'> {
    const words = this.extractWords(text);
    const wordFrequency = this.calculateWordFrequency(words);
    const topWords = this.getTopWords(wordFrequency, 5);
    const legalTerms = this.extractLegalTerms(words);
    const structure = this.analyzeStructure(text);
    
    return {
      wordCount: words.length,
      characterCount: text.length,
      topWords,
      legalTerms,
      structure,
    };
  }

  /**
   * Extract words from text
   */
  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sàáâãäéèêëíìîïóòôõöúùûüçñ]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopwords.has(word));
  }

  /**
   * Calculate word frequency
   */
  private calculateWordFrequency(words: string[]): Map<string, number> {
    const frequency = new Map<string, number>();
    
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
    
    return frequency;
  }

  /**
   * Get top words by frequency
   */
  private getTopWords(
    frequency: Map<string, number>,
    limit: number
  ): Array<{ word: string; count: number }> {
    return Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word, count]) => ({ word, count }));
  }

  /**
   * Extract legal terms from words
   */
  private extractLegalTerms(words: string[]): Array<{ term: string; count: number }> {
    const termFrequency = new Map<string, number>();
    
    for (const word of words) {
      if (this.legalTerms.has(word)) {
        termFrequency.set(word, (termFrequency.get(word) || 0) + 1);
      }
    }
    
    return Array.from(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([term, count]) => ({ term, count }));
  }

  /**
   * Analyze text structure
   */
  private analyzeStructure(text: string): {
    paragraphs: number;
    articles: number;
    sections: number;
  } {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim()).length;
    const articles = (text.match(/\b[Aa]rt\.?\s*\d+/g) || []).length;
    const sections = (text.match(/\b[Ss]eção\s+[IVX\d]+/g) || []).length;
    
    return { paragraphs, articles, sections };
  }

  /**
   * Consolidate results from multiple chunks
   */
  private consolidateChunkResults(
    chunkResults: ChunkResult[],
    originalText: string
  ): Omit<LegalAnalysisResult, 'chunksProcessed' | 'processingTime'> {
    // Aggregate word counts
    const totalWords = chunkResults.reduce((sum, chunk) => sum + chunk.wordCount, 0);
    
    // Merge and re-rank top words
    const allTopWords = new Map<string, number>();
    for (const chunk of chunkResults) {
      for (const { word, count } of chunk.topWords) {
        allTopWords.set(word, (allTopWords.get(word) || 0) + count);
      }
    }
    
    const topWords = Array.from(allTopWords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));
    
    // Merge legal terms
    const allLegalTerms = new Map<string, number>();
    for (const chunk of chunkResults) {
      for (const { term, count } of chunk.legalTerms) {
        allLegalTerms.set(term, (allLegalTerms.get(term) || 0) + count);
      }
    }
    
    const legalTerms = Array.from(allLegalTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([term, count]) => ({ term, count }));
    
    // Calculate overall sentiment
    const sentiments = chunkResults
      .filter(c => c.sentiment)
      .map(c => c.sentiment!);
    
    let overallSentiment: any = undefined;
    if (sentiments.length > 0) {
      const sentimentCounts = {
        positivo: sentiments.filter(s => s === 'positivo').length,
        negativo: sentiments.filter(s => s === 'negativo').length,
        neutro: sentiments.filter(s => s === 'neutro').length,
      };
      
      const dominant = Object.entries(sentimentCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      
      overallSentiment = {
        overall: dominant,
        score: dominant === 'positivo' ? 0.5 : dominant === 'negativo' ? -0.5 : 0,
        analysis: 'Análise consolidada de múltiplos chunks',
      };
    }
    
    return {
      wordCount: totalWords,
      characterCount: originalText.length,
      topWords,
      legalTerms,
      sentiment: overallSentiment,
      structure: this.analyzeStructure(originalText),
    };
  }

  /**
   * Validate input text
   */
  private validateInput(text: string): void {
    if (!text || typeof text !== 'string') {
      throw new Error('Texto inválido');
    }
    
    if (text.trim().length === 0) {
      throw new Error('Texto não pode estar vazio');
    }
    
    if (text.length > config.textProcessing.maxTextSize) {
      throw new Error(`Texto muito grande (máximo ${config.textProcessing.maxTextSize / 1024 / 1024}MB)`);
    }
  }

  /**
   * Check if text is legal content
   */
  isLegalText(text: string): boolean {
    const lowerText = text.toLowerCase();
    const legalIndicators = [
      'contrato', 'lei', 'artigo', 'cláusula', 'parágrafo',
      'decreto', 'petição', 'sentença', 'acórdão', 'processo',
    ];
    
    const matches = legalIndicators.filter(indicator => lowerText.includes(indicator));
    return matches.length >= 2;
  }
}

// Export singleton instance
export const legalTextAnalysisService = new LegalTextAnalysisService();