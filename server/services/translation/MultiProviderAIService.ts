import { createTranslationError } from '../../middleware/errorHandler';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  modelId: string;
  maxTokens: number;
  contextWindow: number;
  requestsPerMinute: number;
  tokensPerMinute: number;
  dailyLimit: number;
}

export interface AIResponse {
  translation: string;
  confidence: number;
  model: string;
  provider: string;
  reasoning?: string;
  tokensUsed?: number;
  processingTime?: number;
}

/**
 * Multi-provider AI service supporting Groq, OpenRouter, and Cerebras
 * with optimized configurations for each provider's API format
 */
export class MultiProviderAIService {
  private providers: Map<string, ProviderConfig> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all available providers based on environment variables
   */
  private initializeProviders(): void {
    // Groq providers
    if (process.env.GROQ_API_KEY) {
      this.providers.set('groq-deepseek-r1', {
        apiKey: process.env.GROQ_API_KEY,
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        modelId: 'deepseek-r1-distill-llama-70b',
        maxTokens: 4000,
        contextWindow: 131072,
        requestsPerMinute: 6,
        tokensPerMinute: 6000,
        dailyLimit: 100000
      });

      this.providers.set('groq-qwen3', {
        apiKey: process.env.GROQ_API_KEY,
        baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
        modelId: 'qwen/qwen3-32b',
        maxTokens: 4000,
        contextWindow: 131072,
        requestsPerMinute: 6,
        tokensPerMinute: 6000,
        dailyLimit: 500000
      });
    }

    // OpenRouter providers
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set('openrouter-gpt-oss', {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'openai/gpt-oss-20b:free',
        maxTokens: 4000,
        contextWindow: 131072,
        requestsPerMinute: 200,
        tokensPerMinute: 50000,
        dailyLimit: 1000000
      });

      this.providers.set('openrouter-kimi-k2', {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'moonshotai/kimi-k2:free',
        maxTokens: 4000,
        contextWindow: 33000,
        requestsPerMinute: 200,
        tokensPerMinute: 50000,
        dailyLimit: 1000000
      });

      this.providers.set('openrouter-deepseek-r1', {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'tngtech/deepseek-r1t2-chimera:free',
        maxTokens: 4000,
        contextWindow: 164000,
        requestsPerMinute: 200,
        tokensPerMinute: 50000,
        dailyLimit: 1000000
      });

      this.providers.set('openrouter-hunyuan', {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
        modelId: 'tencent/hunyuan-a13b-instruct:free',
        maxTokens: 4000,
        contextWindow: 33000,
        requestsPerMinute: 200,
        tokensPerMinute: 50000,
        dailyLimit: 1000000
      });
    }

    // Cerebras providers
    if (process.env.CEREBRAS_API_KEY) {
      this.providers.set('cerebras-gpt-oss', {
        apiKey: process.env.CEREBRAS_API_KEY,
        baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
        modelId: 'gpt-oss-120b',
        maxTokens: 4000,
        contextWindow: 65536,
        requestsPerMinute: 30,
        tokensPerMinute: 64000,
        dailyLimit: 1000000
      });

      this.providers.set('cerebras-qwen3', {
        apiKey: process.env.CEREBRAS_API_KEY,
        baseUrl: 'https://api.cerebras.ai/v1/chat/completions',
        modelId: 'qwen-3-235b-a22b-instruct-2507',
        maxTokens: 4000,
        contextWindow: 64000,
        requestsPerMinute: 30,
        tokensPerMinute: 60000,
        dailyLimit: 1000000
      });
    }

    console.log(`[MultiProviderAI] Initialized ${this.providers.size} AI providers`);
  }

  /**
   * Get translations from all available providers
   */
  public async getMultiProviderTranslations(
    tibetanText: string,
    dictionaryContext: string,
    maxProviders: number = 3
  ): Promise<AIResponse[]> {
    const availableProviders = Array.from(this.providers.keys());
    const selectedProviders = this.selectBestProviders(availableProviders, maxProviders);
    
    console.log(`[MultiProviderAI] Using providers: ${selectedProviders.join(', ')}`);

    const promises = selectedProviders.map(providerId => 
      this.translateWithProvider(providerId, tibetanText, dictionaryContext)
        .catch(error => ({
          translation: '',
          confidence: 0,
          model: this.providers.get(providerId)?.modelId || 'unknown',
          provider: providerId,
          reasoning: `Error: ${error.message}`,
          processingTime: 0
        }))
    );

    const results = await Promise.all(promises);
    return results.filter(result => result.translation.length > 0);
  }

  /**
   * Translate with a specific provider
   */
  private async translateWithProvider(
    providerId: string,
    tibetanText: string,
    dictionaryContext: string
  ): Promise<AIResponse> {
    const config = this.providers.get(providerId);
    if (!config) {
      throw new Error(`Provider ${providerId} not configured`);
    }

    // Check rate limits
    if (!this.checkRateLimit(providerId, config)) {
      throw new Error(`Rate limit exceeded for ${providerId}`);
    }

    const startTime = Date.now();
    const prompt = this.createProviderSpecificPrompt(tibetanText, dictionaryContext, providerId);

    try {
      const requestBody = this.buildRequestBody(config, prompt);
      const headers = this.buildHeaders(config, providerId);

      const response = await fetch(config.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${providerId} API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const translation = this.extractTranslation(data, providerId);
      const tokensUsed = this.extractTokenUsage(data);
      
      // Update rate limiting counters
      this.updateRateLimit(providerId);

      const processingTime = Date.now() - startTime;
      const confidence = this.calculateProviderConfidence(translation, providerId, processingTime);

      return {
        translation: this.cleanTranslation(translation),
        confidence,
        model: config.modelId,
        provider: providerId,
        reasoning: `Translated using ${providerId} with ${config.modelId}`,
        tokensUsed,
        processingTime
      };

    } catch (error) {
      console.error(`[MultiProviderAI] ${providerId} translation error:`, error);
      throw error;
    }
  }

  /**
   * Create provider-specific optimized prompts
   */
  private createProviderSpecificPrompt(
    tibetanText: string,
    dictionaryContext: string,
    providerId: string
  ): string {
    const basePrompt = `You are an expert Tibetan-English translator. Translate the following Tibetan text accurately and naturally.

DICTIONARY REFERENCE:
${dictionaryContext}

GUIDELINES:
- Translate each sentence into natural English
- Include the original Tibetan text in parentheses after each sentence
- Use dictionary references when appropriate
- Preserve Buddhist and cultural terminology accuracy
- Maintain the structure and meaning of the original text

TIBETAN TEXT:
${tibetanText}

Translation:`;

    // Provider-specific optimizations
    switch (true) {
      case providerId.includes('deepseek'):
        return `${basePrompt}\n\nNote: Use step-by-step reasoning for complex Buddhist terminology.`;
      
      case providerId.includes('qwen'):
        return `${basePrompt}\n\nNote: Focus on cultural context and nuanced meaning.`;
      
      case providerId.includes('kimi'):
        return `${basePrompt}\n\nNote: Ensure comprehensive understanding of lengthy texts.`;
      
      case providerId.includes('gpt-oss'):
        return `${basePrompt}\n\nNote: Apply reasoning for complex philosophical concepts.`;
      
      default:
        return basePrompt;
    }
  }

  /**
   * Build request body for different providers
   */
  private buildRequestBody(config: ProviderConfig, prompt: string): any {
    const baseBody = {
      model: config.modelId,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: config.maxTokens,
      temperature: 0.1,
      stream: false
    };

    // Provider-specific parameters
    if (config.modelId.includes('deepseek-r1')) {
      return {
        ...baseBody,
        temperature: 0.6, // DeepSeek R1 works better with slightly higher temperature
        top_p: 0.9
      };
    }

    if (config.modelId.includes('qwen')) {
      const qwenBody: any = {
        ...baseBody,
        top_p: 0.8
      };
      
      // Only add frequency_penalty for non-Cerebras providers
      if (!config.baseUrl.includes('cerebras')) {
        qwenBody.frequency_penalty = 0.1;
      }
      
      return qwenBody;
    }

    return baseBody;
  }

  /**
   * Build headers for different providers
   */
  private buildHeaders(config: ProviderConfig, providerId: string): Record<string, string> {
    const baseHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    };

    // OpenRouter specific headers
    if (providerId.startsWith('openrouter')) {
      return {
        ...baseHeaders,
        'HTTP-Referer': 'https://translate-app.local',
        'X-Title': 'Tibetan Translation App'
      };
    }

    // Cerebras specific headers
    if (providerId.startsWith('cerebras')) {
      return {
        ...baseHeaders,
        'User-Agent': 'TibetanTranslationApp/1.0'
      };
    }

    return baseHeaders;
  }

  /**
   * Extract translation from response
   */
  private extractTranslation(data: any, providerId: string): string {
    try {
      // Standard OpenAI format used by most providers
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.warn(`[MultiProviderAI] Failed to extract translation from ${providerId}:`, error);
      return '';
    }
  }

  /**
   * Extract token usage information
   */
  private extractTokenUsage(data: any): number | undefined {
    return data.usage?.total_tokens;
  }

  /**
   * Calculate provider-specific confidence score
   */
  private calculateProviderConfidence(
    translation: string,
    providerId: string,
    processingTime: number
  ): number {
    let confidence = 0.7; // Base confidence

    // Provider reliability adjustments
    if (providerId.includes('deepseek-r1')) confidence += 0.1; // High reasoning capability
    if (providerId.includes('qwen')) confidence += 0.08; // Good multilingual support
    if (providerId.includes('kimi-k2')) confidence += 0.06; // Good context handling
    if (providerId.includes('gpt-oss')) confidence += 0.05; // Solid reasoning

    // Translation quality indicators
    const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
    confidence += Math.min(0.15, tibetanParens * 0.03);

    // Response time quality (faster often means more confident)
    if (processingTime < 5000) confidence += 0.05;
    if (processingTime > 30000) confidence -= 0.1;

    // Length reasonableness
    const wordCount = translation.split(/\s+/).length;
    if (wordCount < 5) confidence -= 0.2;
    if (wordCount > 1000) confidence -= 0.1;

    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Select best providers based on availability and performance
   */
  private selectBestProviders(available: string[], maxCount: number): string[] {
    // Priority order based on model capability for Tibetan translation
    const priorityOrder = [
      'cerebras-qwen3',       // High performance Qwen
      'groq-deepseek-r1',    // Reasoning capability
      'openrouter-deepseek-r1', // Alternative DeepSeek
      'groq-qwen3',          // Fast Qwen
      'openrouter-kimi-k2',  // Long context
      'cerebras-gpt-oss',    // GPT reasoning
      'openrouter-gpt-oss',  // Alternative GPT
      'openrouter-hunyuan'   // Chinese model expertise
    ];

    const selected: string[] = [];
    for (const provider of priorityOrder) {
      if (available.includes(provider) && this.isProviderAvailable(provider)) {
        selected.push(provider);
        if (selected.length >= maxCount) break;
      }
    }

    // If we don't have enough, add any remaining available providers
    if (selected.length < maxCount) {
      for (const provider of available) {
        if (!selected.includes(provider) && this.isProviderAvailable(provider)) {
          selected.push(provider);
          if (selected.length >= maxCount) break;
        }
      }
    }

    return selected;
  }

  /**
   * Check if provider is available (not rate limited)
   */
  private isProviderAvailable(providerId: string): boolean {
    const config = this.providers.get(providerId);
    return config ? this.checkRateLimit(providerId, config) : false;
  }

  /**
   * Check rate limits for a provider
   */
  private checkRateLimit(providerId: string, config: ProviderConfig): boolean {
    const now = Date.now();
    const rateData = this.requestCounts.get(providerId);

    if (!rateData) {
      return true; // First request
    }

    // Reset counter if a minute has passed
    if (now - rateData.resetTime > 60000) {
      this.requestCounts.set(providerId, { count: 0, resetTime: now });
      return true;
    }

    // Check if under limit
    return rateData.count < config.requestsPerMinute;
  }

  /**
   * Update rate limit counter
   */
  private updateRateLimit(providerId: string): void {
    const now = Date.now();
    const rateData = this.requestCounts.get(providerId);

    if (!rateData) {
      this.requestCounts.set(providerId, { count: 1, resetTime: now });
    } else {
      if (now - rateData.resetTime > 60000) {
        this.requestCounts.set(providerId, { count: 1, resetTime: now });
      } else {
        rateData.count++;
      }
    }
  }

  /**
   * Clean translation output
   */
  private cleanTranslation(translation: string): string {
    return translation
      .replace(/^(Translation:|Here's the translation:|\s*)/i, '')
      .replace(/\s*$/g, '')
      .trim();
  }

  /**
   * Get available providers
   */
  public getAvailableProviders(): Array<{ id: string; model: string; provider: string; contextWindow: number }> {
    return Array.from(this.providers.entries()).map(([id, config]) => ({
      id,
      model: config.modelId,
      provider: id.split('-')[0],
      contextWindow: config.contextWindow
    }));
  }

  /**
   * Check if any providers are available
   */
  public isAvailable(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Get provider statistics
   */
  public getProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [providerId, config] of this.providers.entries()) {
      const rateData = this.requestCounts.get(providerId);
      stats[providerId] = {
        model: config.modelId,
        contextWindow: config.contextWindow,
        requestsUsed: rateData?.count || 0,
        requestsRemaining: config.requestsPerMinute - (rateData?.count || 0),
        dailyLimit: config.dailyLimit
      };
    }

    return stats;
  }
}

export const multiProviderAIService = new MultiProviderAIService();