import { Card } from "@/components/ui/card";

interface StatusCardProps {
  title: string;
  value: string;
  icon: string;
  iconBgColor: string;
  iconColor: string;
  progressValue?: number;
  progressColor?: string;
  progressLabel?: string;
  trend?: {
    value: string;
    direction: "up" | "down";
    label: string;
  };
}

export default function StatusCard({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  progressValue,
  progressColor,
  progressLabel,
  trend,
}: StatusCardProps) {
  return (
    <Card className="p-5 bg-white hover:shadow-md transition-shadow rounded-xl overflow-hidden">
      <div className="flex items-center">
        <div className={`p-2.5 ${iconBgColor} rounded-lg`}>
          <span className={`material-icons ${iconColor}`}>{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className="text-2xl font-semibold mt-0.5">{value}</p>
        </div>
      </div>
      
      <div className="mt-5">
        {progressValue !== undefined && (
          <>
            <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div 
                className={`h-1.5 ${progressColor} rounded-full`} 
                style={{ width: `${progressValue}%` }}
              ></div>
            </div>
            {progressLabel && <p className="mt-1.5 text-xs text-neutral-500">{progressLabel}</p>}
          </>
        )}
        
        {trend && (
          <div className="flex items-center mt-1">
            <span className={`text-xs ${trend.direction === 'up' ? 'text-success' : 'text-error'} font-medium`}>
              {trend.value}
            </span>
            <span className="mx-1.5 text-xs text-neutral-400">•</span>
            <span className="text-xs text-neutral-500">{trend.label}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
