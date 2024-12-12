
import { jsPDF } from 'jspdf';

export const generatePDF = async (text: string): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Set font and styling
  doc.setFont('helvetica');
  doc.setFontSize(12);
  
  const margin = 20;
  const pageWidth = doc.internal.pageSize.width;
  const maxWidth = pageWidth - (margin * 2);
  const lineHeight = 7;
  let yPosition = margin;

  const lines = text.split('\n');
  
  for (const line of lines) {
    // Check if we need a new page
    if (yPosition > doc.internal.pageSize.height - margin) {
      doc.addPage();
      yPosition = margin;
    }

    // Handle empty lines
    if (!line.trim()) {
      yPosition += lineHeight;
      continue;
    }

    // Handle bullet points
    if (line.trim().startsWith('*')) {
      doc.text(line.trim(), margin, yPosition);
      yPosition += lineHeight;
      continue;
    }

    // Handle regular text with proper wrapping
    const textLines = doc.splitTextToSize(line.trim(), maxWidth);
    textLines.forEach((textLine: string) => {
      if (yPosition > doc.internal.pageSize.height - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(textLine, margin, yPosition);
      yPosition += lineHeight;
    });
  }

  return doc.output('blob');
};
