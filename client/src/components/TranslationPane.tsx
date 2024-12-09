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

export default function TranslationPane({
  title,
  text,
  onChange,
  readOnly = false,
}: TranslationPaneProps) {
  return (
    <Card className="h-full bg-background/95">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          {readOnly ? (
            <div className="prose prose-sm dark:prose-invert max-w-none p-4">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
                  h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
                  p: ({node, ...props}) => <p className="my-3" {...props} />,
                  em: ({node, ...props}) => <em className="text-primary italic" {...props} />,
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          ) : (
            <Textarea
              value={text}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[calc(100vh-14rem)] resize-none"
              readOnly={readOnly}
            />
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
