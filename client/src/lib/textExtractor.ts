
import mammoth from 'mammoth';
import { PDFContent } from './pdf';

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
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n';
        }
        text = fullText;
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
        text = await file.text();
    }

    return {
      text: text.trim(),
      sourceFormat: format,
    };
  } catch (error) {
    throw new Error(`Failed to extract text from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
