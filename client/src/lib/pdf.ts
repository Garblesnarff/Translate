import * as pdfjsLib from 'pdfjs-dist';

// Set worker path for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PDFContent {
  text: string;
  pageCount: number;
}

export const extractPDFContent = async (file: File): Promise<PDFContent> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let text = '';
  const pageCount = pdf.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    text += textContent.items.map((item: any) => item.str).join(' ');
  }

  return {
    text,
    pageCount,
  };
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
