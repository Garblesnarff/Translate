
import { jsPDF } from 'jspdf';
import type { PDFPageContent } from '../types/pdf';

export interface PDFContent {
  text: string;
  pageCount: number;
}

// PDF generation is now handled by the server

export const generatePDF = async (pages: PDFPageContent[]): Promise<Blob> => {
  const response = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pages }),
  });

  if (!response.ok) {
    throw new Error('Failed to generate PDF');
  }

  return response.blob();
};

export const extractPDFContent = async (file: File): Promise<PDFContent> => {
  if (!file.type.includes('pdf')) {
    throw new Error('Please upload a PDF file');
  }
  try {
    return {
      text: await file.text(),
      pageCount: 1
    };
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    throw new Error('Failed to extract PDF content');
  }
};
