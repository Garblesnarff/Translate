
import { jsPDF } from 'jspdf';

export interface PDFContent {
  text: string;
  pageCount: number;
}

export const generatePDF = async (text: string): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  
  const margin = 20;
  const lineHeight = 8;
  const maxWidth = 170;
  let yPosition = 20;

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

    if (line.trim().startsWith('*')) {
      const bulletText = line.trim();
      doc.text(bulletText, margin, yPosition);
      yPosition += lineHeight;
    } else {
      const formattedLine = line.trim();
      const wrappedText = doc.splitTextToSize(formattedLine, maxWidth);
      wrappedText.forEach((textLine: string) => {
        doc.text(textLine, margin, yPosition);
        yPosition += lineHeight;
      });
    }
  }

  return doc.output('blob');
};
