import { Bell, Home, LineChart, Package, Package2, ShoppingCart, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", label: "Chat", icon: Home },
  { to: "/requests", label: "Requests", icon: ShoppingCart },
  { to: "/reports", label: "Reports", icon: LineChart },
  { to: "/onboarding", label: "Onboarding", icon: Package },
  { to: "/settings", label: "Settings", icon: Users },
  { to: "/internal", label: "Internal", icon: Package2 }, // Optional: Admin only
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <div className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <span className="font-bold">Rylie SEO Hub</span>
          </div>
          <nav className="flex-1 grid gap-2 px-2 py-4 lg:px-4">
            {navItems.map(item => (
              <Link key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                  location.pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-primary"
                }`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}
