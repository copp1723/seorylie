import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Search, FileText, Globe, TrendingUp, Zap, Target, CheckCircle } from "lucide-react";

export default function SEODashboard() {
  const [keyword, setKeyword] = useState("");
  const [content, setContent] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 2000);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900">SEO RYLIE</h1>
          <p className="text-lg text-gray-600 mt-2">AI-Powered SEO Optimization Dashboard</p>
        </div>
        <Badge className="bg-green-500 text-white px-4 py-2 text-lg">DEMO MODE</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Keywords Tracked</p>
                <p className="text-2xl font-bold">248</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg. Position</p>
                <p className="text-2xl font-bold">12.4</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Content Score</p>
                <p className="text-2xl font-bold">87%</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pages Optimized</p>
                <p className="text-2xl font-bold">156</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content">Content Optimizer</TabsTrigger>
          <TabsTrigger value="keywords">Keyword Research</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Content Optimization</CardTitle>
              <CardDescription>
                Paste your content below and our AI will analyze it for SEO improvements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Target Keyword</label>
                <Input
                  placeholder="Enter your target keyword..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Content to Analyze</label>
                <Textarea
                  placeholder="Paste your content here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mt-1 min-h-[200px]"
                />
              </div>
              <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
                {analyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Analyze Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {!analyzing && keyword && content && (
            <Card>
              <CardHeader>
                <CardTitle>SEO Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Keyword Density</span>
                    <Badge variant="outline">2.3% (Optimal)</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Content Length</span>
                    <Badge variant="outline">1,245 words</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Readability Score</span>
                    <Badge variant="outline">Grade 8</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Meta Description</span>
                    <Badge variant="destructive">Missing</Badge>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">AI Recommendations:</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Add 2-3 more instances of your target keyword</li>
                    <li>• Include more semantic variations</li>
                    <li>• Add a compelling meta description (150-160 chars)</li>
                    <li>• Consider adding 2-3 relevant internal links</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Research Tool</CardTitle>
              <CardDescription>
                Discover high-value keywords for your content strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input placeholder="Enter seed keyword..." />
                <Button className="w-full">
                  <Search className="mr-2 h-4 w-4" />
                  Find Keywords
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>
                Track your SEO performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
                <BarChart className="h-16 w-16 text-gray-400" />
                <span className="ml-4 text-gray-500">Analytics visualization would go here</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO Reports</CardTitle>
              <CardDescription>
                Generate comprehensive SEO reports for your sites
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Site Audit Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Globe className="mr-2 h-4 w-4" />
                  Competitor Analysis Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Monthly Performance Report
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}