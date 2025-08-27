import { TibetanDictionary } from '../../dictionary';

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
 * Advanced prompt generator with multiple prompt strategies for optimal translation quality
 * Supports few-shot examples, chain-of-thought reasoning, and context-aware prompting
 */
export class PromptGenerator {
    private dictionary: TibetanDictionary;
    private readonly fewShotExamples: Array<{ tibetan: string; english: string; category: string }>;

    constructor(dictionary: TibetanDictionary) {
        this.dictionary = dictionary;
        this.fewShotExamples = this.initializeFewShotExamples();
    }

    /**
     * Creates an enhanced translation prompt with dictionary context and specific instructions
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
        const dictionaryContext = await this.dictionary.getDictionaryContext();
        const textType = this.detectTextType(text);
        const selectedExamples = this.selectRelevantExamples(text, textType);
        
        if (options.useChainOfThought) {
            return this.createChainOfThoughtPrompt(text, dictionaryContext, selectedExamples, context);
        }
        
        return this.createStandardPrompt(text, dictionaryContext, selectedExamples, options, context);
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

DICTIONARY REFERENCE (Use when applicable):
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

OUTPUT FORMAT - Follow this exact pattern:
English sentence (Tibetan original)
* Bullet point (Tibetan bullet point)

IMPORTANT: Provide ONLY the translation. No explanations, no process descriptions, no additional commentary.

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

DICTIONARY REFERENCE:
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

IMPORTANT: Provide ONLY the improved translation without any explanation, commentary, or meta-text. Do not include phrases like "Here's an improved translation" or "Key improvements". Simply provide the translation in the requested format: English sentence (Tibetan original)`;
    }

    /**
     * Initializes few-shot examples for different text types
     */
    private initializeFewShotExamples(): Array<{ tibetan: string; english: string; category: string }> {
        return [
            {
                tibetan: "དཀར་ཆགས།",
                english: "Table of Contents (དཀར་ཆགས།)",
                category: "general"
            },
            {
                tibetan: "བྱང་ཆུབ་སེམས་དཔའ་ནི་སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ་བྱང་ཆུབ་ཀྱི་སེམས་བསྐྱེད་པ་ཡིན།",
                english: "A bodhisattva is one who generates the mind of enlightenment for the sake of all sentient beings (བྱང་ཆུབ་སེམས་དཔའ་ནི་སེམས་ཅན་ཐམས་ཅད་ཀྱི་དོན་དུ་བྱང་ཆུབ་ཀྱི་སེམས་བསྐྱེད་པ་ཡིན།)",
                category: "religious"
            },
            {
                tibetan: "སངས་རྒྱས་བཅོམ་ལྡན་འདས་ལ་ཕྱག་འཚལ་ལོ།",
                english: "I bow down to the Buddha, the Blessed One (སངས་རྒྱས་བཅོམ་ལྡན་འདས་ལ་ཕྱག་འཚལ་ལོ།)",
                category: "religious"
            },
            {
                tibetan: "དཔལ་ལྡན་བླ་མ་རིན་པོ་ཆེ་མཆོག",
                english: "The glorious and precious root lama (དཔལ་ལྡན་བླ་མ་རིན་པོ་ཆེ་མཆོག)",
                category: "religious"
            },
            {
                tibetan: "ཆོས་ཀྱི་འཁོར་ལོ་བསྐོར་བ།",
                english: "Turning the wheel of Dharma (ཆོས་ཀྱི་འཁོར་ལོ་བསྐོར་བ།)",
                category: "religious"
            },
            {
                tibetan: "གཞུང་ལུགས་ཀྱི་སློབ་གྲུབ།",
                english: "Traditional scholarly system (གཞུང་ལུགས་ཀྱི་སློབ་གྲུབ།)",
                category: "philosophical"
            },
            {
                tibetan: "ལོ་རྒྱུས་ཤེས་བྱ་མཁས་པའི་མགུལ་རྒྱན།",
                english: "Historical knowledge, the ornament of the learned (ལོ་རྒྱུས་ཤེས་བྱ་མཁས་པའི་མགུལ་རྒྱན།)",
                category: "historical"
            }
        ];
    }

    /**
     * Selects relevant examples based on text content
     */
    private selectRelevantExamples(
        text: string, 
        textType: string
    ): Array<{ tibetan: string; english: string; category: string }> {
        let relevantExamples = this.fewShotExamples.filter(
            example => example.category === textType
        );
        
        // If no specific examples found, include general ones
        if (relevantExamples.length === 0) {
            relevantExamples = this.fewShotExamples.filter(
                example => example.category === 'general'
            );
        }
        
        // Add at least one religious example for Buddhist texts
        if (this.containsBuddhistTerms(text) && !relevantExamples.some(ex => ex.category === 'religious')) {
            const religiousExample = this.fewShotExamples.find(ex => ex.category === 'religious');
            if (religiousExample) {
                relevantExamples.push(religiousExample);
            }
        }
        
        return relevantExamples.slice(0, 3); // Limit to 3 examples
    }

    /**
     * Detects the type of text being translated
     */
    private detectTextType(text: string): string {
        // Religious indicators
        const religiousTerms = ['བླ་མ', 'སངས་རྒྱས', 'ཆོས', 'བྱང་ཆུབ', 'རིན་པོ་ཆེ', 'དགོན་མཆོག'];
        const hasReligiousTerms = religiousTerms.some(term => text.includes(term));
        
        // Philosophical indicators
        const philosophicalTerms = ['གཞུང་ལུགས', 'རིག་པ', 'ཤེས་རབ', 'མཐའ་དཔྱོད'];
        const hasPhilosophicalTerms = philosophicalTerms.some(term => text.includes(term));
        
        // Historical indicators
        const historicalTerms = ['ལོ་རྒྱུས', 'དུས་རབས', 'རྒྱལ་པོ', 'སྐབས'];
        const hasHistoricalTerms = historicalTerms.some(term => text.includes(term));
        
        if (hasReligiousTerms) return 'religious';
        if (hasPhilosophicalTerms) return 'philosophical';
        if (hasHistoricalTerms) return 'historical';
        return 'general';
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
}