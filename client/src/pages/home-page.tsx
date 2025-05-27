import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { BarChart3, TestTube, Users, LogOut, Settings, UserPlus, Zap } from "lucide-react";

export default function HomePage() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const dashboardItems = [
    {
      id: "quick-test",
      title: "Quick Test",
      description: "Quickly test AI responses with single prompts and custom scenarios.",
      icon: <Zap className="h-5 w-5" />,
      onClick: () => {
        setLocation("/prompt-testing");
      }
    },
    {
      id: "prompt-library",
      title: "Prompt Library",
      description: "Manage your library of tested and approved AI prompts for various scenarios.",
      icon: <TestTube className="h-5 w-5" />,
      onClick: () => {
        setLocation("/prompt-library");
      }
    },
    {
      id: "analytics-dashboard",
      title: "Analytics Dashboard",
      description: "View insights and performance metrics for your dealership.",
      icon: <BarChart3 className="h-5 w-5" />,
      onClick: () => {
        setLocation("/analytics");
      }
    },
    {
      id: "security",
      title: "Security Settings",
      description: "Manage security settings, API keys, and access controls for your account.",
      icon: <Settings className="h-5 w-5" />,
      onClick: () => {
        setLocation("/security");
      }
    },
    {
      id: "invitations",
      title: "Invitations",
      description: "Manage user invitations and control access to your organization's platform.",
      icon: <UserPlus className="h-5 w-5" />,
      onClick: () => {
        setLocation("/invitations");
      }
    },
    {
      id: "setup",
      title: "System Setup",
      description: "Configure system settings, integrations, and customize your experience.",
      icon: <Users className="h-5 w-5" />,
      onClick: () => {
        setLocation("/setup");
      }
    }
  ];

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-gray-900">
              Automotive Sales AI Platform
            </h1>
            <div className="flex items-center space-x-6">
              <span className="text-sm text-gray-600">
                Welcome, {user?.username || 'User'}
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h2 className="text-3xl font-semibold text-gray-900 mb-3">Dashboard</h2>
          <p className="text-gray-600">Choose a feature to get started</p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardItems.map((item) => (
            <Card 
              key={item.id}
              className="cursor-pointer transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
              onClick={item.onClick}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-gray-700">
                    {item.icon}
                  </div>
                  <CardTitle className="text-lg font-medium text-gray-900">
                    {item.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 leading-relaxed">
                  {item.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm">
            More features will be added to your dashboard as they become available.
          </p>
        </div>
      </main>
    </div>
  );
}