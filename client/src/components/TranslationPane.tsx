// client/src/components/TranslationPane.tsx

import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePDF } from '@/lib/pdf';
import type { PDFPageContent } from '@/types/pdf';


interface TranslationPaneProps {
  title: string;
  text: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  allPages?: Array<PDFPageContent>;
}

// Define markdown rendering components
const markdownComponents: Components = {
  // Customize markdown rendering components here if needed
};

export default function TranslationPane({
  title,
  text,
  onChange,
  readOnly = false,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  allPages
}: TranslationPaneProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { pages } = useMemo(() => {
    return { pages: [text] };
  }, [text]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsLoading(true);
    onChange(e.target.value);
    setTimeout(() => setIsLoading(false), 100);
  }, [onChange]);

  const handlePageChange = useCallback((newPage: number) => {
    if (onPageChange && newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  }, [onPageChange, totalPages]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const pagesToExport = allPages ?? [{ pageNumber: currentPage, text }];
      const pdfBlob = await generatePDF(pagesToExport);

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'translation.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF exported successfully",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to generate PDF",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="h-full bg-background/95">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {readOnly && text.trim() && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                'Export PDF'
              )}
            </Button>
          )}
          {readOnly && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {isLoading && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          <div className="relative h-[calc(100vh-14rem)]">
            {readOnly ? (
              <div className="absolute inset-0 overflow-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                  className="prose prose-stone dark:prose-invert max-w-none p-4"
                >
                  {(pages[0] || '').trim() || 'No translation available for this page'}
                </ReactMarkdown>
              </div>
            ) : (
              <Textarea
                value={text}
                onChange={handleTextChange}
                className="absolute inset-0 resize-none font-mono p-4"
                readOnly={readOnly}
              />
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}