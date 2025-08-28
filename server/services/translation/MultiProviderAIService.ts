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

export interface ProviderState {
  status: 'available' | 'rate_limited' | 'disabled';
  disabledUntil?: number; // timestamp when provider can be used again
  disabledReason?: string;
  tokensUsed?: number;
  lastError?: string;
}

/**
 * Multi-provider AI service supporting Groq, OpenRouter, and Cerebras
 * with optimized configurations for each provider's API format
 */
export class MultiProviderAIService {
  private providers: Map<string, ProviderConfig> = new Map();
  private requestCounts: Map<string, { count: number; resetTime: number }> = new Map();
  private providerStates: Map<string, ProviderState> = new Map();

  constructor() {
    this.initializeProviders();
    this.initializeProviderStates();
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
   * Initialize provider states for rate limit management
   */
  private initializeProviderStates(): void {
    for (const providerId of this.providers.keys()) {
      this.providerStates.set(providerId, {
        status: 'available',
        tokensUsed: 0
      });
    }
    console.log(`[MultiProviderAI] Initialized provider states for ${this.providerStates.size} providers`);
  }

  /**
   * Check if provider is currently available for use
   */
  private isProviderAvailable(providerId: string): boolean {
    const state = this.providerStates.get(providerId);
    if (!state) return false;
    
    // Check if disabled period has passed
    if (state.status === 'disabled' && state.disabledUntil) {
      if (Date.now() >= state.disabledUntil) {
        // Re-enable provider
        state.status = 'available';
        state.disabledUntil = undefined;
        state.disabledReason = undefined;
        state.tokensUsed = 0;
        console.log(`[MultiProviderAI] Re-enabled ${providerId} after rate limit reset`);
      }
    }
    
    return state.status === 'available';
  }

  /**
   * Handle rate limit errors and disable provider if necessary
   */
  private handleRateLimitError(providerId: string, error: any): void {
    const state = this.providerStates.get(providerId);
    if (!state) return;
    
    const errorMsg = error.message || '';
    
    // Handle authentication errors (401, User not found, etc.)
    if (errorMsg.includes('401') || errorMsg.includes('User not found') || 
        errorMsg.includes('authentication') || errorMsg.includes('unauthorized')) {
      state.status = 'disabled';
      state.disabledUntil = Date.now() + 365 * 24 * 60 * 60 * 1000; // Disable for a year
      state.disabledReason = 'Authentication failed - Invalid API key';
      state.lastError = errorMsg;
      console.warn(`[MultiProviderAI] ${providerId} permanently disabled - Authentication failed`);
      return;
    }
    
    // Check for daily token limit
    if (errorMsg.includes('tokens per day') || errorMsg.includes('TPD') || errorMsg.includes('daily limit')) {
      // Extract reset time if available
      const resetMatch = errorMsg.match(/Please try again in ([\d.]+)([hms])/);
      let disabledUntil = Date.now() + 24 * 60 * 60 * 1000; // Default: 24 hours
      
      if (resetMatch) {
        const value = parseFloat(resetMatch[1]);
        const unit = resetMatch[2];
        const multiplier = unit === 'h' ? 3600000 : unit === 'm' ? 60000 : 1000;
        disabledUntil = Date.now() + (value * multiplier);
      }
      
      // Disable provider
      state.status = 'disabled';
      state.disabledUntil = disabledUntil;
      state.disabledReason = 'Daily token limit exceeded';
      state.lastError = errorMsg;
      
      const resetTime = new Date(disabledUntil).toLocaleTimeString();
      console.warn(`[MultiProviderAI] ${providerId} disabled until ${resetTime} - Daily token limit exceeded`);
      
    } else if (errorMsg.includes('requests per minute') || errorMsg.includes('RPM') ||
               errorMsg.includes('tokens per minute') || errorMsg.includes('TPM')) {
      // Extract reset time with decimal support
      const resetMatch = errorMsg.match(/Please try again in ([\d.]+)([hms])/);
      let cooldownMs = 60000; // Default 1 minute
      
      if (resetMatch) {
        const value = parseFloat(resetMatch[1]);
        const unit = resetMatch[2];
        cooldownMs = unit === 'h' ? value * 3600000 : 
                     unit === 'm' ? value * 60000 : 
                     Math.ceil(value * 1000); // Round up seconds to avoid immediate retry
      }
      
      state.status = 'rate_limited';
      state.disabledUntil = Date.now() + cooldownMs;
      state.disabledReason = 'Per-minute rate limit';
      state.lastError = errorMsg;
      
      const cooldownSeconds = Math.ceil(cooldownMs / 1000);
      console.warn(`[MultiProviderAI] ${providerId} temporarily disabled for ${cooldownSeconds}s - Per-minute rate limit`);
      
      setTimeout(() => {
        if (state.status === 'rate_limited') {
          state.status = 'available';
          console.log(`[MultiProviderAI] ${providerId} available again after ${cooldownSeconds}s cooldown`);
        }
      }, cooldownMs);
    }
  }

  /**
   * Select available providers based on priority and availability
   */
  private selectAvailableProviders(maxProviders: number = 3): string[] {
    const priorityOrder = [
      'cerebras-qwen3',     // Best free option
      'cerebras-gpt-oss',   // Good alternative
      'groq-qwen3',         // 500k daily tokens
      'openrouter-gpt-oss', // When it works
      'openrouter-deepseek-r1', // Backup OpenRouter
      'groq-deepseek-r1'    // 100k daily tokens
    ];
    
    const available = priorityOrder.filter(providerId => {
      return this.providers.has(providerId) && this.isProviderAvailable(providerId);
    }).slice(0, maxProviders);
    
    if (available.length === 0) {
      console.warn('[MultiProviderAI] No providers currently available due to rate limits');
    } else {
      console.log(`[MultiProviderAI] Selected available providers: ${available.join(', ')}`);
    }
    
    return available;
  }

  /**
   * Get translations from all available providers
   */
  public async getMultiProviderTranslations(
    tibetanText: string,
    dictionaryContext: string,
    maxProviders: number = 3
  ): Promise<AIResponse[]> {
    // Get only available providers (not rate-limited or disabled)
    const selectedProviders = this.selectAvailableProviders(maxProviders);
    
    if (selectedProviders.length === 0) {
      console.error('[MultiProviderAI] No providers available - returning empty results');
      return [];
    }

    const promises = selectedProviders.map(providerId => 
      this.translateWithProvider(providerId, tibetanText, dictionaryContext)
        .catch(error => {
          const errorMsg = error.message || error.toString() || 'Unknown error';
          
          // Handle different types of errors
          if (errorMsg.includes('429') || errorMsg.includes('rate_limit_exceeded')) {
            // Rate limit errors - handle and temporarily/permanently disable provider
            this.handleRateLimitError(providerId, error);
          } else if (errorMsg.includes('401') || errorMsg.includes('User not found')) {
            // Authentication errors - permanently disable provider
            this.handleRateLimitError(providerId, error);
          } else {
            // Other errors - just log them
            console.error(`[MultiProviderAI] ${providerId} translation error: ${errorMsg}`);
          }
          
          return {
            translation: '',
            confidence: 0,
            model: this.providers.get(providerId)?.modelId || 'unknown',
            provider: providerId,
            reasoning: `Error: ${errorMsg}`,
            processingTime: 0
          };
        })
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
      // Error logging is handled in getMultiProviderTranslations
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
   * Check rate limits for a provider (backwards compatibility)
   */
  private checkRateLimit(providerId: string, config: ProviderConfig): boolean {
    // Use the new provider state management system
    return this.isProviderAvailable(providerId);
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
   * Get current status of all providers including rate limit information
   */
  public getProviderStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [providerId, config] of this.providers.entries()) {
      const state = this.providerStates.get(providerId);
      const rateData = this.requestCounts.get(providerId);
      
      status[providerId] = {
        model: config.modelId,
        status: state?.status || 'unknown',
        available: state?.status === 'available',
        disabledUntil: state?.disabledUntil ? new Date(state.disabledUntil).toISOString() : null,
        disabledReason: state?.disabledReason || null,
        dailyLimit: config.dailyLimit,
        tokensUsed: state?.tokensUsed || 0,
        requestsUsed: rateData?.count || 0,
        requestsPerMinute: config.requestsPerMinute,
        lastError: state?.lastError ? state.lastError.substring(0, 100) + '...' : null
      };
    }
    
    return status;
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