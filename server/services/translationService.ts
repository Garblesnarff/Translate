import { GoogleGenerativeAI, GenerateContentResult } from "@google/generative-ai";
import { TibetanDictionary } from '../dictionary';
import { TibetanTextProcessor } from '../textFormatter';
import { createTranslationError } from '../middleware/errorHandler';

export class TranslationService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private dictionary: TibetanDictionary;
  private textProcessor: TibetanTextProcessor;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash-8b",
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 8192,
      }
    });
    this.dictionary = new TibetanDictionary();
    this.textProcessor = new TibetanTextProcessor({
      preserveSanskrit: true,
      formatLineages: true,
      enhancedSpacing: true,
      handleHonorifics: true
    });
  }

  /**
   * Creates a translation prompt with dictionary context
   */
  private async createTranslationPrompt(pageNumber: number, text: string): Promise<string> {
    const dictionaryContext = await this.dictionary.getDictionaryContext();
    return `You are an expert Tibetan translator. Follow these instructions carefully but do not include them in your output.

BACKGROUND INFORMATION (Do not include in output):
You will translate Tibetan text using both your knowledge and a provided dictionary.
First translate using your expertise, then check against the dictionary for any matching terms.

DICTIONARY (Reference only, do not include in output):
${dictionaryContext}

TRANSLATION RULES (Do not include in output):
1. Always translate everything, combining:
   - Dictionary terms: Use exact translations provided
   - Non-dictionary terms: Use your knowledge of Tibetan
2. For Buddhist terms not in dictionary:
   - Include Sanskrit with English explanation
   - Preserve literary style and meaning

OUTPUT FORMAT:
Provide ONLY the translation, starting with:
"## Translation of Tibetan Text (Page ${pageNumber})"
Then the translated text, with:
- One sentence per line
- Bullet points (*) for lists
- Dictionary terms: Use provided English with Tibetan in parentheses
- Key terms: Include Tibetan in parentheses

===== BEGIN TEXT TO TRANSLATE =====
${text}
===== END TEXT TO TRANSLATE =====

Important: Output only the translation, without any instructions or explanations about the process.`;
  }

  /**
   * Processes a translation request with error handling and retries
   */
  public async translateText(chunk: { pageNumber: number; content: string }, timeout: number = 30000): Promise<{
    translation: string;
    confidence: number;
  }> {
    try {
      const prompt = await this.createTranslationPrompt(chunk.pageNumber, chunk.content);
      const result = await Promise.race([
        this.model.generateContent({
          contents: [{ 
            role: "user", 
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8,
            maxOutputTokens: 8192,
            candidateCount: 1,
          },
        }) as Promise<GenerateContentResult>,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Translation timeout')), timeout)
        )
      ]) as GenerateContentResult;

      const response = await result.response;
      const rawTranslation = response.text();
      
      // Calculate confidence based on dictionary term usage
      const dictionaryTerms = rawTranslation.match(/\([^)]+\)/g) || [];
      const confidence = Math.min(0.95, 0.7 + (dictionaryTerms.length * 0.05));

      const processedTranslation = this.textProcessor.processText(rawTranslation);

      return {
        translation: processedTranslation,
        confidence
      };
    } catch (error) {
      throw createTranslationError(
        error instanceof Error ? error.message : 'Translation failed',
        'TRANSLATION_ERROR',
        500,
        error
      );
    }
  }
}

export const translationService = new TranslationService();
