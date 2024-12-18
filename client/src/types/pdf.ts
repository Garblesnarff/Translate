// client/src/types/pdf.ts

export interface PDFPageContent {
  pageNumber: number;
  text: string;
}

export interface PDFGenerationResult {
  success: boolean;
  error?: string;
  blob?: Blob;
}