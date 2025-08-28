import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronUp, ChevronDown, Terminal, Trash2, Copy } from 'lucide-react';
import { LogEntry, LogLevel, LOG_COLORS, LOG_ICONS } from '@/types/log';

interface LogViewerProps {
  entries: LogEntry[];
  onClear: () => void;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 1
  });
}

function copyLogsToClipboard(entries: LogEntry[]) {
  const logText = entries.map(entry => 
    `[${formatTimestamp(entry.timestamp)}] ${entry.level.toUpperCase()}: ${entry.message}${entry.source ? ` (${entry.source})` : ''}`
  ).join('\n');
  
  navigator.clipboard.writeText(logText);
}

export default function LogViewer({ entries, onClear }: LogViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries are added and viewer is expanded
  useEffect(() => {
    if (isExpanded && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [entries, isExpanded]);

  const filteredEntries = entries.filter(entry => 
    filter === 'all' || entry.level === filter
  );

  const entryCounts = entries.reduce((counts, entry) => {
    counts[entry.level] = (counts[entry.level] || 0) + 1;
    return counts;
  }, {} as Record<LogLevel, number>);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t shadow-lg">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between px-4 py-2 h-10 rounded-none border-none"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              <span className="text-sm font-medium">Server Logs</span>
              {entries.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {entries.length}
                </Badge>
              )}
              {Object.entries(entryCounts).map(([level, count]) => (
                <Badge 
                  key={level} 
                  variant="outline" 
                  className={`text-xs ${LOG_COLORS[level as LogLevel]}`}
                >
                  {LOG_ICONS[level as LogLevel]} {count}
                </Badge>
              ))}
            </div>
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Card className="rounded-none border-none border-t">
            <CardHeader className="py-2 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Select value={filter} onValueChange={(value) => setFilter(value as LogLevel | 'all')}>
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Logs</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warnings</SelectItem>
                      <SelectItem value="error">Errors</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <span className="text-xs text-muted-foreground">
                    Showing {filteredEntries.length} of {entries.length} entries
                  </span>
                </div>
                
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLogsToClipboard(filteredEntries)}
                    className="h-8 px-2"
                    disabled={filteredEntries.length === 0}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClear}
                    className="h-8 px-2"
                    disabled={entries.length === 0}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-0">
              <ScrollArea ref={scrollAreaRef} className="h-64">
                <div className="p-4 space-y-1">
                  {filteredEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No logs to display
                    </div>
                  ) : (
                    filteredEntries.map((entry) => (
                      <div 
                        key={entry.id} 
                        className="flex items-start gap-2 text-xs font-mono py-1 hover:bg-muted/50 rounded px-2 -mx-2"
                      >
                        <span className="text-muted-foreground flex-shrink-0 w-16">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        <span className={`flex-shrink-0 w-12 font-semibold ${LOG_COLORS[entry.level]}`}>
                          {entry.level.toUpperCase()}
                        </span>
                        {entry.source && (
                          <Badge variant="outline" className="text-xs px-1 py-0 h-4 flex-shrink-0">
                            {entry.source}
                          </Badge>
                        )}
                        <span className="flex-1 break-words">
                          {entry.message}
                        </span>
                        {entry.data && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Data
                            </summary>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-w-md">
                              {JSON.stringify(entry.data, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}