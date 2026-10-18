import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastType = 'success' | 'error';
type Toast = { id: number; message: string; type: ToastType };
type ToastContextValue = { toast: (message: string, type?: ToastType) => void };

let nextToastId = 0;
export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextToastId;
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4200);
  }, []);

  useEffect(() => {
    const handleOffline = () => toast('You appear to be offline. Changes may not save until you reconnect.', 'error');
    const handleOnline = () => toast('Connection restored.', 'success');
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [toast]);

  const value = useMemo(() => ({ toast }), [toast]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {toasts.map((item) => <div className={cn('toast', item.type === 'error' && 'toast-error')} key={item.id} role={item.type === 'error' ? 'alert' : 'status'}>
        {item.type === 'success' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        <span>{item.message}</span>
        <button onClick={() => setToasts((current) => current.filter((toastItem) => toastItem.id !== item.id))} aria-label="Dismiss notification"><X size={15} /></button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}

export function useOptionalToast() {
  return useContext(ToastContext);
}
