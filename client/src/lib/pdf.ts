import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

// Configure PDF.js worker
import { version } from 'pdfjs-dist';
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  pageCount: number;
}

export const extractPDFContent = async (file: File): Promise<PDFContent> => {
  if (!file.type.includes('pdf')) {
    throw new Error('Please upload a PDF file');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    
    let text = '';
    const pageCount = pdf.numPages;

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => item.str)
        .join(' ');
      text += pageText + '\n\n';
    }

    return {
      text: text.trim(),
      pageCount,
    };
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    throw new Error('Failed to extract text from PDF');
  }
};

export const generatePDF = async (translatedText: string): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  doc.setFont('Times', 'Roman');
  doc.setFontSize(12);
  
  const splitText = doc.splitTextToSize(translatedText, 180);
  let yPosition = 20;
  
  splitText.forEach((text: string) => {
    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(text, 15, yPosition);
    yPosition += 7;
  });
  
  return doc.output('blob');
};
