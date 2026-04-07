// src/components/ui/Toast.tsx
import { useState, type ReactNode } from 'react';
import { CheckCircle, XCircle, X, Info, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContext, type ToastType } from './toastContext';

interface ToastItem extends ToastType {
  id: string;
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const addToast = (toast: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      removeToast(id);
    }, 6000); // 6 seconds for better readability
  };

  const showSuccess = (title: string, message: string) =>
    addToast({ type: "success", title, message });
  const showError = (title: string, message: string) =>
    addToast({ type: "error", title, message });
  const showInfo = (title: string, message: string) =>
    addToast({ type: "info", title, message });
  const showWarning = (title: string, message: string) =>
    addToast({ type: "warning", title, message });

  return (
    <ToastContext.Provider value={{ addToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm space-y-4 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 100, scale: 0.9, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              className={`relative overflow-hidden flex items-start p-5 rounded-2xl shadow-2xl border backdrop-blur-xl pointer-events-auto group ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : toast.type === "error"
                  ? "bg-red-500/10 border-red-500/20"
                  : toast.type === "warning"
                  ? "bg-amber-500/10 border-amber-500/20"
                  : "bg-blue-500/10 border-blue-500/20"
              }`}
            >
              {/* Glow effect */}
              <div className={`absolute -inset-1 opacity-20 blur-2xl transition duration-1000 group-hover:duration-200 ${
                toast.type === "success"
                  ? "bg-emerald-500"
                  : toast.type === "error"
                  ? "bg-red-500"
                  : toast.type === "warning"
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`} />

              <div className="flex-shrink-0 relative z-10">
                {toast.type === "success" ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                ) : toast.type === "error" ? (
                  <XCircle className="w-6 h-6 text-red-400" />
                ) : toast.type === "warning" ? (
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                ) : (
                  <Info className="w-6 h-6 text-blue-400" />
                )}
              </div>
              
              <div className="ml-4 flex-1 relative z-10">
                <p className="font-black text-[10px] uppercase tracking-widest text-white/50 mb-1">
                  {toast.type === 'success' ? 'Operation Success' : toast.type === 'error' ? 'Critical Alert' : toast.type === 'warning' ? 'Attention Required' : 'System Intel'}
                </p>
                <p className="font-bold text-white text-sm leading-tight italic tracking-tight uppercase">
                  {toast.title}
                </p>
                <p className="text-slate-300 text-xs mt-1 font-medium italic opacity-80 leading-relaxed capitalize">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="ml-4 p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all text-white/40 hover:text-white border border-white/10 relative z-10"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Progress bar for auto-dismiss */}
              <motion.div 
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6, ease: 'linear' }}
                className={`absolute bottom-0 left-0 h-0.5 opacity-30 ${
                  toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-red-500" : toast.type === "warning" ? "bg-amber-500" : "bg-blue-500"
                }`}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};