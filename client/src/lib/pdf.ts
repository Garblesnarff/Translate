
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem, PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

// Configure worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface PDFContent {
  text: string;
  pageCount: number;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
}

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
    
    // Process all pages
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => item.str)
        .join(' ');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }

    return {
      text: fullText.trim(),
      pageCount,
    };
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    throw error;
  }
};

export const generatePDF = async (translatedText: string): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  // Add Noto Sans Tibetan font for Tibetan text support
  const tibetanFont = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tibetan/files/noto-sans-tibetan-tibetan-400-normal.woff')
    .then(r => r.arrayBuffer());
  
  doc.addFileToVFS('NotoSansTibetan-Regular.ttf', tibetanFont);
  doc.addFont('NotoSansTibetan-Regular.ttf', 'NotoSansTibetan', 'normal');
  
  doc.setFont('NotoSansTibetan');
  doc.setFontSize(12);
  
  const margin = 15;
  const pageWidth = doc.internal.pageSize.width;
  const maxWidth = pageWidth - (2 * margin);
  
  const paragraphs = translatedText.split('\n');
  let yPosition = 20;
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) {
      yPosition += 5;
      continue;
    }

    // Handle text wrapping manually
    let words = trimmedParagraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const metrics = doc.getTextWidth(testLine);

      if (metrics > maxWidth && i > 0) {
        doc.text(currentLine, margin, yPosition);
        currentLine = word;
        yPosition += 7;

        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      doc.text(currentLine, margin, yPosition);
      yPosition += 10;
    }

    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
    }
  }
  
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
    const text = textContent.items
      .filter((item): item is TextItem => 'str' in item)
      .map(item => item.str)
      .join(' ');

    return {
      pageNumber,
      text: text.trim()
    };
  } catch (error) {
    console.error('Error extracting PDF page content:', error);
    throw error;
  }
};
