import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { jsPDF } from 'jspdf';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// Exported interfaces
export interface PDFContent {
  text: string;
  pageCount: number;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
}

interface TextSegment {
  text: string;
  isTibetan: boolean;
}

// Constants
const TIBETAN_UNICODE_RANGE = /[\u0F00-\u0FFF]+/;

class TibetanPDFGenerator {
  private doc: jsPDF;
  private yPosition: number;
  private pageWidth: number;
  private margins: { left: number; right: number };

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    this.yPosition = 20;
    this.pageWidth = 210;
    this.margins = { left: 15, right: 15 };

    this.doc.setFont('Times', 'Roman');
    this.doc.setFontSize(12);
  }

  private isTibetanText(text: string): boolean {
    return TIBETAN_UNICODE_RANGE.test(text);
  }

  private segmentText(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentText = '';
    let currentIsTibetan = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const isTibetan = this.isTibetanText(char);

      if (currentText && isTibetan !== currentIsTibetan) {
        segments.push({
          text: currentText,
          isTibetan: currentIsTibetan
        });
        currentText = '';
      }

      currentText += char;
      currentIsTibetan = isTibetan;
    }

    if (currentText) {
      segments.push({
        text: currentText,
        isTibetan: currentIsTibetan
      });
    }

    return segments;
  }

  private processLine(line: string): TextSegment[] {
    if (line.trim().startsWith('*')) {
      return [{
        text: line,
        isTibetan: false
      }];
    }

    const segments: TextSegment[] = [];
    const parts = line.split(/(\([^)]+\))/);

    parts.forEach(part => {
      if (part.startsWith('(') && part.endsWith(')')) {
        segments.push({
          text: part,
          isTibetan: true
        });
      } else if (part.trim()) {
        segments.push({
          text: part,
          isTibetan: false
        });
      }
    });

    return segments;
  }

  private addTextSegment(segment: TextSegment, x: number) {
    const font = segment.isTibetan ? 'Times' : 'Times';
    this.doc.setFont(font, 'Roman');

    this.doc.text(segment.text, x, this.yPosition, {
      charSpace: segment.isTibetan ? 0.5 : 0
    });
  }

  public async generatePDF(text: string): Promise<Blob> {
    const lines = text.split('\n');

    for (const line of lines) {
      if (this.yPosition > 280) {
        this.doc.addPage();
        this.yPosition = 20;
      }

      const segments = this.processLine(line.trim());
      let xPosition = this.margins.left;

      if (line.trim().startsWith('*')) {
        xPosition += 5;
        this.yPosition += 2;
      }

      for (const segment of segments) {
        this.addTextSegment(segment, xPosition);
        xPosition += this.doc.getTextWidth(segment.text);
      }

      this.yPosition += 7;
    }

    return this.doc.output('blob');
  }
}

// Exported functions
export const extractPDFContent = async (file: File): Promise<PDFContent> => {
  if (!file.type.includes('pdf')) {
    throw new Error('Please upload a PDF file');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf: PDFDocumentProxy = await loadingTask.promise;
    const pageCount = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      const lineMap = new Map<number, TextItem[]>();

      textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .forEach(item => {
          const yPos = Math.round(item.transform[5]);
          if (!lineMap.has(yPos)) {
            lineMap.set(yPos, []);
          }
          lineMap.get(yPos)?.push(item);
        });

      const sortedLines = Array.from(lineMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([_, items]) => {
          return items
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map(item => item.str)
            .join(' ');
        });

      const pageText = sortedLines.join('\n');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }

    return {
      text: fullText.trim(),
      pageCount,
    };
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF structure')) {
        throw new Error('The PDF file appears to be corrupted or invalid');
      } else if (error.message.includes('Password required')) {
        throw new Error('The PDF file is password protected');
      }
      throw new Error(`PDF processing error: ${error.message}`);
    }
    throw new Error('Failed to process the PDF file');
  }
};

export const generatePDF = async (text: string): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Set default font first
  doc.setFont('helvetica', 'normal');
  
  try {
    // Load Noto Sans Tibetan font
    // Use standard fonts for now to ensure text width calculations work
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
  } catch (error) {
    console.warn('Failed to load Tibetan font:', error);
  }
  
  let yPosition = 20;
  const margin = 20;
  const lineHeight = 7;
  
  text.split('\n').forEach(line => {
    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
    }

    // Handle bullet points
    if (line.trim().startsWith('*')) {
      doc.setFont('Helvetica', 'normal');
      doc.text(line.trim(), margin, yPosition);
      yPosition += lineHeight;
      return;
    }

    // Split line into English and Tibetan parts
    const parts = line.split(/(\([^\)]+\))/g);
    let xPosition = margin;

    doc.text(line.trim(), margin, yPosition);

    yPosition += lineHeight;
  });

  return doc.output('blob');
};

export const extractPageContent = async (file: File, pageNumber: number): Promise<PDFPage> => {
  if (!file.type.includes('pdf')) {
    throw new Error('Please upload a PDF file');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf: PDFDocumentProxy = await loadingTask.promise;

    if (pageNumber > pdf.numPages) {
      throw new Error(`Page ${pageNumber} does not exist`);
    }

    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const lineMap = new Map<number, TextItem[]>();

    textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .forEach(item => {
        const yPos = Math.round(item.transform[5]);
        if (!lineMap.has(yPos)) {
          lineMap.set(yPos, []);
        }
        lineMap.get(yPos)?.push(item);
      });

    const sortedLines = Array.from(lineMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([_, items]) => {
        return items
          .sort((a, b) => a.transform[4] - b.transform[4])
          .map(item => item.str)
          .join(' ');
      });

    return {
      pageNumber,
      text: sortedLines.join('\n').trim()
    };
  } catch (error) {
    console.error('Error extracting PDF page content:', error);
    throw error;
  }
};