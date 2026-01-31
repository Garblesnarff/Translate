// client/src/types/pdf.ts

export interface PDFPageContent {
  pageNumber: number;
  text?: string;
  tibetanText?: string;
  englishText?: string;
  confidence?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  error?: string;
  blob?: Blob;
}