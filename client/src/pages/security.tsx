import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Key,
  Shield,
  Lock,
  UserCog,
  FileText,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw
} from "lucide-react";

export default function SecurityPage() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("api_key_●●●●●●●●●●●●●●●●●●●●●●●●");

  const handleGenerateNewKey = () => {
    // This would connect to an API in a real implementation
    if (confirm("Are you sure you want to generate a new API key? This will invalidate the existing key.")) {
      setApiKeyValue("api_key_newgeneratedkey123456789");
      setShowApiKey(true);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(showApiKey ? apiKeyValue.replace("●●●●●●●●●●●●●●●●●●●●●●●●", "actualkey123") : apiKeyValue);
    // Would show toast notification in real implementation
    alert("API Key copied to clipboard");
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">Security Settings</h1>
        <p className="text-gray-600">Manage security settings, API keys, and access controls for your account</p>
      </div>

      <Tabs defaultValue="api-keys" className="space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-md">
          <TabsTrigger value="api-keys" className="rounded-sm text-sm">
            <Key className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="access-control" className="rounded-sm text-sm">
            <UserCog className="h-4 w-4 mr-2" />
            Access Control
          </TabsTrigger>
          <TabsTrigger value="security-logs" className="rounded-sm text-sm">
            <FileText className="h-4 w-4 mr-2" />
            Security Logs
          </TabsTrigger>
          <TabsTrigger value="authentication" className="rounded-sm text-sm">
            <Lock className="h-4 w-4 mr-2" />
            Authentication
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage your API keys for direct integration with our services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">Live API Key</Label>
                <div className="flex space-x-2">
                  <div className="relative flex-grow">
                    <Input
                      id="api-key"
                      value={apiKeyValue}
                      readOnly
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-800"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerateNewKey}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate New Key
                  </Button>
                </div>
                <p className="text-xs text-amber-600 flex items-center mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Keep your API key secure. Don't share it publicly.
                </p>
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-medium mb-3">API Key History</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-sm">2025-05-20 09:41:32</TableCell>
                      <TableCell className="text-sm">2025-05-24 14:12:09</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive">
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-sm">2025-04-15 11:22:47</TableCell>
                      <TableCell className="text-sm">2025-05-20 09:35:18</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200">Revoked</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-gray-400" disabled>
                          Revoked
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Usage Limits</CardTitle>
              <CardDescription>
                View and configure API usage limits and rate limiting settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <div>
                    <h3 className="font-medium">Monthly API Calls</h3>
                    <p className="text-sm text-gray-500">Current plan limit: 10,000 calls</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-medium">4,382 / 10,000</div>
                    <p className="text-sm text-gray-500">Resets in 7 days</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <div>
                    <h3 className="font-medium">Rate Limit</h3>
                    <p className="text-sm text-gray-500">Maximum requests per minute</p>
                  </div>
                  <Input className="w-24 text-right" defaultValue="60" />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <Button>Update Limits</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access-control" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role-Based Access Control</CardTitle>
              <CardDescription>
                Manage user roles and permissions within your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Administrator</TableCell>
                    <TableCell className="text-sm">Full access to all system features and settings</TableCell>
                    <TableCell>2</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Manager</TableCell>
                    <TableCell className="text-sm">Can manage users and view reports, but cannot change system settings</TableCell>
                    <TableCell>3</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">User</TableCell>
                    <TableCell className="text-sm">Basic access to platform features</TableCell>
                    <TableCell>12</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="flex justify-end mt-4">
                <Button variant="outline">Create New Role</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>IP Restrictions</CardTitle>
              <CardDescription>
                Control access to your account based on IP addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch id="ip-restrictions" />
                  <Label htmlFor="ip-restrictions">Enable IP Restrictions</Label>
                </div>
                <Button variant="outline" size="sm">Add IP Range</Button>
              </div>

              <div className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP Range</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono">192.168.1.0/24</TableCell>
                      <TableCell className="text-sm">2025-05-10</TableCell>
                      <TableCell className="text-sm">2025-05-24</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive">Remove</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono">10.0.0.0/8</TableCell>
                      <TableCell className="text-sm">2025-05-15</TableCell>
                      <TableCell className="text-sm">2025-05-23</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="text-destructive">Remove</Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security-logs" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Security Audit Logs</CardTitle>
                <CardDescription>
                  Review security-related events and activities in your account
                </CardDescription>
              </div>
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Logs
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm">2025-05-24 14:32:15</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Login</Badge>
                    </TableCell>
                    <TableCell>admin@example.com</TableCell>
                    <TableCell className="font-mono text-xs">192.168.1.105</TableCell>
                    <TableCell className="text-sm">Successful login via password</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">2025-05-24 12:15:03</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Settings Changed</Badge>
                    </TableCell>
                    <TableCell>admin@example.com</TableCell>
                    <TableCell className="font-mono text-xs">192.168.1.105</TableCell>
                    <TableCell className="text-sm">API rate limit updated</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">2025-05-23 18:42:32</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed Login</Badge>
                    </TableCell>
                    <TableCell>user@example.com</TableCell>
                    <TableCell className="font-mono text-xs">203.0.113.42</TableCell>
                    <TableCell className="text-sm">Invalid password (3rd attempt)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">2025-05-23 15:10:45</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">API Key</Badge>
                    </TableCell>
                    <TableCell>admin@example.com</TableCell>
                    <TableCell className="font-mono text-xs">192.168.1.105</TableCell>
                    <TableCell className="text-sm">New API key generated</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">Showing 4 of 156 logs</div>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" disabled>Previous</Button>
                  <Button variant="outline" size="sm">Next</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="authentication" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Settings</CardTitle>
              <CardDescription>
                Configure authentication methods and security requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <div>
                    <Label className="text-base">Two-Factor Authentication</Label>
                    <p className="text-sm text-gray-500">Require 2FA for all users</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <div>
                    <Label className="text-base">Password Requirements</Label>
                    <p className="text-sm text-gray-500">Enforce strong password policy</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <div>
                    <Label className="text-base">Session Timeout</Label>
                    <p className="text-sm text-gray-500">Automatically log out inactive users</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input className="w-16 text-right" defaultValue="30" />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                  <div>
                    <Label className="text-base">Failed Login Attempts</Label>
                    <p className="text-sm text-gray-500">Lock account after consecutive failed attempts</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Input className="w-16 text-right" defaultValue="5" />
                    <span className="text-sm text-gray-500">attempts</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    <Label className="text-base">Single Sign-On</Label>
                    <p className="text-sm text-gray-500">Enable SSO authentication</p>
                  </div>
                  <Switch />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline">Reset</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}