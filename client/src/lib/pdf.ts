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
    if (error instanceof Error) {
      // Check for common PDF.js errors
      if (error.message.includes('Invalid PDF structure')) {
        throw new Error('The PDF file appears to be corrupted or invalid');
      } else if (error.message.includes('Password required')) {
        throw new Error('The PDF file is password protected');
      } else if (error.message.includes('Missing PDF')) {
        throw new Error('The file does not appear to be a valid PDF');
      } else if (error.message.includes('worker')) {
        throw new Error('PDF worker failed to load. Please try again.');
      }
      throw new Error(`PDF processing error: ${error.message}`);
    }
    throw new Error('Failed to process the PDF file. Please try again.');
  }
};

export interface PDFPageContent {
  pageNumber: number;
  text: string;
}

export const generatePDF = async (pages: PDFPageContent[]): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  doc.setFont('Times', 'Roman');
  doc.setFontSize(12);
  
  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
    }
    
    // Add page number at the top
    doc.setFontSize(10);
    doc.text(`Page ${page.pageNumber}`, 15, 10);
    doc.setFontSize(12);
    
    const splitText = doc.splitTextToSize(page.text, 180);
    let yPosition = 20;
    
    splitText.forEach((text: string) => {
      if (yPosition > 280) {
        doc.addPage();
        doc.setFontSize(10);
        doc.text(`Page ${page.pageNumber} (continued)`, 15, 10);
        doc.setFontSize(12);
        yPosition = 20;
      }
      doc.text(text, 15, yPosition);
      yPosition += 7;
    });
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
