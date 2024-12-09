import { useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import TranslationPane from "../components/TranslationPane";
import UploadDialog from "../components/UploadDialog";
import ProgressIndicator from "../components/ProgressIndicator";
import { useTranslation } from "../lib/gemini";
import { extractPDFContent, generatePDF } from "../lib/pdf";

export default function Translate() {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const { translate, isTranslating, progress } = useTranslation();

  const handleFileUpload = async (file: File) => {
    const content = await extractPDFContent(file);
    setSourceText(content.text);
  };

  const handleTranslate = async () => {
    const result = await translate(sourceText);
    setTranslatedText(result.translatedText);
  };

  const handleExport = async () => {
    const pdfBlob = await generatePDF(translatedText);
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translation.pdf';
    a.click();
    URL.revokeObjectURL(url);
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
            <Button onClick={handleExport} disabled={!translatedText}>
              Export PDF
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
            <TranslationPane
              title="Translation"
              text={translatedText}
              onChange={setTranslatedText}
              readOnly
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
