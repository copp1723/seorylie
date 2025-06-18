import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

interface MetricCardWithSparklineProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  sparklineData?: Array<{ value: number }>;
  className?: string;
  format?: 'number' | 'currency' | 'percentage' | 'duration';
}

export function MetricCardWithSparkline({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  sparklineData,
  className,
  format = 'number'
}: MetricCardWithSparklineProps) {
  const formatValue = (val: string | number) => {
    if (typeof val === 'string') return val;
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'duration':
        const minutes = Math.floor(val / 60);
        const seconds = val % 60;
        return `${minutes}m ${seconds}s`;
      default:
        return val.toLocaleString();
    }
  };

  const getTrendIcon = () => {
    if (!trend || trend === 'neutral') {
      return <Minus className="h-4 w-4 text-gray-400" />;
    }
    if (trend === 'up') {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getTrendColor = () => {
    if (!trend || trend === 'neutral') return 'text-gray-600';
    return trend === 'up' ? 'text-green-600' : 'text-red-600';
  };

  const getSparklineColor = () => {
    if (!trend || trend === 'neutral') return '#9CA3AF';
    return trend === 'up' ? '#10B981' : '#EF4444';
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div className="flex-1">
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            {change !== undefined && (
              <div className="flex items-center text-sm mt-1">
                {getTrendIcon()}
                <span className={cn('ml-1', getTrendColor())}>
                  {Math.abs(change).toFixed(1)}%
                </span>
                {changeLabel && (
                  <span className="text-muted-foreground ml-1">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          
          {sparklineData && sparklineData.length > 0 && (
            <div className="w-24 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={getSparklineColor()}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}