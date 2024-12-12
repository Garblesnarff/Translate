
import { jsPDF } from 'jspdf';

export const generatePDF = async (text: string): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);

  const margin = 20;
  let yPosition = 20;
  const lineHeight = 8;
  const bulletIndent = 10;
  
  const lines = text.split('\n');
  
  lines.forEach(line => {
    // Check if we need a new page
    if (yPosition > 270) {
      doc.addPage();
      yPosition = 20;
    }

    const trimmedLine = line.trim();
    
    // Handle bullet points
    if (trimmedLine.startsWith('*')) {
      const bulletText = trimmedLine.substring(1).trim();
      doc.text('•', margin, yPosition);
      doc.text(bulletText, margin + bulletIndent, yPosition);
    } else {
      // Handle regular lines
      const words = trimmedLine.split(' ');
      let currentLine = '';
      let xPosition = margin;

      words.forEach(word => {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const testWidth = doc.getTextWidth(testLine);

        if (xPosition + testWidth > (210 - margin * 2)) {
          doc.text(currentLine, margin, yPosition);
          currentLine = word;
          yPosition += lineHeight;
        } else {
          currentLine = testLine;
        }
      });

      if (currentLine) {
        doc.text(currentLine, margin, yPosition);
      }
    }

    yPosition += lineHeight;
  });

  return doc.output('blob');
};
