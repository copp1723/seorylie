import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  name: string;
  count: number;
}

interface ConversationChartProps {
  data: ChartData[];
}

export default function ConversationChart({ data }: ConversationChartProps) {
  const [timeRange, setTimeRange] = useState("7days");

  return (
    <Card className="bg-white rounded-lg shadow card">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-medium">Conversation Volume</h2>
        <div className="relative">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="block w-full px-3 py-1.5 pr-8 text-sm border rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="90days">Last 90 Days</option>
          </select>
          <span className="absolute top-2 right-2 material-icons text-neutral-400 text-sm pointer-events-none">
            arrow_drop_down
          </span>
        </div>
      </div>
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#42a5f5"
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
