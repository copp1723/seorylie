/**
 * Feature Flag Management UI Component
 * 
 * Admin interface for managing feature flags
 * 
 * @file client/src/components/admin/FeatureFlagManager.tsx
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, AlertTriangle, Settings, Eye } from 'lucide-react';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  deprecated?: boolean;
  deprecationDate?: string;
  rolloutPercentage?: number;
  environments?: string[];
}

interface FeatureFlagConfig {
  flags: Record<string, FeatureFlag>;
  version: string;
  lastUpdated: string;
}

export const FeatureFlagManager: React.FC = () => {
  const [config, setConfig] = useState<FeatureFlagConfig | null>(null);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<string>('development');

  // Fetch feature flags configuration
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags');
      if (!response.ok) throw new Error('Failed to fetch feature flags');
      const data = await response.json();
      setConfig(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Fetch current status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/admin/feature-flags/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data.data.flags);
      setEnvironment(data.data.environment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Toggle feature flag
  const toggleFlag = async (flagName: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/feature-flags/${flagName}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      if (!response.ok) throw new Error('Failed to toggle flag');
      
      // Refresh data
      await fetchConfig();
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Deprecate flag
  const deprecateFlag = async (flagName: string) => {
    try {
      const response = await fetch(`/api/admin/feature-flags/${flagName}/deprecate`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to deprecate flag');
      
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Cleanup deprecated flags
  const cleanupFlags = async (days: number = 30) => {
    try {
      const response = await fetch(`/api/admin/feature-flags/cleanup?days=${days}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to cleanup flags');
      
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchConfig(), fetchStatus()]);
      setLoading(false);
    };
    
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading feature flags...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!config) {
    return (
      <Alert>
        <AlertDescription>No feature flag configuration found.</AlertDescription>
      </Alert>
    );
  }

  const deprecatedFlags = Object.values(config.flags).filter(flag => flag.deprecated);
  const activeFlags = Object.values(config.flags).filter(flag => !flag.deprecated);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Feature Flag Manager</h1>
          <p className="text-muted-foreground">
            Environment: <Badge variant="outline">{environment}</Badge>
            {' | '}
            Last updated: {new Date(config.lastUpdated).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => cleanupFlags(30)}
            disabled={deprecatedFlags.length === 0}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup Deprecated ({deprecatedFlags.length})
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{Object.keys(config.flags).length}</div>
            <p className="text-sm text-muted-foreground">Total Flags</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {Object.values(status).filter(Boolean).length}
            </div>
            <p className="text-sm text-muted-foreground">Enabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {Object.values(status).filter(s => !s).length}
            </div>
            <p className="text-sm text-muted-foreground">Disabled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {deprecatedFlags.length}
            </div>
            <p className="text-sm text-muted-foreground">Deprecated</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Active Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activeFlags.map((flag) => (
              <div 
                key={flag.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{flag.name}</h3>
                    {flag.environments && (
                      <div className="flex gap-1">
                        {flag.environments.map(env => (
                          <Badge key={env} variant="secondary" className="text-xs">
                            {env}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {flag.rolloutPercentage !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {flag.rolloutPercentage}% rollout
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{flag.description}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {status[flag.name] ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={status[flag.name] || false}
                      onCheckedChange={(enabled) => toggleFlag(flag.name, enabled)}
                    />
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deprecateFlag(flag.name)}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Deprecated Flags */}
      {deprecatedFlags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Deprecated Feature Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deprecatedFlags.map((flag) => (
                <div 
                  key={flag.name}
                  className="flex items-center justify-between p-3 border rounded-lg bg-orange-50"
                >
                  <div>
                    <h3 className="font-semibold text-orange-800">{flag.name}</h3>
                    <p className="text-sm text-orange-600">{flag.description}</p>
                    {flag.deprecationDate && (
                      <p className="text-xs text-orange-500">
                        Deprecated: {new Date(flag.deprecationDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge variant="destructive">Deprecated</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};