import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import TranslationPane from "../components/TranslationPane";
import UploadDialog from "../components/UploadDialog";
import ProgressIndicator from "../components/ProgressIndicator";
import { useTranslation } from "../lib/gemini";
import { extractTextContent } from "../lib/textExtractor";
import { useToast } from "@/hooks/use-toast";

/**
 * Interface for translation errors
 */
interface TranslationError {
  message: string;
  code?: string;
}

/**
 * Interface for individual translation pages
 */
interface TranslationPage {
  pageNumber: number;
  text: string;
}

/**
 * Type definition for the translation state
 */
type TranslationState = {
  pages: TranslationPage[];
  currentPage: number;
  error?: TranslationError | null;
};

/**
 * Translate Component
 * 
 * Main translation interface component that handles:
 * - File uploads
 * - Text translation
 * - Page navigation
 * - Error handling
 * - Progress indication
 */
export default function Translate() {
  const { toast } = useToast();
  const [sourceText, setSourceText] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>(() => {
    (window as any).translationState = {
      pages: [],
      currentPage: 1,
      error: null
    };
    return (window as any).translationState;
  });
  
  // Keep global state in sync
  useEffect(() => {
    (window as any).translationState = translationState;
  }, [translationState]);
  
  // Initial state
  const [_, _setTranslationState] = useState<TranslationState>({
    pages: [],
    currentPage: 1,
    error: null
  });
  const { translate, isTranslating, progress } = useTranslation();

  /**
   * Handles file upload and text extraction
   * @param file - The uploaded file to process
   */
  const handleFileUpload = async (file: File) => {
    try {
      const content = await extractTextContent(file);
      // Reset states when new file is uploaded
      setSourceText(content.text);
      setTranslationState({
        pages: [],
        currentPage: 1,
        error: null
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive",
      });
    }
  };

  /**
   * Handles the translation process for all pages
   * Splits text into pages and translates each separately
   */
  const handleTranslate = async () => {
    try {
      // Split text into pages based on various page break indicators
      const pageTexts = sourceText
        .split(/\n\n(?:Page \d+:|\n-{3,}|\f)/)
        .filter(text => text.trim().length > 0);

      // If no page breaks found, treat entire text as one page
      if (pageTexts.length === 0) {
        pageTexts.push(sourceText);
      }

      const totalPages = pageTexts.length;
      setTranslationState(prev => ({ ...prev, pages: [], error: null }));
      const pages: TranslationPage[] = [];

      // Translate each page sequentially
      for (let i = 0; i < pageTexts.length; i++) {
        try {
          const pageNum = i + 1;
          console.log(`Translating page ${pageNum} of ${pageTexts.length}`);

          // Call translation service for current page
          const result = await translate(pageTexts[i]);

          const translatedPage = {
            pageNumber: pageNum,
            text: result.translatedText
          };

          pages.push(translatedPage);

          // Update state after each page is translated
          setTranslationState(prev => ({
            ...prev,
            pages: [...pages],
            currentPage: 1
          }));
        } catch (error) {
          console.error(`Error translating page ${i + 1}:`, error);
          // Add error page to maintain page count
          pages.push({
            pageNumber: i + 1,
            text: `Error translating this page: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }

      // Handle case where no pages were translated
      if (pages.length === 0) {
        throw new Error('Failed to translate any pages');
      }
    } catch (error) {
      console.error("Translation error:", error);
      // Handle different error types
      if (error instanceof Error) {
        const translationError = {
          message: error.message,
          code: 'code' in error ? (error as any).code : undefined
        };
        setTranslationState(prev => ({
          ...prev,
          pages: [],
          error: translationError
        }));
      } else {
        setTranslationState(prev => ({
          ...prev,
          pages: [],
          error: { message: "An unexpected error occurred during translation" }
        }));
      }
    }
  };

  /**
   * Handles page navigation
   * @param newPage - The page number to navigate to
   */
  const handlePageChange = (newPage: number) => {
    setTranslationState(prev => ({
      ...prev,
      currentPage: newPage
    }));
  };

  /**
   * Gets the text content for the current page
   * @returns The text content of the current page
   */
  const getCurrentPageText = () => {
    const currentPage = translationState.pages[translationState.currentPage - 1];
    return currentPage ? currentPage.text : '';
  };

  return (
    <div className="h-screen flex flex-col"
         style={{
           backgroundImage: `url(https://images.unsplash.com/photo-1508930113057-711dca60638c)`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
         }}>
      {/* Header with controls */}
      <div className="p-4 bg-background/95 shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Translation Studio</h1>
          <div className="space-x-2">
            <UploadDialog onUpload={handleFileUpload} />
            <Button onClick={handleTranslate} disabled={isTranslating}>
              Translate
            </Button>
          </div>
        </div>
      </div>

      {/* Translation progress indicator */}
      {isTranslating && <ProgressIndicator progress={progress} />}

      {/* Main content area */}
      <div className="flex-1 p-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[200px] rounded-lg border bg-background/95"
        >
          {/* Source text panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <TranslationPane
              title="Source Text"
              text={sourceText}
              onChange={setSourceText}
            />
          </ResizablePanel>
          <ResizableHandle className="w-2 bg-muted hover:bg-muted-foreground/10 transition-colors" />
          {/* Translation panel */}
          <ResizablePanel defaultSize={50} minSize={30}>
            {translationState.error ? (
              // Error display
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Translation Failed</AlertTitle>
                  <AlertDescription>
                    {translationState.error.message}
                    {translationState.error.code ? ` (${translationState.error.code})` : ''}
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              // Translation display with pagination
              <TranslationPane
                title={`Translation`}
                text={getCurrentPageText()}
                onChange={() => {}} // Read-only mode
                readOnly
                totalPages={translationState.pages.length}
                currentPage={translationState.currentPage}
                onPageChange={handlePageChange}
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}