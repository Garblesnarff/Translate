import { useEffect, useRef } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LogEntry, LOG_COLORS } from '@/types/log';
import { ProgressInfo } from '@/lib/gemini';
import { Activity, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

interface ConsensusPanelProps {
  logs: LogEntry[];
  progressInfo: ProgressInfo | null;
  isActive: boolean;
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

export default function ConsensusPanel({ logs, progressInfo, isActive }: ConsensusPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            AI Consensus
          </CardTitle>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <Separator />

      {/* Consensus Metrics */}
      {progressInfo && (
        <CardContent className="py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Page Info */}
            {progressInfo.currentPage !== undefined && progressInfo.totalPages !== undefined && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Progress</div>
                <div className="text-lg font-semibold">
                  {progressInfo.currentPage}/{progressInfo.totalPages}
                </div>
              </div>
            )}

            {/* Models Used */}
            {progressInfo.models !== undefined && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Models</div>
                <div className="text-lg font-semibold flex items-center gap-1">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  {progressInfo.models}
                </div>
              </div>
            )}

            {/* Confidence Score */}
            {progressInfo.confidence !== undefined && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="text-lg font-semibold flex items-center gap-1">
                  {progressInfo.confidence >= 0.8 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                  )}
                  {(progressInfo.confidence * 100).toFixed(0)}%
                </div>
              </div>
            )}

            {/* Quality */}
            {progressInfo.quality && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Quality</div>
                <Badge variant={progressInfo.quality === 'high' ? 'default' : 'secondary'}>
                  {progressInfo.quality}
                </Badge>
              </div>
            )}

            {/* Iterations */}
            {progressInfo.iterations !== undefined && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Iterations</div>
                <div className="text-lg font-semibold">
                  {progressInfo.iterations}
                </div>
              </div>
            )}

            {/* Processing Time */}
            {progressInfo.processingTime !== undefined && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Process Time</div>
                <div className="text-sm font-medium">
                  {(progressInfo.processingTime / 1000).toFixed(1)}s
                </div>
              </div>
            )}
          </div>

          {/* Current Status Message */}
          {progressInfo.message && (
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <div className="text-sm bg-muted p-2 rounded">
                {progressInfo.message}
              </div>
            </div>
          )}
        </CardContent>
      )}

      <Separator />

      {/* Logs Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Translation Logs</h3>
            <Badge variant="outline" className="text-xs">
              {logs.length}
            </Badge>
          </div>
        </div>

        <ScrollArea ref={scrollAreaRef} className="flex-1 px-4">
          <div className="space-y-1 pb-4">
            {logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No logs yet
              </div>
            ) : (
              logs.map((entry) => (
                <div
                  key={entry.id}
                  className="text-xs font-mono py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground flex-shrink-0 text-[10px]">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                    <span className={`flex-shrink-0 font-semibold text-[10px] ${LOG_COLORS[entry.level]}`}>
                      {entry.level.toUpperCase()}
                    </span>
                  </div>
                  {entry.source && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-3 mt-1">
                      {entry.source}
                    </Badge>
                  )}
                  <div className="mt-1 break-words text-[11px]">
                    {entry.message}
                  </div>
                  {entry.data && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-[10px]">
                        Details
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-auto">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
}
