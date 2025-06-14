import { lazy, Suspense, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Chart components lazy loading
export const LazyLineChart = lazy(() => 
  import('recharts').then(module => ({ default: module.LineChart }))
);

export const LazyBarChart = lazy(() => 
  import('recharts').then(module => ({ default: module.BarChart }))
);

export const LazyAreaChart = lazy(() => 
  import('recharts').then(module => ({ default: module.AreaChart }))
);

export const LazyPieChart = lazy(() => 
  import('recharts').then(module => ({ default: module.PieChart }))
);

export const LazyResponsiveContainer = lazy(() => 
  import('recharts').then(module => ({ default: module.ResponsiveContainer }))
);

// Export all recharts components as lazy
export const LazyRecharts = {
  LineChart: LazyLineChart,
  BarChart: LazyBarChart,
  AreaChart: LazyAreaChart,
  PieChart: LazyPieChart,
  ResponsiveContainer: LazyResponsiveContainer,
  Line: lazy(() => import('recharts').then(module => ({ default: module.Line }))),
  Bar: lazy(() => import('recharts').then(module => ({ default: module.Bar }))),
  Area: lazy(() => import('recharts').then(module => ({ default: module.Area }))),
  Pie: lazy(() => import('recharts').then(module => ({ default: module.Pie }))),
  XAxis: lazy(() => import('recharts').then(module => ({ default: module.XAxis }))),
  YAxis: lazy(() => import('recharts').then(module => ({ default: module.YAxis }))),
  CartesianGrid: lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid }))),
  Tooltip: lazy(() => import('recharts').then(module => ({ default: module.Tooltip }))),
  Legend: lazy(() => import('recharts').then(module => ({ default: module.Legend }))),
  Cell: lazy(() => import('recharts').then(module => ({ default: module.Cell }))),
};

// JSON Viewer lazy loading
export const LazyJsonView = lazy(() => 
  import('@uiw/react-json-view').then(module => ({ default: module.default }))
);

// Heavy page components
export const LazyAnalyticsPage = lazy(() => import('@/pages/analytics'));
export const LazyAgentStudioPage = lazy(() => import('@/pages/agent-studio'));
export const LazyPromptLibraryPage = lazy(() => import('@/pages/prompt-library'));
export const LazyAuditLogsPage = lazy(() => import('@/pages/audit-logs'));

// Heavy dashboard components
export const LazyAIAnalyticsDashboard = lazy(() => 
  import('@/components/dashboard/AIAnalyticsDashboard')
);
export const LazyIntegrationDashboard = lazy(() => 
  import('@/components/dashboard/IntegrationDashboard')
);
export const LazyMonitoringDashboard = lazy(() => 
  import('@/components/monitoring-dashboard')
);

// Loading components
export const ChartSkeleton = () => (
  <div className="w-full h-[300px] p-4">
    <Skeleton className="w-full h-full" />
  </div>
);

export const PageSkeleton = () => (
  <div className="space-y-4 p-4">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-32 w-full" />
  </div>
);

export const JsonViewSkeleton = () => (
  <div className="p-4 space-y-2">
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-4 w-1/2" />
  </div>
);

// Wrapper component for lazy loading with fallback
interface LazyLoadWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const LazyLoadWrapper: React.FC<LazyLoadWrapperProps> = ({ 
  children, 
  fallback = <PageSkeleton /> 
}) => {
  return <Suspense fallback={fallback}>{children}</Suspense>;
};

// HOC for lazy loading components with error boundary
export function withLazyLoad<P extends object>(
  Component: ComponentType<P>,
  fallback: React.ReactNode = <PageSkeleton />
) {
  return (props: P) => (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  );
}