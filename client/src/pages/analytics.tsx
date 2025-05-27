import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";

// Sample data - in a real application, this would come from an API
const conversationData = [
  { name: "Mon", count: 12, handovers: 3 },
  { name: "Tue", count: 19, handovers: 5 },
  { name: "Wed", count: 15, handovers: 4 },
  { name: "Thu", count: 22, handovers: 7 },
  { name: "Fri", count: 25, handovers: 8 },
  { name: "Sat", count: 18, handovers: 6 },
  { name: "Sun", count: 10, handovers: 2 }
];

const responseTimeData = [
  { name: "00-04", avgTime: 2.1 },
  { name: "04-08", avgTime: 1.8 },
  { name: "08-12", avgTime: 3.5 },
  { name: "12-16", avgTime: 3.2 },
  { name: "16-20", avgTime: 2.9 },
  { name: "20-24", avgTime: 2.3 }
];

const intentData = [
  { name: "Inventory", value: 35 },
  { name: "Pricing", value: 25 },
  { name: "Trade-In", value: 15 },
  { name: "Financing", value: 12 },
  { name: "Test Drive", value: 8 },
  { name: "Other", value: 5 }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

const handoverReasonsData = [
  { name: "Complex pricing", value: 32 },
  { name: "Specific vehicle details", value: 28 },
  { name: "Financing options", value: 21 },
  { name: "Trade-in valuation", value: 15 },
  { name: "Test drive scheduling", value: 4 }
];

const customerSatisfactionData = [
  { name: "Very Satisfied", value: 45 },
  { name: "Satisfied", value: 30 },
  { name: "Neutral", value: 15 },
  { name: "Unsatisfied", value: 7 },
  { name: "Very Unsatisfied", value: 3 }
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 mb-2">Analytics Dashboard</h1>
          <p className="text-gray-600">View insights and performance metrics for your dealership</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-600">Time Range:</span>
          <Select defaultValue="7d" onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Total Conversations</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold">121</span>
              <span className="text-sm text-green-600">+15.3%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Handover Rate</CardTitle>
            <CardDescription>Conversations escalated to humans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold">28.9%</span>
              <span className="text-sm text-red-600">+2.4%</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Avg. Response Time</CardTitle>
            <CardDescription>Time to generate AI response</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-bold">2.6s</span>
              <span className="text-sm text-green-600">-0.3s</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conversations" className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-md">
          <TabsTrigger value="conversations" className="rounded-sm text-sm">
            Conversation Metrics
          </TabsTrigger>
          <TabsTrigger value="customer-intent" className="rounded-sm text-sm">
            Customer Intent
          </TabsTrigger>
          <TabsTrigger value="handovers" className="rounded-sm text-sm">
            Handover Analysis
          </TabsTrigger>
          <TabsTrigger value="satisfaction" className="rounded-sm text-sm">
            Customer Satisfaction
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Conversation Volume</CardTitle>
              <CardDescription>
                Number of conversations and handovers over time
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={conversationData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Total Conversations" fill="#8884d8" />
                  <Bar dataKey="handovers" name="Handovers" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Time by Hour</CardTitle>
              <CardDescription>
                Average response time throughout the day
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={responseTimeData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis unit="s" />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgTime"
                    name="Avg. Response Time"
                    stroke="#8884d8"
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer-intent" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Intent Distribution</CardTitle>
                <CardDescription>
                  Primary intent categories detected in conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={intentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {intentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Customer Questions</CardTitle>
                <CardDescription>
                  Most common customer queries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Pricing information</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: '68%' }} />
                      </div>
                      <span className="text-sm">68%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Vehicle availability</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: '55%' }} />
                      </div>
                      <span className="text-sm">55%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Trade-in value</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: '42%' }} />
                      </div>
                      <span className="text-sm">42%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Vehicle features</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: '38%' }} />
                      </div>
                      <span className="text-sm">38%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Financing options</span>
                    <div className="flex items-center">
                      <div className="w-32 h-2 bg-gray-200 rounded-full mr-2">
                        <div className="h-2 bg-blue-500 rounded-full" style={{ width: '29%' }} />
                      </div>
                      <span className="text-sm">29%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="handovers" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Handover Reasons</CardTitle>
                <CardDescription>
                  Primary reasons for escalation to human agents
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={handoverReasonsData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {handoverReasonsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Handover Timing</CardTitle>
                <CardDescription>
                  When handovers typically occur in conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { message: "1-2", count: 10 },
                      { message: "3-4", count: 25 },
                      { message: "5-6", count: 35 },
                      { message: "7-8", count: 18 },
                      { message: "9+", count: 12 }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="message" label={{ value: 'Message Number', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Handovers', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Handovers" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="satisfaction" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Satisfaction</CardTitle>
                <CardDescription>
                  Based on post-conversation surveys
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={customerSatisfactionData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {customerSatisfactionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sentiment Analysis</CardTitle>
                <CardDescription>
                  Customer sentiment during conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { name: "Day 1", positive: 65, negative: 12, neutral: 23 },
                      { name: "Day 2", positive: 68, negative: 10, neutral: 22 },
                      { name: "Day 3", positive: 60, negative: 15, neutral: 25 },
                      { name: "Day 4", positive: 72, negative: 8, neutral: 20 },
                      { name: "Day 5", positive: 70, negative: 9, neutral: 21 },
                      { name: "Day 6", positive: 75, negative: 7, neutral: 18 },
                      { name: "Day 7", positive: 78, negative: 6, neutral: 16 }
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis unit="%" />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="positive"
                      name="Positive"
                      stroke="#4caf50"
                      activeDot={{ r: 8 }}
                    />
                    <Line type="monotone" dataKey="neutral" name="Neutral" stroke="#ff9800" />
                    <Line type="monotone" dataKey="negative" name="Negative" stroke="#f44336" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}