
import { jsPDF } from 'jspdf';
import type { PDFPageContent } from '../../../client/src/types/pdf';
import { promises as fs } from 'fs';
import path from 'path';

export class PDFGenerator {
  private doc: jsPDF;
  private currentY: number;
  private readonly margins = {
    top: 40,
    right: 40,
    bottom: 40,
    left: 40
  };
  private fontLoaded: boolean = false;

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });
    this.currentY = this.margins.top;
  }

  private async loadFonts(): Promise<void> {
    try {
      // Skip font loading for now - use default fonts
      this.fontLoaded = false;
      console.log('Using default fonts for PDF generation');
    } catch (error) {
      console.error('Error loading Tibetan font:', error);
      this.fontLoaded = false;
    }
  }

  private writeLine(text: string, indent: number = 0): void {
    const maxWidth = this.doc.internal.pageSize.width - this.margins.left - this.margins.right - indent;
    
    if (this.fontLoaded) {
      this.doc.setFont('NotoSansTibetan');
    } else {
      this.doc.setFont('Helvetica');
    }
    
    this.doc.setFontSize(11);
    
    const lines = this.doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
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
    if (this.fontLoaded) {
      this.doc.setFont('NotoSansTibetan');
    } else {
      this.doc.setFont('Helvetica');
    }
    this.doc.setFontSize(14);
    this.writeLine(text);
    this.currentY += 8;
  }

  public async generatePDF(pages: PDFPageContent[]): Promise<Buffer> {
    try {
      await this.loadFonts();

      pages.forEach((page, index) => {
        if (index > 0) {
          this.doc.addPage();
          this.currentY = this.margins.top;
        }

        this.writeTitle(`Page ${page.pageNumber}`);
        
        // Handle both text formats
        const textContent = page.text || page.englishText || '';
        const lines = textContent.split('\n');
        
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

      return Buffer.from(this.doc.output('arraybuffer'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }
}
