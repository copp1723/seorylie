import { useState } from "react";
import { 
  User, 
  Building2, 
  Bell, 
  Shield, 
  Palette, 
  Globe,
  Save,
  Eye,
  EyeOff
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select } from "../components/ui/select";
import { useBranding } from "../contexts/BrandingContext";
import { useAuth } from "../contexts/AuthContext";
import { safeLog } from "../lib/utils";

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [showPassword, setShowPassword] = useState(false);
  const { branding, updateBranding } = useBranding();
  const { user } = useAuth();

  const [profileData, setProfileData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: user?.email || 'demo@client.com',
    phone: '',
    company: 'Demo Company',
    website: 'https://democompany.com',
    address: '',
    bio: ''
  });

  const [notifications, setNotifications] = useState({
    emailReports: true,
    emailUpdates: true,
    smsAlerts: false,
    weeklyDigest: true,
    projectUpdates: true
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactorEnabled: false
  });

  const [brandingSettings, setBrandingSettings] = useState({
    companyName: branding.companyName,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    theme: branding.theme
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'website', label: 'Website', icon: Globe }
  ];

  const handleSaveProfile = async () => {
    safeLog('Saving profile', profileData);
    // In a real app, make API call to save profile
  };

  const handleSaveNotifications = async () => {
    safeLog('Saving notifications', notifications);
    // In a real app, make API call to save notification preferences
  };

  const handleSaveSecurity = async () => {
    if (security.newPassword !== security.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    safeLog('Updating security settings', {
      hasCurrentPassword: !!security.currentPassword,
      hasNewPassword: !!security.newPassword,
      twoFactorEnabled: security.twoFactorEnabled
    });
    // In a real app, make API call to update password/security
  };

  const handleSaveBranding = async () => {
    updateBranding({
      companyName: brandingSettings.companyName,
      primaryColor: brandingSettings.primaryColor,
      secondaryColor: brandingSettings.secondaryColor,
      theme: brandingSettings.theme as 'light' | 'dark'
    });
    safeLog('Saving branding', brandingSettings);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left transition-colors ${
                        activeTab === tab.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Profile Settings */}
          {activeTab === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and business details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      First Name
                    </label>
                    <Input
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Last Name
                    </label>
                    <Input
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Email Address
                    </label>
                    <Input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Company
                    </label>
                    <Input
                      value={profileData.company}
                      onChange={(e) => setProfileData(prev => ({ ...prev, company: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Website
                    </label>
                    <Input
                      type="url"
                      value={profileData.website}
                      onChange={(e) => setProfileData(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Address
                  </label>
                  <Input
                    value={profileData.address}
                    onChange={(e) => setProfileData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Your business address"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Bio
                  </label>
                  <Textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="Tell us about yourself or your business"
                    rows={3}
                  />
                </div>

                <Button onClick={handleSaveProfile} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Profile</span>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose how you want to be notified about updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {Object.entries(notifications).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {key === 'emailReports' && 'Email Reports'}
                          {key === 'emailUpdates' && 'Email Updates'}
                          {key === 'smsAlerts' && 'SMS Alerts'}
                          {key === 'weeklyDigest' && 'Weekly Digest'}
                          {key === 'projectUpdates' && 'Project Updates'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {key === 'emailReports' && 'Receive weekly SEO performance reports'}
                          {key === 'emailUpdates' && 'Get notified about important updates'}
                          {key === 'smsAlerts' && 'Urgent alerts via text message'}
                          {key === 'weeklyDigest' && 'Weekly summary of all activities'}
                          {key === 'projectUpdates' && 'Updates on your SEO projects'}
                        </p>
                      </div>
                      <button
                        onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          value ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            value ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSaveNotifications} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Preferences</span>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>
                  Manage your password and security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Current Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={security.currentPassword}
                        onChange={(e) => setSecurity(prev => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      New Password
                    </label>
                    <Input
                      type="password"
                      value={security.newPassword}
                      onChange={(e) => setSecurity(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-border">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Two-Factor Authentication
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <button
                      onClick={() => setSecurity(prev => ({ ...prev, twoFactorEnabled: !prev.twoFactorEnabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        security.twoFactorEnabled ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          security.twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <Button onClick={handleSaveSecurity} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Update Security</span>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Branding Settings */}
          {activeTab === 'branding' && (
            <Card>
              <CardHeader>
                <CardTitle>Branding Preferences</CardTitle>
                <CardDescription>
                  Customize the appearance of your dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Company Name
                    </label>
                    <Input
                      value={brandingSettings.companyName}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, companyName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Theme
                    </label>
                    <Select
                      value={brandingSettings.theme}
                      onChange={(e) => setBrandingSettings(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' }))}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Primary Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="color"
                        value={brandingSettings.primaryColor}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-12 h-10"
                      />
                      <Input
                        value={brandingSettings.primaryColor}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                        placeholder="#2563eb"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      Secondary Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="color"
                        value={brandingSettings.secondaryColor}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        className="w-12 h-10"
                      />
                      <Input
                        value={brandingSettings.secondaryColor}
                        onChange={(e) => setBrandingSettings(prev => ({ ...prev, secondaryColor: e.target.value }))}
                        placeholder="#1e40af"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium text-foreground mb-2">Preview</h4>
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: brandingSettings.primaryColor }}
                    >
                      R
                    </div>
                    <span className="text-lg font-bold text-foreground">
                      {brandingSettings.companyName}
                    </span>
                  </div>
                </div>

                <Button onClick={handleSaveBranding} className="flex items-center space-x-2">
                  <Save className="h-4 w-4" />
                  <span>Save Branding</span>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Website Settings */}
          {activeTab === 'website' && (
            <Card>
              <CardHeader>
                <CardTitle>Website Integration</CardTitle>
                <CardDescription>
                  Connect and manage your website properties
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border border-border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">Primary Website</h4>
                      <p className="text-sm text-muted-foreground mt-1">{profileData.website}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm">
                        <span className="text-green-600">✓ Verified</span>
                        <span className="text-muted-foreground">Analytics Connected</span>
                        <span className="text-muted-foreground">Search Console Connected</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Manage
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-foreground">Integration Status</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">Google Analytics</span>
                      </div>
                      <span className="text-sm text-green-600">Connected</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm">Google Search Console</span>
                      </div>
                      <span className="text-sm text-green-600">Connected</span>
                    </div>
                    <div className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm">Google Business Profile</span>
                      </div>
                      <Button variant="outline" size="sm">Connect</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}