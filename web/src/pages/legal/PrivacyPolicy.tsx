import { Shield, Eye, Database, Globe, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 py-12 px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>Back</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Eye className="text-blue-400" size={24} />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-slate-500 text-lg">Last updated: April 12, 2026</p>
        </header>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="text-blue-500" size={20} /> 1. Data Collection
            </h2>
            <p className="leading-relaxed">
              At Xemora, we collect information necessary to provide you with a personalized AI experience. This includes your name, email address, and account preferences. We also collect metadata about your interactions with our AI models to improve response quality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <ScanFace className="text-purple-500" size={20} /> 2. Biometric Data
            </h2>
            <p className="leading-relaxed">
              Your biometric data (Face ID and Voice Identity) is handled with the highest level of security. We do not store raw images or audio of your face or voice. Instead, we generate secure, encrypted mathematical embeddings that are used solely for authentication purposes. These embeddings are stored in isolated, encrypted databases.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="text-emerald-500" size={20} /> 3. AI Processing & Documents
            </h2>
            <p className="leading-relaxed">
              Documents you upload for analysis are processed via our RAG (Retrieval-Augmented Generation) pipeline. These documents are indexed locally or in our secure cloud infrastructure. Your documents are never used to train public AI models. Access is strictly limited to your own user session.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="text-amber-500" size={20} /> 4. Third-Party Services
            </h2>
            <p className="leading-relaxed">
              We utilize trusted infrastructure providers including Supabase for database management, Upstash for high-speed caching, and Cloudinary for secure asset storage. All providers are GDPR and SOC2 compliant.
            </p>
          </section>

          <section className="pt-8 border-t border-slate-800">
            <h2 className="text-xl font-semibold text-white mb-2">Contact Us</h2>
            <p>If you have questions about this policy, contact our privacy team at privacy@xemora.ai.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

// Internal icon for the section
const ScanFace = ({ className, size }: { className?: string, size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size || 24} 
    height={size || 24} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01" /><path d="M15 9h.01" />
  </svg>
);

export default PrivacyPolicy;
