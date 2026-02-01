import { TibetanDictionary, ExtendedDictionaryEntry } from '../../dictionary';
import { ExampleSelector, TranslationExample } from './ExampleSelector';

export interface PromptOptions {
  includeContext?: boolean;
  contextWindow?: number;
  iterationPass?: number;
  previousTranslations?: string[];
  useChainOfThought?: boolean;
}

export interface TranslationContext {
  previousChunks?: Array<{ text: string; translation: string }>;
  nextChunks?: Array<{ text: string }>;
  documentTitle?: string;
  textType?: 'religious' | 'philosophical' | 'historical' | 'general';
}

/**
 * Advanced prompt generator with dynamic few-shot example selection
 * Supports embedding-based example selection, chain-of-thought reasoning, and context-aware prompting
 */
export class PromptGenerator {
    private dictionary: TibetanDictionary;
    private exampleSelector: ExampleSelector;
    private exampleSelectorInitialized: boolean = false;

    constructor(dictionary: TibetanDictionary, geminiApiKey?: string) {
        this.dictionary = dictionary;
        this.exampleSelector = new ExampleSelector(geminiApiKey);
        // Initialize example selector asynchronously
        this.initializeExampleSelector();
    }

    /**
     * Initialize the example selector
     */
    private async initializeExampleSelector(): Promise<void> {
        try {
            await this.exampleSelector.initialize();
            this.exampleSelectorInitialized = true;
            const stats = this.exampleSelector.getStatistics();
            console.log(`[PromptGenerator] Initialized with ${stats.totalExamples} examples (${stats.examplesWithEmbeddings} with embeddings)`);
        } catch (error) {
            console.error('[PromptGenerator] Failed to initialize example selector:', error);
            this.exampleSelectorInitialized = false;
        }
    }

    /**
     * Creates an enhanced translation prompt with dictionary context and dynamic examples
     * @param pageNumber - The page number being translated
     * @param text - The text to translate
     * @param options - Additional prompt options
     * @param context - Translation context for better continuity
     * @returns A formatted prompt string
     */
    public async createTranslationPrompt(
        pageNumber: number,
        text: string,
        options: PromptOptions = {},
        context?: TranslationContext
    ): Promise<string> {
        // Extract relevant dictionary terms from the input text
        const relevantTerms = await this.extractRelevantTerms(text);
        const dictionaryContext = this.formatDictionaryContext(relevantTerms);
        const textType = this.detectTextType(text);
        const selectedExamples = await this.selectRelevantExamples(text, textType);

        if (options.useChainOfThought) {
            return this.createChainOfThoughtPrompt(text, dictionaryContext, selectedExamples, context);
        }

        return this.createStandardPrompt(text, dictionaryContext, selectedExamples, options, context);
    }

    /**
     * Extract relevant dictionary terms found in the input text
     * Returns top 20 most relevant terms, prioritizing common terms
     */
    private async extractRelevantTerms(text: string): Promise<ExtendedDictionaryEntry[]> {
        try {
            return await this.dictionary.extractRelevantTerms(text, 20);
        } catch (error) {
            console.error("Failed to extract relevant terms:", error);
            return [];
        }
    }

    /**
     * Format dictionary entries for inclusion in prompt
     * Only includes terms actually found in the text for efficiency
     */
    private formatDictionaryContext(terms: ExtendedDictionaryEntry[]): string {
        if (terms.length === 0) {
            return "No specific dictionary terms found in this text.";
        }

        let context = `KEY TERMS IN THIS TEXT (${terms.length} relevant terms found):\n\n`;

        for (const term of terms) {
            context += `• ${term.tibetan} (${term.english})`;

            // Add Wylie transliteration if available
            if (term.wylie) {
                context += ` [${term.wylie}]`;
            }

            // Add Sanskrit if available
            if (term.sanskrit) {
                context += ` — Sanskrit: ${term.sanskrit}`;
            }

            // Add alternate translations if available
            if (term.alternateTranslations && term.alternateTranslations.length > 0) {
                context += ` — Also: ${term.alternateTranslations.join(', ')}`;
            }

            // Add context/usage note
            if (term.context) {
                context += `\n  Context: ${term.context}`;
            }

            context += '\n';
        }

        context += '\nIMPORTANT: Use these terms consistently throughout your translation.\n';

        return context;
    }

    /**
     * Creates a standard enhanced prompt with few-shot examples
     */
    private createStandardPrompt(
        text: string, 
        dictionaryContext: string, 
        examples: Array<{ tibetan: string; english: string; category: string }>,
        options: PromptOptions,
        context?: TranslationContext
    ): string {
        const contextSection = this.buildContextSection(context);
        const examplesSection = this.buildExamplesSection(examples);
        const iterationGuidance = this.getIterationGuidance(options.iterationPass || 1);
        
        return `You are an expert Tibetan-English translator specializing in Buddhist texts and Tibetan literature. Your translations are known for accuracy, natural flow, and proper preservation of original meaning.

${contextSection}

${dictionaryContext}

${examplesSection}

TRANSLATION GUIDELINES:
1. Translate each sentence naturally into English while preserving the original meaning
2. Include the original Tibetan text in parentheses immediately after each translated sentence
3. Use dictionary terms when they provide accurate contextual translations
4. Maintain consistency with any previous translations in the document
5. Preserve the structure and formatting of the original text
6. Handle Buddhist and technical terms with precision
${iterationGuidance}

**OUTPUT FORMAT REQUIREMENTS (CRITICAL):**

✓ CORRECT FORMAT:
  The Buddha taught the Dharma (སངས་རྒྱས་ཀྱིས་ཆོས་གསུངས།).
  A bodhisattva generates compassion for all beings (བྱང་ཆུབ་སེམས་དཔའ་ནི་སེམས་ཅན་ཐམས་ཅད་ལ་སྙིང་རྗེ་བསྐྱེད།).

✗ INCORRECT - DO NOT DO THIS:
  - NO meta-text: "Translation:", "Here is the translation:", "Output:"
  - NO explanations: "I have translated the text as follows..."
  - NO code blocks: \`\`\` or markdown formatting
  - NO Tibetan outside parentheses
  - NO unbalanced parentheses
  - NO English text inside Tibetan parentheses
  - NO apologies: "I cannot translate" or "I apologize"

**STRICT RULES:**
1. Each English phrase MUST be immediately followed by (Tibetan text)
2. ALL Tibetan text MUST be inside parentheses
3. ALL parentheses MUST contain Tibetan text
4. NO additional commentary, notes, or explanations
5. Start IMMEDIATELY with the translation - no preamble

IMPORTANT: Provide ONLY the translation in the exact format shown above. Nothing else.

TEXT TO TRANSLATE:
${text}

Translation:`;
    }

    /**
     * Creates a chain-of-thought prompt for complex passages
     */
    private createChainOfThoughtPrompt(
        text: string, 
        dictionaryContext: string, 
        examples: Array<{ tibetan: string; english: string; category: string }>,
        context?: TranslationContext
    ): string {
        return `You are an expert Tibetan translator. For this complex passage, work through your translation step by step.

${dictionaryContext}

TRANSLATION PROCESS:
1. First, identify key terms and their meanings
2. Analyze the sentence structure and grammar
3. Consider the context and cultural implications
4. Create a natural English translation
5. Verify accuracy and include Tibetan original in parentheses

EXAMPLE PROCESS:
Tibetan: ཆོས་ཀྱི་རྒྱལ་པོ།
Step 1: Key terms - ཆོས (dharma/law), རྒྱལ་པོ (king)
Step 2: Structure - possessive construction
Step 3: Context - Buddhist terminology, refers to righteous ruler
Step 4: Translation - "Dharma King" or "righteous king"
Final: Dharma King (ཆོས་ཀྱི་རྒྱལ་པོ།)

Now translate this text using the same careful process:
${text}

Final Translation:`;
    }

    /**
     * Creates a refinement prompt for iterative improvement
     */
    public createRefinementPrompt(
        originalText: string, 
        previousTranslation: string, 
        focusAreas: string[] = []
    ): string {
        const focusGuidance = focusAreas.length > 0 
            ? `\n\nSPECIFIC FOCUS AREAS:\n${focusAreas.map(area => `- ${area}`).join('\n')}` 
            : '';
            
        return `You are reviewing and improving a Tibetan translation. Your task is to enhance accuracy, naturalness, and consistency while maintaining the original meaning.

ORIGINAL TIBETAN:
${originalText}

PREVIOUS TRANSLATION:
${previousTranslation}

IMPROVEMENT GUIDELINES:
1. Verify accuracy of Buddhist and technical terms
2. Improve English flow and naturalness
3. Ensure Tibetan original is preserved in parentheses
4. Maintain consistency with standard terminology
5. Fix any grammatical or structural issues${focusGuidance}

**FORMAT REQUIREMENTS (MUST FOLLOW):**
✓ CORRECT: English text (Tibetan text)
✗ WRONG: "Translation:", "Here's an improved version:", explanations, code blocks

**CRITICAL RULES:**
1. Output ONLY the translation - no preamble, no explanation
2. ALL Tibetan MUST be in parentheses
3. NO meta-text like "Translation:" or "Here is"
4. Start immediately with the first sentence

IMPORTANT: Provide ONLY the improved translation in format: English sentence (Tibetan original). Nothing else.`;
    }

    /**
     * Selects relevant examples using dynamic selection with embeddings
     * Falls back to keyword matching if embeddings not available
     */
    private async selectRelevantExamples(
        text: string,
        textType: string
    ): Promise<Array<{ tibetan: string; english: string; category: string }>> {
        if (!this.exampleSelectorInitialized) {
            console.warn('[PromptGenerator] Example selector not initialized, using fallback examples');
            return this.getFallbackExamples(textType);
        }

        try {
            // Use dynamic selection with category preference
            const examples = await this.exampleSelector.selectExamples(text, {
                count: 3,
                preferCategory: textType,
                ensureDiversity: true,
                minSimilarity: 0.25 // Lower threshold for more matches
            });

            // Convert to format expected by prompt builders
            return examples.map(ex => ({
                tibetan: ex.tibetan,
                english: ex.english,
                category: ex.category
            }));
        } catch (error) {
            console.error('[PromptGenerator] Failed to select examples dynamically:', error);
            return this.getFallbackExamples(textType);
        }
    }

    /**
     * Fallback examples when dynamic selection fails
     */
    private getFallbackExamples(textType: string): Array<{ tibetan: string; english: string; category: string }> {
        const fallbackExamples = [
            {
                tibetan: "བྱང་ཆུབ་སེམས་དཔའ་ནི་སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ་བྱང་ཆུབ་ཀྱི་སེམས་བསྐྱེད་པ་ཡིན།",
                english: "A bodhisattva is one who generates the mind of enlightenment for the sake of all sentient beings (བྱང་ཆུབ་སེམས་དཔའ་ནི་སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ་བྱང་ཆུབ་ཀྱི་སེམས་བསྐྱེད་པ་ཡིན།)",
                category: "philosophy"
            },
            {
                tibetan: "སངས་རྒྱས་བཅོམ་ལྡན་འདས་ལ་ཕྱག་འཚལ་ལོ།",
                english: "I bow down to the Buddha, the Blessed One (སངས་རྒྱས་བཅོམ་ལྡན་འདས་ལ་ཕྱག་འཚལ་ལོ།)",
                category: "prayer"
            },
            {
                tibetan: "དཀར་ཆགས།",
                english: "Table of Contents (དཀར་ཆགས།)",
                category: "general"
            }
        ];

        // Filter by category if possible
        const filtered = fallbackExamples.filter(ex => ex.category === textType);
        return filtered.length > 0 ? filtered : fallbackExamples;
    }

    /**
     * Enhanced text type detection with multi-factor analysis
     * Analyzes vocabulary, grammar patterns, and structural features
     */
    private detectTextType(text: string): string {
        const scores: Record<string, number> = {
            prayer: 0,
            philosophy: 0,
            biographical: 0,
            instructional: 0,
            historical: 0,
            letters: 0,
            general: 0
        };

        // Prayer indicators (prostrations, invocations, aspirations)
        const prayerTerms = ['ཕྱག་འཚལ', 'སྐྱབས་སུ་མཆི', 'གསོལ་བ་འདེབས', 'བདེ་བ་དང་ལྡན', 'བྱིན་རླབས', 'མཆོད་པ', 'སྨོན་ལམ'];
        scores.prayer = prayerTerms.filter(term => text.includes(term)).length * 2;

        // Prayer sentence patterns
        if (text.includes('གྱུར་ཅིག') || text.includes('པར་ཤོག')) scores.prayer += 2;
        if (text.includes('ལ་ཕྱག་འཚལ') || text.includes('ལ་གསོལ་བ')) scores.prayer += 2;

        // Philosophy indicators (emptiness, logic, analysis)
        const philosophyTerms = ['སྟོང་པ་ཉིད', 'རང་བཞིན', 'རྟེན་འབྲེལ', 'དབུ་མ', 'ཤེས་རབ', 'ཚད་མ', 'ཆོས་ཉིད', 'རིག་པ'];
        scores.philosophy = philosophyTerms.filter(term => text.includes(term)).length * 2;

        // Complex philosophical constructions
        if (text.includes('གྲུབ་མཐའ') || text.includes('ལྟ་བ')) scores.philosophy += 1;

        // Biographical indicators (names, dates, life events)
        const biographicalTerms = ['རྣམ་ཐར', 'སྐུ་འཁྲུངས', 'སྐུ་དགུང', 'བཞུགས', 'སློབ་མ', 'བླ་མ་དམ་པ', 'མཛད'];
        scores.biographical = biographicalTerms.filter(term => text.includes(term)).length * 2;

        // Personal titles and honorifics
        if (text.includes('རྗེ་བཙུན') || text.includes('པཎ་ཆེན')) scores.biographical += 2;

        // Instructional indicators (commands, procedures)
        const instructionalTerms = ['དགོས', 'བྱ་རྒྱུ', 'བགྱིད', 'བསམ་གཏན', 'ཉམས་ལེན', 'སྔགས་བཟླ', 'མཆོད་པ་འབུལ'];
        scores.instructional = instructionalTerms.filter(term => text.includes(term)).length * 2;

        // Imperative constructions
        if (text.includes('དགོས་ལ') || text.includes('བྱ་དགོས')) scores.instructional += 2;
        if (text.includes('དང་པོར') || text.includes('དེ་ནས')) scores.instructional += 1;

        // Historical indicators (dates, events, dynasties)
        const historicalTerms = ['ལོ་རྒྱུས', 'དུས་རབས', 'རྒྱལ་པོ', 'བཙུགས', 'དགོན་པ', 'ལོ་ངོ', 'སྔོན'];
        scores.historical = historicalTerms.filter(term => text.includes(term)).length * 2;

        // Date patterns
        if (/[༠-༩]{3,4}/.test(text) || text.includes('ལོ་') || text.includes('སྐབས')) scores.historical += 2;

        // Letter indicators (greetings, communication phrases)
        const letterTerms = ['བཀྲིས་བདེ་ལེགས', 'ཁྱེད་ཀྱི', 'ངས་', 'གསོལ', 'ཐུགས་རྗེ་ཆེ', 'སྡིང་ཁ', 'བརྗོད་དོན'];
        scores.letters = letterTerms.filter(term => text.includes(term)).length * 2;

        // First/second person pronouns
        if (text.includes('ང་ཚོ') || text.includes('ངས་')) scores.letters += 1;

        // General/administrative indicators
        const generalTerms = ['དཀར་ཆགས', 'ལེའུ', 'དཔེ་དེབ', 'གནས་ཚུལ', 'ཚོགས་འདུ', 'ལས་དོན'];
        scores.general = generalTerms.filter(term => text.includes(term)).length * 2;

        // Find highest scoring category
        let maxCategory = 'general';
        let maxScore = 0;

        for (const [category, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxCategory = category;
            }
        }

        // Require minimum score threshold, otherwise default to general
        if (maxScore < 2) {
            return 'general';
        }

        console.log(`[PromptGenerator] Detected text type: ${maxCategory} (score: ${maxScore})`);
        return maxCategory;
    }

    /**
     * Checks if text contains Buddhist terms
     */
    private containsBuddhistTerms(text: string): boolean {
        const buddhistTerms = ['སངས་རྒྱས', 'བྱང་ཆུབ', 'བོ་ཎི', 'ཆོས', 'དགེ', 'བསོད་ནམས', 'སེམས་ཅན'];
        return buddhistTerms.some(term => text.includes(term));
    }

    /**
     * Builds context section for the prompt
     */
    private buildContextSection(context?: TranslationContext): string {
        if (!context) return '';
        
        let contextSection = '';
        
        if (context.documentTitle) {
            contextSection += `\nDOCUMENT: ${context.documentTitle}`;
        }
        
        if (context.previousChunks && context.previousChunks.length > 0) {
            contextSection += '\n\nPREVIOUS CONTEXT:';
            context.previousChunks.forEach((chunk, index) => {
                contextSection += `\n${index + 1}. ${chunk.translation}`;
            });
        }
        
        if (context.nextChunks && context.nextChunks.length > 0) {
            contextSection += '\n\nUPCOMING CONTEXT:';
            context.nextChunks.forEach((chunk, index) => {
                contextSection += `\n${index + 1}. ${chunk.text.substring(0, 100)}...`;
            });
        }
        
        return contextSection;
    }

    /**
     * Builds examples section for the prompt
     */
    private buildExamplesSection(
        examples: Array<{ tibetan: string; english: string; category: string }>
    ): string {
        if (examples.length === 0) return '';
        
        let examplesSection = '\nTRANSLATION EXAMPLES:';
        examples.forEach((example, index) => {
            examplesSection += `\n${index + 1}. ${example.english}`;
        });
        
        return examplesSection;
    }

    /**
     * Gets iteration-specific guidance
     */
    private getIterationGuidance(iteration: number): string {
        switch (iteration) {
            case 1:
                return '';
            case 2:
                return '\n7. This is a refinement pass - focus on improving accuracy and naturalness';
            case 3:
                return '\n7. This is a final review - ensure terminology consistency and perfect formatting';
            default:
                return '\n7. This is an advanced refinement - focus on subtle meaning and cultural nuance';
        }
    }

    // ============================================
    // New methods cherry-picked from PR #1
    // ============================================

    /**
     * Creates a prompt to extract a glossary of key terms from Tibetan text.
     * Returns JSON mapping Tibetan terms to English translations.
     *
     * @param text - The Tibetan text to extract terms from
     * @returns A formatted prompt string
     */
    public createGlossaryExtractionPrompt(text: string): string {
        return `You are a linguistic analyst specializing in classical Tibetan texts. Your task is to identify key terms, names, and important concepts in the following text and provide their English translations.

TEXT:
${text}

INSTRUCTIONS:
1. Identify up to 10 key terms, proper names, or significant concepts.
2. For each term, provide a concise and accurate English translation.
3. Prioritize:
   - Proper names (people, places, texts)
   - Technical Buddhist terminology
   - Recurring important concepts
4. Return the results as a single JSON object where keys are the Tibetan terms and values are their English translations.
5. Ensure the output is valid JSON with no additional text.

EXAMPLE OUTPUT:
{
  "ཆོས་ཀྱི་རྒྱལ་པོ": "Dharma King",
  "བྱང་ཆུབ་སེམས་དཔའ": "Bodhisattva",
  "རྗེ་བཙུན་མི་ལ་རས་པ": "Jetsun Milarepa"
}

JSON_GLOSSARY:`;
    }

    /**
     * Creates a prompt for an expert to critique a translation.
     * Used by the panel of experts quality gate.
     *
     * @param originalText - The original Tibetan text
     * @param translation - The English translation to critique
     * @param expert - The expert persona (e.g., 'Historian', 'Linguist', 'Religious Scholar')
     * @returns A formatted prompt string
     */
    public createCritiquePrompt(originalText: string, translation: string, expert: string): string {
        const expertGuidance = this.getExpertGuidance(expert);

        return `You are a world-renowned ${expert} with deep expertise in Tibetan literature and Buddhist studies. Your task is to review the following translation and provide a concise critique from your expert perspective.

ORIGINAL TIBETAN:
${originalText}

ENGLISH TRANSLATION:
${translation}

YOUR EXPERTISE AS ${expert.toUpperCase()}:
${expertGuidance}

INSTRUCTIONS:
1. As a ${expert}, identify any potential inaccuracies, inconsistencies, or areas for improvement.
2. Focus on aspects relevant to your field.
3. If you find no significant issues, respond with exactly: "No significant issues found."
4. If you find issues, describe them concisely in 2-3 sentences.
5. Be constructive - suggest improvements where possible.

CRITIQUE:`;
    }

    /**
     * Get expertise-specific guidance for critique prompts
     */
    private getExpertGuidance(expert: string): string {
        const guidance: Record<string, string> = {
            'Historian': 'Focus on historical accuracy, proper names, dates, places, and historical context. Verify that events and figures are correctly identified.',
            'Linguist': 'Focus on grammar, syntax, word choice, and natural English flow. Check that the translation accurately conveys the structure and nuances of the original.',
            'Religious Scholar': 'Focus on Buddhist terminology, doctrinal accuracy, and proper understanding of religious concepts. Ensure technical terms are correctly translated.',
            'Tibetologist': 'Focus on Tibetan language accuracy, proper rendering of Tibetan terms, and cultural context specific to Tibetan Buddhism.',
            'Philosopher': 'Focus on logical consistency, philosophical concepts, and accurate representation of Buddhist philosophical views.'
        };

        return guidance[expert] || `Focus on accuracy and quality from your perspective as a ${expert}.`;
    }

    /**
     * Builds a reference translations section for inclusion in prompts.
     * Used for in-context learning with gold standard examples.
     *
     * @param references - Array of reference translation pairs
     * @returns A formatted reference section string
     */
    public buildReferenceSection(
        references?: Array<{ source: string; translation: string; context?: string }>
    ): string {
        if (!references || references.length === 0) {
            return '';
        }

        let referenceSection = '\nREFERENCE TRANSLATIONS (Use as style and terminology guide):\n';

        references.forEach((ref, index) => {
            referenceSection += `\nExample ${index + 1}:`;
            if (ref.context) {
                referenceSection += ` [${ref.context}]`;
            }
            referenceSection += `\nTibetan: ${ref.source}`;
            referenceSection += `\nEnglish: ${ref.translation}\n`;
        });

        return referenceSection;
    }
}