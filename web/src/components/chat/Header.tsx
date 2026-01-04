import {
  Bars3Icon as MenuIcon,
  XMarkIcon as XIcon,
} from "@heroicons/react/24/solid";
import { useTheme } from "../../contexts/ThemeContext";


interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

function Header({ isSidebarOpen, setIsSidebarOpen }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="relative bg-slate-900/80 backdrop-blur-xl border-b border-white/10 text-white p-4 shadow-2xl flex items-center justify-between z-20 flex-shrink-0 h-20">
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-r animate-pulse ${
        theme === 'dark' 
          ? 'from-cyan-500/5 via-purple-500/10 to-pink-500/5' 
          : 'from-blue-500/10 via-purple-500/5 to-pink-500/5'
      }`}></div>

      <div className="relative z-10 flex items-center space-x-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="group p-3 rounded-2xl bg-gradient-to-r from-slate-700/50 to-slate-600/50 backdrop-blur border border-white/20 hover:from-purple-600/50 hover:to-pink-600/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all duration-300 transform hover:scale-105 shadow-lg"
          aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          <div className="relative w-5 h-5">
            <XIcon
              className={`h-5 w-5 text-white group-hover:text-pink-200 transition-all duration-300 absolute ${
                isSidebarOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"
              }`}
            />
            <MenuIcon
              className={`h-5 w-5 text-white group-hover:text-purple-200 transition-all duration-300 absolute ${
                !isSidebarOpen ? "opacity-100 rotate-0" : "opacity-0 rotate-90"
              }`}
            />
          </div>
        </button>

        {/* Logo/Brand section */}
         <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg"></div>
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      </div> 
      

      {/* Center title with enhanced styling */}
      <div className="absolute left-1/2 transform -translate-x-1/2 z-10 hidden md:block">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
          Super AI App
        </h1>
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 rounded-full mt-1 opacity-60"></div>
      </div>

      {/* Right side controls */}
      <div className="relative z-10 flex items-center space-x-3">
        {/* Status indicator */}
        <div className="hidden sm:flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur rounded-2xl border border-green-500/30">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-300 font-medium">Online</span>
        </div>

        {/* Theme toggle button - Updated */}
      <button
        onClick={toggleTheme} // USE TOGGLE THEME
        className="group relative p-3 rounded-2xl bg-gradient-to-r from-slate-700/50 to-slate-600/50 backdrop-blur border border-white/20 hover:from-yellow-600/50 hover:to-orange-600/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all duration-300 transform hover:scale-105 shadow-lg overflow-hidden"
        aria-label="Toggle theme"
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <div className="relative z-10">
          {theme === 'dark' ? (
            <div className="flex items-center justify-center">
              <span className="text-2xl group-hover:rotate-12 transition-transform duration-300">
                ☀️
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="text-2xl group-hover:-rotate-12 transition-transform duration-300">
                🌙
              </span>
            </div>
          )}
        </div>
      </button>

        {/* Settings/Profile button */}
        <button
          className="group p-3 rounded-2xl bg-gradient-to-r from-slate-700/50 to-slate-600/50 backdrop-blur border border-white/20 hover:from-indigo-600/50 hover:to-purple-600/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 transition-all duration-300 transform hover:scale-105 shadow-lg"
          aria-label="Open settings"
          title="Open settings"
        >
          <svg
            className="h-5 w-5 text-white group-hover:text-indigo-200 group-hover:rotate-90 transition-all duration-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Header;
