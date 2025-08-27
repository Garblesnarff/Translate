import { createTranslationError } from '../../middleware/errorHandler';

export interface HelperAIResponse {
  translation: string;
  confidence: number;
  model: string;
  reasoning?: string;
}

export interface TranslationConsensus {
  finalTranslation: string;
  confidence: number;
  modelAgreement: number;
  models: string[];
  individualResponses: HelperAIResponse[];
}

/**
 * Service for integrating multiple AI models to improve translation accuracy
 * Supports Qwen, DeepSeek, and other Chinese AI models that may have better Tibetan capabilities
 */
export class HelperAIService {
  private qwenApiKey: string;
  private deepSeekApiKey: string;
  private enableQwen: boolean;
  private enableDeepSeek: boolean;

  constructor() {
    this.qwenApiKey = process.env.QWEN_API_KEY || '';
    this.deepSeekApiKey = process.env.DEEPSEEK_API_KEY || '';
    this.enableQwen = !!this.qwenApiKey;
    this.enableDeepSeek = !!this.deepSeekApiKey;
    
    if (!this.enableQwen && !this.enableDeepSeek) {
      console.warn('No helper AI services configured. Set QWEN_API_KEY or DEEPSEEK_API_KEY environment variables.');
    }
  }

  /**
   * Translates text using Qwen model (Alibaba's large language model)
   * Qwen models often have good performance on Asian languages including Tibetan
   */
  private async translateWithQwen(tibetanText: string, dictionaryContext: string): Promise<HelperAIResponse> {
    if (!this.enableQwen) {
      throw createTranslationError('Qwen API key not configured', 'QWEN_NOT_CONFIGURED', 500);
    }

    const prompt = this.createQwenPrompt(tibetanText, dictionaryContext);
    
    try {
      const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.qwenApiKey}`,
          'X-DashScope-SSE': 'disable'
        },
        body: JSON.stringify({
          model: 'qwen-max',
          input: {
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          },
          parameters: {
            temperature: 0.1,
            top_p: 0.8,
            max_tokens: 4000,
            result_format: 'message'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Qwen API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.code && data.code !== '200') {
        throw new Error(`Qwen API error: ${data.message || 'Unknown error'}`);
      }

      const translation = data.output?.choices?.[0]?.message?.content || '';
      const confidence = this.calculateQwenConfidence(translation);

      return {
        translation: this.cleanTranslation(translation),
        confidence,
        model: 'qwen-max',
        reasoning: 'Qwen translation with Asian language expertise'
      };
    } catch (error) {
      console.error('Qwen translation error:', error);
      throw createTranslationError(
        `Qwen translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'QWEN_TRANSLATION_ERROR',
        500
      );
    }
  }

  /**
   * Translates text using DeepSeek model
   * DeepSeek models have shown good performance on various language tasks
   */
  private async translateWithDeepSeek(tibetanText: string, dictionaryContext: string): Promise<HelperAIResponse> {
    if (!this.enableDeepSeek) {
      throw createTranslationError('DeepSeek API key not configured', 'DEEPSEEK_NOT_CONFIGURED', 500);
    }

    const prompt = this.createDeepSeekPrompt(tibetanText, dictionaryContext);
    
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deepSeekApiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          top_p: 0.8,
          max_tokens: 4000,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const translation = data.choices?.[0]?.message?.content || '';
      const confidence = this.calculateDeepSeekConfidence(translation);

      return {
        translation: this.cleanTranslation(translation),
        confidence,
        model: 'deepseek-chat',
        reasoning: 'DeepSeek translation with reasoning capabilities'
      };
    } catch (error) {
      console.error('DeepSeek translation error:', error);
      throw createTranslationError(
        `DeepSeek translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'DEEPSEEK_TRANSLATION_ERROR',
        500
      );
    }
  }

  /**
   * Gets translations from all available helper AI models
   */
  public async getHelperTranslations(tibetanText: string, dictionaryContext: string): Promise<HelperAIResponse[]> {
    const translations: Promise<HelperAIResponse>[] = [];
    
    if (this.enableQwen) {
      translations.push(
        this.translateWithQwen(tibetanText, dictionaryContext).catch(error => ({
          translation: '',
          confidence: 0,
          model: 'qwen-max',
          reasoning: `Error: ${error.message}`
        }))
      );
    }

    if (this.enableDeepSeek) {
      translations.push(
        this.translateWithDeepSeek(tibetanText, dictionaryContext).catch(error => ({
          translation: '',
          confidence: 0,
          model: 'deepseek-chat',
          reasoning: `Error: ${error.message}`
        }))
      );
    }

    if (translations.length === 0) {
      return [];
    }

    const results = await Promise.all(translations);
    return results.filter(result => result.translation.length > 0);
  }

  /**
   * Creates optimized prompt for Qwen model
   */
  private createQwenPrompt(tibetanText: string, dictionaryContext: string): string {
    return `You are an expert Tibetan-English translator with deep knowledge of Tibetan Buddhism and culture. Your task is to provide an accurate, natural English translation.

REFERENCE DICTIONARY (use when applicable):
${dictionaryContext}

TRANSLATION GUIDELINES:
1. Translate naturally into English while preserving meaning
2. Use dictionary terms when they provide accurate context
3. For each translated sentence, include the original Tibetan in parentheses
4. Maintain the structure and flow of the original text
5. Handle Buddhist terminology with precision

TEXT TO TRANSLATE:
${tibetanText}

Provide ONLY the translation without explanations:`;
  }

  /**
   * Creates optimized prompt for DeepSeek model
   */
  private createDeepSeekPrompt(tibetanText: string, dictionaryContext: string): string {
    return `You are a skilled Tibetan to English translator. Translate the following Tibetan text accurately and naturally.

REFERENCE DICTIONARY:
${dictionaryContext}

INSTRUCTIONS:
- Translate each sentence into natural English
- Include the original Tibetan text in parentheses after each sentence
- Use dictionary references when appropriate
- Preserve the meaning and context of Buddhist or cultural terms

TIBETAN TEXT:
${tibetanText}

Translation:`;
  }

  /**
   * Calculates confidence score for Qwen translations
   */
  private calculateQwenConfidence(translation: string): number {
    let confidence = 0.7; // Base confidence for Qwen
    
    // Boost confidence based on translation quality indicators
    const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
    confidence += tibetanParens * 0.02;
    
    // Check for proper sentence structure
    if (translation.match(/[.!?]\s*\([^)]*\)/g)) {
      confidence += 0.05;
    }
    
    // Penalize very short or very long translations
    const wordCount = translation.split(/\s+/).length;
    if (wordCount < 5) confidence -= 0.1;
    if (wordCount > 500) confidence -= 0.05;
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Calculates confidence score for DeepSeek translations
   */
  private calculateDeepSeekConfidence(translation: string): number {
    let confidence = 0.75; // Base confidence for DeepSeek
    
    // Similar confidence calculation as Qwen
    const tibetanParens = (translation.match(/\([^)]*[\u0F00-\u0FFF][^)]*\)/g) || []).length;
    confidence += tibetanParens * 0.02;
    
    if (translation.match(/[.!?]\s*\([^)]*\)/g)) {
      confidence += 0.05;
    }
    
    const wordCount = translation.split(/\s+/).length;
    if (wordCount < 5) confidence -= 0.1;
    if (wordCount > 500) confidence -= 0.05;
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Cleans up translation output by removing unwanted prefixes/suffixes
   */
  private cleanTranslation(translation: string): string {
    return translation
      .replace(/^(Translation:|Here's the translation:|\s*)/i, '')
      .replace(/\s*$/g, '')
      .trim();
  }

  /**
   * Checks if helper AI services are available
   */
  public isAvailable(): boolean {
    return this.enableQwen || this.enableDeepSeek;
  }

  /**
   * Gets list of available helper AI models
   */
  public getAvailableModels(): string[] {
    const models: string[] = [];
    if (this.enableQwen) models.push('qwen-max');
    if (this.enableDeepSeek) models.push('deepseek-chat');
    return models;
  }
}

export const helperAIService = new HelperAIService();