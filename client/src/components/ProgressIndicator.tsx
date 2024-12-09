import { Progress } from "@/components/ui/progress";

interface ProgressIndicatorProps {
  progress: number;
}

export default function ProgressIndicator({ progress }: ProgressIndicatorProps) {
  return (
    <div className="p-4 bg-background/95">
      <div className="max-w-xl mx-auto">
        <h3 className="text-sm font-medium mb-2">
          Translating... {progress.toFixed(0)}%
        </h3>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}
