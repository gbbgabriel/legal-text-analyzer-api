import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';

export class OpenAIService {
  private client: OpenAI | null = null;
  private enabled: boolean;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 1000; // 1 second between requests

  constructor() {
    this.enabled = !!config.openai.apiKey;
    
    if (this.enabled) {
      this.client = new OpenAI({
        apiKey: config.openai.apiKey,
        timeout: config.openai.timeout,
        maxRetries: config.openai.maxRetries,
      });
      logger.info('OpenAI service initialized');
    } else {
      logger.warn('OpenAI service disabled - no API key provided');
    }
  }

  /**
   * Analyze sentiment of text
   */
  async analyzeSentiment(text: string): Promise<{
    overall: string;
    score: number;
    analysis?: string;
  }> {
    if (!this.enabled || !this.client) {
      return this.fallbackSentimentAnalysis(text);
    }

    try {
      await this.enforceRateLimit();
      
      const prompt = `Analise o sentimento do seguinte texto jurídico e retorne:
      1. Sentimento geral: positivo, negativo ou neutro
      2. Score de -1 a 1 (-1 muito negativo, 0 neutro, 1 muito positivo)
      3. Breve análise do tom e contexto jurídico
      
      Texto: "${text.substring(0, 2000)}..."
      
      Responda em formato JSON: {"overall": "...", "score": 0.0, "analysis": "..."}`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em análise de textos jurídicos.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      try {
        const result = JSON.parse(content);
        logger.info('OpenAI sentiment analysis completed');
        return result;
      } catch (parseError) {
        logger.error('Failed to parse OpenAI response', parseError);
        return this.fallbackSentimentAnalysis(text);
      }
    } catch (error: any) {
      if (error.status === 401) {
        logger.warn('OpenAI API key not configured or invalid - using fallback analysis');
      } else {
        logger.error('OpenAI API error', error);
      }
      return this.fallbackSentimentAnalysis(text);
    }
  }

  /**
   * Summarize text (optional feature)
   */
  async summarizeText(text: string): Promise<string | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      await this.enforceRateLimit();
      
      const prompt = `Resuma o seguinte texto jurídico em no máximo 3 parágrafos, 
      destacando os pontos mais importantes:
      
      Texto: "${text.substring(0, 3000)}..."`;

      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Você é um especialista em direito que cria resumos concisos e precisos.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });

      const summary = response.choices[0]?.message?.content;
      logger.info('OpenAI text summarization completed');
      return summary || null;
    } catch (error) {
      logger.error('OpenAI summarization error', error);
      return null;
    }
  }

  /**
   * Count tokens (estimate)
   */
  estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text fits within token limit
   */
  fitsWithinTokenLimit(text: string): boolean {
    return this.estimateTokens(text) <= config.openai.maxTokens;
  }

  /**
   * Fallback sentiment analysis when OpenAI is not available
   */
  private fallbackSentimentAnalysis(text: string): {
    overall: string;
    score: number;
    analysis?: string;
  } {
    const lowerText = text.toLowerCase();
    
    // Positive indicators
    const positiveWords = [
      'acordo', 'aprovado', 'deferido', 'procedente', 'favorável',
      'ganho', 'vitória', 'sucesso', 'benefício', 'direito garantido',
    ];
    
    // Negative indicators
    const negativeWords = [
      'indeferido', 'improcedente', 'negado', 'recusado', 'multa',
      'penalidade', 'condenação', 'prejuízo', 'dano', 'violação',
    ];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++;
    });
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++;
    });
    
    const score = (positiveCount - negativeCount) / (positiveCount + negativeCount + 1);
    
    let overall: string;
    if (score > 0.2) overall = 'positivo';
    else if (score < -0.2) overall = 'negativo';
    else overall = 'neutro';
    
    return {
      overall,
      score: Math.max(-1, Math.min(1, score)),
      analysis: this.enabled 
        ? 'Análise realizada com método local (erro na API OpenAI)'
        : 'Análise realizada com método local (chave OpenAI não configurada)',
    };
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get service statistics
   */
  getStats(): {
    enabled: boolean;
    requestCount: number;
    estimatedCost: number;
  } {
    // Rough cost estimation: $0.002 per 1K tokens
    const estimatedCost = (this.requestCount * 500 * 0.002) / 1000;
    
    return {
      enabled: this.enabled,
      requestCount: this.requestCount,
      estimatedCost,
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();