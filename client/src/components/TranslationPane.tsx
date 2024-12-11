
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo, useState, useCallback } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import type { Components } from 'react-markdown';

interface TranslationPaneProps {
  title: string;
  text: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
  totalPages?: number;
}

const markdownComponents: Components = {
  // ... (keep existing markdown components)
};

function processMarkdown(text: string): { pages: string[] } {
  try {
    // First check if there are page markers
    const pages = text.split(/(?=##\s*Translation of Tibetan Text \(Page \d+\))/g)
      .filter(page => page.trim().length > 0);
    
    if (pages.length > 0) {
      return { pages };
    }
    // If no page markers found, treat as single page
    return { pages: [text] };
  } catch (e) {
    console.error('Error processing markdown:', e);
    return { pages: [text] };
  }
}

export default function TranslationPane({
  title,
  text,
  onChange,
  readOnly = false,
  totalPages = 1,
}: TranslationPaneProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  
  const { pages } = useMemo(() => {
    if (!text) return { pages: [''] };
    return { pages: [text] };
  }, [text]);
  
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsLoading(true);
    onChange(e.target.value);
    setTimeout(() => setIsLoading(false), 100);
  }, [onChange]);

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <Card className="h-full bg-background/95">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {readOnly && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={prevPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={nextPage}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
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
                  {pages[currentPage - 1]?.trim() || 'No translation available for this page'}
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
