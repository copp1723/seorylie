import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Database, Upload, RefreshCw, Server } from "lucide-react";

export default function SetupPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">
          System Setup
        </h1>
        <p className="text-gray-600">
          Configure system settings, integrations, and customize your experience
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-md">
          <TabsTrigger value="general" className="rounded-sm text-sm">
            <Settings className="h-4 w-4 mr-2" />
            General Settings
          </TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-sm text-sm">
            <Server className="h-4 w-4 mr-2" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="data" className="rounded-sm text-sm">
            <Database className="h-4 w-4 mr-2" />
            Data Management
          </TabsTrigger>
          <TabsTrigger value="import" className="rounded-sm text-sm">
            <Upload className="h-4 w-4 mr-2" />
            Import/Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
              <CardDescription>
                Configure general application settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="app-name">Application Name</Label>
                  <Input
                    id="app-name"
                    defaultValue="Automotive Sales AI Platform"
                  />
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <Input id="timezone" defaultValue="America/New_York" />
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>Dark Mode</Label>
                    <span className="text-sm text-gray-500">
                      Enable dark mode by default
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="dark-mode" />
                  </div>
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>Notifications</Label>
                    <span className="text-sm text-gray-500">
                      Enable email notifications
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="notifications" defaultChecked />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline">Reset</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Personalization</CardTitle>
              <CardDescription>
                Customize your workspace appearance and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="language">Default Language</Label>
                  <Input id="language" defaultValue="English (US)" />
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>Compact View</Label>
                    <span className="text-sm text-gray-500">
                      Use compact density for tables and lists
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="compact-view" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline">Reset</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>External Integrations</CardTitle>
              <CardDescription>
                Connect to third-party services and APIs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>OpenAI Integration</Label>
                    <span className="text-sm text-gray-500">
                      Connect to OpenAI API for AI capabilities
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="openai-integration" defaultChecked />
                  </div>
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    defaultValue="●●●●●●●●●●●●●●●●"
                  />
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>CRM Integration</Label>
                    <span className="text-sm text-gray-500">
                      Connect to your CRM system
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="crm-integration" />
                  </div>
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="crm-endpoint">CRM API Endpoint</Label>
                  <Input
                    id="crm-endpoint"
                    placeholder="https://your-crm.example.com/api"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline">Reset</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Manage data storage and synchronization settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>Data Backup</Label>
                    <span className="text-sm text-gray-500">
                      Enable automatic data backups
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="data-backup" defaultChecked />
                  </div>
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <Label htmlFor="backup-frequency">Backup Frequency</Label>
                  <Input id="backup-frequency" defaultValue="Daily" />
                </div>

                <div className="grid grid-cols-2 items-center gap-4">
                  <div className="flex flex-col space-y-1">
                    <Label>Data Retention</Label>
                    <span className="text-sm text-gray-500">
                      Automatically archive old data
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="data-retention" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline">Reset</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Database Management</CardTitle>
              <CardDescription>
                Database settings and maintenance options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Database Status</h3>
                    <p className="text-sm text-gray-500">
                      Connected to PostgreSQL database
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Check Status
                  </Button>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">Database Optimization</h3>
                    <p className="text-sm text-gray-500">
                      Run optimization to improve performance
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    Optimize
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import/Export Data</CardTitle>
              <CardDescription>Import or export system data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Import Vehicle Inventory
                  </h3>
                  <div className="flex items-center gap-3">
                    <Input type="file" />
                    <Button size="sm">Upload</Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: CSV, TSV, Excel
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">
                    Export System Data
                  </h3>
                  <div className="flex flex-col space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Export Vehicle Inventory
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Export Customer Data
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-start"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Export Conversation History
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
