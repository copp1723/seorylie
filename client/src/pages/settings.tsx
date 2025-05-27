import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface ApiKey {
  id: number;
  key: string;
  description: string;
  dealershipName: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");

  // Sample API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: 1,
      key: "ryk_f8a72e1b...",
      description: "Production API Key",
      dealershipName: "Florida Motors",
      isActive: true,
      createdAt: "2023-05-15T10:30:00Z",
      lastUsedAt: "2023-06-15T14:45:00Z",
    },
    {
      id: 2,
      key: "ryk_9d8c5b3a...",
      description: "Test Environment",
      dealershipName: "Florida Motors",
      isActive: true,
      createdAt: "2023-05-20T11:15:00Z",
      lastUsedAt: "2023-06-10T09:30:00Z",
    },
    {
      id: 3,
      key: "ryk_7e6f4d2b...",
      description: "Development Key",
      dealershipName: "Texas Auto Group",
      isActive: false,
      createdAt: "2023-04-10T08:45:00Z",
      lastUsedAt: null,
    },
  ]);

  // Sample users
  const [users, setUsers] = useState<User[]>([
    {
      id: 1,
      name: "Alex Johnson",
      email: "alex.johnson@example.com",
      role: "Administrator",
      isActive: true,
    },
    {
      id: 2,
      name: "Sarah Williams",
      email: "sarah.williams@example.com",
      role: "Manager",
      isActive: true,
    },
    {
      id: 3,
      name: "Michael Brown",
      email: "michael.brown@example.com",
      role: "Support",
      isActive: true,
    },
    {
      id: 4,
      name: "Jessica Davis",
      email: "jessica.davis@example.com",
      role: "Support",
      isActive: false,
    },
  ]);

  // Settings state
  const [settings, setSettings] = useState({
    enableAutoEscalation: true,
    autoEscalationThreshold: 3,
    defaultResponseTime: 1.0,
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    logRetentionDays: 90,
    enableDebugMode: false,
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const toggleApiKeyStatus = (id: number) => {
    setApiKeys(
      apiKeys.map((key) =>
        key.id === id ? { ...key, isActive: !key.isActive } : key
      )
    );
  };

  const toggleUserStatus = (id: number) => {
    setUsers(
      users.map((user) =>
        user.id === id ? { ...user, isActive: !user.isActive } : user
      )
    );
  };

  return (
    <>
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <h1 className="text-2xl font-medium">Settings</h1>
      </div>

      <Tabs defaultValue="general" onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white shadow mb-6 p-1 rounded-lg">
          <TabsTrigger value="general" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">settings</span>
            General
          </TabsTrigger>
          <TabsTrigger value="api" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">api</span>
            API Keys
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">people</span>
            Users & Permissions
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">notifications</span>
            Notifications
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-md px-4 py-2">
            <span className="material-icons mr-2 text-sm">history</span>
            Logs & Debugging
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="p-6">
            <h2 className="text-lg font-medium mb-4">General Settings</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-md font-medium">Conversation Settings</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-escalation" className="font-medium">
                      Automatic Escalation
                    </Label>
                    <p className="text-sm text-neutral-500">
                      Automatically escalate conversations based on keywords and confidence scores
                    </p>
                  </div>
                  <Switch
                    id="auto-escalation"
                    checked={settings.enableAutoEscalation}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enableAutoEscalation", checked)
                    }
                  />
                </div>

                {settings.enableAutoEscalation && (
                  <div className="ml-6 pt-2">
                    <Label htmlFor="escalation-threshold" className="mb-2 block">
                      Escalation Threshold (Lower is more sensitive)
                    </Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="escalation-threshold"
                        type="number"
                        min="1"
                        max="10"
                        value={settings.autoEscalationThreshold}
                        onChange={(e) =>
                          handleSettingChange(
                            "autoEscalationThreshold",
                            parseInt(e.target.value)
                          )
                        }
                        className="w-24"
                      />
                      <div className="relative w-48 h-2 bg-neutral-100 rounded-full">
                        <div
                          className={`h-2 bg-primary rounded-full`}
                          style={{
                            width: `${
                              (settings.autoEscalationThreshold / 10) * 100
                            }%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {settings.autoEscalationThreshold <= 3
                          ? "Sensitive"
                          : settings.autoEscalationThreshold <= 7
                          ? "Balanced"
                          : "Tolerant"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-md font-medium">Response Time</h3>
                <div>
                  <Label htmlFor="response-time" className="mb-2 block">
                    Default Target Response Time (seconds)
                  </Label>
                  <Input
                    id="response-time"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={settings.defaultResponseTime}
                    onChange={(e) =>
                      handleSettingChange(
                        "defaultResponseTime",
                        parseFloat(e.target.value)
                      )
                    }
                    className="w-48"
                  />
                </div>
              </div>

              <Separator />

              <div className="pt-4 flex justify-end space-x-3">
                <Button variant="outline">Cancel</Button>
                <Button>Save Changes</Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium">API Keys</h2>
              <Button className="inline-flex items-center">
                <span className="material-icons text-sm mr-1">add</span>
                Generate New Key
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      DESCRIPTION
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      KEY
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      DEALERSHIP
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      CREATED
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      LAST USED
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      STATUS
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3 font-medium">
                        {apiKey.description}
                      </td>
                      <td className="px-4 py-3">
                        <code className="bg-neutral-100 px-2 py-1 rounded text-xs">
                          {apiKey.key}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {apiKey.dealershipName}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(apiKey.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {apiKey.lastUsedAt
                          ? new Date(apiKey.lastUsedAt).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            apiKey.isActive
                              ? "text-success-800 bg-success-100"
                              : "text-error-800 bg-error-100"
                          }`}
                        >
                          {apiKey.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => toggleApiKeyStatus(apiKey.id)}
                            className="p-1 text-neutral-500 rounded hover:bg-neutral-100"
                            title={
                              apiKey.isActive ? "Deactivate Key" : "Activate Key"
                            }
                          >
                            <span className="material-icons text-sm">
                              {apiKey.isActive ? "toggle_on" : "toggle_off"}
                            </span>
                          </button>
                          <button
                            className="p-1 text-neutral-500 rounded hover:bg-neutral-100"
                            title="Copy Key"
                          >
                            <span className="material-icons text-sm">
                              content_copy
                            </span>
                          </button>
                          <button
                            className="p-1 text-error rounded hover:bg-neutral-100"
                            title="Delete Key"
                          >
                            <span className="material-icons text-sm">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 text-sm text-neutral-500">
              <p className="flex items-center">
                <span className="material-icons text-sm mr-1 text-warning">
                  warning
                </span>
                API keys provide full access to your account. Keep them secure and
                never share them in public repositories or client-side code.
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Users & Permissions */}
        <TabsContent value="users">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-medium">Users & Permissions</h2>
              <Button className="inline-flex items-center">
                <span className="material-icons text-sm mr-1">add</span>
                Add User
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-neutral-50">
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      NAME
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      EMAIL
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      ROLE
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      STATUS
                    </th>
                    <th className="px-4 py-2 text-xs font-medium text-left text-neutral-500">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-neutral-200 rounded-full flex items-center justify-center text-neutral-500 mr-2">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <span className="font-medium">{user.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{user.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.role === "Administrator"
                              ? "bg-primary/10 text-primary"
                              : user.role === "Manager"
                              ? "bg-success/10 text-success"
                              : "bg-neutral-100 text-neutral-800"
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                            user.isActive
                              ? "text-success-800 bg-success-100"
                              : "text-error-800 bg-error-100"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex space-x-2">
                          <button
                            className="p-1 text-neutral-500 rounded hover:bg-neutral-100"
                          >
                            <span className="material-icons text-sm">edit</span>
                          </button>
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className="p-1 text-neutral-500 rounded hover:bg-neutral-100"
                          >
                            <span className="material-icons text-sm">
                              {user.isActive ? "toggle_on" : "toggle_off"}
                            </span>
                          </button>
                          {user.id !== 1 && (
                            <button className="p-1 text-error rounded hover:bg-neutral-100">
                              <span className="material-icons text-sm">
                                delete
                              </span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="p-6">
            <h2 className="text-lg font-medium mb-4">Notification Settings</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-md font-medium">Email Notifications</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications" className="font-medium">
                      Enable Email Notifications
                    </Label>
                    <p className="text-sm text-neutral-500">
                      Receive email notifications for escalations and system alerts
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={settings.enableEmailNotifications}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enableEmailNotifications", checked)
                    }
                  />
                </div>

                <div className="ml-6 pt-2 space-y-3">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email-escalations"
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      checked={true}
                      disabled={!settings.enableEmailNotifications}
                    />
                    <label
                      htmlFor="email-escalations"
                      className={`ml-2 text-sm ${
                        !settings.enableEmailNotifications
                          ? "text-neutral-400"
                          : ""
                      }`}
                    >
                      Conversation escalations
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email-api-errors"
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      checked={true}
                      disabled={!settings.enableEmailNotifications}
                    />
                    <label
                      htmlFor="email-api-errors"
                      className={`ml-2 text-sm ${
                        !settings.enableEmailNotifications
                          ? "text-neutral-400"
                          : ""
                      }`}
                    >
                      API errors and outages
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="email-weekly-reports"
                      className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      checked={true}
                      disabled={!settings.enableEmailNotifications}
                    />
                    <label
                      htmlFor="email-weekly-reports"
                      className={`ml-2 text-sm ${
                        !settings.enableEmailNotifications
                          ? "text-neutral-400"
                          : ""
                      }`}
                    >
                      Weekly performance reports
                    </label>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-md font-medium">SMS Notifications</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sms-notifications" className="font-medium">
                      Enable SMS Notifications
                    </Label>
                    <p className="text-sm text-neutral-500">
                      Receive SMS alerts for urgent escalations and critical system
                      issues
                    </p>
                  </div>
                  <Switch
                    id="sms-notifications"
                    checked={settings.enableSmsNotifications}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enableSmsNotifications", checked)
                    }
                  />
                </div>

                {settings.enableSmsNotifications && (
                  <div className="ml-6 pt-2">
                    <Label htmlFor="sms-phone" className="mb-2 block">
                      Phone Number for SMS Alerts
                    </Label>
                    <Input
                      id="sms-phone"
                      placeholder="+1 (555) 123-4567"
                      className="w-64"
                    />
                    <p className="mt-2 text-xs text-neutral-500">
                      Standard SMS rates may apply. SMS notifications will only be
                      sent for critical alerts.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="pt-4 flex justify-end space-x-3">
                <Button variant="outline">Cancel</Button>
                <Button>Save Changes</Button>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Logs & Debugging */}
        <TabsContent value="logs">
          <Card className="p-6">
            <h2 className="text-lg font-medium mb-4">Logs & Debugging</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-md font-medium">Log Settings</h3>
                <div>
                  <Label htmlFor="log-retention" className="mb-2 block">
                    Log Retention Period (days)
                  </Label>
                  <Input
                    id="log-retention"
                    type="number"
                    min="1"
                    max="365"
                    value={settings.logRetentionDays}
                    onChange={(e) =>
                      handleSettingChange(
                        "logRetentionDays",
                        parseInt(e.target.value)
                      )
                    }
                    className="w-48"
                  />
                  <p className="mt-2 text-xs text-neutral-500">
                    Logs older than this period will be automatically deleted
                  </p>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div>
                    <Label htmlFor="debug-mode" className="font-medium">
                      Debug Mode
                    </Label>
                    <p className="text-sm text-neutral-500">
                      Enable detailed logging for troubleshooting (may impact
                      performance)
                    </p>
                  </div>
                  <Switch
                    id="debug-mode"
                    checked={settings.enableDebugMode}
                    onCheckedChange={(checked) =>
                      handleSettingChange("enableDebugMode", checked)
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-md font-medium">System Logs</h3>
                <div className="bg-neutral-900 text-neutral-100 rounded-md p-4 h-64 overflow-y-auto font-mono text-xs">
                  <div className="text-neutral-400">[2023-06-15 10:30:45] [INFO] Server started on port 8000</div>
                  <div className="text-neutral-400">[2023-06-15 10:31:12] [INFO] Connected to database</div>
                  <div className="text-success-400">[2023-06-15 10:32:05] [SUCCESS] API Key ryk_f8a72e1b... authenticated</div>
                  <div className="text-neutral-400">[2023-06-15 10:32:08] [INFO] Received inbound message from customer Sarah Miller</div>
                  <div className="text-neutral-400">[2023-06-15 10:32:09] [INFO] Generated response in 0.89s</div>
                  <div className="text-neutral-400">[2023-06-15 10:35:22] [INFO] Received inbound message from customer Michael Chang</div>
                  <div className="text-warning-400">[2023-06-15 10:35:24] [WARN] Response time exceeded target: 1.45s</div>
                  <div className="text-error-400">[2023-06-15 10:40:15] [ERROR] Failed to process message: OpenAI API timeout</div>
                  <div className="text-neutral-400">[2023-06-15 10:40:18] [INFO] Conversation escalated to human support</div>
                  <div className="text-neutral-400">[2023-06-15 10:45:30] [INFO] Received inbound message from customer Jessica Williams</div>
                  <div className="text-neutral-400">[2023-06-15 10:45:31] [INFO] Generated response in 0.76s</div>
                  <div className="text-success-400">[2023-06-15 11:00:00] [SUCCESS] Scheduled maintenance tasks completed</div>
                </div>
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" size="sm" className="text-xs">
                    <span className="material-icons text-xs mr-1">refresh</span>
                    Refresh
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs">
                    <span className="material-icons text-xs mr-1">download</span>
                    Download Logs
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="pt-4 flex justify-end space-x-3">
                <Button variant="outline">Cancel</Button>
                <Button>Save Changes</Button>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
