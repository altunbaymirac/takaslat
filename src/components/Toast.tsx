import { useEffect, useState } from 'react';

interface ToastState {
  message: string;
  type:    'success' | 'error' | 'info';
}

// ─── Tek instance toast — global state ────────────────────────────────────────

let setter: ((t: ToastState | null) => void) | null = null;

export function showToast(message: string, type: ToastState['type'] = 'success') {
  setter?.({ message, type });
  setTimeout(() => setter?.(null), 2400);
}

export default function Toast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    setter = setToast;
    return () => { setter = null; };
  }, []);

  if (!toast) return null;

  const color =
    toast.type === 'success' ? 'bg-emerald-600 text-white' :
    toast.type === 'error'   ? 'bg-red-600 text-white'     :
    'bg-slate-800 text-white';

  const icon =
    toast.type === 'success' ? '✓' :
    toast.type === 'error'   ? '✕' :
    'ℹ';

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${color} px-5 py-3 rounded-2xl shadow-2xl z-[100] flex items-center gap-2.5 toast-enter`}>
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}
