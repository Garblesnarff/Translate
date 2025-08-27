import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, ChevronDown, ChevronUp, Clock, Zap, Brain, Star } from "lucide-react";
import { useState } from "react";
import type { ProgressInfo } from "@/lib/gemini";

interface ProgressIndicatorProps {
  progress: number;
  progressInfo?: ProgressInfo | null;
  canCancel?: boolean;
  onCancel?: () => void;
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function formatConfidence(confidence?: number): string {
  if (confidence === undefined) return '';
  return `${(confidence * 100).toFixed(1)}%`;
}

function getProgressColor(progress: number): string {
  if (progress < 30) return 'bg-yellow-500';
  if (progress < 70) return 'bg-blue-500';
  if (progress < 90) return 'bg-purple-500';
  return 'bg-green-500';
}

export default function ProgressIndicator({ 
  progress, 
  progressInfo, 
  canCancel, 
  onCancel 
}: ProgressIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const progressColor = getProgressColor(progress);
  const isActive = progress > 0 && progress < 100;

  return (
    <Card className="mx-4 mb-4 bg-background/95 backdrop-blur-sm border shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'animate-pulse bg-blue-500' : 'bg-gray-400'}`} />
            {progressInfo?.message || 'Processing...'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {progressInfo?.timeElapsed && (
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {formatTime(progressInfo.timeElapsed)}
              </Badge>
            )}
            <span className="text-sm font-mono text-muted-foreground">
              {progress.toFixed(0)}%
            </span>
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <Progress 
            value={progress} 
            className={`h-2 transition-all duration-300 ${isActive ? 'animate-pulse' : ''}`}
          />
          
          {/* Page progress indicator */}
          {progressInfo?.currentPage && progressInfo?.totalPages && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                Page {progressInfo.currentPage} of {progressInfo.totalPages}
              </span>
              <span>
                {Math.round((progressInfo.currentPage / progressInfo.totalPages) * 100)}% complete
              </span>
            </div>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-xs">
            {progressInfo?.pageNumber && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Current:</span>
                <Badge variant={progressInfo.pageType === 'odd' ? 'default' : 'secondary'} className="text-xs">
                  Page {progressInfo.pageNumber} ({progressInfo.pageType})
                </Badge>
              </div>
            )}
            
            {progressInfo?.confidence && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" />
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-mono text-green-600">
                  {formatConfidence(progressInfo.confidence)}
                </span>
              </div>
            )}

            {progressInfo?.models && progressInfo.models > 1 && (
              <div className="flex items-center gap-1">
                <Brain className="w-3 h-3 text-purple-500" />
                <span className="text-muted-foreground">Models:</span>
                <span className="font-mono">{progressInfo.models}</span>
              </div>
            )}

            {progressInfo?.quality && (
              <Badge variant="outline" className="text-xs">
                Quality: {progressInfo.quality}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Expandable details */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-4 py-2 h-8">
            <span className="text-xs text-muted-foreground">
              {isExpanded ? 'Hide' : 'Show'} details
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-3 text-xs">
              {/* Processing metrics */}
              {progressInfo && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium text-muted-foreground">Translation Progress</h4>
                    {progressInfo.currentPage && progressInfo.totalPages && (
                      <div className="flex justify-between">
                        <span>Pages processed:</span>
                        <span className="font-mono">{progressInfo.currentPage}/{progressInfo.totalPages}</span>
                      </div>
                    )}
                    {progressInfo.timeElapsed && (
                      <div className="flex justify-between">
                        <span>Time elapsed:</span>
                        <span className="font-mono">{formatTime(progressInfo.timeElapsed)}</span>
                      </div>
                    )}
                    {progressInfo.estimatedTimeRemaining && (
                      <div className="flex justify-between">
                        <span>Est. remaining:</span>
                        <span className="font-mono text-blue-600">
                          {formatTime(progressInfo.estimatedTimeRemaining)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-muted-foreground">Quality Metrics</h4>
                    {progressInfo.confidence && (
                      <div className="flex justify-between">
                        <span>Confidence:</span>
                        <span className="font-mono text-green-600">
                          {formatConfidence(progressInfo.confidence)}
                        </span>
                      </div>
                    )}
                    {progressInfo.iterations && progressInfo.iterations > 1 && (
                      <div className="flex justify-between">
                        <span>Refinements:</span>
                        <span className="font-mono">{progressInfo.iterations}</span>
                      </div>
                    )}
                    {progressInfo.processingTime && (
                      <div className="flex justify-between">
                        <span>Processing time:</span>
                        <span className="font-mono">{progressInfo.processingTime}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress visualization */}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3 h-3 text-blue-500" />
                  <span className="font-medium text-muted-foreground">Processing Pipeline</span>
                </div>
                <div className="flex justify-between text-xs">
                  <Badge variant={progress > 0 ? 'default' : 'outline'} className="text-xs">Start</Badge>
                  <Badge variant={progress > 25 ? 'default' : 'outline'} className="text-xs">Translation</Badge>
                  <Badge variant={progress > 75 ? 'default' : 'outline'} className="text-xs">Quality Check</Badge>
                  <Badge variant={progress > 90 ? 'default' : 'outline'} className="text-xs">Finalize</Badge>
                  <Badge variant={progress >= 100 ? 'default' : 'outline'} className="text-xs">Complete</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
