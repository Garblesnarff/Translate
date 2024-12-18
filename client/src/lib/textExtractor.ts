import mammoth from 'mammoth';
import { PDFContent, extractPDFContent } from './pdf';

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

export async function extractTextContent(file: File): Promise<ExtractedContent> {
  try {
    let text: string;
    const format = file.type || 'text/plain';

    switch (true) {
      case format.includes('pdf'): {
        const content: PDFContent = await extractPDFContent(file);
        text = content.text;
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
