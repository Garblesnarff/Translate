// TranslationPane.tsx
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
interface TranslationPaneProps {
  title: string;
  text: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
}
function processMarkdown(text: string): string {
  try {
    // If text is JSON, parse it
    const parsed = JSON.parse(text);
    if (parsed.translatedText) {
      text = parsed.translatedText;
    }
  } catch (e) {
    // If parsing fails, use text as-is
  }
  // Ensure proper spacing for lists and paragraphs
  return text
    .split('\n')
    .map(line => {
      // Add extra space after list items
      if (line.trim().startsWith('*')) {
        return line + '  ';
      }
      return line;
    })
    .join('\n');
}
export default function TranslationPane({
  title,
  text,
  onChange,
  readOnly = false,
}: TranslationPaneProps) {
  const processedText = processMarkdown(text);
  return (
    <Card className="h-full bg-background/95">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {readOnly ? (
            <div className="prose prose-stone dark:prose-invert max-w-none p-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  // Headers
                  h1: ({node, ...props}) => (
                    <h1 className="text-3xl font-bold mt-8 mb-4 border-b pb-2" {...props} />
                  ),
                  h2: ({node, ...props}) => (
                    <h2 className="text-2xl font-semibold mt-6 mb-3 text-primary" {...props} />
                  ),
                  // Paragraphs
                  p: ({node, children, ...props}) => (
                    <p className="my-4 leading-7 whitespace-pre-line" {...props}>
                      {children}
                    </p>
                  ),
                  // Lists
                  ul: ({node, ...props}) => (
                    <ul className="my-6 ml-6 list-disc [&>li]:mt-2" {...props} />
                  ),
                  li: ({node, children, ...props}) => (
                    <li className="leading-7" {...props}>
                      {children}
                    </li>
                  ),
                  // Inline elements
                  em: ({node, ...props}) => (
                    <em className="text-primary italic" {...props} />
                  ),
                  strong: ({node, ...props}) => (
                    <strong className="font-semibold text-primary" {...props} />
                  ),
                  // Links and references
                  a: ({node, ...props}) => (
                    <a className="text-primary underline underline-offset-4" {...props} />
                  ),
                  // Block elements
                  blockquote: ({node, ...props}) => (
                    <blockquote className="mt-6 border-l-2 border-primary pl-6 italic" {...props} />
                  ),

                  // Code blocks
                  pre: ({node, ...props}) => (
                    <pre className="mt-6 bg-muted p-4 rounded-lg overflow-x-auto" {...props} />
                  ),
                  code: ({node, ...props}) => (
                    <code className="bg-muted px-1.5 py-0.5 rounded-sm font-mono text-sm" {...props} />
                  ),
                  // Tables
                  table: ({node, ...props}) => (
                    <div className="my-6 w-full overflow-y-auto">
                      <table className="w-full" {...props} />
                    </div>
                  ),
                  th: ({node, ...props}) => (
                    <th className="border px-4 py-2 text-left font-semibold bg-muted" {...props} />
                  ),
                  td: ({node, ...props}) => (
                    <td className="border px-4 py-2" {...props} />
                  ),
                }}
              >
                {processedText}
              </ReactMarkdown>
            </div>
          ) : (
            <Textarea
              value={text}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[calc(100vh-14rem)] resize-none font-mono"
              readOnly={readOnly}
            />
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}