// src/components/ui/Toast.tsx
import  {  useState, type ReactNode } from 'react';
import { CheckCircle, XCircle, X, Info } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContext, type ToastType } from './toastContext';

interface ToastItem extends ToastType {
  id: string;
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const addToast = (toast: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, ...toast }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const showSuccess = (title: string, message: string) => addToast({ type: 'success', title, message });
  const showError = (title: string, message: string) => addToast({ type: 'error', title, message });
  const showInfo = (title: string, message: string) => addToast({ type: 'info', title, message });

  return (
    <ToastContext.Provider value={{ addToast, showSuccess, showError, showInfo }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8, transition: { duration: 0.2 } }}
              className={`flex items-start p-4 rounded-xl shadow-2xl border pointer-events-auto ${
                toast.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : toast.type === 'error'
                  ? 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                  : 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
              }`}
            >
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : toast.type === 'error' ? (
                  <XCircle className="w-6 h-6 text-red-500" />
                ) : (
                  <Info className="w-6 h-6 text-blue-500" />
                )}
              </div>
              <div className="ml-3 flex-1">
                <p className="font-bold">{toast.title}</p>
                <p className="text-sm mt-1">{toast.message}</p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className={`ml-4 p-1 rounded-full ${
                  toast.type === 'success'
                    ? 'hover:bg-emerald-100 dark:hover:bg-emerald-800'
                    : toast.type === 'error'
                    ? 'hover:bg-red-100 dark:hover:bg-red-800'
                    : 'hover:bg-blue-100 dark:hover:bg-blue-800'
                }`}
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};