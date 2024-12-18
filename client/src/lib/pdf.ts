import { jsPDF } from 'jspdf';
import type { PDFPageContent } from '../types/pdf';
import { tibetanFontBase64 } from '@/assets/fonts/tibetanFont';

// Configuration constants for PDF generation
const PDF_CONFIG = {
  FONT_NAME: 'Jomolhari',            // Name we'll use to reference our font in the PDF
  DEFAULT_FONT_SIZE: 12,             // Base font size for normal text
  TIBETAN_FONT_SIZE: 14,             // Slightly larger for Tibetan text readability
  PAGE_MARGIN: 20,                   // Margins in millimeters
  LINE_HEIGHT: 7,                    // Base line height
  TIBETAN_LINE_HEIGHT: 10            // Increased line height for Tibetan text
} as const;

// Interface for storing PDF metadata
export interface PDFContent {
  text: string;
  pageCount: number;
}

// Utility function to detect Tibetan text
const containsTibetanText = (text: string): boolean => {
  // Tibetan Unicode range: U+0F00 to U+0FFF
  return /[\u0F00-\u0FFF]/.test(text);
};

// Main PDF generation function
export const generatePDF = async (pages: PDFPageContent[]): Promise<Blob> => {
  // Initialize PDF document with A4 size and proper margins
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  try {
    // Embed the Tibetan font
    doc.addFileToVFS(`${PDF_CONFIG.FONT_NAME}.ttf`, tibetanFontBase64);
    doc.addFont(`${PDF_CONFIG.FONT_NAME}.ttf`, PDF_CONFIG.FONT_NAME, 'normal');

    // Process each page
    let yPosition = PDF_CONFIG.PAGE_MARGIN;

    pages.forEach((page, pageIndex) => {
      // Add new page for all pages after the first
      if (pageIndex > 0) {
        doc.addPage();
        yPosition = PDF_CONFIG.PAGE_MARGIN;
      }

      // Add page number
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Page ${page.pageNumber}`, PDF_CONFIG.PAGE_MARGIN, yPosition);
      yPosition += PDF_CONFIG.LINE_HEIGHT;

      // Split text into paragraphs and process each one
      const paragraphs = page.text.split('\n').filter(p => p.trim());

      paragraphs.forEach(paragraph => {
        // Determine if paragraph contains Tibetan text
        const hasTibetan = containsTibetanText(paragraph);

        // Set appropriate font and size
        if (hasTibetan) {
          doc.setFont(PDF_CONFIG.FONT_NAME, 'normal');
          doc.setFontSize(PDF_CONFIG.TIBETAN_FONT_SIZE);
        } else {
          doc.setFont('times', 'normal');
          doc.setFontSize(PDF_CONFIG.DEFAULT_FONT_SIZE);
        }

        // Calculate available width for text
        const pageWidth = doc.internal.pageSize.width;
        const maxWidth = pageWidth - (2 * PDF_CONFIG.PAGE_MARGIN);

        // Split text to fit within page width
        const lines = doc.splitTextToSize(paragraph, maxWidth);

        // Process each line
        lines.forEach((line: string) => {
          // Check if we need to add a new page
          if (yPosition > doc.internal.pageSize.height - PDF_CONFIG.PAGE_MARGIN) {
            doc.addPage();
            yPosition = PDF_CONFIG.PAGE_MARGIN;

            // Add continuation marker
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Page ${page.pageNumber} (continued)`, PDF_CONFIG.PAGE_MARGIN, yPosition);
            yPosition += PDF_CONFIG.LINE_HEIGHT;

            // Restore font settings
            if (hasTibetan) {
              doc.setFont(PDF_CONFIG.FONT_NAME, 'normal');
              doc.setFontSize(PDF_CONFIG.TIBETAN_FONT_SIZE);
            } else {
              doc.setFont('times', 'normal');
              doc.setFontSize(PDF_CONFIG.DEFAULT_FONT_SIZE);
            }
          }

          // Add the line to the PDF
          doc.text(line, PDF_CONFIG.PAGE_MARGIN, yPosition);
          yPosition += hasTibetan ? PDF_CONFIG.TIBETAN_LINE_HEIGHT : PDF_CONFIG.LINE_HEIGHT;
        });

        // Add paragraph spacing
        yPosition += PDF_CONFIG.LINE_HEIGHT;
      });
    });

    return doc.output('blob');
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};

// Function to extract content from uploaded PDFs
export const extractPDFContent = async (file: File): Promise<PDFContent> => {
  if (!file.type.includes('pdf')) {
    throw new Error('Please upload a PDF file');
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to extract PDF content');
    }

    const data = await response.json();
    return {
      text: data.text,
      pageCount: data.pageCount || 1
    };
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    throw new Error('Failed to extract PDF content');
  }
};