import { useState } from "react";
import { Card } from "@/components/ui/card";

interface PersonaData {
  name: string;
  value: number;
  percentage: string;
}

interface PersonaChartProps {
  data: PersonaData[];
}

// Define metric type for better type safety
type MetricType = "conversion" | "response" | "satisfaction";

export default function PersonaChart({ data }: PersonaChartProps) {
  const [metricType, setMetricType] = useState<MetricType>("conversion");

  return (
    <Card className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b">
        <h2 className="text-lg font-semibold">Persona Performance</h2>
        <div className="relative">
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as MetricType)}
            className="block w-full h-9 px-3 pr-8 text-sm border border-neutral-200 rounded-lg shadow-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="conversion">Conversion Rate</option>
            <option value="response">Response Time</option>
            <option value="satisfaction">Customer Satisfaction</option>
          </select>
          <span className="absolute top-2 right-2 material-icons text-neutral-400 text-sm pointer-events-none">
            arrow_drop_down
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="space-y-4">
          {data.map((item: PersonaData) => (
            <div key={item.name} className="mb-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-neutral-700">
                  {item.name}
                </span>
                <span className="text-xs font-medium text-neutral-500">
                  {item.percentage}
                </span>
              </div>
              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-1.5 bg-primary rounded-full"
                  style={{ width: `${item.value}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
