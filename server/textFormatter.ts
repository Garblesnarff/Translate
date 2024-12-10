// textFormatter.ts
interface BuddhistTerm {
  sanskrit: string;
  english: string;
  preserveDiacritics: boolean;
}

interface TextProcessorOptions {
  preserveSanskrit: boolean;
  formatLineages: boolean;
  enhancedSpacing: boolean;
  handleHonorifics: boolean;
}

export class TibetanTextProcessor {
  private static readonly PRESERVED_TERMS: BuddhistTerm[] = [
    { sanskrit: "Dharma", english: "teachings", preserveDiacritics: true },
    { sanskrit: "Karma", english: "action", preserveDiacritics: true },
    { sanskrit: "Buddha", english: "awakened one", preserveDiacritics: true },
    { sanskrit: "Sangha", english: "community", preserveDiacritics: true },
    { sanskrit: "Vajra", english: "diamond-like", preserveDiacritics: true }
  ];

  private static readonly HONORIFIC_MAPPINGS = new Map([
    ["Rinpoche", "Precious One"],
    ["Lama", "Master"],
    ["Geshe", "Learned One"],
    ["Khenpo", "Preceptor"]
  ]);

  private options: TextProcessorOptions;

  constructor(options: Partial<TextProcessorOptions> = {}) {
    this.options = {
      preserveSanskrit: options.preserveSanskrit ?? true,
      formatLineages: options.formatLineages ?? true,
      enhancedSpacing: options.enhancedSpacing ?? true,
      handleHonorifics: options.handleHonorifics ?? true
    };
  }

  public processText(text: string): string {
    let processed = text;

    // Process sections in order
    processed = this.formatHeaders(processed);
    processed = this.processBuddhistTerms(processed);
    processed = this.formatLineages(processed);
    processed = this.enhanceSpacing(processed);
    processed = this.processHonorificTitles(processed);

    return processed;
  }

  private formatHeaders(text: string): string {
    // First clean up any existing malformed headers
    let processed = text.replace(/#{2,}\s*([^#\n]+)#{2,}/g, '## $1');

    // Format section headers consistently
    processed = processed.replace(
      /^(?:##\s*)?([A-Z][^.!?\n]+(?:Lineage|Vows|Empowerment|Teachings|Activities)[^.!?\n]*):?\s*$/gm,
      '\n## $1\n'
    );

    // Clean up multiple consecutive newlines around headers
    processed = processed.replace(/\n{3,}##/g, '\n\n##');
    processed = processed.replace(/##([^\n]+)\n{3,}/g, '## $1\n\n');

    return processed;
  }

  private processBuddhistTerms(text: string): string {
    if (!this.options.preserveSanskrit) return text;

    return TibetanTextProcessor.PRESERVED_TERMS.reduce((processed, term) => {
      // Only add English translation on first occurrence
      const pattern = new RegExp(`\\b${term.sanskrit}\\b(?![^(]*\\))`, 'g');
      let isFirst = true;

      return processed.replace(pattern, (match) => {
        if (isFirst) {
          isFirst = false;
          return `${term.sanskrit} (${term.english})`;
        }
        return term.sanskrit;
      });
    }, text);
  }

  private formatLineages(text: string): string {
    if (!this.options.formatLineages) return text;

    // Format lineage sections
    let processed = text.replace(
      /(?:^|\n)((?:##\s*)?Lineage[^:\n]*:?)([^]*?)(?=\n##|\n\n(?:[A-Z]|$)|$)/gm,
      (match, header, content) => {
        // Clean and format the lineage entries
        const entries = content
          .split('\n')
          .map((line: string) => line.trim())
          .filter(Boolean)
          .map((line: string) => {
            // Remove any existing bullet points or markers
            line = line.replace(/^[*•-]\s*/, '');
            // Handle Sanskrit/Tibetan pairs with translations
            line = line.replace(/\s*\(\s*([^)]+)\s*\)\s*$/, ' ($1)');
            // Add bullet point
            return `* ${line}`;
          });

        return `\n## ${header.replace(/^##\s*/, '').replace(/:$/, '')}\n\n${entries.join('\n')}`;
      }
    );

    // Clean up multiple consecutive newlines
    processed = processed.replace(/\n{3,}/g, '\n\n');

    return processed;
  }

  private enhanceSpacing(text: string): string {
    if (!this.options.enhancedSpacing) return text;

    let processed = text
      // Remove excessive whitespace
      .replace(/[ \t]+$/gm, '')
      .replace(/^[ \t]+/gm, '')

      // Ensure proper spacing around headers
      .replace(/\n*(##[^\n]+)\n*/g, '\n\n$1\n\n')

      // Format list items with proper spacing
      .replace(/(\n\*[^\n]+)(?=\n\*)/g, '$1\n')
      .replace(/(\n\*[^\n]+)(?=\n[^*\n])/g, '$1\n\n')

      // Clean up multiple consecutive blank lines
      .replace(/\n{3,}/g, '\n\n')

      // Ensure proper paragraph spacing
      .replace(/([^\n])\n([A-Z])/g, '$1\n\n$2')

      // Clean up spacing around parenthetical translations
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')

      // Ensure single space after punctuation
      .replace(/([.!?])\s+([A-Z])/g, '$1 $2');

    return processed;
  }

  private processHonorificTitles(text: string): string {
    if (!this.options.handleHonorifics) return text;

    return Array.from(TibetanTextProcessor.HONORIFIC_MAPPINGS.entries())
      .reduce((processed, [tibetan, english]) => {
        const pattern = new RegExp(`\\b${tibetan}\\b(?![^(]*\\))`, 'g');
        return processed.replace(pattern, `${english} (${tibetan})`);
      }, text);
  }
}

// For backward compatibility with existing code
interface TranslationOptions {
  simplifyNames?: boolean;
  formatHeaders?: boolean;
  preserveStructure?: boolean;
  preserveLineage?: boolean;
}

// Export the legacy function that maintains the old interface
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