import { TextProcessorOptions, TranslationOptions } from './types';
import { HeaderFormatter } from './HeaderFormatter';
import { LineageFormatter } from './LineageFormatter';
import { SpacingEnhancer } from './SpacingEnhancer';
import { TermProcessor } from './TermProcessor';

/**
 * Main text processing service that coordinates various formatting and processing operations
 */
export class TibetanTextProcessor {
  private readonly headerFormatter: HeaderFormatter;
  private readonly lineageFormatter: LineageFormatter;
  private readonly spacingEnhancer: SpacingEnhancer;
  private readonly termProcessor: TermProcessor;
  private readonly options: TextProcessorOptions;

  constructor(options: Partial<TextProcessorOptions> = {}) {
    this.options = {
      preserveSanskrit: options.preserveSanskrit ?? true,
      formatLineages: options.formatLineages ?? true,
      enhancedSpacing: options.enhancedSpacing ?? true,
      handleHonorifics: options.handleHonorifics ?? true
    };

    this.headerFormatter = new HeaderFormatter();
    this.lineageFormatter = new LineageFormatter();
    this.spacingEnhancer = new SpacingEnhancer();
    this.termProcessor = new TermProcessor();
  }

  /**
   * Processes the input text applying all enabled formatting and processing operations
   * @param text - The text to process
   * @returns The fully processed text
   */
  public processText(text: string): string {
    let processed = text;

    // Process sections in order
    processed = this.headerFormatter.format(processed);
    if (this.options.preserveSanskrit) {
      processed = this.termProcessor.processBuddhistTerms(processed);
    }
    if (this.options.formatLineages) {
      processed = this.lineageFormatter.format(processed);
    }
    if (this.options.enhancedSpacing) {
      processed = this.spacingEnhancer.enhance(processed);
    }
    if (this.options.handleHonorifics) {
      processed = this.termProcessor.processHonorificTitles(processed);
    }

    return processed;
  }
}

/**
 * Legacy function for backward compatibility
 */
export function formatTibetanTranslation(
  text: string | { translatedText: string },
  options: TranslationOptions = {}
): string {
  const processor = new TibetanTextProcessor({
    preserveSanskrit: true,
    formatLineages: options.preserveLineage ?? true,
    enhancedSpacing: options.preserveStructure ?? true,
    handleHonorifics: !options.simplifyNames
  });

  const inputText = typeof text === 'string' ? text : text.translatedText;
  const processed = processor.processText(inputText);

  return typeof text === 'string' ? processed : JSON.stringify({ translatedText: processed });
}
