
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

interface TranslationError {
  message: string;
  code?: string;
}

interface TranslationPage {
  pageNumber: number;
  text: string;
}

type TranslationState = {
  pages: TranslationPage[];
  currentPage: number;
  error?: TranslationError | null;
};

export default function Translate() {
  const { toast } = useToast();
  const [sourceText, setSourceText] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>({
    pages: [],
    currentPage: 0,
    error: null
  });
  const { translate, isTranslating, progress, setProgress } = useTranslation();

  const handleFileUpload = async (file: File) => {
    try {
      const content = await extractTextContent(file);
      // Set the complete source text
      setSourceText(content.text);
      // Reset translation state when new file is uploaded
      setTranslationState({
        pages: [],
        currentPage: 0,
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

  const handleTranslate = async () => {
    try {
      // Split text into pages (either by explicit page markers or by paragraphs)
      const pageTexts = sourceText
        .split(/\n\n(?:Page \d+:|\n-{3,}|\f)/)
        .filter(text => text.trim().length > 0);

      if (pageTexts.length === 0) {
        // If no page breaks found, treat the entire text as one page
        pageTexts.push(sourceText);
      }

      const totalPages = pageTexts.length;
      setTranslationState(prev => ({ ...prev, pages: [], error: null }));
      const pages: TranslationPage[] = [];

      // Split pages into odd and even
      const oddPages = pageTexts.map((text, i) => ({ text, index: i })).filter(p => (p.index + 1) % 2 === 1);
      const evenPages = pageTexts.map((text, i) => ({ text, index: i })).filter(p => (p.index + 1) % 2 === 0);

      console.log('Starting parallel translation of odd and even pages...');
      
      // Translate odd and even pages in parallel
      try {
        const [oddResults, evenResults] = await Promise.all([
          // Process odd pages
          Promise.all(oddPages.map(async ({ text, index }) => {
            try {
              console.log(`Translating odd page ${index + 1}`);
              const result = await translate(text);
              return {
                pageNumber: index + 1,
                text: result.translatedText
              };
            } catch (error) {
              console.error(`Error translating page ${index + 1}:`, error);
              return {
                pageNumber: index + 1,
                text: `Error translating this page: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          })),
          // Process even pages
          Promise.all(evenPages.map(async ({ text, index }) => {
            try {
              console.log(`Translating even page ${index + 1}`);
              const result = await translate(text);
              return {
                pageNumber: index + 1,
                text: result.translatedText
              };
            } catch (error) {
              console.error(`Error translating page ${index + 1}:`, error);
              return {
                pageNumber: index + 1,
                text: `Error translating this page: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          }))
        ]);

        // Combine results and sort by page number
        pages = [...oddResults, ...evenResults].sort((a, b) => a.pageNumber - b.pageNumber);
        
        // Update progress to 100% since all pages are done
        setProgress(100);
        
        // Update final state with all translated pages
        setTranslationState(prev => ({
          ...prev,
          pages,
          currentPage: 0,
          error: null
        }));
      } catch (error) {
        console.error('Error in parallel translation:', error);
        throw error;
      }

      // If no pages were translated successfully
      if (pages.length === 0) {
        throw new Error('Failed to translate any pages');
      }
    } catch (error) {
      console.error("Translation error:", error);
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

  const handlePageChange = (pageIndex: number) => {
    setTranslationState(prev => ({
      ...prev,
      currentPage: pageIndex
    }));
  };

  return (
    <div className="h-screen flex flex-col"
         style={{
           backgroundImage: `url(https://images.unsplash.com/photo-1508930113057-711dca60638c)`,
           backgroundSize: 'cover',
           backgroundPosition: 'center',
         }}>
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

      {isTranslating && <ProgressIndicator progress={progress} />}

      <div className="flex-1 p-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[200px] rounded-lg border bg-background/95"
        >
          <ResizablePanel defaultSize={50} minSize={30}>
            <TranslationPane
              title="Source Text"
              text={sourceText}
              onChange={setSourceText}
            />
          </ResizablePanel>
          <ResizableHandle className="w-2 bg-muted hover:bg-muted-foreground/10 transition-colors" />
          <ResizablePanel defaultSize={50} minSize={30}>
            {translationState.error ? (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Translation Failed</AlertTitle>
                  <AlertDescription>
                    Translation Error: {translationState.error.message}
                    {translationState.error.code ? ` (${translationState.error.code})` : ''}
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <TranslationPane
                  title={`Translation - Page ${translationState.currentPage + 1}/${translationState.pages.length}`}
                  text={translationState.pages[translationState.currentPage]?.text || ''}
                  onChange={(text) => {
                    const newPages = [...translationState.pages];
                    if (newPages[translationState.currentPage]) {
                      newPages[translationState.currentPage].text = text;
                      setTranslationState(prev => ({ ...prev, pages: newPages }));
                    }
                  }}
                  readOnly
                  currentPage={translationState.currentPage + 1}
                  totalPages={translationState.pages.length}
                  allPages={translationState.pages.map(page => ({
                    pageNumber: page.pageNumber,
                    text: page.text
                  }))}
                />
                {translationState.pages.length > 1 && (
                  <div className="flex justify-center gap-2 p-2 border-t">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(Math.max(0, translationState.currentPage - 1))}
                      disabled={translationState.currentPage === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(Math.min(translationState.pages.length - 1, translationState.currentPage + 1))}
                      disabled={translationState.currentPage === translationState.pages.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}