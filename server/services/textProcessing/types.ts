export interface BuddhistTerm {
  sanskrit: string;
  english: string;
  preserveDiacritics: boolean;
}

export interface TextProcessorOptions {
  preserveSanskrit: boolean;
  formatLineages: boolean;
  enhancedSpacing: boolean;
  handleHonorifics: boolean;
}

export interface TranslationOptions {
  simplifyNames?: boolean;
  formatHeaders?: boolean;
  preserveStructure?: boolean;
  preserveLineage?: boolean;
}
