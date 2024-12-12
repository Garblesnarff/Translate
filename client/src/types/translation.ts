// File: /client/src/types/translation.ts

export interface TranslationError {
  message: string;
  code?: string;
}

export interface TranslationPage {
  pageNumber: number;
  text: string;
}

export interface TranslationState {
  pages: TranslationPage[];
  currentPage: number;
  error?: TranslationError | null;
}