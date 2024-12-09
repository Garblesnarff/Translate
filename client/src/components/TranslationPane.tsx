import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
          <Textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[calc(100vh-14rem)] resize-none"
            readOnly={readOnly}
          />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
