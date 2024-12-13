// client/src/lib/pdf.ts

import { jsPDF } from 'jspdf';
import type { PDFPageContent } from '../types/pdf';

export interface PDFContent {
  text: string;
  pageCount: number;
}

class PDFGenerator {
  private doc: jsPDF;
  private currentY: number;
  private lineHeight: number;
  private margins = {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40
  };

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4',
      putOnlyUsedFonts: true
    });

    this.currentY = this.margins.top;
    this.lineHeight = 16;
    
    // Use built-in Unicode font
    this.doc.addFont('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@4.5.11/files/noto-sans-all-400-normal.woff', 'Noto Sans', 'normal', 'Identity-H');
    this.doc.setFont('Noto Sans', 'normal');
    this.doc.setFontSize(11);
  }

  private cleanText(text: string): string {
    // Only clean special characters, preserve Tibetan Unicode
    return text.replace(/[|±]/g, '');
  }

  private measureWidth(text: string): number {
    return this.doc.getStringUnitWidth(text) * this.doc.getFontSize();
  }

  private writeLine(text: string, indent: number = 0): void {
    const pageWidth = this.doc.internal.pageSize.width;
    const maxWidth = pageWidth - this.margins.left - this.margins.right - indent;
    const cleanedText = this.cleanText(text);

    // Split text into words
    const words = cleanedText.split(' ');
    let currentLine = '';
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = this.measureWidth(word + ' ');

      if (currentWidth + wordWidth > maxWidth) {
        // Write current line and start new one
        if (this.currentY > this.doc.internal.pageSize.height - this.margins.bottom) {
          this.doc.addPage();
          this.currentY = this.margins.top;
        }

        this.doc.text(currentLine.trim(), this.margins.left + indent, this.currentY);
        this.currentY += this.lineHeight;
        currentLine = word + ' ';
        currentWidth = wordWidth;
      } else {
        currentLine += word + ' ';
        currentWidth += wordWidth;
      }
    }

    // Write remaining text
    if (currentLine.trim()) {
      if (this.currentY > this.doc.internal.pageSize.height - this.margins.bottom) {
        this.doc.addPage();
        this.currentY = this.margins.top;
      }
      this.doc.text(currentLine.trim(), this.margins.left + indent, this.currentY);
      this.currentY += this.lineHeight;
    }

    // Add paragraph spacing
    this.currentY += this.lineHeight * 0.5;
  }

  private writeTitle(text: string): void {
    const originalSize = this.doc.getFontSize();
    this.doc.setFontSize(14);
    this.writeLine(text);
    this.doc.setFontSize(originalSize);
    this.currentY += this.lineHeight * 0.5;
  }

  public async generatePDF(pages: PDFPageContent[]): Promise<Blob> {
    try {
      pages.forEach((page, index) => {
        if (index > 0) {
          this.doc.addPage();
          this.currentY = this.margins.top;
        }

        // Write page title
        this.writeTitle(`Page ${page.pageNumber}`);
        // Process each line of text
        const lines = page.text.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            this.currentY += this.lineHeight * 0.5;
            continue;
          }

          if (trimmedLine.startsWith('*')) {
            // Handle bullet points
            this.writeLine(`• ${trimmedLine.substring(1).trim()}`, 20);
          } else {
            this.writeLine(trimmedLine);
          }
        }
      });

      return this.doc.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }
}

export const generatePDF = async (pages: PDFPageContent[]): Promise<Blob> => {
  const generator = new PDFGenerator();
  return generator.generatePDF(pages);
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