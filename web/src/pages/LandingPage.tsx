import { Link } from 'react-router-dom';
import { 
  ScanFace, 
  ImageIcon, 
  Mic, 
  MessageSquare, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    title: "Face Playground",
    description: "Advanced biometric experiments with real-time liveness detection and 1:N identification.",
    icon: ScanFace,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    title: "Image Generation",
    description: "Transform your ideas into stunning visuals using state-of-the-art GenAI art tools.",
    icon: ImageIcon,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    title: "Voice Tools",
    description: "Multi-modal voice interaction. Speak naturally to the AI and experience hands-free control.",
    icon: Mic,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    title: "Knowledge Brain",
    description: "Chat with your documents using RAG. Upload PDFs and get cited answers instantly.",
    icon: MessageSquare,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    title: "Biometric Lab",
    description: "The ultimate testing ground for AI-driven security protocols and vision analysis.",
    icon: ShieldCheck,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  }
];

const testimonials = [
  {
    quote: "Xemora has completely transformed how our developers integrate AI security. The biometric lab is second to none.",
    author: "Elena Vance",
    role: "Lead Engineer at TechStream"
  },
  {
    quote: "The generative art tools are incredibly intuitive. It’s like having a digital artist at my fingertips.",
    author: "Marcus Thorne",
    role: "Creative Director"
  }
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200">
      {/* 1. Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              Xemora
            </span>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <Link to="/login" className="text-white hover:text-indigo-300 transition-colors">Login</Link>
          </nav>

          <Link 
            to="/register" 
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 hover:scale-105 active:scale-95 transition-all text-sm"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        {/* Background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">
              <Zap size={14} className="fill-indigo-400" />
              Unified AI Ecosystem
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
              The AI Ecosystem for <br />
              <span className="bg-gradient-to-r from-blue-400 via-transparent to-pink-400 bg-clip-text text-transparent italic decoration-indigo-500/50">Vision, Voice, & Security</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
              Seamlessly integrate biometric security, powerful computer vision, document intelligence, and generative AI art tools into your workspace.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                to="/register" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-950 rounded-2xl font-bold text-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                Sign Up for Xemora <ArrowRight size={20} />
              </Link>
              <Link 
                to="/login" 
                className="w-full sm:w-auto px-8 py-4 bg-slate-800/50 backdrop-blur-md border border-slate-700 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-colors"
              >
                View Demo
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-24 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Powerful Features</h2>
            <p className="text-slate-500 font-medium">Everything you need to build next-gen AI applications.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div 
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl hover:border-indigo-500/30 transition-all group"
              >
                <div className={`w-14 h-14 ${feature.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-7 h-7 ${feature.color}`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  {feature.title}
                  <ChevronRight size={16} className="text-slate-600 group-hover:translate-x-1 transition-transform" />
                </h3>
                <p className="text-slate-400 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Use Cases / Social Proof */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">Designed for Developers, <br /> Built for Businesses.</h2>
              <div className="space-y-6">
                {[
                  "Accelerate your computer vision projects",
                  "Deploy biometric security in minutes",
                  "Integrate document intelligence (RAG) flows",
                  "Scale generative AI art production"
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="text-indigo-400 h-6 w-6" />
                    <span className="text-slate-300 font-medium">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-6">
              {testimonials.map((t) => (
                <div key={t.author} className="p-8 bg-gradient-to-br from-slate-900 to-indigo-950/30 border border-slate-800 rounded-3xl italic text-slate-300 relative">
                  <span className="absolute top-2 right-6 text-6xl text-indigo-500/10 select-none">"</span>
                  <p className="mb-6 relative z-10">{t.quote}</p>
                  <div className="not-italic flex items-center gap-3 border-t border-white/5 pt-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                      {t.author[0]}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{t.author}</div>
                      <div className="text-slate-500 text-xs">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Footer */}
      <footer className="py-24 border-t border-white/5 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <Sparkles className="w-8 h-8 text-indigo-500" />
                <span className="text-2xl font-bold text-white tracking-tight">Xemora</span>
              </div>
              <p className="text-slate-500 max-w-sm mb-8 leading-relaxed">
                Building the future of unified AI interfaces. Experience the synergy of vision, voice, and biometric security in one intelligent platform.
              </p>
              <div className="flex gap-4">
                <Globe className="text-slate-600 hover:text-indigo-400 cursor-pointer transition-colors" />
                <ShieldCheck className="text-slate-600 hover:text-indigo-400 cursor-pointer transition-colors" />
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-[0.2em]">Platform</h4>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li><Link to="/login" className="hover:text-white transition-colors">Face Playground</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Image Gen</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Voice Tools</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Knowledge Brain</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-6 text-sm uppercase tracking-[0.2em]">Keywords</h4>
              <div className="flex flex-wrap gap-2">
                {["AI development platform", "biometric security SaaS", "generative AI suite", "Computer Vision", "LLM Integration"].map(k => (
                  <span key={k} className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center text-slate-600 text-xs font-bold uppercase tracking-widest">
            &copy; {new Date().getFullYear()} Xemora AI Ecosystem. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
