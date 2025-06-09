import { 
  MessageSquare, 
  FileText, 
  BarChart3, 
  UserPlus, 
  Settings as SettingsIcon, 
  Shield,
  Bell,
  User,
  LogOut,
  Menu,
  Search
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/requests", label: "Requests", icon: FileText },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/onboarding", label: "Onboarding", icon: UserPlus },
  { to: "/orders", label: "Orders", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/internal", label: "Internal", icon: Shield, adminOnly: true },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="flex w-64 flex-col">
            <div className="flex min-h-0 flex-1 flex-col border-r border-border bg-card">
              {/* Logo and Brand */}
              <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
                <div className="flex flex-shrink-0 items-center px-4">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: branding.primaryColor }}
                    >
                      R
                    </div>
                    <span className="text-xl font-bold text-foreground">
                      {branding.companyName}
                    </span>
                  </div>
                </div>
                
                {/* Navigation */}
                <nav className="mt-8 flex-1 space-y-1 px-2">
                  {filteredNavItems.map((item) => {
                    const isActive = location.pathname === item.to;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        <item.icon
                          className={`mr-3 h-5 w-5 flex-shrink-0 ${
                            isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              
              {/* User Profile */}
              <div className="flex flex-shrink-0 border-t border-border p-4">
                <div className="group block w-full flex-shrink-0">
                  <div className="flex items-center">
                    <div className="inline-block h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {user?.email}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {user?.role}
                      </p>
                    </div>
                    <button
                      onClick={logout}
                      className="ml-2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="lg:hidden">
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <div className="flex items-center space-x-3">
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: branding.primaryColor }}
              >
                R
              </div>
              <span className="text-lg font-bold text-foreground">
                {branding.companyName}
              </span>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden">
            <div className="fixed inset-0 z-40 flex">
              <div 
                className="fixed inset-0 bg-background/80 backdrop-blur-sm"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="relative flex w-full max-w-xs flex-1 flex-col bg-card">
                <div className="absolute top-0 right-0 -mr-12 pt-2">
                  <button
                    className="ml-1 flex h-10 w-10 items-center justify-center rounded-full"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="sr-only">Close sidebar</span>
                  </button>
                </div>
                <div className="h-0 flex-1 overflow-y-auto pt-5 pb-4">
                  <nav className="mt-5 space-y-1 px-2">
                    {filteredNavItems.map((item) => {
                      const isActive = location.pathname === item.to;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`group flex items-center rounded-md px-2 py-2 text-base font-medium ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                          }`}
                        >
                          <item.icon className="mr-4 h-6 w-6 flex-shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="border-b border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-foreground">
                  {navItems.find(item => item.to === location.pathname)?.label || 'Dashboard'}
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="h-9 w-64 rounded-md border border-input bg-background pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <button className="relative rounded-md p-2 text-muted-foreground hover:text-foreground">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive"></span>
                </button>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-background p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}