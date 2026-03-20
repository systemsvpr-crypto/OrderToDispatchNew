import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContainer = () => {
    const { toasts, removeToast } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-4">
            <div className="flex flex-col gap-3 w-full max-w-sm">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-300 ease-in-out animate-in fade-in zoom-in slide-in-from-bottom-4
                            ${toast.type === 'success' ? 'bg-white border-l-4 border-primary' : ''}
                            ${toast.type === 'error' ? 'bg-white border-l-4 border-red-500' : ''}
                            ${toast.type === 'info' ? 'bg-white border-l-4 border-primary' : ''}
                        `}
                        role="alert"
                    >
                        {/* Icon */}
                        <div className="flex-shrink-0">
                            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-primary" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {toast.type === 'info' && <Info className="w-5 h-5 text-primary" />}
                        </div>

                        {/* Message */}
                        <div className="flex-1 mr-2">
                            <p className="text-sm font-medium text-gray-800">
                                {toast.message}
                            </p>
                        </div>

                        {/* Close Button */}
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ToastContainer;
