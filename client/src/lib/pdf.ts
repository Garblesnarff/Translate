
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { jsPDF } from 'jspdf';

export interface PDFContent {
  text: string;
  pageCount: number;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
}

export const generatePDF = async (text: string): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  
  let yPosition = 20;
  const margin = 20;
  const lineHeight = 8;
  const maxWidth = 170;

  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.trim() === '') {
      yPosition += lineHeight;
      continue;
    }

    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
    }

    // Handle bullet points with proper indentation
    if (line.trim().startsWith('*')) {
      const bulletText = line.trim();
      doc.text(bulletText, margin, yPosition);
      yPosition += lineHeight;
      continue;
    }

    // Handle parenthetical Tibetan text
    const parts = line.split(/(\([^)]+\))/g);
    let xPosition = margin;

    for (const part of parts) {
      if (part.trim()) {
        const wrappedText: string[] = doc.splitTextToSize(part, maxWidth - (xPosition - margin));
        for (const textLine of wrappedText) {
          doc.text(textLine, xPosition, yPosition);
          yPosition += lineHeight;
        }
        xPosition += doc.getTextWidth(part);
      }
    }

    yPosition += 2;
  }

  return doc.output('blob');
};

// Rest of the existing PDF extraction code...
