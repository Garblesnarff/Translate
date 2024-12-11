import { TibetanDictionary } from '../../dictionary';

/**
 * Responsible for generating translation prompts with appropriate context and instructions
 */
export class PromptGenerator {
  private dictionary: TibetanDictionary;

  constructor(dictionary: TibetanDictionary) {
    this.dictionary = dictionary;
  }

  /**
   * Creates a translation prompt with dictionary context and specific instructions
   * @param pageNumber - The page number being translated
   * @param text - The text to translate
   * @returns A formatted prompt string
   */
  public async createTranslationPrompt(pageNumber: number, text: string): Promise<string> {
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
Provide ONLY the translation with:
- One sentence per line
- Bullet points (*) for lists
- Dictionary terms: Use provided English with Tibetan in parentheses
- Key terms: Include Tibetan in parentheses

===== BEGIN TEXT TO TRANSLATE =====
${text}
===== END TEXT TO TRANSLATE =====

Important: Output only the translation, without any instructions or explanations about the process.`;
  }
}
