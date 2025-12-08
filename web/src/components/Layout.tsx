// src/components/Layout.tsx - Fixed version
import  { useState, useEffect } from "react";
import { Link, Outlet, useLocation, NavLink, useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  ImageIcon, 
  Mic, 
  Sparkles,
  Shield, 
  Zap,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  LogOut,
  User,
  Home
} from "lucide-react";
import { useAuth } from "../hooks/useAuth"; 
import { useTheme } from "../contexts/ThemeContext";

// Navigation data
const navigation = [
  { 
    name: "Chat", 
    href: "/chat",
    icon: MessageSquare,
    description: "Intelligent conversations with our advanced AI."
  },
  { 
    name: "Image Generation", 
    href: "/image",
    icon: ImageIcon,
    description: "Create stunning, unique images from text prompts."
  },
  { 
    name: "Voice Tools", 
    href: "/voice",
    icon: Mic,
    description: "Interact with AI using natural voice commands."
  },
];



const features = [
  {
    name: "Lightning Fast",
    description: "Blazing fast responses with optimized AI models.",
    icon: Zap,
    color: "from-yellow-400 to-orange-500"
  },
  {
    name: "Privacy First",
    description: "Your data stays secure with end-to-end encryption.",
    icon: Shield,
    color: "from-green-400 to-emerald-500"
  },
  {
    name: "Premium Quality",
    description: "High-quality outputs that exceed expectations.",
    icon: Sparkles,
    color: "from-purple-400 to-pink-500"
  }
];

const Layout = () => {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth(); // Use the real auth hook
  const navigate = useNavigate();
  

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {

    // Close mobile menu on route change
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isHomePage = location.pathname === "/";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-lg border-b border-slate-200 dark:border-slate-800' 
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="relative w-10 h-10 lg:w-12 lg:h-12">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-75 blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <div className="relative w-full h-full bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                    <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Super AI
                  </h1>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-2">
              <NavLink to="/" className={({ isActive }) => `flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`} end>
                  <Home className="w-4 h-4" />
                  <span>Home</span>
              </NavLink>
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.name} to={item.href} className={({ isActive }) => `flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}>
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 lg:space-x-3">
              {user && (
                <div className="hidden md:flex items-center space-x-3">
                    <div className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10">
                            <User className="w-4 h-4 text-white" onClick={() => navigate("/profile")}/>
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {user.name || user.email}
                        </span>
                    </div>
                    <button onClick={handleSignOut} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-slate-200 dark:border-slate-700/50" aria-label="Sign out" title="Sign out">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
              )}

              {/* Updated theme toggle button */}
          <button 
            onClick={toggleTheme} 
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all duration-200 group border border-slate-200 dark:border-slate-700/50" 
            aria-label={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"} 
            title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === 'dark' ? 
              <Sun className="h-5 w-5 group-hover:rotate-180 transition-transform duration-500" /> : 
              <Moon className="h-5 w-5 group-hover:-rotate-180 transition-transform duration-500" />
            }
          </button>

              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors border border-slate-200 dark:border-slate-700/50" aria-label="Toggle menu">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 py-4 space-y-2 px-4">
               <NavLink to="/" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`} end>
                  <Home className="w-5 h-5" />
                  <span className="font-medium">Home</span>
              </NavLink>
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.name} to={item.href} className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </NavLink>
                );
              })}
              {user && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-2">
                    <div className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {user.name || user.email}
                        </span>
                    </div>
                    <button onClick={handleSignOut} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                    
                 </div> 
              )}
             </div> 
          )}
        </div>
      </nav>

      <main className="pt-16 lg:pt-20">
        {isHomePage ? (
          <div className="min-h-screen mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
            <div className="space-y-20">
              <div className="text-center space-y-8">
                <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium border border-blue-200 dark:border-blue-800">
                  <Sparkles className="w-4 h-4" />
                  <span>Powered by Advanced AI</span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-slate-900 dark:text-white leading-tight tracking-tighter">
                  Your Ultimate
                  <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    AI Companion
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
                  Experience the future of AI assistance. Chat naturally, create stunning visuals, and interact with voice—all powered by cutting-edge artificial intelligence.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <Link to="/chat" className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center space-x-2 text-lg">
                    <span>Get Started</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.name} className="group relative bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transform hover:-translate-y-2" style={{ animationDelay: `${index * 100}ms`, animation: 'fadeInUp 0.6s ease-out forwards' }}>
                      <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                        {feature.name}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 lg:p-12 border border-slate-200 dark:border-slate-800">
                <div className="text-center mb-12">
                  <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                    Explore Powerful Features
                  </h2>
                  <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                    Choose your preferred way to interact with our AI.
                  </p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  {navigation.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.name} to={item.href} className="group text-left p-6 lg:p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 border-2 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-2xl transform hover:-translate-y-2" style={{ animationDelay: `${index * 100}ms`, animation: 'fadeInUp 0.6s ease-out forwards' }}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          {item.description}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Layout;