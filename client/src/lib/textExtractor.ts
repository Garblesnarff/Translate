// client/src/lib/textExtractor.ts

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFContent } from './pdf';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedContent {
  text: string;
  sourceFormat: string;
}

async function extractFromHTML(file: File): Promise<string> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.body.textContent || '';
}

async function extractFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function extractFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;
    let fullText = '';

    // Process all pages
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ');
      fullText += `Page ${i}:\n${pageText}\n\n`;
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting PDF content:', error);
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF structure')) {
        throw new Error('The PDF file appears to be corrupted or invalid');
      } else if (error.message.includes('Password required')) {
        throw new Error('The PDF file is password protected');
      } else if (error.message.includes('Missing PDF')) {
        throw new Error('The file does not appear to be a valid PDF');
      }
      throw new Error(`PDF processing error: ${error.message}`);
    }
    throw new Error('Failed to process the PDF file');
  }
}

export async function extractTextContent(file: File): Promise<ExtractedContent> {
  try {
    let text: string;
    const format = file.type || 'text/plain';

    switch (true) {
      case format.includes('pdf'): {
        text = await extractFromPDF(file);
        break;
      }
      case format.includes('html'):
        text = await extractFromHTML(file);
        break;
      case format.includes('officedocument.wordprocessingml.document'):
      case format.includes('msword'):
        text = await extractFromDOCX(file);
        break;
      default:
        text = await file.text(); // For plain text files
    }

    return {
      text: text.trim(),
      sourceFormat: format,
    };
  } catch (error) {
    console.error('Error extracting text content:', error);

    // Create a more user-friendly error message based on file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    let errorMessage = 'Unknown error occurred';

    if (error instanceof Error) {
      if (error.message.includes('PDF')) {
        errorMessage = 'Could not read PDF file. The file might be corrupted or password protected.';
      } else if (['doc', 'docx'].includes(extension || '')) {
        errorMessage = 'Could not read Word document. Please ensure it\'s not corrupted.';
      } else if (['html', 'htm'].includes(extension || '')) {
        errorMessage = 'Could not read HTML file. Please ensure it contains valid HTML content.';
      } else {
        errorMessage = error.message;
      }
    }

    throw new Error(`Failed to extract text from ${file.name}: ${errorMessage}`);
  }
}