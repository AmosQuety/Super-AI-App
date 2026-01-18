// src/components/Layout.tsx
import  { useState, useEffect } from "react";
import { Link, Outlet, useLocation, NavLink, useNavigate } from "react-router-dom";
import { 
  MessageSquare, 
  ImageIcon, 
  Mic, 
  Sparkles,
  Menu,
  X,
  LogOut,
  User,
  Home,
  ScanFace,
  ChevronRight
} from "lucide-react";
import { useAuth } from "../hooks/useAuth"; 

// --- CONFIGURATION ---

const navigation = [
  { 
    name: "Chat", 
    href: "/chat",
    icon: MessageSquare,
    description: "Intelligent conversations."
  },
  { 
    name: "Image Generation", 
    href: "/image",
    icon: ImageIcon,
    description: "Create stunning visuals."
  },
  { 
    name: "Voice Tools", 
    href: "/voice",
    icon: Mic,
    description: "Interact with voice."
  },
  {
    name: "Face Playground",
    href: "/playground",
    icon: ScanFace,
    description: "Biometric experiments."
  }
];

// 👇 THIS WAS MISSING
const quickActions = [
  { label: "Analyze my Face", icon: ScanFace, href: "/playground", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
  { label: "Draft an Email", icon: MessageSquare, href: "/chat", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  { label: "Create Art", icon: ImageIcon, href: "/image", color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/20" },
  { label: "Voice Command", icon: Mic, href: "/voice", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
];

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
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
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 selection:bg-indigo-500/30">
      
      {/* --- NAVBAR --- */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled 
            ? 'bg-[#0B0F19]/90 backdrop-blur-xl shadow-lg border-b border-white/5' 
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-3 group">
                <div className="relative w-10 h-10 lg:w-12 lg:h-12">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-75 blur-sm group-hover:blur-md transition-all duration-300"></div>
                  <div className="relative w-full h-full bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    PRISM AI
                  </h1>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-2">
              <NavLink to="/" className={({ isActive }) => `flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`} end>
                  <Home className="w-4 h-4" />
                  <span>Home</span>
              </NavLink>
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.name} to={item.href} className={({ isActive }) => `flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${isActive ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-2 lg:space-x-3">
              {user && (
                <div className="hidden md:flex items-center space-x-3">
                  <button onClick={() => navigate("/profile")}>
                    <div className="flex items-center space-x-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ring-2 ring-white/10">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-slate-300">
                            {user.name || user.email}
                        </span>
                    </div>
                  </button>
                  <button onClick={handleSignOut} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10">
                      <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 transition-colors border border-white/10">
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-white/10 py-4 space-y-2">
               <NavLink to="/" className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? "bg-white/10 text-white" : "text-slate-400"}`} end>
                  <Home className="w-5 h-5" />
                  <span className="font-medium">Home</span>
              </NavLink>
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.name} to={item.href} className={({ isActive }) => `w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive ? "bg-white/10 text-white" : "text-slate-400"}`}>
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </NavLink>
                );
              })}
              {user && (
                <div className="border-t border-white/10 pt-4 mt-2 px-2">
                    <button onClick={() => navigate("/profile")} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-white/5 text-left mb-2 text-slate-300">
                        <User className="w-5 h-5" />
                        <span className="font-medium">{user.name || user.email}</span>
                    </button>
                    <button onClick={handleSignOut} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10">
                        <LogOut className="w-5 h-5" /> 
                        <span className="font-medium">Sign Out</span>
                    </button>
                 </div> 
              )}
             </div> 
          )}
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      <main className="pt-24 lg:pt-32 pb-12">
        {isHomePage ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* 1. HERO SECTION */}
            <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs font-medium text-slate-400 mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                System Operational
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                Hello, <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{user?.name?.split(' ')[0] || 'Creator'}</span>.
                <br />
                <span className="text-slate-500 text-3xl md:text-5xl font-semibold">What are we building today?</span>
              </h1>

              {/* 2. QUICK ACTION CHIPS */}
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.href)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border ${action.bg} ${action.border} hover:bg-opacity-80 transition-all duration-200 group`}
                  >
                    <action.icon size={16} className={action.color} />
                    <span className="text-sm font-medium text-slate-300 group-hover:text-white">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. BENTO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* LARGE CARD: Chat (COMING SOON MODE) */}
              <div 
                className="md:col-span-2 relative overflow-hidden bg-slate-900/30 border border-slate-800/50 rounded-3xl p-8 cursor-default"
              >
                {/* Coming Soon Badge */}
                <div className="absolute top-6 right-6 z-20">
                   <span className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-bold rounded-full border border-slate-700 tracking-wider">
                     COMING SOON
                   </span>
                </div>

                <div className="relative z-10 opacity-50 grayscale-[50%]">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700/50">
                    <MessageSquare className="w-6 h-6 text-slate-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-300 mb-2">Knowledge Brain</h3>
                  <p className="text-slate-500 max-w-md">
                    Chat with your documents using RAG technology. Upload PDFs, ask questions, and get cited answers instantly.
                  </p>
                </div>
                
                {/* Subtle, non-interactive decoration */}
                <div className="absolute -bottom-4 -right-4 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]" />
              </div>

              {/* TALL CARD: Biometrics */}
              <div 
                onClick={() => navigate('/playground')}
                className="md:row-span-2 group relative overflow-hidden bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-8 transition-all cursor-pointer flex flex-col justify-between"
              >
                 <div className="absolute top-0 right-0 p-8 opacity-50 group-hover:opacity-100 transition-opacity">
                   <ChevronRight className="text-violet-500" />
                </div>
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
                    <ScanFace className="w-6 h-6 text-violet-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Biometric Lab</h3>
                  <p className="text-slate-400">
                    Access advanced computer vision tools:
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-500">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Magic Mirror Analysis</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> 1:N Identification</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-violet-500" /> Liveness Detection</li>
                  </ul>
                </div>
                <div className="mt-8 relative h-32 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden group-hover:border-violet-500/30 transition-colors">
                     <div className="absolute inset-0 flex items-center justify-center">
                        <ScanFace className="w-12 h-12 text-slate-700 group-hover:text-violet-500/50 transition-colors" />
                     </div>
                     <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-violet-500/50 animate-scan" />
                </div>
              </div>

              {/* MEDIUM CARD: Image Gen */}
              <div 
                onClick={() => navigate('/image')}
                className="group relative overflow-hidden bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-8 transition-all cursor-pointer"
              >
                <div className="absolute top-0 right-0 p-8 opacity-50 group-hover:opacity-100 transition-opacity">
                   <ChevronRight className="text-pink-500" />
                </div>
                <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center mb-4">
                  <ImageIcon className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Imagine Anything</h3>
                <p className="text-slate-400 text-sm">
                  Generate stunning visuals with Flux & Stable Diffusion models.
                </p>
              </div>

              {/* MEDIUM CARD: Voice */}
              <div 
                onClick={() => navigate('/voice')}
                className="group relative overflow-hidden bg-slate-900/50 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-8 transition-all cursor-pointer"
              >
                <div className="absolute top-0 right-0 p-8 opacity-50 group-hover:opacity-100 transition-opacity">
                   <ChevronRight className="text-amber-500" />
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <Mic className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Voice Command</h3>
                <p className="text-slate-400 text-sm">
                  Speak naturally to the AI. Hands-free interaction.
                </p>
              </div>

            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
            <Outlet />
          </div>
        )}
      </main>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-20px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(20px); opacity: 0; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default Layout;