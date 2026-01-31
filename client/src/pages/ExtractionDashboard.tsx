import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  TrendingUp,
  Database,
  GitBranch,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  alert?: boolean;
}

interface EntityTypeData {
  type: string;
  count: number;
}

interface ConfidenceData {
  range: string;
  count: number;
}

interface QualityAlert {
  type: 'warning' | 'error' | 'info';
  message: string;
  count?: number;
}

interface ExtractionJob {
  id: string;
  translationId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  entityCount: number;
  relationshipCount: number;
  averageConfidence: number | null;
  processingTime: number | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

interface AggregateMetrics {
  totalEntities: number;
  totalRelationships: number;
  avgConfidence: number;
  needsReview: number;
  verifiedEntities: number;
  avgProcessingTime: number;
  entityTypeBreakdown: EntityTypeData[];
  confidenceBreakdown: ConfidenceData[];
}

interface QualityReport {
  alerts: QualityAlert[];
  timestamp: string;
}

function MetricCard({ title, value, icon, trend, alert }: MetricCardProps) {
  return (
    <Card className={alert ? "border-orange-500" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <p className={`text-xs ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
            {trend > 0 ? '+' : ''}{trend}% from last week
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function QualityAlerts({ alerts }: { alerts: QualityAlert[] }) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'warning':
        return <Badge variant="default" className="bg-orange-500">Warning</Badge>;
      case 'info':
        return <Badge variant="outline">Info</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
          {getAlertIcon(alert.type)}
          <div className="flex-1">
            <p className="text-sm font-medium">{alert.message}</p>
          </div>
          {getAlertBadge(alert.type)}
        </div>
      ))}
    </div>
  );
}

function ExtractionList({ extractions }: { extractions: ExtractionJob[] }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b">
          <tr className="text-left">
            <th className="pb-3 text-sm font-medium">Job ID</th>
            <th className="pb-3 text-sm font-medium">Translation</th>
            <th className="pb-3 text-sm font-medium">Status</th>
            <th className="pb-3 text-sm font-medium">Entities</th>
            <th className="pb-3 text-sm font-medium">Relations</th>
            <th className="pb-3 text-sm font-medium">Confidence</th>
            <th className="pb-3 text-sm font-medium">Time</th>
            <th className="pb-3 text-sm font-medium">Date</th>
          </tr>
        </thead>
        <tbody>
          {extractions.map((job) => (
            <tr key={job.id} className="border-b hover:bg-muted/50">
              <td className="py-3 text-sm font-mono">{job.id.slice(0, 8)}...</td>
              <td className="py-3 text-sm">#{job.translationId}</td>
              <td className="py-3">{getStatusBadge(job.status)}</td>
              <td className="py-3 text-sm">{job.entityCount}</td>
              <td className="py-3 text-sm">{job.relationshipCount}</td>
              <td className="py-3 text-sm">
                {job.averageConfidence !== null
                  ? `${(job.averageConfidence * 100).toFixed(1)}%`
                  : 'N/A'}
              </td>
              <td className="py-3 text-sm">{formatTime(job.processingTime)}</td>
              <td className="py-3 text-sm">
                {job.completedAt
                  ? new Date(job.completedAt).toLocaleDateString()
                  : job.startedAt
                  ? new Date(job.startedAt).toLocaleDateString()
                  : 'N/A'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntityTypeChart({ data }: { data: EntityTypeData[] }) {
  const maxCount = Math.max(...data.map(d => d.count));

  const formatType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.type} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{formatType(item.type)}</span>
            <span className="text-muted-foreground">{item.count}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ConfidenceChart({ data }: { data: ConfidenceData[] }) {
  const maxCount = Math.max(...data.map(d => d.count));

  const getColor = (range: string) => {
    if (range.startsWith('0-') || range.startsWith('30-')) return 'bg-red-500';
    if (range.startsWith('50-')) return 'bg-orange-500';
    if (range.startsWith('70-')) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.range} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{item.range}</span>
            <span className="text-muted-foreground">{item.count}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`${getColor(item.range)} h-2 rounded-full transition-all`}
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExtractionDashboard() {
  const { toast } = useToast();

  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useQuery({
    queryKey: ['/api/metrics/aggregate'],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const {
    data: qualityData,
    isLoading: qualityLoading,
    refetch: refetchQuality
  } = useQuery({
    queryKey: ['/api/metrics/quality'],
    refetchInterval: 60000, // Auto-refresh every minute
  });

  const {
    data: jobsData,
    isLoading: jobsLoading,
    refetch: refetchJobs
  } = useQuery({
    queryKey: ['/api/extract/jobs?limit=10'],
    refetchInterval: 15000, // Auto-refresh every 15 seconds
  });

  const metrics: AggregateMetrics | undefined = (metricsData as any)?.metrics;
  const qualityReport: QualityReport | undefined = (qualityData as any)?.qualityReport;
  const recentJobs: ExtractionJob[] = (jobsData as any)?.jobs || [];

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetchMetrics(),
        refetchQuality(),
        refetchJobs()
      ]);
      toast({
        title: "Dashboard refreshed",
        description: "All metrics have been updated",
      });
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Failed to refresh dashboard data",
        variant: "destructive",
      });
    }
  };

  if (metricsLoading && !metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (metricsError && !metrics) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{metricsError instanceof Error ? metricsError.message : 'Failed to load metrics'}</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Entity Extraction Dashboard</h1>
        <Button
          onClick={handleRefresh}
          disabled={metricsLoading || qualityLoading || jobsLoading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(metricsLoading || qualityLoading || jobsLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overview Stats */}
      {metrics && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Entities"
              value={metrics.totalEntities.toLocaleString()}
              icon={<Database className="h-4 w-4" />}
            />
            <MetricCard
              title="Avg Confidence"
              value={`${(metrics.avgConfidence * 100).toFixed(1)}%`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <MetricCard
              title="Needs Review"
              value={metrics.needsReview.toLocaleString()}
              icon={<AlertTriangle className="h-4 w-4" />}
              alert={metrics.needsReview > 100}
            />
            <MetricCard
              title="Processing Time"
              value={`${metrics.avgProcessingTime}ms`}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MetricCard
              title="Total Relationships"
              value={metrics.totalRelationships.toLocaleString()}
              icon={<GitBranch className="h-4 w-4" />}
            />
            <MetricCard
              title="Verified Entities"
              value={metrics.verifiedEntities.toLocaleString()}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>

          {/* Entity Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Entity Types Extracted</CardTitle>
              <CardDescription>
                Distribution of entity types across all extractions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.entityTypeBreakdown.length > 0 ? (
                <EntityTypeChart data={metrics.entityTypeBreakdown} />
              ) : (
                <p className="text-muted-foreground text-center py-8">No entity data available</p>
              )}
            </CardContent>
          </Card>

          {/* Confidence Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Confidence Score Distribution</CardTitle>
              <CardDescription>
                Quality distribution of extracted entities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.confidenceBreakdown.length > 0 ? (
                <ConfidenceChart data={metrics.confidenceBreakdown} />
              ) : (
                <p className="text-muted-foreground text-center py-8">No confidence data available</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Quality Alerts */}
      {qualityReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Quality Alerts
            </CardTitle>
            <CardDescription>
              Issues and warnings detected in extracted data
            </CardDescription>
          </CardHeader>
          <CardContent>
            {qualityLoading && !qualityReport ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <QualityAlerts alerts={qualityReport.alerts} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Extractions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Extractions</CardTitle>
          <CardDescription>
            Latest entity extraction jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobsLoading && recentJobs.length === 0 ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : recentJobs.length > 0 ? (
            <ExtractionList extractions={recentJobs} />
          ) : (
            <p className="text-muted-foreground text-center py-8">No extraction jobs found</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
