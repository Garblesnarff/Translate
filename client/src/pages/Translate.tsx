
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

interface TranslationError {
  message: string;
  code?: string;
}

type TranslationState = {
  text: string;
  error?: TranslationError | null;
};

export default function Translate() {
  const [sourceText, setSourceText] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>({
    text: "",
    error: null
  });
  const { translate, isTranslating, progress } = useTranslation();

  const handleFileUpload = async (file: File) => {
    const content = await extractTextContent(file);
    setSourceText(content.text);
  };

  const handleTranslate = async () => {
    try {
      const result = await translate(sourceText);
      console.log("Translation result:", result);
      setTranslationState(prev => ({
        ...prev,
        text: result.translatedText || "",
        error: null
      }));
    } catch (error) {
      console.error("Translation error:", error);
      if (error instanceof Error) {
        const translationError = {
          message: error.message,
          code: 'code' in error ? (error as any).code : undefined
        };
        setTranslationState(prev => ({
          ...prev,
          text: "",
          error: translationError
        }));
      } else {
        setTranslationState(prev => ({
          ...prev,
          text: "",
          error: { message: "An unexpected error occurred during translation" }
        }));
      }
    }
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
              <TranslationPane
                title="Translation"
                text={translationState.text}
                onChange={(text) => setTranslationState(prev => ({ ...prev, text }))}
                readOnly
              />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}