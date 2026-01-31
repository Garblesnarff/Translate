import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, Database, Key, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface KeyInfo {
  displayName: string;
  status: 'available' | 'rate_limited' | 'disabled';
  callsToday: number;
  resetIn?: string;
  disabledReason?: string;
}

interface PoolStatus {
  poolName: string;
  totalKeys: number;
  availableKeys: number;
  rateLimitedKeys: number;
  disabledKeys: number;
  keys: KeyInfo[];
}

interface ProviderState {
  available: boolean;
  disabledUntil?: number;
  disabledReason?: string;
  errorCount: number;
  lastError?: string;
  successfulCalls: number;
  totalCalls: number;
  averageResponseTime: number;
}

interface ApiStatus {
  timestamp: string;
  services: {
    gemini: {
      odd: {
        pageType: string;
        keyPool: PoolStatus;
      };
      even: {
        pageType: string;
        keyPool: PoolStatus;
      };
    };
    aiProviders: Record<string, ProviderState>;
  };
  database: {
    connected: boolean;
    type: string;
  };
  environment: {
    nodeEnv: string;
    port: string;
    hasGeminiOddKey: boolean;
    hasGeminiEvenKey: boolean;
    hasBackupKeys: boolean;
    backupKeyCount: number;
  };
}

export default function Dashboard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch status';
      setError(errorMsg);
      toast({
        title: "Error fetching status",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string, resetIn?: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="default" className="bg-green-500">Available</Badge>;
      case 'rate_limited':
        return <Badge variant="destructive">Rate Limited {resetIn ? `(${resetIn})` : ''}</Badge>;
      case 'disabled':
        return <Badge variant="secondary">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProviderBadge = (provider: ProviderState) => {
    if (!provider.available) {
      return <Badge variant="destructive">Disabled</Badge>;
    }
    return <Badge variant="default" className="bg-green-500">Available</Badge>;
  };

  if (loading && !status) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button onClick={fetchStatus} className="mt-4">
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
        <h1 className="text-3xl font-bold">API Dashboard</h1>
        <Button 
          onClick={fetchStatus} 
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {status && (
        <>
          {/* Environment Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Server className="h-5 w-5 mr-2" />
                Environment
              </CardTitle>
              <CardDescription>
                Last updated: {new Date(status.timestamp).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Environment</p>
                <p className="text-2xl font-bold">{status.environment.nodeEnv}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Database</p>
                <p className="text-2xl font-bold flex items-center">
                  <Database className="h-4 w-4 mr-1" />
                  {status.database.type}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Primary Keys</p>
                <p className="text-2xl font-bold">
                  {(status.environment.hasGeminiOddKey ? 1 : 0) + (status.environment.hasGeminiEvenKey ? 1 : 0)}/2
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Backup Keys</p>
                <p className="text-2xl font-bold">{status.environment.backupKeyCount}</p>
              </div>
            </CardContent>
          </Card>

          {/* Gemini Key Pools */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Odd Pages Pool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  Gemini Odd Pages Pool
                </CardTitle>
                <CardDescription>
                  {status.services.gemini.odd.keyPool.availableKeys}/{status.services.gemini.odd.keyPool.totalKeys} keys available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.services.gemini.odd.keyPool.keys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{key.displayName}</p>
                        <p className="text-sm text-muted-foreground">{key.callsToday} calls today</p>
                        {key.disabledReason && (
                          <p className="text-sm text-red-600">{key.disabledReason}</p>
                        )}
                      </div>
                      {getStatusBadge(key.status, key.resetIn)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Even Pages Pool */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  Gemini Even Pages Pool
                </CardTitle>
                <CardDescription>
                  {status.services.gemini.even.keyPool.availableKeys}/{status.services.gemini.even.keyPool.totalKeys} keys available
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.services.gemini.even.keyPool.keys.map((key, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{key.displayName}</p>
                        <p className="text-sm text-muted-foreground">{key.callsToday} calls today</p>
                        {key.disabledReason && (
                          <p className="text-sm text-red-600">{key.disabledReason}</p>
                        )}
                      </div>
                      {getStatusBadge(key.status, key.resetIn)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Providers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                AI Providers
              </CardTitle>
              <CardDescription>
                Helper AI services status and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(status.services.aiProviders).map(([name, provider]) => (
                  <div key={name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium capitalize">{name}</h3>
                      {getProviderBadge(provider)}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>Success: {provider.successfulCalls}/{provider.totalCalls}</p>
                      <p>Avg Response: {provider.averageResponseTime.toFixed(0)}ms</p>
                      {provider.errorCount > 0 && (
                        <p className="text-red-600">Errors: {provider.errorCount}</p>
                      )}
                      {provider.disabledReason && (
                        <p className="text-red-600">{provider.disabledReason}</p>
                      )}
                      {provider.disabledUntil && (
                        <p className="text-orange-600">
                          Disabled until: {new Date(provider.disabledUntil).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}