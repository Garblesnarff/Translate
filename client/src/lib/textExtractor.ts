// client/src/lib/textExtractor.ts

import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFContent } from './pdf';
import { buildTextFromPDFContent, PositionalTextBuilder } from './pdf/PositionalTextBuilder';
import { removeArtifacts, type ArtifactPattern } from './pdf/artifactRemover';
import { analyzePageLayout, sortItemsByColumnAndPosition, type ColumnLayout } from './pdf/layoutAnalyzer';
import { validateAndNormalize, type UnicodeQualityReport } from './tibetan/unicodeValidator';
import { validateSyllableStructure, type SyllableValidation } from './tibetan/syllableDetector';
import { needsOCR, detectPagesNeedingOCR, isTextSparse } from './ocr/ocrDetector';
import { TibetanOCR, type OCRProgress } from './ocr/tibetanOCR';
import { cleanOCRText } from './ocr/ocrPostProcessor';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedContent {
  text: string;
  sourceFormat: string;
  // Enhanced metadata
  extractionMethod?: 'native' | 'positional' | 'hybrid' | 'ocr' | 'hybrid-ocr';
  pageCount?: number;
  unicodeValidation?: UnicodeQualityReport;
  syllableValidation?: SyllableValidation;
  artifactsRemoved?: ArtifactPattern[];
  layoutDetection?: {
    hasMultiColumn: boolean;
    layouts: ColumnLayout[];
  };
  // OCR metadata
  ocrUsed?: boolean;
  ocrConfidence?: number;
  ocrQuality?: number;
  lowQualityPages?: number[];
  ocrPages?: number[];
  ocrProcessingTimeMs?: number;
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

async function extractFromPDF(
  file: File,
  onProgress?: (progress: { stage: string; percent: number; message: string }) => void
): Promise<{
  text: string;
  pageCount: number;
  artifactsRemoved: ArtifactPattern[];
  layouts: ColumnLayout[];
  ocrUsed: boolean;
  ocrConfidence?: number;
  ocrQuality?: number;
  ocrPages?: number[];
  ocrProcessingTimeMs?: number;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const pageCount = pdf.numPages;

    onProgress?.({ stage: 'extraction', percent: 0, message: 'Starting text extraction...' });

    // Extract text from all pages using position-aware extraction
    const pageTexts: string[] = [];
    const layouts: ColumnLayout[] = [];

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Extract positional items from PDF.js
      const items = PositionalTextBuilder.extractPositionalItems(textContent);

      // Analyze layout for this page
      const layout = analyzePageLayout(items);
      layouts.push(layout);

      // Build text using position-aware reconstruction
      let pageText: string;

      if (layout.columnCount > 1 && layout.confidence > 0.6) {
        // Multi-column layout detected
        const sortedItems = sortItemsByColumnAndPosition(items, layout);
        const builder = new PositionalTextBuilder({
          preserveArtificialSpacing: false,
          spaceThreshold: 3,
        });
        pageText = builder.buildText(sortedItems);
      } else {
        // Single column or low-confidence multi-column
        pageText = buildTextFromPDFContent(textContent, {
          preserveArtificialSpacing: false,
          spaceThreshold: 3,
        });
      }

      pageTexts.push(pageText);
      onProgress?.({
        stage: 'extraction',
        percent: (i / pageCount) * 0.4,
        message: `Extracted page ${i} of ${pageCount}`,
      });
    }

    // Combine text for OCR detection
    let combinedText = pageTexts.join('\n\n');

    // Check if OCR is needed
    onProgress?.({ stage: 'detection', percent: 0.4, message: 'Checking if OCR is needed...' });

    const ocrDetection = await needsOCR(pdf, combinedText, {
      minCharsPerPage: 50,
      sparsePageThreshold: 0.3,
      checkForImages: true,
    });

    let ocrUsed = false;
    let ocrConfidence: number | undefined;
    let ocrQuality: number | undefined;
    let ocrPages: number[] | undefined;
    let ocrProcessingTimeMs: number | undefined;

    // Perform OCR if needed
    if (ocrDetection.needsOCR) {
      onProgress?.({
        stage: 'ocr',
        percent: 0.5,
        message: `OCR required: ${ocrDetection.reason}`,
      });

      console.log('OCR Detection Result:', ocrDetection);

      const ocrStartTime = performance.now();

      // Determine which pages need OCR
      const pagesForOCR = ocrDetection.sparsePages.length > 0
        ? ocrDetection.sparsePages
        : Array.from({ length: pageCount }, (_, i) => i + 1);

      ocrPages = pagesForOCR;

      // Initialize OCR
      const tibetanOCR = new TibetanOCR({
        language: 'bod+eng',
        renderDpi: 300,
        parallelPages: 2,
        onProgress: (ocrProgress: OCRProgress) => {
          onProgress?.({
            stage: 'ocr',
            percent: 0.5 + (ocrProgress.progress * 0.4),
            message: ocrProgress.message,
          });
        },
      });

      try {
        // Get pages that need OCR
        const pagesToProcess = await Promise.all(
          pagesForOCR.map(pageNum => pdf.getPage(pageNum))
        );

        // Perform OCR
        const ocrResults = await tibetanOCR.processMultiplePages(pagesToProcess, pagesForOCR[0]);

        // Process OCR results
        let totalConfidence = 0;
        let totalQuality = 0;

        for (const result of ocrResults) {
          const pageIndex = result.pageNumber - 1;

          // Post-process OCR text
          const cleaned = cleanOCRText(result.text, result.confidence);

          // Replace or supplement original text
          if (pageTexts[pageIndex].trim().length < 50) {
            // Page had very little text, replace entirely
            pageTexts[pageIndex] = cleaned.text;
          } else {
            // Page had some text, append OCR result as supplement
            pageTexts[pageIndex] += '\n' + cleaned.text;
          }

          totalConfidence += result.confidence;
          totalQuality += cleaned.quality;

          console.log(`OCR Page ${result.pageNumber}:`, {
            confidence: result.confidence,
            quality: cleaned.quality,
            corrections: cleaned.corrections,
            textLength: cleaned.text.length,
          });
        }

        ocrUsed = true;
        ocrConfidence = totalConfidence / ocrResults.length;
        ocrQuality = totalQuality / ocrResults.length;
        ocrProcessingTimeMs = performance.now() - ocrStartTime;

        console.log('OCR Summary:', {
          pagesProcessed: ocrResults.length,
          avgConfidence: ocrConfidence,
          avgQuality: ocrQuality,
          processingTime: `${(ocrProcessingTimeMs / 1000).toFixed(2)}s`,
        });
      } finally {
        // Clean up OCR workers
        await tibetanOCR.terminate();
      }

      // Update combined text
      combinedText = pageTexts.join('\n\n');
    }

    onProgress?.({ stage: 'cleanup', percent: 0.9, message: 'Cleaning up artifacts...' });

    // Remove artifacts (headers, footers, page numbers) across all pages
    const { cleanedPages, patterns } = removeArtifacts(pageTexts, {
      minRepetitions: 3,
      detectPageNumbers: true,
      detectHeaders: true,
      detectFooters: true,
    });

    // Combine all pages with page markers
    let fullText = '';
    for (let i = 0; i < cleanedPages.length; i++) {
      const pageText = cleanedPages[i].trim();
      if (pageText.length > 0) {
        fullText += `Page ${i + 1}:\n${pageText}\n\n`;
      }
    }

    onProgress?.({ stage: 'complete', percent: 1, message: 'Text extraction complete' });

    return {
      text: fullText.trim(),
      pageCount,
      artifactsRemoved: patterns,
      layouts,
      ocrUsed,
      ocrConfidence,
      ocrQuality,
      ocrPages,
      ocrProcessingTimeMs,
    };
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

export async function extractTextContent(
  file: File,
  onProgress?: (progress: { stage: string; percent: number; message: string }) => void
): Promise<ExtractedContent> {
  try {
    let text: string;
    const format = file.type || 'text/plain';
    let extractionMethod: 'native' | 'positional' | 'hybrid' | 'ocr' | 'hybrid-ocr' = 'native';
    let pageCount: number | undefined;
    let artifactsRemoved: ArtifactPattern[] | undefined;
    let layouts: ColumnLayout[] | undefined;
    let ocrUsed = false;
    let ocrConfidence: number | undefined;
    let ocrQuality: number | undefined;
    let ocrPages: number[] | undefined;
    let ocrProcessingTimeMs: number | undefined;

    switch (true) {
      case format.includes('pdf'): {
        const pdfResult = await extractFromPDF(file, onProgress);
        text = pdfResult.text;
        extractionMethod = pdfResult.ocrUsed ? 'hybrid-ocr' : 'positional';
        pageCount = pdfResult.pageCount;
        artifactsRemoved = pdfResult.artifactsRemoved;
        layouts = pdfResult.layouts;
        ocrUsed = pdfResult.ocrUsed;
        ocrConfidence = pdfResult.ocrConfidence;
        ocrQuality = pdfResult.ocrQuality;
        ocrPages = pdfResult.ocrPages;
        ocrProcessingTimeMs = pdfResult.ocrProcessingTimeMs;
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

    // Validate and normalize Unicode
    const { text: normalizedText, report: unicodeValidation } = validateAndNormalize(text, 0.3);

    // Validate Tibetan syllable structure
    const syllableValidation = validateSyllableStructure(normalizedText);

    // Throw error if validation fails critically
    if (!unicodeValidation.isValid && unicodeValidation.tibetanPercentage < 0.3) {
      const highSeverityIssues = unicodeValidation.corruptionIssues
        .filter(issue => issue.severity === 'high')
        .map(issue => issue.description);

      if (highSeverityIssues.length > 0) {
        throw new Error(
          `Text validation failed: ${highSeverityIssues.join(', ')}. ` +
          `Tibetan content: ${(unicodeValidation.tibetanPercentage * 100).toFixed(1)}%`
        );
      }
    }

    return {
      text: normalizedText.trim(),
      sourceFormat: format,
      extractionMethod,
      pageCount,
      unicodeValidation,
      syllableValidation,
      artifactsRemoved,
      layoutDetection: layouts ? {
        hasMultiColumn: layouts.some(l => l.columnCount > 1),
        layouts,
      } : undefined,
      ocrUsed,
      ocrConfidence,
      ocrQuality,
      lowQualityPages: ocrPages && ocrQuality && ocrQuality < 0.6 ? ocrPages : undefined,
      ocrPages,
      ocrProcessingTimeMs,
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