import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FixedSizeList as List } from 'react-window';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo, useState, useCallback } from 'react';
import { Loader2 } from "lucide-react";
import type { Components } from 'react-markdown';

interface TranslationPaneProps {
  title: string;
  text: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
}

// Chunk size for text rendering (number of lines)
const CHUNK_SIZE = 50;

// Custom components for markdown rendering with proper types
const markdownComponents: Components = {
  h1: ({ children, ...props }) => (
    <h1 className="text-3xl font-bold mt-8 mb-4 border-b pb-2" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-2xl font-semibold mt-6 mb-3 text-primary" {...props}>
      {children}
    </h2>
  ),
  p: ({ children, ...props }) => (
    <p className="my-4 leading-7 whitespace-pre-line" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="leading-7" {...props}>
      {children}
    </li>
  ),
  em: ({ children, ...props }) => (
    <em className="text-primary italic" {...props}>
      {children}
    </em>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-primary" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, ...props }) => (
    <a className="text-primary underline underline-offset-4" {...props}>
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="mt-6 border-l-2 border-primary pl-6 italic" {...props}>
      {children}
    </blockquote>
  ),
  pre: ({ children, ...props }) => (
    <pre className="mt-6 bg-muted p-4 rounded-lg overflow-x-auto" {...props}>
      {children}
    </pre>
  ),
  code: ({ children, ...props }) => (
    <code className="bg-muted px-1.5 py-0.5 rounded-sm font-mono text-sm" {...props}>
      {children}
    </code>
  ),
  table: ({ children, ...props }) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className="w-full" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="border px-4 py-2 text-left font-semibold bg-muted" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border px-4 py-2" {...props}>
      {children}
    </td>
  ),
};

function processMarkdown(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (parsed.translatedText) {
      text = parsed.translatedText;
    }
  } catch (e) {
    // If parsing fails, use text as-is
  }
  
  return text
    .split('\n')
    .map(line => line.trim().startsWith('*') ? line + '  ' : line)
    .join('\n');
}

// Split text into chunks for efficient rendering
function splitIntoChunks(text: string): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  
  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    chunks.push(lines.slice(i, i + CHUNK_SIZE).join('\n'));
  }
  
  return chunks;
}

export default function TranslationPane({
  title,
  text,
  onChange,
  readOnly = false,
}: TranslationPaneProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Memoize processed text to prevent unnecessary processing
  const processedText = useMemo(() => processMarkdown(text), [text]);
  
  // Split text into chunks for virtualized rendering
  const textChunks = useMemo(() => splitIntoChunks(processedText), [processedText]);
  
  // Memoize the row renderer for react-window
  const Row = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => (
    <div style={style}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
        className="prose prose-stone dark:prose-invert max-w-none p-4"
      >
        {textChunks[index]}
      </ReactMarkdown>
    </div>
  ), [textChunks]);

  // Handle text changes with debouncing
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsLoading(true);
    onChange(e.target.value);
    setTimeout(() => setIsLoading(false), 100);
  }, [onChange]);

  return (
    <Card className="h-full bg-background/95">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {isLoading && (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {readOnly ? (
            <List
              height={window.innerHeight - 200}
              itemCount={textChunks.length}
              itemSize={200}
              width="100%"
            >
              {Row}
            </List>
          ) : (
            <Textarea
              value={text}
              onChange={handleTextChange}
              className="min-h-[calc(100vh-14rem)] resize-none font-mono"
              readOnly={readOnly}
            />
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
