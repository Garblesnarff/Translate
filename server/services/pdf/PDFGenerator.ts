
import { jsPDF } from 'jspdf';
import type { PDFPageContent } from '../../../client/src/types/pdf';
import { promises as fs } from 'fs';

export class PDFGenerator {
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
  }

  private async loadFonts(): Promise<void> {
    const fontPath = 'server/services/pdf/noto-sans-tibetan.ttf';
    const fontData = await fs.readFile(fontPath);
    this.doc.addFileToVFS('noto-sans-tibetan.ttf', fontData.toString('base64'));
    this.doc.addFont('noto-sans-tibetan.ttf', 'Noto Sans Tibetan', 'normal');
    this.doc.setFont('Noto Sans Tibetan');
    this.doc.setFontSize(11);
    this.doc.setLineHeightFactor(1.5);
  }

  private writeLine(text: string, indent: number = 0): void {
    const maxWidth = this.doc.internal.pageSize.width - this.margins.left - this.margins.right - indent;
    
    // Special handling for Tibetan text in parentheses
    const segments = text.split(/(\([^\)]+\))/g);
    
    segments.forEach((segment) => {
      if (segment.startsWith('(') && segment.endsWith(')')) {
        // Tibetan text
        this.doc.setFont('Noto Sans Tibetan');
        this.doc.setFontSize(12); // Slightly larger for Tibetan
      } else {
        // English text
        this.doc.setFont('Helvetica');
        this.doc.setFontSize(11);
      }
      
      const wrappedLines = this.doc.splitTextToSize(segment, maxWidth);
      wrappedLines.forEach((line: string) => {
        if (this.currentY > this.doc.internal.pageSize.height - this.margins.bottom) {
          this.doc.addPage();
          this.currentY = this.margins.top;
        }
        this.doc.text(line, this.margins.left + indent, this.currentY);
        this.currentY += 16;
      });
    });
    
    this.currentY += 8;
  }

  private writeTitle(text: string): void {
    this.doc.setFont('Helvetica');
    this.doc.setFontSize(14);
    this.writeLine(text);
    this.doc.setFontSize(11);
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

      return Buffer.from(this.doc.output('arraybuffer'));
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }
}
