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
  const [documentTitle, setDocumentTitle] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>({
    pages: [],
    currentPage: 0,
    error: null
  });
  const { translate, isTranslating, progress, progressInfo, canCancel, cancelTranslation, setProgress } = useTranslation();

  const handleFileUpload = async (file: File, fileName: string) => {
    try {
      const content = await extractTextContent(file);
      // Set the complete source text
      setSourceText(content.text);
      setDocumentTitle(fileName); // Set the document title
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

      console.log('Starting parallel translation in pairs...');
      
      // Process pages in pairs
      for (let i = 0; i < pageTexts.length; i += 2) {
        const currentPair = [];
        
        // First page of the pair (odd page)
        currentPair.push(
          (async () => {
            try {
              console.log(`Translating page ${i + 1}`);
              const result = await translate(pageTexts[i]);
              return {
                pageNumber: i + 1,
                text: result.translatedText
              };
            } catch (error) {
              console.error(`Error translating page ${i + 1}:`, error);
              return {
                pageNumber: i + 1,
                text: `Error translating this page: ${error instanceof Error ? error.message : 'Unknown error'}`
              };
            }
          })()
        );

        // Second page of the pair (even page) if it exists
        if (i + 1 < pageTexts.length) {
          currentPair.push(
            (async () => {
              try {
                console.log(`Translating page ${i + 2}`);
                const result = await translate(pageTexts[i + 1]);
                return {
                  pageNumber: i + 2,
                  text: result.translatedText
                };
              } catch (error) {
                console.error(`Error translating page ${i + 2}:`, error);
                return {
                  pageNumber: i + 2,
                  text: `Error translating this page: ${error instanceof Error ? error.message : 'Unknown error'}`
                };
              }
            })()
          );
        }

        // Wait for both pages in the pair to complete
        const pairResults = await Promise.all(currentPair);
        pages.push(...pairResults);

        // Update progress
        const progressVal = Math.min(((i + 2) / pageTexts.length) * 100, 100);
        setProgress(progressVal);

        // Update state with the new pages
        setTranslationState(prev => ({
          ...prev,
          pages: [...pages],
          currentPage: Math.min(pages.length - 1, 0),
          error: null
        }));
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

      {isTranslating && (
        <ProgressIndicator 
          progress={progress} 
          progressInfo={progressInfo}
          canCancel={canCancel}
          onCancel={cancelTranslation}
        />
      )}

      <div className="flex-1 p-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="min-h-[200px] rounded-lg border bg-background/95"
        >
          <ResizablePanel defaultSize={50} minSize={30}>
            <TranslationPane
              title={documentTitle || "Source Text"} // Use documentTitle if available
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