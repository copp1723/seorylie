import { useState } from "react";
import { AuthButtons } from "./AuthButtons";

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-white border-b sm:px-6">
      <button
        onClick={onMenuClick}
        className="p-1 text-neutral-500 rounded-full hover:bg-neutral-100 lg:hidden"
      >
        <span className="material-icons">menu</span>
      </button>

      <div className="flex items-center ml-auto space-x-4">
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="py-2 pl-10 pr-4 text-sm border rounded-md w-60 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <span className="absolute top-2.5 left-3 material-icons text-neutral-400 text-sm">
            search
          </span>
        </div>

        <button className="relative p-1 text-neutral-500 rounded-full hover:bg-neutral-100">
          <span className="material-icons">notifications</span>
          <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full"></span>
        </button>

        <button className="p-1 text-neutral-500 rounded-full hover:bg-neutral-100">
          <span className="material-icons">help_outline</span>
        </button>
        
        {/* Authentication buttons */}
        <div className="ml-2">
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
