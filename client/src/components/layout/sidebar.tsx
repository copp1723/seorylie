import React from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  Zap,
  TestTube,
  Settings,
  UserPlus,
  Users,
  LogOut,
  Home,
  Building2,
  Paintbrush,
  MessageSquare,
  GitMerge,
  ClipboardList,
  ListTodo,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem = ({
  icon,
  label,
  href,
  active,
  onClick,
}: SidebarItemProps) => {
  return (
    <li>
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (onClick) onClick();
        }}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-gray-100 text-gray-900 font-medium"
            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
        )}
      >
        <span className="text-gray-500">{icon}</span>
        <span>{label}</span>
      </a>
    </li>
  );
};

export default function Sidebar() {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  // Get user role
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isDealershipAdmin = user?.role === "dealership_admin";
  const isSEOWerksTeam = user?.role === "seowerks_team";
  const showAdminSection = isSuperAdmin || isDealershipAdmin || isSEOWerksTeam;

  const navigationItems = [
    {
      icon: <Home className="h-4 w-4" />,
      label: "Dashboard",
      href: "/",
    },
    {
      icon: <MessageSquare className="h-4 w-4" />,
      label: "SEOWerks Assistant",
      href: "/seoworks-chat",
    },
    {
      icon: <BarChart3 className="h-4 w-4" />,
      label: "Analytics",
      href: "/analytics",
    },
    {
      icon: <TestTube className="h-4 w-4" />,
      label: "SEO Tasks",
      href: "/tasks",
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: "Clients",
      href: "/clients",
    },
    {
      icon: <Building2 className="h-4 w-4" />,
      label: "Projects",
      href: "/projects",
    },
    {
      icon: <Settings className="h-4 w-4" />,
      label: "System Settings",
      href: "/system",
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: "System Setup",
      href: "/setup",
    },
  ];

  // Admin section items
  const adminItems = [
    {
      icon: <Building2 className="h-4 w-4" />,
      label: "Dealerships",
      href: "/admin/dealerships",
    },
    {
      icon: <Paintbrush className="h-4 w-4" />,
      label: "Branding & Persona",
      href: "/admin/branding",
    },
    {
      icon: <ClipboardList className="h-4 w-4" />,
      label: "SEOWerks Onboarding",
      href: "/admin/seoworks-onboarding",
    },
    {
      icon: <ListTodo className="h-4 w-4" />,
      label: "SEOWerks Queue",
      href: "/admin/seowerks-queue",
    },
  ];

  return (
    <div className="w-64 border-r border-gray-200 bg-white h-screen flex flex-col">
      <div className="p-6">
        <h2 className="text-xl font-semibold text-gray-900">OneKeelSEO</h2>
      </div>

      <div className="flex-1 overflow-auto px-4">
        <nav className="space-y-4">
          <div>
            <ul className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarItem
                  key={item.href}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  active={location === item.href}
                  onClick={() => setLocation(item.href)}
                />
              ))}
            </ul>
          </div>

          {showAdminSection && (
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Administration
              </h3>
              <ul className="space-y-1">
                {adminItems.map((item) => (
                  <SidebarItem
                    key={item.href}
                    icon={item.icon}
                    label={item.label}
                    href={item.href}
                    active={location === item.href}
                    onClick={() => setLocation(item.href)}
                  />
                ))}
              </ul>
            </div>
          )}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-600 transition-colors hover:text-gray-900 hover:bg-gray-50"
        >
          <LogOut className="h-4 w-4 text-gray-500" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
