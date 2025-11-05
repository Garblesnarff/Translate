/**
 * PromptGenerator V2
 *
 * Generates specialized prompts for Tibetan translation including:
 * - Relevant dictionary terms (from DictionaryService)
 * - 3 similar translation examples (from ExampleSelector)
 * - Format instructions
 * - Context preservation instructions
 *
 * @module server/services/translation/PromptGeneratorV2
 */

/**
 * Dictionary entry structure
 */
export interface DictionaryTerm {
  tibetan: string;
  english: string;
  wylie?: string;
  sanskrit?: string;
  category?: string;
  frequency?: string;
  context?: string;
}

/**
 * Translation example structure
 */
export interface TranslationExample {
  id: string;
  tibetan: string;
  english: string;
  category: string;
}

/**
 * Options for prompt generation
 */
export interface PromptOptions {
  dictionaryTerms?: DictionaryTerm[];
  examples?: TranslationExample[];
}

/**
 * PromptGenerator creates specialized prompts for Tibetan translation.
 *
 * The generated prompt includes:
 * - Clear translation instructions
 * - Format requirements (English with Tibetan in parentheses)
 * - Relevant dictionary terms for context
 * - Similar translation examples for few-shot learning
 * - Context preservation guidelines
 *
 * @example
 * ```typescript
 * const generator = new PromptGenerator();
 *
 * const prompt = await generator.generate(
 *   "བཀྲ་ཤིས་བདེ་ལེགས།",
 *   {
 *     dictionaryTerms: [
 *       { tibetan: "བཀྲ་ཤིས", english: "auspicious" },
 *       { tibetan: "བདེ་ལེགས", english: "well-being" }
 *     ],
 *     examples: [
 *       {
 *         id: "ex-1",
 *         tibetan: "ཐུགས་རྗེ་ཆེ།",
 *         english: "Thank you (ཐུགས་རྗེ་ཆེ།).",
 *         category: "greeting"
 *       }
 *     ]
 *   }
 * );
 * ```
 */
export class PromptGenerator {
  /**
   * Generate a specialized prompt for Tibetan translation.
   *
   * @param text - Tibetan text to translate
   * @param options - Dictionary terms and examples
   * @returns Formatted prompt string
   */
  async generate(text: string, options: PromptOptions = {}): Promise<string> {
    const { dictionaryTerms = [], examples = [] } = options;

    // Build prompt sections
    const sections: string[] = [];

    // 1. System instructions
    sections.push(this.getSystemInstructions());

    // 2. Format requirements
    sections.push(this.getFormatInstructions());

    // 3. Dictionary context (if available)
    if (dictionaryTerms.length > 0) {
      sections.push(this.formatDictionarySection(dictionaryTerms));
    }

    // 4. Translation examples (if available)
    if (examples.length > 0) {
      sections.push(this.formatExamplesSection(examples));
    }

    // 5. Context preservation guidelines
    sections.push(this.getContextGuidelines());

    // 6. The actual translation task
    sections.push(this.getTranslationTask(text));

    return sections.join('\n\n');
  }

  /**
   * Get system-level instructions for the AI model.
   *
   * @returns System instructions
   */
  private getSystemInstructions(): string {
    return `You are an expert Tibetan-to-English translator specializing in accurate, context-aware translations of Tibetan texts.

Your task is to translate Tibetan text into natural, fluent English while preserving:
- The original Tibetan text in parentheses
- Cultural and religious context
- Technical terminology
- Stylistic nuances`;
  }

  /**
   * Get format requirements for translation output.
   *
   * @returns Format instructions
   */
  private getFormatInstructions(): string {
    return `## FORMAT REQUIREMENTS

CRITICAL: You must follow this exact format:

✓ CORRECT: "May you be well (བདེ་ལེགས་སུ་གྱུར་ཅིག)."
✓ CORRECT: "Homage to the Buddha (སངས་རྒྱས་ལ་ཕྱག་འཚལ་ལོ།)."

✗ WRONG: "May you be well བདེ་ལེགས་སུ་གྱུར་ཅིག"
✗ WRONG: "བདེ་ལེགས་སུ་གྱུར་ཅིག (May you be well)"

Rules:
1. Write English translation first
2. Include original Tibetan in parentheses immediately after
3. Preserve Tibetan punctuation (།, ༎)
4. Maintain sentence structure and flow`;
  }

  /**
   * Format dictionary terms section.
   *
   * @param terms - Array of relevant dictionary terms
   * @returns Formatted dictionary section
   */
  private formatDictionarySection(terms: DictionaryTerm[]): string {
    let section = `## RELEVANT TERMS IN THIS TEXT\n\nThe following ${terms.length} terms appear in the text you're translating:\n\n`;

    terms.forEach((term, index) => {
      section += `${index + 1}. བོད་ཡིག: ${term.tibetan}\n`;
      section += `   English: ${term.english}\n`;

      if (term.wylie) {
        section += `   Wylie: ${term.wylie}\n`;
      }

      if (term.sanskrit) {
        section += `   Sanskrit: ${term.sanskrit}\n`;
      }

      if (term.category) {
        section += `   Category: ${term.category}\n`;
      }

      if (term.context) {
        section += `   Context: ${term.context}\n`;
      }

      section += '\n';
    });

    section += 'Use these terms to inform your translation, ensuring consistency and accuracy.';

    return section;
  }

  /**
   * Format translation examples section.
   *
   * @param examples - Array of similar translation examples
   * @returns Formatted examples section
   */
  private formatExamplesSection(examples: TranslationExample[]): string {
    let section = `## TRANSLATION EXAMPLES\n\nHere are ${examples.length} similar translations for reference:\n\n`;

    examples.forEach((example, index) => {
      section += `Example ${index + 1} (${example.category}):\n`;
      section += `Tibetan: ${example.tibetan}\n`;
      section += `English: ${example.english}\n\n`;
    });

    section += 'Follow the style and format demonstrated in these examples.';

    return section;
  }

  /**
   * Get context preservation guidelines.
   *
   * @returns Context guidelines
   */
  private getContextGuidelines(): string {
    return `## CONTEXT PRESERVATION GUIDELINES

1. **Religious Terms**: Preserve Buddhist terminology (dharma, karma, sangha)
2. **Sanskrit**: Keep Sanskrit terms when appropriate (སངས་རྒྱས = Buddha, not "awakened one")
3. **Honorifics**: Respect Tibetan honorific levels in translation
4. **Poetry**: Maintain poetic structure when translating verse
5. **Numbers**: Convert Tibetan numerals (༡༢༣) to Arabic (123) or spell out as context requires
6. **Names**: Keep proper names in Tibetan with English approximation if needed

Remember: The goal is fluent English that honors the original meaning and context.`;
  }

  /**
   * Get the translation task with the input text.
   *
   * @param text - Tibetan text to translate
   * @returns Translation task prompt
   */
  private getTranslationTask(text: string): string {
    return `## TRANSLATION TASK

Please translate the following Tibetan text to English:

${text}

Remember to:
- Provide natural, fluent English
- Include the original Tibetan in parentheses after each clause or sentence
- Use the dictionary terms and examples above for guidance
- Preserve cultural and religious context
- Follow the exact format requirements

Your translation:`;
  }
}
