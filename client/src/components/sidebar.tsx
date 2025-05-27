import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [location] = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState<string[]>(() => {
    const saved = localStorage.getItem("favoriteNavItems");
    return saved ? JSON.parse(saved) : ["/", "/prompt-testing"];
  });

  const navItems: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/prompt-testing", label: "Prompt Testing", icon: "psychology" },
    { href: "/simple-prompt-testing", label: "Quick Test", icon: "speed" },
    { href: "/system-prompt-tester", label: "Prompt Builder", icon: "construction" },
    { href: "/prompt-library", label: "Prompt Library", icon: "auto_stories" },
    { href: "/invitations", label: "Invitations", icon: "mail" },
    { href: "/dealership-setup", label: "Setup", icon: "build" },
    { href: "/security-compliance", label: "Security", icon: "shield" },
    { href: "/audit-logs", label: "Audit Logs", icon: "receipt_long" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ];

  // Save favorites to localStorage when they change
  useEffect(() => {
    localStorage.setItem("favoriteNavItems", JSON.stringify(favoriteItems));
  }, [favoriteItems]);

  const toggleFavorite = (href: string) => {
    setFavoriteItems((prev: string[]) => 
      prev.includes(href) 
        ? prev.filter((item: string) => item !== href)
        : [...prev, href]
    );
  };

  // Filter items to create favorites and regular sections
  const favorites = navItems.filter((item: NavItem) => favoriteItems.includes(item.href));
  const regularItems = navItems.filter((item: NavItem) => !favoriteItems.includes(item.href));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-10 shadow-md transform slide-transition bg-white dark:bg-gray-800 lg:translate-x-0 backdrop-blur-sm",
        expanded ? "w-64" : "w-20",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-gray-100 dark:border-gray-700 transition-all",
        expanded ? "justify-between" : "justify-center"
      )}>
        <div className="flex items-center space-x-2 overflow-hidden">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-sm">
            <span className="material-icons text-base">smart_toy</span>
          </div>
          <h1 className={cn(
            "font-medium text-primary transition-opacity",
            expanded ? "opacity-100" : "opacity-0"
          )}>Rylie AI</h1>
        </div>
        {expanded && (
          <button
            onClick={onClose}
            className="p-1 text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
          >
            <span className="material-icons">close</span>
          </button>
        )}
      </div>

      <div className="overflow-y-auto h-[calc(100vh-8rem)]">
        {favorites.length > 0 && (
          <>
            <div className={cn(
              "pt-4 pb-2",
              expanded ? "px-4" : "px-2"
            )}>
              <p className={cn(
                "text-xs uppercase font-medium text-gray-500 dark:text-gray-400 mb-2 transition-opacity",
                expanded ? "opacity-100 px-2" : "opacity-0 text-center"
              )}>
                Favorites
              </p>
              <nav className={cn(
                "space-y-1",
                expanded ? "px-1" : "px-0"
              )}>
                {favorites.map((item) => (
                  <NavItem 
                    key={item.href}
                    item={item}
                    expanded={expanded}
                    isActive={location === item.href}
                    onFavoriteToggle={toggleFavorite}
                    isFavorite={true}
                  />
                ))}
              </nav>
            </div>
            <div className="sidebar-hr" />
          </>
        )}

        <div className={cn(
          "pt-3 pb-2", 
          expanded ? "px-4" : "px-2"
        )}>
          <p className={cn(
            "text-xs uppercase font-medium text-gray-500 dark:text-gray-400 mb-2 transition-opacity",
            expanded ? "opacity-100 px-2" : "opacity-0 text-center"
          )}>
            Navigation
          </p>
          <nav className={cn(
            "space-y-1",
            expanded ? "px-1" : "px-0"
          )}>
            {regularItems.map((item) => (
              <NavItem 
                key={item.href}
                item={item}
                expanded={expanded}
                isActive={location === item.href}
                onFavoriteToggle={toggleFavorite}
                isFavorite={false}
              />
            ))}
          </nav>
        </div>
      </div>

      <div className="absolute bottom-0 w-full border-t border-gray-100 dark:border-gray-700 transition-all">
        <div className={cn(
          "py-4",
          expanded ? "px-4" : "px-2"
        )}>
          <div className={cn(
            "flex items-center",
            expanded ? "space-x-3" : "justify-center"
          )}>
            <div className="flex-shrink-0 w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <span className="material-icons text-gray-600 dark:text-gray-300">person</span>
            </div>
            {expanded && (
              <>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">Alex Johnson</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Administrator</p>
                </div>
                <button className="p-1 ml-auto text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <span className="material-icons text-sm">logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

interface NavItemProps {
  item: { href: string; label: string; icon: string };
  expanded: boolean;
  isActive: boolean;
  isFavorite: boolean;
  onFavoriteToggle: (href: string) => void;
}

function NavItem({ item, expanded, isActive, isFavorite, onFavoriteToggle }: NavItemProps) {
  return (
    <div className="relative group">
      <Link
        href={item.href}
        className={cn(
          "flex items-center rounded-xl transition-all duration-200",
          expanded ? "px-3 py-2" : "py-3 justify-center",
          isActive 
            ? "bg-primary/10 text-primary" 
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50"
        )}
      >
        <span className="material-icons">
          {item.icon}
        </span>
        {expanded && (
          <>
            <span className="ml-3 truncate">{item.label}</span>
            <button 
              onClick={(e) => {
                e.preventDefault();
                onFavoriteToggle(item.href);
              }}
              className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <span className="material-icons text-sm">
                {isFavorite ? "star" : "star_border"}
              </span>
            </button>
          </>
        )}
      </Link>
      
      {!expanded && (
        <span className="sidebar-tooltip group-hover:scale-100">
          {item.label}
        </span>
      )}
    </div>
  );
}
