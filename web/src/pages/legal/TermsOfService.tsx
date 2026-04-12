
import { Scale, Info, CheckCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfService = () => {
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
            <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center border border-purple-500/20">
              <Scale className="text-purple-400" size={24} />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Terms of Service</h1>
          </div>
          <p className="text-slate-500 text-lg">Last updated: April 12, 2026</p>
        </header>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="text-blue-500" size={20} /> 1. Acceptance of Terms
            </h2>
            <p className="leading-relaxed">
              By accessing or using Xemora, you agree to be bound by these Terms of Service. If you do not agree, you must immediately cease all use of the platform and our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="text-emerald-500" size={20} /> 2. Account Security
            </h2>
            <p className="leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials, including AI-generated passwords and biometric identifiers. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} /> 3. Prohibited Conduct
            </h2>
            <p className="leading-relaxed">
              You may not use Xemora to generate illegal content, engage in harassment, or attempt to reverse-engineer our proprietary biometric or AI systems. Violation of these terms will result in immediate termination of access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <Scale className="text-fuchsia-500" size={20} /> 4. AI Limitations
            </h2>
            <p className="leading-relaxed">
              Xemora provides AI-generated content for informational and creative purposes. While we strive for accuracy, our AI models (Blaze) may occasionally provide incorrect information. You acknowledge that you use AI insights at your own risk.
            </p>
          </section>

          <section className="pt-8 border-t border-slate-800">
            <h2 className="text-xl font-semibold text-white mb-2">Legal Jurisdiction</h2>
            <p>These terms are governed by the laws of your primary service region. For concerns, contact legal@xemora.ai.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
