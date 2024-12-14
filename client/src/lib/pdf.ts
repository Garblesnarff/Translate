
import { jsPDF } from 'jspdf';
import type { PDFPageContent } from '../types/pdf';

export interface PDFContent {
  text: string;
  pageCount: number;
}

class PDFGenerator {
  private doc: jsPDF;
  private currentY: number;
  private readonly margins = {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40
  };

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    this.currentY = this.margins.top;
    this.doc.setFont('Helvetica');
    this.doc.setFontSize(11);
  }

  private writeLine(text: string, indent: number = 0): void {
    const maxWidth = this.doc.internal.pageSize.width - this.margins.left - this.margins.right - indent;
    
    const lines = this.doc.splitTextToSize(text, maxWidth);
    lines.forEach(line => {
      if (this.currentY > this.doc.internal.pageSize.height - this.margins.bottom) {
        this.doc.addPage();
        this.currentY = this.margins.top;
      }
      this.doc.text(line, this.margins.left + indent, this.currentY);
      this.currentY += 16;
    });
    
    this.currentY += 8;
  }

  private writeTitle(text: string): void {
    this.doc.setFontSize(14);
    this.writeLine(text);
    this.doc.setFontSize(11);
    this.currentY += 8;
  }

  public async generatePDF(pages: PDFPageContent[]): Promise<Blob> {
    try {
      pages.forEach((page, index) => {
        if (index > 0) {
          this.doc.addPage();
          this.currentY = this.margins.top;
        }

        this.writeTitle(`Page ${page.pageNumber}`);
        const lines = page.text.split('\n');
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) {
            this.currentY += 8;
            continue;
          }

          if (trimmedLine.startsWith('*')) {
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
