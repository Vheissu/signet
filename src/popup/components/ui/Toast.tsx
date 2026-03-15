import { useStore } from '@/popup/store';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);
  const removeToast = useStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-2 left-2 right-2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border backdrop-blur-md toast-enter
            ${toast.type === 'success' ? 'bg-success/10 border-success/20 text-success' : ''}
            ${toast.type === 'error' ? 'bg-error/10 border-error/20 text-error' : ''}
            ${toast.type === 'info' ? 'bg-info/10 border-info/20 text-info' : ''}
          `}
        >
          {toast.type === 'success' && <CheckCircle size={16} className="flex-shrink-0" />}
          {toast.type === 'error' && <XCircle size={16} className="flex-shrink-0" />}
          {toast.type === 'info' && <Info size={16} className="flex-shrink-0" />}
          <span className="text-xs font-medium flex-1 text-text-primary">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
