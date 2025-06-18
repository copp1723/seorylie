import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Users, 
  Activity, 
  Globe, 
  Monitor, 
  Smartphone, 
  Tablet,
  Circle
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface RealTimeUser {
  id: string;
  page: string;
  country: string;
  city: string;
  deviceCategory: string;
  source: string;
  duration: number;
  timestamp: Date;
}

interface RealTimeStats {
  activeUsers: number;
  pageViewsPerMinute: number;
  avgSessionDuration: number;
  topPages: Array<{
    page: string;
    users: number;
    percentage: number;
  }>;
  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  locations: Array<{
    country: string;
    city: string;
    users: number;
  }>;
  activeUsersList: RealTimeUser[];
}

interface RealTimeTrafficProps {
  propertyId: string;
}

export function RealTimeTraffic({ propertyId }: RealTimeTrafficProps) {
  const [pulseAnimation, setPulseAnimation] = useState(false);
  
  // Fetch real-time data
  const { data, isLoading, error } = useQuery({
    queryKey: ['realtime-traffic', propertyId],
    queryFn: async () => {
      const response = await fetch(`/api/ga4/realtime?propertyId=${propertyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch real-time data');
      }

      return response.json() as Promise<RealTimeStats>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: true,
  });

  // Trigger pulse animation when user count changes
  useEffect(() => {
    if (data?.activeUsers) {
      setPulseAnimation(true);
      const timer = setTimeout(() => setPulseAnimation(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [data?.activeUsers]);

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getDevicePercentage = (device: keyof typeof data.devices) => {
    if (!data) return 0;
    const total = data.devices.desktop + data.devices.mobile + data.devices.tablet;
    return total > 0 ? (data.devices[device] / total) * 100 : 0;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-Time Traffic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse">Loading real-time data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-Time Traffic
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Real-time data unavailable
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-Time Traffic
          </CardTitle>
          <div className="flex items-center gap-2">
            <Circle className={cn(
              "h-3 w-3 fill-current",
              pulseAnimation && "animate-pulse",
              data.activeUsers > 0 ? "text-green-500" : "text-gray-400"
            )} />
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
        </div>
        <CardDescription>
          Active users on your site right now
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Users Counter */}
        <div className="text-center">
          <div className={cn(
            "text-6xl font-bold transition-all duration-500",
            pulseAnimation && "scale-110"
          )}>
            {data.activeUsers}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Active Users
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Page Views/Min</p>
            <p className="text-2xl font-semibold">{data.pageViewsPerMinute}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg. Duration</p>
            <p className="text-2xl font-semibold">
              {Math.floor(data.avgSessionDuration / 60)}m {data.avgSessionDuration % 60}s
            </p>
          </div>
        </div>

        {/* Device Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Devices</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Desktop</span>
                  <span>{data.devices.desktop} ({getDevicePercentage('desktop').toFixed(0)}%)</span>
                </div>
                <Progress value={getDevicePercentage('desktop')} className="h-2 mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Mobile</span>
                  <span>{data.devices.mobile} ({getDevicePercentage('mobile').toFixed(0)}%)</span>
                </div>
                <Progress value={getDevicePercentage('mobile')} className="h-2 mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Tablet className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Tablet</span>
                  <span>{data.devices.tablet} ({getDevicePercentage('tablet').toFixed(0)}%)</span>
                </div>
                <Progress value={getDevicePercentage('tablet')} className="h-2 mt-1" />
              </div>
            </div>
          </div>
        </div>

        {/* Top Pages */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Top Active Pages</h4>
          <div className="space-y-2">
            {data.topPages.slice(0, 5).map((page, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm truncate flex-1 mr-2">{page.page}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {page.users}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Locations */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Top Locations
          </h4>
          <div className="space-y-2">
            {data.locations.slice(0, 5).map((location, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <span>
                  {location.city}, {location.country}
                </span>
                <Badge variant="outline" className="text-xs">
                  {location.users}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Active Users List */}
        {data.activeUsersList.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {data.activeUsersList.slice(0, 10).map((user) => (
                <div key={user.id} className="flex items-center gap-2 text-xs">
                  {getDeviceIcon(user.deviceCategory)}
                  <span className="text-muted-foreground">
                    {user.country} • {user.page}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}