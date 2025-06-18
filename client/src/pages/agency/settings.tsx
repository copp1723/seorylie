import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Palette,
  Mail,
  Key,
  Users,
  Package,
  Save,
  Check,
  AlertCircle,
  Building2,
  Globe,
  Shield,
  Bell,
  CreditCard
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useToast } from '../../components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

interface AgencySettings {
  id: string;
  name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  support_email: string;
  support_phone: string;
  website_url?: string;
  address?: string;
  timezone: string;
  notifications: {
    email_enabled: boolean;
    sms_enabled: boolean;
    task_created: boolean;
    task_completed: boolean;
    deliverable_ready: boolean;
    weekly_digest: boolean;
  };
  api_keys: {
    sendgrid_configured: boolean;
    ga4_configured: boolean;
    gsc_configured: boolean;
  };
  billing: {
    plan: 'starter' | 'professional' | 'enterprise';
    billing_email: string;
    payment_method?: string;
  };
  permissions: {
    max_users: number;
    max_dealerships: number;
    features: string[];
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch agency settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['agency-settings'],
    queryFn: async () => {
      const response = await fetch('/api/agency/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    placeholderData: {
      id: '1',
      name: 'SEOWerks Agency',
      logo_url: '/logo.png',
      primary_color: '#3B82F6',
      secondary_color: '#1E40AF',
      support_email: 'support@seowerks.com',
      support_phone: '(555) 123-4567',
      website_url: 'https://seowerks.com',
      address: '123 Main St, Dallas, TX 75201',
      timezone: 'America/Chicago',
      notifications: {
        email_enabled: true,
        sms_enabled: false,
        task_created: true,
        task_completed: true,
        deliverable_ready: true,
        weekly_digest: true
      },
      api_keys: {
        sendgrid_configured: true,
        ga4_configured: true,
        gsc_configured: false
      },
      billing: {
        plan: 'professional',
        billing_email: 'billing@seowerks.com',
        payment_method: 'Visa ending in 4242'
      },
      permissions: {
        max_users: 10,
        max_dealerships: 50,
        features: ['white_label', 'api_access', 'custom_reports', 'automation']
      }
    }
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<AgencySettings>) => {
      const response = await fetch('/api/agency/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agency-settings'] });
      toast({
        title: 'Settings Updated',
        description: 'Your settings have been saved successfully.',
      });
      setIsSaving(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
      setIsSaving(false);
    },
  });

  const handleSave = (updates: Partial<AgencySettings>) => {
    setIsSaving(true);
    updateSettingsMutation.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your agency settings and configuration
        </p>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        {/* Profile Settings */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Agency Profile</CardTitle>
              <CardDescription>
                Basic information about your agency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agency Name</Label>
                  <Input
                    id="name"
                    defaultValue={settings.name}
                    placeholder="Your Agency Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    defaultValue={settings.website_url}
                    placeholder="https://youragency.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Support Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={settings.support_email}
                    placeholder="support@youragency.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Support Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    defaultValue={settings.support_phone}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  defaultValue={settings.address}
                  placeholder="123 Main St, City, State ZIP"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select defaultValue={settings.timezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave({ name: settings.name })} disabled={isSaving}>
                  {isSaving ? (
                    <><Settings className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Changes</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Settings */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>White-Label Branding</CardTitle>
              <CardDescription>
                Customize how your agency appears to clients
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  type="url"
                  defaultValue={settings.logo_url}
                  placeholder="https://youragency.com/logo.png"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      defaultValue={settings.primary_color}
                      className="w-16 h-10"
                    />
                    <Input
                      defaultValue={settings.primary_color}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      defaultValue={settings.secondary_color}
                      className="w-16 h-10"
                    />
                    <Input
                      defaultValue={settings.secondary_color}
                      placeholder="#1E40AF"
                    />
                  </div>
                </div>
              </div>
              <Alert>
                <Palette className="h-4 w-4" />
                <AlertDescription>
                  These branding settings will be applied to all client-facing interfaces,
                  including the chat widget, reports, and emails.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end">
                <Button onClick={() => handleSave({ primary_color: settings.primary_color })} disabled={isSaving}>
                  {isSaving ? (
                    <><Settings className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Branding</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure how you receive updates about tasks and deliverables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch defaultChecked={settings.notifications.email_enabled} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive text message alerts for urgent updates
                    </p>
                  </div>
                  <Switch defaultChecked={settings.notifications.sms_enabled} />
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium">Notification Events</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>New Task Created</Label>
                    <Switch defaultChecked={settings.notifications.task_created} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Task Completed</Label>
                    <Switch defaultChecked={settings.notifications.task_completed} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Deliverable Ready</Label>
                    <Switch defaultChecked={settings.notifications.deliverable_ready} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Weekly Performance Digest</Label>
                    <Switch defaultChecked={settings.notifications.weekly_digest} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave({ notifications: settings.notifications })} disabled={isSaving}>
                  {isSaving ? (
                    <><Settings className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save Preferences</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Manage your API keys and integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      <h4 className="font-medium">SendGrid</h4>
                    </div>
                    {settings.api_keys.sendgrid_configured ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" /> Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Email delivery service for notifications and reports
                  </p>
                  <Input
                    type="password"
                    placeholder="SG.XXXXXXXXXXXXXXXXXXXX"
                    defaultValue={settings.api_keys.sendgrid_configured ? '••••••••••••••••••••' : ''}
                  />
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      <h4 className="font-medium">Google Analytics 4</h4>
                    </div>
                    {settings.api_keys.ga4_configured ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" /> Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Analytics data for performance tracking
                  </p>
                  <div className="space-y-2">
                    <Input placeholder="Property ID (e.g., 320759942)" />
                    <Textarea
                      placeholder="Service Account Credentials JSON"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      <h4 className="font-medium">Google Search Console</h4>
                    </div>
                    {settings.api_keys.gsc_configured ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" /> Configured
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not Configured</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    Search performance and indexing data
                  </p>
                  <Button variant="outline" size="sm">
                    Connect Search Console
                  </Button>
                </div>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  API keys are encrypted and stored securely. Changes take effect immediately.
                </AlertDescription>
              </Alert>
              <div className="flex justify-end">
                <Button onClick={() => handleSave({})} disabled={isSaving}>
                  {isSaving ? (
                    <><Settings className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Save API Keys</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Settings */}
        <TabsContent value="billing">
          <Card>
            <CardHeader>
              <CardTitle>Billing & Plan</CardTitle>
              <CardDescription>
                Manage your subscription and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium capitalize">{settings.billing.plan} Plan</h4>
                    <p className="text-sm text-muted-foreground">
                      {settings.permissions.max_users} users • {settings.permissions.max_dealerships} dealerships
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg px-3 py-1">
                    ${settings.billing.plan === 'starter' ? '299' : settings.billing.plan === 'professional' ? '599' : '1299'}/mo
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {settings.permissions.features.map((feature) => (
                    <Badge key={feature} variant="secondary">
                      {feature.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Billing Email</Label>
                  <Input
                    type="email"
                    defaultValue={settings.billing.billing_email}
                    placeholder="billing@youragency.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm">{settings.billing.payment_method || 'No payment method'}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Update Payment Method</Button>
                <Button variant="outline">View Invoices</Button>
                <Button variant="outline">Upgrade Plan</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}