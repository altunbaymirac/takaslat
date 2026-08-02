import { useEffect, useState } from 'react';

interface ToastState {
  message: string;
  type:    'success' | 'error' | 'info';
}

// ─── Tek instance toast — global state ────────────────────────────────────────

let setter: ((t: ToastState | null) => void) | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string, type: ToastState['type'] = 'success') {
  setter?.({ message, type });
  setTimeout(() => setter?.(null), 2400);
}

export default function Toast() {
  const [toast, setToast]     = useState<ToastState | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setter = (t) => {
      if (t) {
        setLeaving(false);
        setToast(t);
      } else {
        setLeaving(true);
        setTimeout(() => setToast(null), 200);
      }
    };
    return () => { setter = null; };
  }, []);

  if (!toast) return null;

  const color =
    toast.type === 'success' ? 'bg-blue-700 text-white' :
    toast.type === 'error'   ? 'bg-red-600 text-white'     :
    'bg-slate-800 text-white';

  return (
    <div
      className={`fixed bottom-4 sm:bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-md sm:w-auto -translate-x-1/2 ${color} px-5 py-3 rounded-lg shadow-xl z-[100] flex items-center justify-center transition-all duration-200 ease-out ${
        leaving ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0 toast-enter'
      }`}
    >
      <span className="text-center text-sm font-medium break-words">{toast.message}</span>
    </div>
  );
}
