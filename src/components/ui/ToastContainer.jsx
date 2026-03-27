import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  // Check for duplicate IDs and warn in development
  const ids = toasts.map(t => t.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (process.env.NODE_ENV === 'development' && duplicates.length) {
    console.warn('Duplicate toast IDs detected:', duplicates);
  }

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-[9999] flex flex-col items-end pointer-events-none p-4 w-full">
      <div className="flex flex-col gap-3 w-full max-w-sm items-end">
        {toasts.map((toast, idx) => {
          // Use a guaranteed unique key: combine id with index (fallback)
          const uniqueKey = `${toast.id}_${idx}`;
          return (
            <div
              key={uniqueKey}
              className={`
                pointer-events-auto flex items-start sm:items-center gap-3.5 px-5 py-4 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] border w-full transform transition-all duration-300 ease-out animate-in fade-in slide-in-from-right-8 zoom-in-95
                ${toast.type === 'success' ? 'bg-white border-green-100 shadow-primary/10' : ''}
                ${toast.type === 'error' ? 'bg-white border-red-100 shadow-red-500/10' : ''}
                ${toast.type === 'info' ? 'bg-white border-blue-100 shadow-blue-500/10' : ''}
              `}
              role="alert"
            >
              {/* Icon */}
              <div className={`flex-shrink-0 mt-0.5 sm:mt-0 p-2 rounded-lg ${toast.type === 'success' ? 'bg-primary/10 text-primary' : toast.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                {toast.type === 'success' && <CheckCircle className="w-5 h-5 stroke-[2.5]" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 stroke-[2.5]" />}
                {toast.type === 'info' && <Info className="w-5 h-5 stroke-[2.5]" />}
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0 mr-2">
                <p className={`text-[13px] font-bold leading-relaxed ${toast.type === 'error' ? 'text-red-900' : 'text-gray-800'}`}>
                  {toast.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(toast.id)}
                className={`flex-shrink-0 mt-1 sm:mt-0 p-1.5 transition-colors rounded-lg ${toast.type === 'error' ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToastContainer;