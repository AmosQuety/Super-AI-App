// src/components/ui/Toast.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContext } from './toastContext';

interface Toast {
  id: string;
  type: 'success' | 'error';
  title: string;
  message: string;
}



export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const addToast = (type: 'success' | 'error', title: string, message: string) => {
    const id = Math.random().toString(36);
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const showSuccess = (title: string, message: string) => addToast('success', title, message);
  const showError = (title: string, message: string) => addToast('error', title, message);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-full max-w-sm space-y-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8, transition: { duration: 0.2 } }}
              className={`flex items-start p-4 rounded-xl shadow-2xl border ${
                toast.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              }`}
            >
              <div className="flex-shrink-0">
                {toast.type === 'success' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-500" />
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
                    : 'hover:bg-red-100 dark:hover:bg-red-800'
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

