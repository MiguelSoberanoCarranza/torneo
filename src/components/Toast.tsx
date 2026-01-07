import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);

        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
    };

    const icons = {
        success: 'check_circle',
        error: 'error',
        info: 'info',
    };

    return (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl shadow-black/10 text-white ${bgColors[type]} animate-in slide-in-from-top-2 fade-in duration-300 min-w-[300px] max-w-[90vw]`}>
            <span className="material-symbols-outlined text-xl bg-white/20 p-1 rounded-full">{icons[type]}</span>
            <p className="font-medium text-sm flex-1">{message}</p>
            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    );
};

export default Toast;
